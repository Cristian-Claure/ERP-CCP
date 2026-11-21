<?php

namespace App\Http\Requests\Inventory;

use App\Domain\Inventory\Actions\VoidInventoryDocument;
use Illuminate\Foundation\Http\FormRequest;

class VoidDocumentRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:'.VoidInventoryDocument::MIN_REASON_LENGTH, 'max:500'],
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
