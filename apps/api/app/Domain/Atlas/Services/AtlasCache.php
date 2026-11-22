<?php

namespace App\Domain\Atlas\Services;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Cache of the Atlas read model (Redis in dev/prod). Keys carry a version
 * per company: bump() invalidates every cached filter combination of that
 * company at once, without needing cache tags or key scans.
 */
class AtlasCache
{
    public const TTL_SECONDS = 600;

    /**
     * @param  array<string, mixed>  $filters
     */
    public function remember(int $companyId, string $kind, array $filters, Closure $compute): mixed
    {
        ksort($filters);
        $key = sprintf('atlas:%d:v%d:%s:%s', $companyId, $this->version($companyId), $kind, md5((string) json_encode($filters)));

        return Cache::remember($key, self::TTL_SECONDS, $compute);
    }

    public function bump(int $companyId): void
    {
        Cache::increment($this->versionKey($companyId));
    }

    public function version(int $companyId): int
    {
        return (int) Cache::rememberForever($this->versionKey($companyId), fn () => 1);
    }

    private function versionKey(int $companyId): string
    {
        return "atlas:{$companyId}:version";
    }
}
