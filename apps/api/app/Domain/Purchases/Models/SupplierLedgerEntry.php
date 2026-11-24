<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Sales\Enums\LedgerEntryKind;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Immutable accounts-payable entry (charge +, payment −, reversal ±). Written only by SupplierLedger. */
#[Fillable([
    'company_id', 'supplier_id', 'kind', 'amount', 'balance_after', 'entry_date', 'due_date', 'source_type',
    'source_id', 'description', 'created_by',
])]
class SupplierLedgerEntry extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'kind' => LedgerEntryKind::class,
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'entry_date' => 'date',
            'due_date' => 'date',
        ];
    }

    /** @return MorphTo<Model, $this> */
    public function source(): MorphTo
    {
        return $this->morphTo();
    }
}
