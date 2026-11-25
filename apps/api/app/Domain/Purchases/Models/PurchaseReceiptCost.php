<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Purchases\Enums\ReceiptCostKind;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** Additional cost of a receipt (freight, unloading, other), prorated into the unit cost. */
#[Fillable(['company_id', 'purchase_receipt_id', 'kind', 'description', 'amount'])]
class PurchaseReceiptCost extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'kind' => ReceiptCostKind::class,
            'amount' => 'decimal:2',
        ];
    }
}
