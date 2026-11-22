<?php

namespace App\Domain\Sales\Data;

use BcMath\Number;

final readonly class SalesTotals
{
    /**
     * @param  list<LineAmounts>  $lines
     */
    public function __construct(
        public array $lines,
        public Number $subtotal,
        public Number $lineDiscountTotal,
        public Number $globalDiscount,
        public Number $total,
        public Number $vat,
        public Number $net,
    ) {}
}
