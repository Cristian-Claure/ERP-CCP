<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Purchases\Data\PurchaseOrderData;
use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Support\Facades\DB;

/**
 * Creates or replaces a DRAFT purchase order (lines and total). Approved
 * orders are immutable. Idempotent by key on creation.
 */
class SavePurchaseOrder
{
    public function __construct(private readonly DocumentDateWindow $dates) {}

    public function handle(PurchaseOrderData $data, User $actor, ?PurchaseOrder $order = null): PurchaseOrder
    {
        if ($order === null && $data->idempotencyKey !== null) {
            $existing = PurchaseOrder::query()->where('idempotency_key', $data->idempotencyKey)->first();
            if ($existing !== null) {
                return $existing->load('lines');
            }
        }

        $this->validate($data, $actor);

        return DB::transaction(function () use ($data, $actor, $order) {
            if ($order !== null) {
                $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);
                if ($order->status !== PurchaseOrderStatus::Draft) {
                    throw PurchaseException::state('Solo se editan órdenes en borrador.');
                }
            }

            $order ??= new PurchaseOrder(['created_by' => $actor->id, 'idempotency_key' => $data->idempotencyKey]);
            $order->fill([
                'supplier_id' => $data->supplierId,
                'warehouse_id' => $data->warehouseId,
                'order_date' => $data->orderDate->toDateString(),
                'expected_date' => $data->expectedDate?->toDateString(),
                'reference' => $data->reference,
                'notes' => $data->notes,
            ])->save();

            $order->lines()->delete();
            $total = new Number('0');
            foreach ($data->lines as $line) {
                $lineTotal = (new Number($line['quantity']) * new Number($line['unit_price']))->round(2);
                $total += $lineTotal;
                $order->lines()->create([
                    'company_id' => $order->company_id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'unit_price' => Decimal::money(Decimal::of($line['unit_price'])),
                    'line_total' => Decimal::money($lineTotal),
                ]);
            }

            $order->forceFill(['total' => Decimal::money($total)])->save();

            return $order->load('lines');
        });
    }

    private function validate(PurchaseOrderData $data, User $actor): void
    {
        $errors = $this->dates->errors($actor->company, $data->orderDate, 'order_date');

        $supplier = Supplier::query()->find($data->supplierId);
        if ($supplier === null || ! $supplier->is_active) {
            $errors['supplier_id'] = ['Selecciona un proveedor activo.'];
        }
        if (! Warehouse::query()->whereKey($data->warehouseId)->where('is_active', true)->exists()) {
            $errors['warehouse_id'] = ['Selecciona un almacén activo.'];
        }
        if ($data->expectedDate !== null && $data->expectedDate->lt($data->orderDate)) {
            $errors['expected_date'] = ['La fecha esperada no puede ser anterior a la orden.'];
        }
        if ($data->lines === []) {
            $errors['lines'] = ['Agrega al menos un producto.'];
        }

        $ids = array_column($data->lines, 'product_id');
        $valid = Product::query()->whereIn('id', $ids)->where('is_active', true)->pluck('id')->all();
        $seen = [];
        foreach ($data->lines as $i => $line) {
            if (! in_array($line['product_id'], $valid, true)) {
                $errors["lines.{$i}.product_id"] = ['El producto no existe o está inactivo.'];
            } elseif (isset($seen[$line['product_id']])) {
                $errors["lines.{$i}.product_id"] = ['El producto está repetido en la orden.'];
            }
            $seen[$line['product_id']] = true;
            if (Decimal::of($line['quantity']) <= 0) {
                $errors["lines.{$i}.quantity"] = ['La cantidad debe ser mayor a 0.'];
            }
        }

        if ($errors !== []) {
            throw new PurchaseException($errors);
        }
    }
}
