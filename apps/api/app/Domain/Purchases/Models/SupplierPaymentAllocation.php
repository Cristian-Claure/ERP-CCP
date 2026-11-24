<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['company_id', 'payment_id', 'purchase_receipt_id', 'amount'])]
class SupplierPaymentAllocation extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    /** @return BelongsTo<SupplierPayment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(SupplierPayment::class, 'payment_id');
    }

    /** @return BelongsTo<PurchaseReceipt, $this> */
    public function receipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }
}
