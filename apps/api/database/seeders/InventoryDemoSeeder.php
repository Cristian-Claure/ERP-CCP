<?php

namespace Database\Seeders;

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Actions\VoidInventoryDocument;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\ProductCategory;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\Unit;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\RunsInCompanyContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Realistic ~90 days of inventory history for a Santa Cruz trading company.
 *
 * Every document goes through the REAL engine (SaveDraft -> Post / Void)
 * with a simulated clock, so balances, average costs, numbering and audit
 * logs are exactly what production would produce. Deterministic (fixed seed).
 */
class InventoryDemoSeeder extends Seeder
{
    use RunsInCompanyContext;

    private const DAYS = 90;

    private const SEED = 20261122;

    /** [sku, name, category, unit, base cost (BOB), min stock, daily demand] */
    private const PRODUCTS = [
        ['ABA-001', 'Arroz grano largo', 'Abarrotes', 'KG', 7.80, 150, 28],
        ['ABA-002', 'Azúcar blanca', 'Abarrotes', 'KG', 6.20, 120, 22],
        ['ABA-003', 'Harina de trigo 0000', 'Abarrotes', 'KG', 5.40, 80, 12],
        ['ABA-004', 'Aceite vegetal a granel', 'Abarrotes', 'LT', 12.50, 60, 9],
        ['ABA-005', 'Fideo spaghetti 400 g', 'Abarrotes', 'UND', 4.30, 90, 18],
        ['ABA-006', 'Sal yodada 1 kg', 'Abarrotes', 'UND', 2.60, 40, 6],
        ['ABA-007', 'Café molido 250 g', 'Abarrotes', 'UND', 19.50, 25, 4],
        ['ABA-008', 'Leche evaporada 400 g', 'Abarrotes', 'UND', 7.40, 120, 20],
        ['ABA-009', 'Atún en aceite 170 g', 'Abarrotes', 'UND', 10.20, 60, 9],
        ['ABA-010', 'Avena en hojuelas 500 g', 'Abarrotes', 'UND', 8.90, 40, 6],
        ['BEB-001', 'Gaseosa cola 2 L', 'Bebidas', 'UND', 9.80, 96, 24],
        ['BEB-002', 'Agua sin gas 2 L', 'Bebidas', 'UND', 5.20, 72, 18],
        ['BEB-003', 'Cerveza rubia 620 ml', 'Bebidas', 'UND', 11.50, 120, 30],
        ['BEB-004', 'Jugo de durazno 1 L', 'Bebidas', 'UND', 8.40, 48, 8],
        ['BEB-005', 'Bebida energizante 473 ml', 'Bebidas', 'UND', 9.00, 36, 6],
        ['BEB-006', 'Té en sobres x25', 'Bebidas', 'UND', 6.80, 20, 3],
        ['LIM-001', 'Detergente en polvo 1 kg', 'Limpieza', 'UND', 16.50, 40, 7],
        ['LIM-002', 'Lavandina a granel', 'Limpieza', 'LT', 4.80, 50, 8],
        ['LIM-003', 'Jabón de lavar en barra', 'Limpieza', 'UND', 3.90, 60, 10],
        ['LIM-004', 'Desinfectante aroma pino 1 L', 'Limpieza', 'UND', 11.20, 24, 4],
        ['LIM-005', 'Papel higiénico x4', 'Limpieza', 'UND', 12.90, 48, 9],
        ['LIM-006', 'Esponja multiuso x3', 'Limpieza', 'UND', 7.50, 20, 3],
        ['CPE-001', 'Shampoo 400 ml', 'Cuidado personal', 'UND', 22.00, 18, 3],
        ['CPE-002', 'Pasta dental 90 g', 'Cuidado personal', 'UND', 9.60, 36, 6],
        ['CPE-003', 'Jabón de tocador 125 g', 'Cuidado personal', 'UND', 4.70, 48, 8],
        ['CPE-004', 'Desodorante en barra', 'Cuidado personal', 'UND', 18.50, 15, 2],
        ['CPE-005', 'Pañales talla M x30', 'Cuidado personal', 'PAQ', 68.00, 12, 2],
        ['FER-001', 'Clavos de 2"', 'Ferretería', 'KG', 14.00, 25, 3],
        ['FER-002', 'Alambre de amarre', 'Ferretería', 'KG', 16.50, 20, 2],
        ['FER-003', 'Manguera de jardín 1/2"', 'Ferretería', 'M', 6.80, 50, 6],
        ['FER-004', 'Pintura látex blanca', 'Ferretería', 'LT', 32.00, 40, 5],
        ['FER-005', 'Thinner', 'Ferretería', 'LT', 18.00, 20, 3],
        ['FER-006', 'Cinta aislante 20 m', 'Ferretería', 'UND', 6.50, 30, 4],
        ['FER-007', 'Silicona transparente 280 ml', 'Ferretería', 'UND', 24.00, 12, 2],
        ['ELE-001', 'Cable THW 12 AWG', 'Eléctricos', 'M', 4.60, 300, 45],
        ['ELE-002', 'Cable mellizo 2x14', 'Eléctricos', 'M', 3.80, 200, 30],
        ['ELE-003', 'Foco LED 9 W', 'Eléctricos', 'UND', 12.00, 60, 8],
        ['ELE-004', 'Tomacorriente doble', 'Eléctricos', 'UND', 15.50, 20, 3],
        ['ELE-005', 'Interruptor simple', 'Eléctricos', 'UND', 11.00, 20, 3],
        ['ELE-006', 'Extensión 5 m', 'Eléctricos', 'UND', 35.00, 10, 1],
    ];

