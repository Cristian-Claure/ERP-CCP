<?php

namespace App\Domain\Sales\Events;

use App\Domain\Sales\Models\SalesDocument;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** A quote, invoice or sales note was posted. Dispatched only once the transaction has committed. */
final class SalesDocumentPosted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly SalesDocument $document) {}
}
