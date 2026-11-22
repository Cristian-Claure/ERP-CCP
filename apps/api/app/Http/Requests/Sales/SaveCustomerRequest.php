<?php

namespace App\Http\Requests\Sales;

use App\Domain\Sales\Enums\CustomerDocumentType;
use App\Domain\Sales\Enums\CustomerSegment;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Policies are checked in the controller.
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Customer|null $customer */
        $customer = $this->route('customer');
        $type = CustomerDocumentType::tryFrom((string) $this->input('document_type'));
        $complement = $type?->requiresComplement() ? strtoupper(trim((string) $this->input('complement'))) : '';

        return [
            'document_type' => ['required', Rule::enum(CustomerDocumentType::class)],
            'document_number' => [
                'required', 'string', 'max:20', 'regex:/^[0-9A-Za-z\-]+$/',
                Rule::unique('customers', 'document_number')
                    ->where('company_id', $this->user()->company_id)
                    ->where('document_type', $type?->value)
                    ->where('complement', $complement)
                    ->ignore($customer?->id),
            ],
            'complement' => ['nullable', 'string', 'max:5', 'required_if:document_type,ci_complement', 'regex:/^[0-9A-Za-z]+$/'],
            'name' => ['required', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
            'department' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'size:2'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'decimal:0,6', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'decimal:0,6', 'required_with:latitude'],
            'payment_terms' => ['required', Rule::enum(PaymentTerms::class)],
            'credit_days' => ['nullable', 'integer', 'min:0', 'max:365', 'required_if:payment_terms,credit'],
            'credit_limit' => ['nullable', 'numeric', 'min:0', 'decimal:0,2', 'max:999999999999', 'required_if:payment_terms,credit'],
            'segment' => ['required', Rule::enum(CustomerSegment::class)],
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
            'document_number.unique' => 'Ya existe un cliente con ese documento.',
            'document_number.regex' => 'Usa solo números, letras o guion.',
            'complement.required_if' => 'Ingresa el complemento del CI.',
            'credit_days.required_if' => 'Ingresa el plazo de crédito.',
            'credit_limit.required_if' => 'Ingresa el límite de crédito.',
            'latitude.required_with' => 'Fija la ubicación completa en el mapa.',
            'longitude.required_with' => 'Fija la ubicación completa en el mapa.',
        ];
    }
}