    /** Products whose purchases stop near the end, so they finish below minimum. */
    private const STOCKOUT_SKUS = ['BEB-001', 'ABA-008', 'LIM-005', 'ELE-003', 'CPE-002'];

    private const UNITS = [
        ['UND', 'Unidad', false], ['PAQ', 'Paquete', false], ['CJ', 'Caja', false],
        ['KG', 'Kilogramo', true], ['LT', 'Litro', true], ['M', 'Metro', true],
    ];

    /** Share of the daily demand served by each warehouse. */
    private const WAREHOUSES = [
        ['CEN', 'Central Santa Cruz', '4to anillo, Av. Banzer, Santa Cruz de la Sierra', 0.25],
        ['EQP', 'Sucursal Equipetrol', 'Calle 9 Oeste, Equipetrol, Santa Cruz de la Sierra', 0.35],
        ['P3M', 'Sucursal Plan 3000', 'Av. Paurito, Plan 3000, Santa Cruz de la Sierra', 0.40],
    ];

    private string $timezone = 'America/La_Paz';

    private User $admin;

    private User $storekeeper;

    /** @var array<int, array<int, float>> warehouse_id => product_id => planned stock */
    private array $stock = [];

    /** @var array<string, Product> */
    private array $products = [];

    /** @var array<string, array{min: float, demand: float, cost: float, fractional: bool}> */
    private array $meta = [];

    /** @var list<Warehouse> */
    private array $warehouses = [];

    public function run(): void
    {
        $company = Company::query()->where('tax_id', '1020304050')->firstOrFail();
        $this->admin = User::query()->withoutGlobalScopes()->where('email', DemoCompanySeeder::ADMIN_EMAIL)->firstOrFail();
        $this->storekeeper = User::query()->withoutGlobalScopes()->where('email', 'almacenero@ccp.test')->firstOrFail();

        $this->inCompany($company, function (Company $company) {
            $this->timezone = $company->timezone;
            mt_srand(self::SEED);
            $this->catalog();

            $start = CarbonImmutable::now($company->timezone)->startOfDay()->subDays(self::DAYS);
            try {
                $this->simulate($start);
            } finally {
                Carbon::setTestNow();
                CarbonImmutable::setTestNow();
            }

            $this->pendingDrafts(CarbonImmutable::now($company->timezone));
        });
    }

