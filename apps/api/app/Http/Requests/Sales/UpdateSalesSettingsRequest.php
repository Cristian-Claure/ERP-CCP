<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSalesSettingsRequest extends FormRequest
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
            'sales_note_vat_breakdown' => ['sometimes', 'boolean'],
            'quote_validity_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'default_customer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->where('company_id', $this->user()->company_id)],
        ];
    }
}
