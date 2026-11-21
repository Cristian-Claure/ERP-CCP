<?php

namespace App\Http\Requests\Inventory;

use App\Domain\Inventory\Enums\AdjustmentReason;
use App\Domain\Inventory\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shape validation for creating/updating a draft. Business rules (date
 * window, active warehouses, decimals per unit...) live in the domain
 * (DocumentValidator).
 */
class SaveDocumentRequest extends FormRequest
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
        $decimal = ['nullable', 'numeric', 'decimal:0,4', 'max:9999999999'];

        return [
            'type' => [$this->isMethod('post') ? 'required' : 'sometimes', Rule::enum(DocumentType::class)],
            'warehouse_id' => ['required', 'integer'],
            'destination_warehouse_id' => ['nullable', 'integer', 'required_if:type,transfer'],
            'document_date' => ['required', 'date_format:Y-m-d'],
            'adjustment_reason' => ['nullable', Rule::enum(AdjustmentReason::class), 'required_if:type,adjustment'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['present', 'array', 'max:500'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.quantity' => $decimal,
            'lines.*.counted_quantity' => $decimal,
            'lines.*.unit_cost' => $decimal,
            'lines.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'warehouse_id.required' => 'Selecciona el almacén.',
            'destination_warehouse_id.required_if' => 'Selecciona el almacén de destino.',
            'document_date.required' => 'La fecha es obligatoria.',
            'adjustment_reason.required_if' => 'Selecciona el motivo del ajuste.',
            'lines.*.product_id.required' => 'Selecciona un producto.',
            'lines.*.*.decimal' => 'Máximo 4 decimales.',
            'lines.*.*.numeric' => 'Debe ser un número.',
        ];
    }
}