    private function catalog(): void
    {
        $units = [];
        foreach (self::UNITS as [$code, $name, $decimals]) {
            $units[$code] = Unit::query()->updateOrCreate(['code' => $code], ['name' => $name, 'allows_decimals' => $decimals]);
        }

        foreach (self::WAREHOUSES as [$code, $name, $address]) {
            $this->warehouses[] = Warehouse::query()->updateOrCreate(['code' => $code], ['name' => $name, 'address' => $address, 'is_active' => true]);
        }

        $categories = [];
        foreach (self::PRODUCTS as [$sku, $name, $category, $unit, $cost, $min, $demand]) {
            $categories[$category] ??= ProductCategory::query()->updateOrCreate(['name' => $category], ['is_active' => true]);

            $this->products[$sku] = Product::query()->updateOrCreate(['sku' => $sku], [
                'name' => $name,
                'category_id' => $categories[$category]->id,
                'unit_id' => $units[$unit]->id,
                'barcode' => '777'.str_pad((string) crc32($sku) % 10_000_000_000, 10, '0', STR_PAD_LEFT),
                'min_stock' => (string) $min,
                'is_active' => true,
            ]);
            $this->meta[$sku] = ['min' => $min, 'demand' => $demand, 'cost' => $cost, 'fractional' => $units[$unit]->allows_decimals];
        }

        foreach ($this->warehouses as $w) {
            foreach ($this->products as $p) {
                $this->stock[$w->id][$p->id] = 0.0;
            }
        }
    }

    private function simulate(CarbonImmutable $start): void
    {
        [$central, $equipetrol, $plan3000] = $this->warehouses;
        $exitsByDay = [];

        for ($day = 0; $day <= self::DAYS; $day++) {
            $date = $start->addDays($day);
            $clock = $date->setTime(8, 30);

            if ($day === 0) {
                $this->at($clock, fn () => $this->purchase($central, $day, initial: true));
                foreach ([$equipetrol, $plan3000] as $branch) {
                    $this->at($clock->addMinutes(40), fn () => $this->transfer($central, $branch, $day, initial: true));
                }

                continue;
            }

            if ($date->isMonday()) {
                $this->at($clock, fn () => $this->purchase($central, $day));
            }

            if ($date->isTuesday() || $date->isFriday()) {
                foreach ([$equipetrol, $plan3000] as $i => $branch) {
                    $this->at($clock->addHours(1)->addMinutes(15 * $i), fn () => $this->transfer($central, $branch, $day));
                }
            }

            foreach ($this->warehouses as $i => $warehouse) {
                $doc = $this->at($clock->setTime(19, 0)->addMinutes(10 * $i), fn () => $this->dailyExit($warehouse, $day, $date));
                if ($doc) {
                    $exitsByDay[$day][] = $doc;
                }
            }

            if ($day % 12 === 6) {
                $this->at($clock->setTime(20, 0), fn () => $this->countAdjustment($this->warehouses[$day % 3], $day));
            }

            // A few voids, as real users make mistakes.
            if (in_array($day, [21, 48, 77], true) && isset($exitsByDay[$day - 1][0])) {
                $this->at($clock->setTime(10, 5), fn () => $this->voidDoc($exitsByDay[$day - 1][0], 'Venta registrada dos veces por error de caja.'));
            }
        }
    }

