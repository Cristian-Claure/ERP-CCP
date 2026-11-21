<?php

namespace Database\Factories;

use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
class WarehouseFactory extends Factory
{
    protected $model = Warehouse::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'code' => strtoupper(fake()->unique()->bothify('ALM-###')),
            'name' => 'Almacén '.fake()->city(),
            'address' => fake()->streetAddress(),
            'is_active' => true,
        ];
    }
}
