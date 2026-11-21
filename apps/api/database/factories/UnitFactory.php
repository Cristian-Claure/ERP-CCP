<?php

namespace Database\Factories;

use App\Domain\Inventory\Models\Unit;
use App\Domain\Shared\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Unit>
 */
class UnitFactory extends Factory
{
    protected $model = Unit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'code' => strtoupper(fake()->unique()->lexify('U???')),
            'name' => 'Unidad',
            'allows_decimals' => false,
        ];
    }

    public function fractional(string $code = 'KG', string $name = 'Kilogramo'): static
    {
        return $this->state(['code' => $code, 'name' => $name, 'allows_decimals' => true]);
    }
}
