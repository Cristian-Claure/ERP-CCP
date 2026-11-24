<?php

namespace App\Console\Commands;

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\ProductCategory;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\Unit;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\RunsInCompanyContext;
use Illuminate\Console\Attributes\AsCommand;
use Illuminate\Console\Command;

/**
 * Idempotent fixtures for the Playwright suite (never available in production):
 * dedicated E2E products with known cost and enough stock in the Central warehouse,
 * and an invoicing E2E supplier (30-day terms) for the purchases flow.
 * Stock is topped up through the real inventory engine (ENT-), never edited.
 */
#[AsCommand(name: 'e2e:prepare')]
class PrepareE2e extends Command
{
    use RunsInCompanyContext;

    /** [sku, name, barcode, unit cost, sale price] */
    public const PRODUCTS = [
        ['E2E-001', 'Producto E2E costo 10', '7790000000011', '10.0000', '15.00'],
        ['E2E-002', 'Producto E2E costo 4', '7790000000028', '4.0000', '6.50'],
        ['E2E-003', 'Producto E2E costo 2', '7790000000035', '2.0000', '3.20'],
    ];

    private const MIN_STOCK = 200;

    protected $signature = 'e2e:prepare';

    protected $description = 'Create or top up the fixtures used by the end-to-end test suite';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->components->error('e2e:prepare solo está disponible en local/testing.');

            return self::FAILURE;
        }

        $company = Company::query()->where('tax_id', '1020304050')->firstOrFail();
        $actor = User::query()->withoutGlobalScopes()->where('email', 'admin@ccp.test')->firstOrFail();

        $this->inCompany($company, function (Company $company) use ($actor) {
            $warehouse = Warehouse::query()->where('code', 'CEN')->firstOrFail();
            $unit = Unit::query()->where('code', 'UND')->firstOrFail();
            $category = ProductCategory::query()->firstOrCreate(['name' => 'Pruebas E2E'], ['is_active' => true]);
            Supplier::query()->updateOrCreate(['tax_id' => 'E2E-PROV-1'], [
                'name' => 'Proveedor E2E SRL', 'country' => 'BO', 'city' => 'Santa Cruz de la Sierra',
                'latitude' => '-17.770000', 'longitude' => '-63.160000', 'payment_terms_days' => 30,
                'lead_time_days' => 2, 'issues_invoice' => true, 'is_active' => true,
            ]);

            $lines = [];
            foreach (self::PRODUCTS as [$sku, $name, $barcode, $cost, $price]) {
                $product = Product::query()->updateOrCreate(['sku' => $sku], [
                    'name' => $name, 'category_id' => $category->id, 'unit_id' => $unit->id, 'barcode' => $barcode,
                    'sale_price' => $price, 'min_price' => null, 'min_stock' => '0', 'is_active' => true,
                ]);
                $onHand = (float) (StockBalance::query()
                    ->where(['warehouse_id' => $warehouse->id, 'product_id' => $product->id])
                    ->value('quantity') ?? 0);
                if ($onHand < self::MIN_STOCK) {
                    $lines[] = ['product_id' => $product->id, 'quantity' => (string) (self::MIN_STOCK * 2), 'unit_cost' => $cost];
                }
            }

            if ($lines !== []) {
                $draft = app(SaveInventoryDocumentDraft::class)->handle(DocumentData::fromArray([
                    'type' => 'entry', 'warehouse_id' => $warehouse->id, 'document_date' => now($company->timezone)->toDateString(),
                    'reference' => 'E2E', 'notes' => 'Fixture de pruebas E2E', 'lines' => $lines,
                ]), $actor);
                app(PostInventoryDocument::class)->handle($draft, $actor);
            }
        });

        $this->components->info('Fixtures E2E listos.');

        return self::SUCCESS;
    }
}
