<?php

namespace App\Http\Requests\Sales;

use App\Domain\Sales\Data\PostingAuthorization;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Optional authorizations sent with a posting (the domain checks the
 * permission of each one).
 */
class PostSalesDocumentRequest extends FormRequest
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
        $reason = ['nullable', 'string', 'min:'.PostingAuthorization::MIN_REASON_LENGTH, 'max:500'];

        return [
            'below_cost_reason' => $reason,
            'credit_override_reason' => $reason,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*.min' => 'Describe el motivo (mínimo :min caracteres).',
        ];
    }
}
