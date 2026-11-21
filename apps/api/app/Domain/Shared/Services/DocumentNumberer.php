<?php

namespace App\Domain\Shared\Services;

use App\Domain\Shared\Models\DocumentSequence;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Gapless correlative numbering per company + document type.
 *
 * MUST be called inside the transaction that persists the document: the
 * sequence row stays locked (FOR UPDATE) until commit, and a rollback also
 * rolls back the increment, so no number is ever skipped.
 */
class DocumentNumberer
{
    public function next(int $companyId, string $key, string $prefix, int $padding = 6): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('DocumentNumberer::next() must run inside a database transaction.');
        }

        // Create the sequence row on first use without racing other transactions.
        DB::table('document_sequences')->insertOrIgnore([
            'company_id' => $companyId,
            'key' => $key,
            'prefix' => $prefix,
            'last_number' => 0,
            'padding' => $padding,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        /** @var DocumentSequence $sequence */
        $sequence = DocumentSequence::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('key', $key)
            ->lockForUpdate()
            ->firstOrFail();

        $number = $sequence->last_number + 1;
        $sequence->forceFill(['last_number' => $number])->save();

        return sprintf('%s-%s', $sequence->prefix, str_pad((string) $number, $sequence->padding, '0', STR_PAD_LEFT));
    }
}
