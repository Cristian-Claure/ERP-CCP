<?php

namespace App\Domain\Sales\Data;

/**
 * Exceptions the actor authorizes when posting a sale, each with its reason.
 * A reason without the matching permission is rejected (403).
 */
final readonly class PostingAuthorization
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        public ?string $belowCostReason = null,
        public ?string $creditOverrideReason = null,
    ) {}

    public static function none(): self
    {
        return new self;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $clean = fn (?string $v) => ($v = trim((string) $v)) === '' ? null : $v;

        return new self(
            belowCostReason: $clean($data['below_cost_reason'] ?? null),
            creditOverrideReason: $clean($data['credit_override_reason'] ?? null),
        );
    }
}
