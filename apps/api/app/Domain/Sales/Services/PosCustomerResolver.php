<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Actions\SaveCustomer;
use App\Domain\Sales\Data\CustomerData;
use App\Domain\Sales\Enums\CustomerDocumentType;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Customer of a counter sale: an explicit id, an existing customer found by
 * its NIT/CI, a minimal new one (NIT/CI + name, cash, no credit) or the
 * company's walk-in customer "Sin nombre / S/N".
 */
class PosCustomerResolver
{
    public function __construct(private readonly SaveCustomer $saveCustomer) {}

    /** Existing customer with that NIT/CI (NIT first), or null. */
    public function find(string $documentNumber): ?Customer
    {
        return Customer::query()
            ->where('document_number', trim($documentNumber))
            ->orderByRaw('CASE document_type WHEN ? THEN 0 ELSE 1 END', [CustomerDocumentType::Nit->value])
            ->orderBy('id')
            ->first();
    }

    /**
     * @param  array{id?: int|null, document_type?: string|null, document_number?: string|null, name?: string|null}  $input
     *
     * @throws AuthorizationException|InvalidSalesDocumentException
     */
    public function resolve(array $input, Company $company, User $actor): Customer
    {
        if (! empty($input['id'])) {
            return Customer::query()->findOrFail((int) $input['id']);
        }

        $number = trim((string) ($input['document_number'] ?? ''));
        if ($number === '') {
            $default = $company->default_customer_id ? Customer::query()->find($company->default_customer_id) : null;

            return $default ?? throw InvalidSalesDocumentException::with([
                'customer' => 'Configura el cliente por defecto (Sin nombre / S/N) en Configuración → Ventas.',
            ]);
        }

        if ($existing = $this->find($number)) {
            return $existing;
        }

        $name = trim((string) ($input['name'] ?? ''));
        if (mb_strlen($name) < 2) {
            throw InvalidSalesDocumentException::with(['customer.name' => 'Ingresa la razón social o el nombre para el NIT/CI nuevo.']);
        }

        if (! $actor->can('customers.manage')) {
            throw new AuthorizationException('No tienes permiso para registrar clientes nuevos.');
        }

        return $this->saveCustomer->handle(CustomerData::fromArray([
            'document_type' => $input['document_type'] ?? CustomerDocumentType::Nit->value,
            'document_number' => $number,
            'name' => $name,
            'payment_terms' => 'cash',
            'segment' => 'retail',
            'notes' => 'Registrado desde el punto de venta.',
        ]), $actor);
    }
}
