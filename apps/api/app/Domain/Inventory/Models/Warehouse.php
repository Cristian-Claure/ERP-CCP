<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Inventory\Policies\WarehousePolicy;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Database\Factories\WarehouseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['company_id', 'code', 'name', 'address', 'is_active'])]
#[UseFactory(WarehouseFactory::class)]
#[UsePolicy(WarehousePolicy::class)]
class Warehouse extends Model
{
    /** @use HasFactory<WarehouseFactory> */
    use BelongsToCompany, HasFactory;

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * @return HasMany<StockBalance, $this>
     */
    public function balances(): HasMany
    {
        return $this->hasMany(StockBalance::class);
    }
}
