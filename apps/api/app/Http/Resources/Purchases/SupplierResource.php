<?php

namespace App\Http\Resources\Purchases;

use App\Domain\Purchases\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Supplier
 */
class SupplierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canSeePayables = (bool) $request->user()?->can('payables.view');

        return [
            'id' => $this->id,
            'tax_id' => $this->tax_id,
            'name' => $this->name,
            'contact_name' => $this->contact_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'country' => $this->country,
            'city' => $this->city,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'payment_terms_days' => $this->payment_terms_days,
            'payment_terms_label' => $this->payment_terms_days > 0 ? "Crédito {$this->payment_terms_days} días" : 'Contado',
            'lead_time_days' => $this->lead_time_days,
            'issues_invoice' => $this->issues_invoice,
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'balance' => $this->when($canSeePayables, $this->balance),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
