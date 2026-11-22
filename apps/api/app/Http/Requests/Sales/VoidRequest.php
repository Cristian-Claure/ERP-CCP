<?php

namespace App\Http\Requests\Sales;

use App\Domain\Sales\Actions\VoidSalesDocument;
use Illuminate\Foundation\Http\FormRequest;

/** Void of a sales document or a receipt: the reason is mandatory. */
class VoidRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:'.VoidSalesDocument::MIN_REASON_LENGTH, 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'El motivo de anulación es obligatorio.',
            'reason.min' => 'Describe el motivo (mínimo :min caracteres).',
        ];
    }
}
