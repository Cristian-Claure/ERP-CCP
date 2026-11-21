<?php

namespace Database\Factories;

use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'document_type' => 'nit',
            'document_number' => (string) fake()->unique()->numberBetween(1000000, 999999999),
            'complement' => '',
            'name' => fake()->company(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->numerify('7#######'),
            'city' => 'Santa Cruz de la Sierra',
            'department' => 'Santa Cruz',
            'country' => 'BO',
            'payment_terms' => 'cash',
            'credit_days' => 0,
            'credit_limit' => '0',
            'segment' => 'retail',
            'is_active' => true,
        ];
    }

    public function credit(string $limit = '10000.00', int $days = 30): static
    {
        return $this->state(['payment_terms' => 'credit', 'credit_limit' => $limit, 'credit_days' => $days]);
    }
}
