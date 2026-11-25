<?php

namespace App\Http\Requests\Purchases;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePurchaseSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'purchase_approval_threshold' => ['sometimes', 'numeric', 'min:0', 'decimal:0,2', 'max:999999999999'],
            'purchase_receipt_tolerance_pct' => ['sometimes', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'purchase_price_variance_pct' => ['sometimes', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ];
    }
}
