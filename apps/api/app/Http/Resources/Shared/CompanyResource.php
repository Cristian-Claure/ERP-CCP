<?php

namespace App\Http\Resources\Shared;

use App\Domain\Shared\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Company
 */
class CompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'tax_id' => $this->tax_id,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'allow_negative_stock' => $this->allow_negative_stock,
            'document_backdate_days' => $this->document_backdate_days,
        ];
    }
}
