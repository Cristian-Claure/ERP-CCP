<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Events\PurchasingChanged;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a supplier. Changes to payment conditions or to the
 * invoicing flag (which decides the fiscal credit, ADR 0006) are audited.
 */
class SaveSupplier
{
    private const AUDITED = ['payment_terms_days', 'issues_invoice', 'tax_id', 'is_active'];

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $attributes  validated input
     */
    public function handle(array $attributes, User $actor, ?Supplier $supplier = null): Supplier
    {
        return DB::transaction(function () use ($attributes, $actor, $supplier) {
            $isNew = $supplier === null;
            $supplier ??= new Supplier;
            $old = $isNew ? [] : array_intersect_key($supplier->only(self::AUDITED), array_flip(self::AUDITED));

            $supplier->fill([...$attributes, 'country' => strtoupper((string) ($attributes['country'] ?? 'BO'))])->save();

            $new = $supplier->only(self::AUDITED);
            if ($isNew || $old != $new) {
                $this->audit->log($isNew ? 'suppliers.created' : 'suppliers.updated', actor: $actor, auditable: $supplier, old: $old, new: $new);
            }

            PurchasingChanged::dispatch($supplier->company_id);

            return $supplier;
        });
    }
}
