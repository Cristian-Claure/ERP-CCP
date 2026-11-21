<?php

namespace Tests\Support;

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Actions\VoidInventoryDocument;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\Unit;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Database\Seeders\RolesAndPermissionsSeeder;

/**
 * Fluent fixture to drive the inventory engine through its real Actions.
 */
final class InventoryScenario
{
    public Company $company;

    public User $user;

    public Warehouse $warehouse;

    public Warehouse $branch;

    public Product $product;

    public static function make(array $companyAttributes = []): self
    {
        $s = new self;
        (new RolesAndPermissionsSeeder)->run();
        $s->company = Company::factory()->create($companyAttributes);
        $s->user = User::factory()->for($s->company)->create();
        CompanyContext::run($s->company->id, fn () => $s->user->assignRole('admin'));

        $s->warehouse = Warehouse::factory()->create(['company_id' => $s->company->id, 'code' => 'CEN', 'name' => 'Central']);
        $s->branch = Warehouse::factory()->create(['company_id' => $s->company->id, 'code' => 'SUC', 'name' => 'Sucursal']);
        $unit = Unit::factory()->create(['company_id' => $s->company->id, 'code' => 'UND', 'allows_decimals' => false]);
        $s->product = Product::factory()->create(['company_id' => $s->company->id, 'unit_id' => $unit->id, 'name' => 'Arroz', 'sku' => 'ARR-1']);

        return $s;
    }

    /** Runs $callback as the scenario's company (tenant scope + permissions team). */
    public function as(callable $callback): mixed
    {
        return CompanyContext::run($this->company->id, fn () => $callback($this));
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     */
    public function draft(string $type, array $lines, array $header = []): InventoryDocument
    {
        return $this->as(fn () => app(SaveInventoryDocumentDraft::class)->handle(DocumentData::fromArray([
            'type' => $type,
            'warehouse_id' => $this->warehouse->id,
            'document_date' => now($this->company->timezone)->toDateString(),
            'lines' => $lines,
            ...$header,
        ]), $this->user));
    }

    public function post(InventoryDocument $document): InventoryDocument
    {
        return $this->as(fn () => app(PostInventoryDocument::class)->handle($document, $this->user));
    }

    public function void(InventoryDocument $document, string $reason = 'Error de digitación'): InventoryDocument
    {
        return $this->as(fn () => app(VoidInventoryDocument::class)->handle($document, $this->user, $reason));
    }

    public function entry(string $quantity, string $unitCost, ?Warehouse $warehouse = null, ?Product $product = null): InventoryDocument
    {
        return $this->post($this->draft('entry', [[
            'product_id' => ($product ?? $this->product)->id, 'quantity' => $quantity, 'unit_cost' => $unitCost,
        ]], ['warehouse_id' => ($warehouse ?? $this->warehouse)->id]));
    }

    public function exit(string $quantity, ?Warehouse $warehouse = null, ?Product $product = null): InventoryDocument
    {
        return $this->post($this->draft('exit', [[
            'product_id' => ($product ?? $this->product)->id, 'quantity' => $quantity,
        ]], ['warehouse_id' => ($warehouse ?? $this->warehouse)->id]));
    }

    public function balance(?Warehouse $warehouse = null, ?Product $product = null): ?StockBalance
    {
        return StockBalance::query()->withoutGlobalScopes()
            ->where('product_id', ($product ?? $this->product)->id)
            ->where('warehouse_id', ($warehouse ?? $this->warehouse)->id)
            ->first();
    }

    /**
     * @return array{0: string, 1: string, 2: string} [quantity, avg_cost, total_value]
     */
    public function state(?Warehouse $warehouse = null, ?Product $product = null): array
    {
        $b = $this->balance($warehouse, $product);

        return [$b?->quantity ?? '0.0000', $b?->avg_cost ?? '0.0000', $b?->total_value ?? '0.0000'];
    }
}
