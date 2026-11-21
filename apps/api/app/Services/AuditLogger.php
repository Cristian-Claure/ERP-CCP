<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     * @param  array<string, mixed>|null  $metadata
     */
    public function log(
        string $event,
        ?User $actor = null,
        ?Model $auditable = null,
        ?array $old = null,
        ?array $new = null,
        ?array $metadata = null,
    ): AuditLog {
        $actor ??= $this->request->user();

        return AuditLog::create([
            'company_id' => $actor?->company_id,
            'user_id' => $actor?->id,
            'event' => $event,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'old_values' => $old,
            'new_values' => $new,
            'metadata' => $metadata,
            'ip_address' => $this->request->ip(),
            'user_agent' => $this->request->userAgent(),
        ]);
    }
}
