<?php

namespace App\Domain\Shared\Models;

use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['company_id', 'key', 'prefix', 'last_number', 'padding'])]
class DocumentSequence extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return [
            'last_number' => 'integer',
            'padding' => 'integer',
        ];
    }
}
