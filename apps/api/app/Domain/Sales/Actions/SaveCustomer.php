<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Data\CustomerData;
use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a customer. Changes to credit conditions are audited
 * (they decide who can buy on credit). The balance is never set here.
 */
class SaveCustomer
{
    private const AUDITED = ['payment_terms', 'credit_days', 'credit_limit', 'is_active'];

    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(CustomerData $data, User $actor, ?Customer $customer = null): Customer
    {
        return DB::transaction(function () use ($data, $actor, $customer) {
            $isNew = $customer === null;
            $customer ??= new Customer;
            $old = $isNew ? null : $this->snapshot($customer);

            $customer->fill($data->toAttributes())->save();

            $new = $this->snapshot($customer);
            if ($isNew || $old !== $new) {
                $this->audit->log($isNew ? 'customers.created' : 'customers.credit_updated', actor: $actor, auditable: $customer, old: $old, new: $new);
            }

            return $customer;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(Customer $customer): array
    {
        return collect(self::AUDITED)->mapWithKeys(fn (string $k) => [$k => match (true) {
            $customer->{$k} instanceof \BackedEnum => $customer->{$k}->value,
            default => is_bool($customer->{$k}) ? $customer->{$k} : (string) $customer->{$k},
        }])->all();
    }
}
