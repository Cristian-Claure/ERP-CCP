<?php

namespace App\Domain\Inventory\Enums;

enum AdjustmentReason: string
{
    case Shrinkage = 'shrinkage';
    case Expiry = 'expiry';
    case Damage = 'damage';
    case EntryError = 'entry_error';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Shrinkage => 'Merma',
            self::Expiry => 'Vencimiento',
            self::Damage => 'Daño',
            self::EntryError => 'Error de registro',
            self::Other => 'Otro',
        };
    }

    /** "Otro" requires a free-text explanation in the document notes. */
    public function requiresNotes(): bool
    {
        return $this === self::Other;
    }

    /**
     * @return list<array{value: string, label: string, requires_notes: bool}>
     */
    public static function options(): array
    {
        return array_map(fn (self $r) => [
            'value' => $r->value,
            'label' => $r->label(),
            'requires_notes' => $r->requiresNotes(),
        ], self::cases());
    }
}
