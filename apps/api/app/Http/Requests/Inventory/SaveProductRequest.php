<?php

namespace App\Http\Requests\Inventory;

use App\Domain\Inventory\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveProductRequest extends FormRequest
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
        $companyId = $this->user()->company_id;
        /** @var Product|null $product */
        $product = $this->route('product');

        return [
            'sku' => [
                'required', 'string', 'max:40', 'regex:/^[A-Za-z0-9._\-]+$/',
                Rule::unique('products', 'sku')->where('company_id', $companyId)->ignore($product?->id),
            ],
            'name' => ['required', 'string', 'max:160'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category_id' => ['nullable', 'integer', Rule::exists('product_categories', 'id')->where('company_id', $companyId)],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')->where('company_id', $companyId)],
            'min_stock' => ['nullable', 'numeric', 'min:0', 'decimal:0,4'],
            // Price list, VAT included (ADR 0005).
            'sale_price' => ['nullable', 'numeric', 'min:0', 'decimal:0,2', 'max:999999999999'],
            'min_price' => ['nullable', 'numeric', 'min:0', 'decimal:0,2', 'lte:sale_price'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sku.unique' => 'Ya existe un producto con ese código.',
            'sku.regex' => 'Usa solo letras, números, punto, guion o guion bajo.',
            'unit_id.required' => 'Selecciona la unidad de medida.',
            'min_price.lte' => 'El precio mínimo no puede superar el precio de venta.',
        ];
    }
}
