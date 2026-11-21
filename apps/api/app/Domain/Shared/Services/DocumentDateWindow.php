<?php

namespace App\Domain\Shared\Services;

use App\Domain\Shared\Models\Company;
use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Company rule shared by every business document (inventory, sales,
 * receipts): document_date must be within
 * [today − companies.document_backdate_days, today], "today" in the
 * company's timezone.
 */
class DocumentDateWindow
{
    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function window(Company $company): array
    {
        $today = $this->today($company);

        return [$today->subDays($company->document_backdate_days), $today];
    }

    public function today(Company $company): CarbonImmutable
    {
        return CarbonImmutable::now($company->timezone)->startOfDay();
    }

    /**
     * @return array<string, list<string>>
     */
    public function errors(Company $company, DateTimeInterface $date, string $field = 'document_date'): array
    {
        [$min, $max] = $this->window($company);
        $day = CarbonImmutable::parse($date->format('Y-m-d'), $company->timezone)->startOfDay();

        if ($day->greaterThan($max)) {
            return [$field => ['La fecha del documento no puede ser futura.']];
        }

        if ($day->lessThan($min)) {
            return [$field => [sprintf(
                'La fecha del documento no puede ser anterior al %s (ventana de %d días).',
                $min->format('d/m/Y'),
                $company->document_backdate_days,
            )]];
        }

        return [];
    }
}
