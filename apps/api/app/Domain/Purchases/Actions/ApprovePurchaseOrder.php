<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentNumberer;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Approves a draft OC and assigns its OC- number (gap-free, in the transaction).
 *
 * - total <= companies.purchase_approval_threshold: purchases.create is enough.
 * - total >  threshold: needs purchases.approve AND an approver other than the
 *   creator (segregation of duties: 422 self_approval_not_allowed). The blocked
 *   attempt is audited OUTSIDE the rolled-back transaction so it is kept.
 * Idempotent: approving an approved order returns it unchanged.
 */
class ApprovePurchaseOrder
{
    public const SEQUENCE_KEY = 'purchases.order';

    public const PREFIX = 'OC';

    public function __construct(
        private readonly DocumentNumberer $numberer,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(PurchaseOrder $order, User $actor): PurchaseOrder
    {
        $result = DB::transaction(function () use ($order, $actor) {
            /** @var PurchaseOrder $order */
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);

            if ($order->status === PurchaseOrderStatus::Approved) {
                return $order->load('lines');
            }
            if ($order->status !== PurchaseOrderStatus::Draft) {
                throw PurchaseException::state('Solo se aprueban órdenes en borrador.');
            }
            if (! $order->lines()->exists()) {
                throw PurchaseException::with(['lines' => 'La orden no tiene productos.']);
            }

            $threshold = Decimal::of($order->company()->firstOrFail()->purchase_approval_threshold);
            $needsApprover = Decimal::of($order->total) > $threshold;
            $this->assertPermission($actor, $needsApprover, $threshold);

            if ($needsApprover && $order->created_by === $actor->id) {
                return ['blocked' => $order, 'threshold' => Decimal::money($threshold)];
            }

            $order->forceFill([
                'number' => $this->numberer->next($order->company_id, self::SEQUENCE_KEY, self::PREFIX),
                'status' => PurchaseOrderStatus::Approved,
                'approved_by' => $actor->id,
                'approved_at' => now(),
            ])->save();

            $this->audit->log('purchases.order.approved', actor: $actor, auditable: $order, new: [
                'number' => $order->number,
                'total' => $order->total,
                'threshold' => Decimal::money($threshold),
                'requires_approver' => $needsApprover,
            ]);

            return $order->load('lines');
        });

        if (is_array($result)) {
            $this->audit->log('purchases.order.self_approval_blocked', actor: $actor, auditable: $result['blocked'], new: [
                'total' => $result['blocked']->total,
                'threshold' => $result['threshold'],
            ]);

            throw PurchaseException::selfApproval($result['threshold']);
        }

        return $result;
    }

    private function assertPermission(User $actor, bool $needsApprover, Number $threshold): void
    {
        if ($needsApprover && ! $actor->can('purchases.approve')) {
            throw new AuthorizationException(sprintf(
                'Las órdenes por encima de Bs %s requieren el permiso de aprobación.', Decimal::money($threshold),
            ));
        }
        if (! $needsApprover && ! $actor->can('purchases.create') && ! $actor->can('purchases.approve')) {
            throw new AuthorizationException('No tienes permiso para aprobar órdenes de compra.');
        }
    }
}
