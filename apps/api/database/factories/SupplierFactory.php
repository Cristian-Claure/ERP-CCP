<?php

namespace Database\Factories;

use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shared\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'tax_id' => (string) fake()->unique()->numberBetween(1000000, 999999999),
            'name' => fake()->company(),
            'contact_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->numerify('7#######'),
            'country' => 'BO',
            'city' => 'Santa Cruz de la Sierra',
            'payment_terms_days' => 30,
            'lead_time_days' => 7,
            'issues_invoice' => true,
            'is_active' => true,
        ];
    }

    public function withoutInvoice(): static
    {
        return $this->state(['issues_invoice' => false]);
    }
}
