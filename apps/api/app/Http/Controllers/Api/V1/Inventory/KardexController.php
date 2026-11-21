<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Inventory\Queries\StockQueries;
use App\Domain\Shared\Support\Decimal;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Resources\Inventory\KardexEntryResource;
use BcMath\Number;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Kardex per product AND warehouse (average cost is per warehouse, so a
 * consolidated running cost would be meaningless).
 */
class KardexController extends Controller
{
    use PaginatesRequests;

    public function __construct(private readonly StockQueries $queries) {}

    public function index(Request $request, Product $product): AnonymousResourceCollection
    {
        Gate::authorize('view', $product);
        [$warehouse, $from, $to] = $this->range($request);

        $page = $this->queries->kardex($product, $warehouse->id, $from, $to)
            ->paginate($this->perPage($request, 50, 200))
            ->withQueryString();

        return KardexEntryResource::collection($page)->additional(['meta' => [
            'warehouse' => ['id' => $warehouse->id, 'name' => $warehouse->name],
            'from' => $from->toDateString(),
            'to' => $to->subDay()->toDateString(),
            'opening' => $this->queries->openingBalance($product, $warehouse->id, $from),
        ]]);
    }

    /** CSV (UTF-8 with BOM, ";" separator, decimal comma) — opens cleanly in Excel es-BO. */
    public function export(Request $request, Product $product): StreamedResponse
    {
        Gate::authorize('view', $product);
        [$warehouse, $from, $to] = $this->range($request);
        $opening = $this->queries->openingBalance($product, $warehouse->id, $from);
        $query = $this->queries->kardex($product, $warehouse->id, $from, $to);
        $tz = $request->user()->company->timezone;

        $filename = sprintf('kardex_%s_%s_%s_%s.csv', $product->sku, $warehouse->code, $from->format('Ymd'), $to->subDay()->format('Ymd'));

        return response()->streamDownload(function () use ($query, $opening, $product, $warehouse, $tz) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $row = fn (array $cells) => fputcsv($out, $cells, ';', '"', '');
            $num = fn (?string $v, int $decimals = 4) => $v === null ? '' : str_replace('.', ',', (string) (new Number($v))->round($decimals));

            $row(["Kardex: {$product->sku} — {$product->name}", "Almacén: {$warehouse->name}"]);
            $row(['Fecha confirmación', 'Fecha documento', 'Documento', 'Tipo', 'Movimiento', 'Entrada', 'Salida', 'Costo unitario', 'Costo total', 'Saldo cantidad', 'Costo promedio', 'Saldo valorizado']);
            $row(['', '', '', '', 'Saldo inicial', '', '', '', '', $num($opening['quantity']), $num($opening['avg_cost']), $num($opening['value'], 2)]);

            $query->chunkById(500, function ($movements) use ($row, $num, $tz) {
                /** @var StockMovement $m */
                foreach ($movements as $m) {
                    $qty = new Number($m->quantity);
                    $row([
                        $m->occurred_at->setTimezone($tz)->format('d/m/Y H:i'),
                        $m->document_date->format('d/m/Y'),
                        $m->document?->number,
                        $m->document?->type->label(),
                        ($m->isReversal() ? 'Anulación · ' : '').$m->kind->label(),
                        $qty > 0 ? $num((string) $qty) : '',
                        $qty < 0 ? $num((string) Decimal::abs($qty)) : '',
                        $num($m->unit_cost),
                        $num((string) Decimal::abs(new Number($m->total_cost)), 2),
                        $num($m->quantity_after),
                        $num($m->avg_cost_after),
                        $num($m->value_after, 2),
                    ]);
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array{0: Warehouse, 1: CarbonImmutable, 2: CarbonImmutable} [warehouse, from (inclusive), to (exclusive)]
     */
    private function range(Request $request): array
    {
        $request->validate([
            'warehouse_id' => ['required', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ], ['warehouse_id.required' => 'Selecciona un almacén para ver el kardex.']);

        $warehouse = Warehouse::query()->findOrFail($request->integer('warehouse_id'));
        $tz = $request->user()->company->timezone;

        $to = $request->filled('to')
            ? CarbonImmutable::parse($request->string('to'), $tz)->addDay()->startOfDay()
            : CarbonImmutable::now($tz)->addDay()->startOfDay();
        $from = $request->filled('from')
            ? CarbonImmutable::parse($request->string('from'), $tz)->startOfDay()
            : $to->subDays(91);

        return [$warehouse, $from, $to];
    }
}
