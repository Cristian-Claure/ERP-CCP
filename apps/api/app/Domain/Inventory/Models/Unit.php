<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Shared\Tenancy\BelongsToCompany;
use Database\Factories\UnitFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['company_id', 'code', 'name', 'allows_decimals'])]
#[UseFactory(UnitFactory::class)]
class Unit extends Model
{
    /** @use HasFactory<UnitFactory> */
    use BelongsToCompany, HasFactory;

    protected function casts(): array
    {
        return ['allows_decimals' => 'boolean'];
    }
}
