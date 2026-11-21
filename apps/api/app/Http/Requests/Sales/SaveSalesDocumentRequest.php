<?php

namespace App\Http\Requests\Sales;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shape validation of a draft. Business rules (active customer/products,
 * date window, decimals per unit, discounts) live in the domain.
 */
class SaveSalesDocumentRequest extends FormRequest
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
            'type' => [$this->isMethod('post') ? 'required' : 'sometimes', Rule::enum(SalesDocumentType::class)],
            'customer_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'document_date' => ['required', 'date_format:Y-m-d'],
            'valid_until' => ['nullable', 'date_format:Y-m-d'],
            'payment_terms' => ['nullable', Rule::enum(PaymentTerms::class)],
            'payment_method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'global_discount' => ['nullable', ...$money],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['present', 'array', 'max:300'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999'],
            'lines.*.unit_price' => ['required', ...$money],
            'lines.*.discount_amount' => ['nullable', ...$money],
            'lines.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'customer_id.required' => 'Selecciona el cliente.',
            'warehouse_id.required' => 'Selecciona el almacén.',
            'document_date.required' => 'La fecha es obligatoria.',
            'lines.*.product_id.required' => 'Selecciona un producto.',
            'lines.*.quantity.gt' => 'La cantidad debe ser mayor a 0.',
            'lines.*.unit_price.required' => 'Ingresa el precio.',
            'lines.*.*.decimal' => 'Demasiados decimales.',
            'lines.*.*.numeric' => 'Debe ser un número.',
            'lines.*.*.min' => 'No puede ser negativo.',
        ];
    }
}