    private function purchase(Warehouse $central, int $day, bool $initial = false): ?InventoryDocument
    {
        $lines = [];
        foreach ($this->products as $sku => $product) {
            $m = $this->meta[$sku];
            if (! $initial && in_array($sku, self::STOCKOUT_SKUS, true) && $day > self::DAYS - 24) {
                continue;
            }

            $network = array_sum(array_map(fn (Warehouse $w) => $this->stock[$w->id][$product->id], $this->warehouses));
            $target = $m['demand'] * ($initial ? 40 : 30);
            if (! $initial && $network >= $m['demand'] * 18) {
                continue;
            }

            $quantity = $this->qty(max($target - $network, $m['demand'] * 7), $m['fractional']);
            $drift = 1 + 0.0012 * $day + mt_rand(-300, 300) / 10_000;
            $lines[] = ['product_id' => $product->id, 'quantity' => $quantity, 'unit_cost' => number_format($m['cost'] * $drift, 4, '.', '')];
        }

        return $this->postDoc('entry', $central, $lines, [
            'reference' => sprintf('FAC-PROV-%05d', 1200 + $day),
            'notes' => $initial ? 'Inventario inicial' : 'Compra semanal a proveedores',
        ], $this->storekeeper);
    }

    private function transfer(Warehouse $from, Warehouse $to, int $day, bool $initial = false): ?InventoryDocument
    {
        $share = $this->share($to);
        $lines = [];
        foreach ($this->products as $sku => $product) {
            $m = $this->meta[$sku];
            $branchStock = $this->stock[$to->id][$product->id];
            if (! $initial && $branchStock >= $m['demand'] * $share * 6) {
                continue;
            }

            $wanted = $m['demand'] * $share * ($initial ? 14 : 9) - $branchStock;
            $available = $this->stock[$from->id][$product->id] - $m['demand'] * $this->share($from) * 3;
            $quantity = min($wanted, $available);
            if ($quantity < ($m['fractional'] ? 0.5 : 1)) {
                continue;
            }
            $lines[] = ['product_id' => $product->id, 'quantity' => $this->qty($quantity, $m['fractional'], floor: true)];
        }

        return $this->postDoc('transfer', $from, $lines, [
            'destination_warehouse_id' => $to->id,
            'reference' => sprintf('GUIA-%04d', 300 + $day * 2 + $to->id),
        ], $this->storekeeper);
    }

    private function dailyExit(Warehouse $warehouse, int $day, CarbonImmutable $date): ?InventoryDocument
    {
        $weekday = match ($date->dayOfWeekIso) { 5 => 1.15, 6 => 1.35, 7 => 0.65, default => 1.0 };
        $trend = 1 + 0.003 * $day;
        $share = $this->share($warehouse);
        $lines = [];

        foreach ($this->products as $sku => $product) {
            if (mt_rand(1, 100) > 72) {
                continue; // not every product sells every day
            }
            $m = $this->meta[$sku];
            $wanted = $m['demand'] * $share * $weekday * $trend * (mt_rand(60, 140) / 100) / 0.72;
            $quantity = min($wanted, $this->stock[$warehouse->id][$product->id]);
            if ($quantity < ($m['fractional'] ? 0.25 : 1)) {
                continue;
            }
            $lines[] = ['product_id' => $product->id, 'quantity' => $this->qty($quantity, $m['fractional'], floor: true)];
        }

        return $this->postDoc('exit', $warehouse, $lines, [
            'reference' => sprintf('VTA-%s-%s', $warehouse->code, $date->format('ymd')),
            'notes' => 'Ventas del día (consolidado de caja)',
        ], $this->admin);
    }

