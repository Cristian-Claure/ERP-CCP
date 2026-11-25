<?php

namespace App\Http\Requests\Pos;

use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Enums\CustomerDocumentType;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\SalesDocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PosCheckoutRequest extends FormRequest
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
        $reason = ['nullable', 'string', 'min:'.PostingAuthorization::MIN_REASON_LENGTH, 'max:500'];

        return [
            'type' => ['required', Rule::in([SalesDocumentType::Invoice->value, SalesDocumentType::SalesNote->value])],
            'warehouse_id' => ['required', 'integer'],
            'customer' => ['nullable', 'array'],
            'customer.id' => ['nullable', 'integer'],
            'customer.document_type' => ['nullable', Rule::in([CustomerDocumentType::Nit->value, CustomerDocumentType::Ci->value])],
            'customer.document_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9A-Za-z-]+$/'],
            'customer.name' => ['nullable', 'string', 'max:160'],
            'global_discount' => ['nullable', ...$money],
            'notes' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:1', 'max:300'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999'],
            'lines.*.unit_price' => ['required', ...$money],
            'lines.*.discount_amount' => ['nullable', ...$money],
            'payments' => ['required', 'array', 'min:1', 'max:5'],
            'payments.*.method' => ['required', Rule::enum(PaymentMethod::class)],
            'payments.*.amount' => ['required', ...$money],
            'below_cost_reason' => $reason,
            'credit_override_reason' => $reason,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lines.required' => 'El carrito está vacío.',
            'lines.min' => 'El carrito está vacío.',
            'payments.required' => 'Indica cómo paga el cliente.',
            'customer.document_number.regex' => 'El NIT/CI solo admite números, letras y guiones.',
            'lines.*.quantity.gt' => 'La cantidad debe ser mayor a 0.',
            'below_cost_reason.min' => 'Describe el motivo (mínimo :min caracteres).',
        ];
    }
}
