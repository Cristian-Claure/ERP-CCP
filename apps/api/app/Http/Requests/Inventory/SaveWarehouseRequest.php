<?php

namespace App\Http\Requests\Inventory;

use App\Domain\Inventory\Models\Warehouse;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveWarehouseRequest extends FormRequest
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
        /** @var Warehouse|null $warehouse */
        $warehouse = $this->route('warehouse');

        return [
            'code' => [
                'required', 'string', 'max:20',
                Rule::unique('warehouses', 'code')->where('company_id', $this->user()->company_id)->ignore($warehouse?->id),
            ],
            'name' => ['required', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'decimal:0,6', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'decimal:0,6', 'required_with:latitude'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
