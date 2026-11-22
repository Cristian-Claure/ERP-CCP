<?php

namespace App\Domain\Atlas\Listeners;

use App\Domain\Atlas\Services\AtlasCache;
use App\Domain\Sales\Events\CustomerSaved;
use App\Domain\Sales\Events\PaymentRegistered;
use App\Domain\Sales\Events\PaymentVoided;
use App\Domain\Sales\Events\SalesDocumentPosted;
use App\Domain\Sales\Events\SalesDocumentVoided;

/**
 * Sales, receipts and customer changes alter what Atlas shows: drop the
 * company's cached Atlas data (the events fire after commit).
 */
class InvalidateAtlasCache
{
    public function __construct(private readonly AtlasCache $cache) {}

    public function handle(SalesDocumentPosted|SalesDocumentVoided|PaymentRegistered|PaymentVoided|CustomerSaved $event): void
    {
        $model = match (true) {
            $event instanceof SalesDocumentPosted, $event instanceof SalesDocumentVoided => $event->document,
            $event instanceof PaymentRegistered, $event instanceof PaymentVoided => $event->payment,
            default => $event->customer,
        };

        $this->cache->bump((int) $model->company_id);
    }
}
