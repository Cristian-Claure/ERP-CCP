<?php

namespace App\Http\Requests\Purchases;

use App\Domain\Purchases\Enums\ReceiptCostKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PostReceiptRequest extends FormRequest
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
        $money = ['numeric', 'min:0', 'decimal:0,2', 'max:999999999999'];

        return [
            'receipt_date' => ['required', 'date_format:Y-m-d'],
            'supplier_invoice_number' => ['nullable', 'string', 'max:40'],
            'supplier_invoice_date' => ['nullable', 'date_format:Y-m-d'],
            'price_variance_reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:300'],
            'lines.*.purchase_order_line_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0', 'decimal:0,4', 'max:9999999999'],
            'lines.*.unit_price' => ['required', ...$money],
            'costs' => ['nullable', 'array', 'max:20'],
            'costs.*.kind' => ['required', Rule::enum(ReceiptCostKind::class)],
            'costs.*.description' => ['nullable', 'string', 'max:120'],
            'costs.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2', 'max:999999999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'receipt_date.required' => 'La fecha de recepción es obligatoria.',
            'price_variance_reason.min' => 'Describe el motivo (mínimo :min caracteres).',
            'costs.*.amount.gt' => 'El gasto debe ser mayor a 0.',
        ];
    }
}
