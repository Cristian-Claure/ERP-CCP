<?php

namespace App\Http\Requests\Purchases;

use App\Domain\Sales\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterSupplierPaymentRequest extends FormRequest
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
        $money = ['numeric', 'gt:0', 'decimal:0,2', 'max:999999999999'];

        return [
            'supplier_id' => ['required', 'integer'],
            'payment_date' => ['required', 'date_format:Y-m-d'],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'amount' => ['required', ...$money],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'allocations' => ['nullable', 'array', 'max:200'],
            'allocations.*.purchase_receipt_id' => ['required', 'integer'],
            'allocations.*.amount' => ['required', ...$money],
        ];
    }
}
