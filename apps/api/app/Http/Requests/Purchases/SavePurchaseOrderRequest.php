<?php

namespace App\Http\Requests\Purchases;

use Illuminate\Foundation\Http\FormRequest;

class SavePurchaseOrderRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'order_date' => ['required', 'date_format:Y-m-d'],
            'expected_date' => ['nullable', 'date_format:Y-m-d'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:300'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,2', 'max:999999999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Selecciona el proveedor.',
            'warehouse_id.required' => 'Selecciona el almacén de destino.',
            'lines.required' => 'Agrega al menos un producto.',
            'lines.*.quantity.gt' => 'La cantidad debe ser mayor a 0.',
            'lines.*.*.decimal' => 'Demasiados decimales.',
        ];
    }
}
