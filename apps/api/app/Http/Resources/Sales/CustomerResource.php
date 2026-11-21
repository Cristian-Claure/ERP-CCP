<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Queries\ReceivablesQueries;
use App\Domain\Shared\Support\Decimal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Receivable data (balance, overdue, debt status, available credit) is
 * only sent with receivables.view.
 *
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canSeeReceivables = (bool) $request->user()?->can('receivables.view');
        $attributes = $this->resource->getAttributes();

        return [
            'id' => $this->id,
            'document_type' => $this->document_type->value,
            'document_type_label' => $this->document_type->label(),
            'document_number' => $this->document_number,
            'complement' => $this->complement !== '' ? $this->complement : null,
            'document_label' => $this->documentLabel(),
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'city' => $this->city,
            'department' => $this->department,
            'country' => $this->country,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'payment_terms' => $this->payment_terms->value,
            'payment_terms_label' => $this->payment_terms->label(),
            'credit_days' => $this->credit_days,
            'credit_limit' => $this->credit_limit,
            'segment' => $this->segment->value,
            'segment_label' => $this->segment->label(),
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'receivables' => $this->when($canSeeReceivables, function () use ($attributes) {
                $status = ReceivablesQueries::statusFrom(
                    (string) $this->balance,
                    $attributes['overdue_amount'] ?? null,
                    $attributes['due_soon_amount'] ?? null,
                );
                $available = Decimal::of($this->credit_limit) - Decimal::of($this->balance);

                return [
                    'balance' => $this->balance,
                    'overdue_amount' => array_key_exists('overdue_amount', $attributes) ? Decimal::money(Decimal::of($attributes['overdue_amount'])) : null,
                    'available_credit' => Decimal::money($available < 0 ? Decimal::of('0') : $available),
                    'debt_status' => array_key_exists('overdue_amount', $attributes) ? $status->value : null,
                    'debt_status_label' => array_key_exists('overdue_amount', $attributes) ? $status->label() : null,
                ];
            }),
            'stats' => $this->when(array_key_exists('sales_total', $attributes), fn () => [
                'sales_count' => (int) ($attributes['sales_count'] ?? 0),
                'sales_total' => Decimal::money(Decimal::of($attributes['sales_total'] ?? '0')),
                'last_sale_at' => $attributes['last_sale_at'] ?? null,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
