<?php

namespace App\Http\Requests\Purchases;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveSupplierRequest extends FormRequest
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
        $supplier = $this->route('supplier');

        return [
            'tax_id' => ['required', 'string', 'max:30', 'regex:/^[0-9A-Za-z.\-]+$/',
                Rule::unique('suppliers', 'tax_id')->where('company_id', $this->user()->company_id)->ignore($supplier?->id)],
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'country' => ['required', 'string', 'size:2'],
            'city' => ['nullable', 'string', 'max:80'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'payment_terms_days' => ['required', 'integer', 'min:0', 'max:365'],
            'lead_time_days' => ['required', 'integer', 'min:0', 'max:365'],
            'issues_invoice' => ['required', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tax_id.required' => 'El NIT es obligatorio.',
            'tax_id.unique' => 'Ya existe un proveedor con ese NIT.',
            'tax_id.regex' => 'El NIT solo admite números, letras, puntos y guiones.',
            'name.required' => 'La razón social es obligatoria.',
        ];
    }
}