    private function countAdjustment(Warehouse $warehouse, int $day): ?InventoryDocument
    {
        $reasons = ['shrinkage', 'expiry', 'damage', 'entry_error'];
        $skus = array_keys($this->products);
        $lines = [];

        foreach ([$skus[$day % count($skus)], $skus[($day * 7) % count($skus)]] as $sku) {
            $product = $this->products[$sku];
            $system = $this->stock[$warehouse->id][$product->id];
            if ($system < 3) {
                continue;
            }
            $counted = max(0, $system - max(1, round($system * mt_rand(1, 4) / 100)));
            $lines[$product->id] = ['product_id' => $product->id, 'counted_quantity' => $this->qty($counted, $this->meta[$sku]['fractional'], floor: true)];
        }

        return $this->postDoc('adjustment', $warehouse, array_values($lines), [
            'adjustment_reason' => $reasons[$day % 4],
            'notes' => 'Conteo cíclico programado',
        ], $this->storekeeper);
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     * @param  array<string, mixed>  $header
     */
    private function postDoc(string $type, Warehouse $warehouse, array $lines, array $header, User $actor): ?InventoryDocument
    {
        if ($lines === []) {
            return null;
        }

        $draft = app(SaveInventoryDocumentDraft::class)->handle(DocumentData::fromArray([
            'type' => $type,
            'warehouse_id' => $warehouse->id,
            'document_date' => now($this->timezone)->toDateString(),
            'lines' => $lines,
            ...$header,
        ]), $actor);

        try {
            $doc = app(PostInventoryDocument::class)->handle($draft, $actor);
        } catch (InsufficientStockException) {
            $draft->lines()->delete();
            $draft->delete();

            return null;
        }

        $this->syncStock();

        return $doc;
    }

    private function voidDoc(InventoryDocument $doc, string $reason): void
    {
        try {
            app(VoidInventoryDocument::class)->handle($doc, $this->admin, $reason);
        } catch (InsufficientStockException|VoidCostInconsistencyException) {
            return;
        }
        $this->syncStock();
    }

    /** Leaves two realistic drafts pending for the UI. */
    private function pendingDrafts(CarbonImmutable $today): void
    {
        [$central, $equipetrol] = $this->warehouses;
        $pick = fn (array $skus, callable $line) => array_map(fn (string $sku) => $line($this->products[$sku], $this->meta[$sku]), $skus);

        app(SaveInventoryDocumentDraft::class)->handle(DocumentData::fromArray([
            'type' => 'entry',
            'warehouse_id' => $central->id,
            'document_date' => $today->toDateString(),
            'reference' => 'FAC-PROV-09931',
            'notes' => 'Reposición urgente: productos bajo mínimo',
            'lines' => $pick(self::STOCKOUT_SKUS, fn (Product $p, array $m) => [
                'product_id' => $p->id, 'quantity' => $this->qty($m['demand'] * 25, $m['fractional']), 'unit_cost' => number_format($m['cost'] * 1.1, 4, '.', ''),
            ]),
        ]), $this->storekeeper);

        app(SaveInventoryDocumentDraft::class)->handle(DocumentData::fromArray([
            'type' => 'transfer',
            'warehouse_id' => $central->id,
            'destination_warehouse_id' => $equipetrol->id,
            'document_date' => $today->toDateString(),
            'lines' => $pick(['ABA-001', 'ABA-002', 'BEB-003'], fn (Product $p) => ['product_id' => $p->id, 'quantity' => '10']),
        ]), $this->storekeeper);
    }

    private function at(CarbonImmutable $moment, callable $callback): mixed
    {
        Carbon::setTestNow($moment);
        CarbonImmutable::setTestNow($moment);

        return $callback();
    }

    private function syncStock(): void
    {
        foreach (StockBalance::query()->get(['product_id', 'warehouse_id', 'quantity']) as $b) {
            $this->stock[$b->warehouse_id][$b->product_id] = (float) $b->quantity;
        }
    }

    private function share(Warehouse $warehouse): float
    {
        foreach (self::WAREHOUSES as [$code, , , $share]) {
            if ($code === $warehouse->code) {
                return $share;
            }
        }

        return 0.3;
    }

    private function qty(float $value, bool $fractional, bool $floor = false): string
    {
        if ($fractional) {
            $v = $floor ? floor($value * 4) / 4 : round($value * 4) / 4; // quarter units (0.25 kg/l/m)

            return number_format(max(0, $v), 2, '.', '');
        }

        return (string) max(0, (int) ($floor ? floor($value) : round($value)));
    }
}
