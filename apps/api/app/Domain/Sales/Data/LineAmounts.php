<?php

namespace App\Domain\Sales\Data;

use BcMath\Number;

final readonly class LineAmounts
{
    public function __construct(
        public Number $gross,
        public Number $globalShare,
        public Number $total,
        public Number $vat,
        public Number $net,
    ) {}
}
