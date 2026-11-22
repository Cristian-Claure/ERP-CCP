<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Services\DocumentDateWindow;
use BcMath\Number;
use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Business validation of inventory documents (beyond request shape).
 * Used when saving drafts and, authoritatively, when posting.
 */
class DocumentValidator
{
    public function __construct(private readonly DocumentDateWindow $dates) {}

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function dateWindow(Company $company): array
    {
        return $this->dates->window($company);
    }

    /**
     * @return array<string, list<string>>
     */
    public function dateErrors(Company $company, DateTimeInterface $date): array
    {
        return $this->dates->errors($company, $date);
    }

    /**
     * Full check before posting. Expects lines.product.unit, warehouse and
     * destinationWarehouse loaded.
     *
     * @throws InvalidDocumentException
     */
    public function assertPostable(InventoryDocument $document, Company $company): void
    {
        $errors = $this->dateErrors($company, $document->document_date);
        $errors += $this->headerErrors(
            $document->type,
            $document->warehouse,
            $document->destinationWarehouse,
            $document->adjustment_reason?->requiresNotes() ?? false,
            $document->adjustment_reason !== null,
            $document->notes,
        );

        if ($document->lines->isEmpty()) {
            $errors['lines'] = ['El documento debe tener al menos una línea.'];
        }

        $seen = [];
        foreach ($document->lines as $i => $line) {
            $errors += $this->lineErrors(
                $document->type,
                $i,
                $line->product,
                $line->quantity,
                $line->counted_quantity,
                $line->unit_cost,
            );

            if ($document->type === DocumentType::Adjustment) {
                if (isset($seen[$line->product_id])) {
                    $errors["lines.{$i}.product_id"] = ['El producto está repetido en el ajuste.'];
                }
                $seen[$line->product_id] = true;
            }
        }

        if ($errors !== []) {
            throw new InvalidDocumentException($errors);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function headerErrors(
        DocumentType $type,
        ?Warehouse $warehouse,
        ?Warehouse $destination,
        bool $reasonRequiresNotes,
        bool $hasReason,
        ?string $notes,
    ): array {
        $errors = [];

        if ($warehouse === null || ! $warehouse->is_active) {
            $errors['warehouse_id'] = ['El almacén no existe o está inactivo.'];
        }

        if ($type === DocumentType::Transfer) {
            if ($destination === null || ! $destination->is_active) {
                $errors['destination_warehouse_id'] = ['El almacén de destino no existe o está inactivo.'];
            } elseif ($warehouse !== null && $destination->id === $warehouse->id) {
                $errors['destination_warehouse_id'] = ['El almacén de destino debe ser distinto del de origen.'];
            }
        }

        if ($type === DocumentType::Adjustment) {
            if (! $hasReason) {
                $errors['adjustment_reason'] = ['El motivo del ajuste es obligatorio.'];
            } elseif ($reasonRequiresNotes && trim((string) $notes) === '') {
                $errors['notes'] = ['Describe el motivo cuando eliges "Otro".'];
            }
        }

        return $errors;
    }

    /**
     * @return array<string, list<string>>
     */
    public function lineErrors(
        DocumentType $type,
        int $index,
        ?Product $product,
        ?string $quantity,
        ?string $countedQuantity,
        ?string $unitCost,
    ): array {
        $errors = [];
        $prefix = "lines.{$index}";

        if ($product === null || ! $product->is_active) {
            return ["{$prefix}.product_id" => ['El producto no existe o está inactivo.']];
        }

        $allowsDecimals = (bool) $product->unit?->allows_decimals;

        if ($type === DocumentType::Adjustment) {
            if ($countedQuantity === null || new Number($countedQuantity) < 0) {
                $errors["{$prefix}.counted_quantity"] = ['Ingresa la cantidad contada (0 o más).'];
            } elseif (! $allowsDecimals && $this->hasFraction($countedQuantity)) {
                $errors["{$prefix}.counted_quantity"] = ["{$product->name} no admite decimales."];
            }

            return $errors;
        }

        if ($quantity === null || new Number($quantity) <= 0) {
            $errors["{$prefix}.quantity"] = ['La cantidad debe ser mayor a 0.'];
        } elseif (! $allowsDecimals && $this->hasFraction($quantity)) {
            $errors["{$prefix}.quantity"] = ["{$product->name} no admite decimales."];
        }

        if ($type === DocumentType::Entry && ($unitCost === null || new Number($unitCost) < 0)) {
            $errors["{$prefix}.unit_cost"] = ['Ingresa el costo unitario de la entrada.'];
        }

        return $errors;
    }

    private function hasFraction(string $value): bool
    {
        $n = new Number($value);

        return $n != $n->floor();
    }
}
