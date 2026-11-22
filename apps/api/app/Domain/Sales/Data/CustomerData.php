<?php

namespace App\Domain\Sales\Data;

use App\Domain\Sales\Enums\CustomerDocumentType;
use App\Domain\Sales\Enums\CustomerSegment;
use App\Domain\Sales\Enums\PaymentTerms;

final readonly class CustomerData
{
    public function __construct(
        public CustomerDocumentType $documentType,
        public string $documentNumber,
        public string $complement,
        public string $name,
        public PaymentTerms $paymentTerms,
        public int $creditDays,
        public string $creditLimit,
        public CustomerSegment $segment,
        public ?string $email = null,
        public ?string $phone = null,
        public ?string $address = null,
        public ?string $city = null,
        public ?string $department = null,
        public string $country = 'BO',
        public ?string $latitude = null,
        public ?string $longitude = null,
        public bool $isActive = true,
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data): self
    {
        $type = CustomerDocumentType::from($data['document_type']);
        $terms = PaymentTerms::from($data['payment_terms'] ?? 'cash');

        return new self(
            documentType: $type,
            documentNumber: trim((string) $data['document_number']),
            complement: $type->requiresComplement() ? strtoupper(trim((string) ($data['complement'] ?? ''))) : '',
            name: trim((string) $data['name']),
            paymentTerms: $terms,
            // Cash customers carry no credit conditions.
            creditDays: $terms === PaymentTerms::Credit ? (int) ($data['credit_days'] ?? 0) : 0,
            creditLimit: $terms === PaymentTerms::Credit ? (string) ($data['credit_limit'] ?? '0') : '0',
            segment: CustomerSegment::from($data['segment'] ?? 'retail'),
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
            address: $data['address'] ?? null,
            city: $data['city'] ?? null,
            department: $data['department'] ?? null,
            country: strtoupper((string) ($data['country'] ?? 'BO')),
            latitude: isset($data['latitude']) ? (string) $data['latitude'] : null,
            longitude: isset($data['longitude']) ? (string) $data['longitude'] : null,
            isActive: (bool) ($data['is_active'] ?? true),
            notes: $data['notes'] ?? null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toAttributes(): array
    {
        return [
            'document_type' => $this->documentType,
            'document_number' => $this->documentNumber,
            'complement' => $this->complement,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'city' => $this->city,
            'department' => $this->department,
            'country' => $this->country,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'payment_terms' => $this->paymentTerms,
            'credit_days' => $this->creditDays,
            'credit_limit' => $this->creditLimit,
            'segment' => $this->segment,
            'is_active' => $this->isActive,
            'notes' => $this->notes,
        ];
    }
}
