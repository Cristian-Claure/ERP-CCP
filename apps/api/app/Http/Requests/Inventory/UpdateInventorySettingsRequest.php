<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInventorySettingsRequest extends FormRequest
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
            'allow_negative_stock' => ['sometimes', 'boolean'],
            'document_backdate_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
        ];
    }
}
