<?php

namespace Database\Factories;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Unit;
use App\Domain\Shared\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'unit_id' => fn (array $attributes) => Unit::factory()->create(['company_id' => $attributes['company_id']]),
            'category_id' => null,
            'sku' => strtoupper(fake()->unique()->bothify('SKU-#####')),
            'barcode' => null,
            'name' => ucfirst(fake()->words(3, true)),
            'description' => null,
            'min_stock' => '0',
            'is_active' => true,
        ];
    }
}
