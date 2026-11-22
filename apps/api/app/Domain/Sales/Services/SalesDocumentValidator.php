<?php

namespace App\Domain\Sales\Services;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Services\DocumentDateWindow;
use BcMath\Number;
use Carbon\CarbonInterface;

/**
 * Business validation of sales documents (beyond request shape). Used on
 * draft save and, authoritatively, on posting.
 */
class SalesDocumentValidator
{
    public function __construct(private readonly DocumentDateWindow $dates) {}

    /**
     * Expects customer, warehouse and lines.product.unit loaded.
     *
     * @throws InvalidSalesDocumentException
     */
    public function assertValid(SalesDocument $document, Company $company): void
    {
        $errors = $this->dates->errors($company, $document->document_date);
        $errors += $this->headerErrors($document->type, $document->customer, $document->warehouse, $document->document_date, $document->valid_until);

        if ($document->lines->isEmpty()) {
            $errors['lines'] = ['El documento debe tener al menos una línea.'];
        }

        foreach ($document->lines->values() as $i => $line) {
            $errors += $this->lineErrors($i, $line->product, (string) $line->quantity, (string) $line->unit_price);
        }

        if ($errors !== []) {
            throw new InvalidSalesDocumentException($errors);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function headerErrors(
        SalesDocumentType $type,
        ?Customer $customer,
        ?Warehouse $warehouse,
        CarbonInterface $documentDate,
        ?CarbonInterface $validUntil,
    ): array {
        $errors = [];

        if ($customer === null || ! $customer->is_active) {
            $errors['customer_id'] = ['El cliente no existe o está inactivo.'];
        }

        if ($warehouse === null || ! $warehouse->is_active) {
            $errors['warehouse_id'] = ['El almacén no existe o está inactivo.'];
        }

        if ($type === SalesDocumentType::Quote && $validUntil !== null && $validUntil->lt($documentDate->copy()->startOfDay())) {
            $errors['valid_until'] = ['La validez de la cotización no puede ser anterior a su fecha.'];
        }

        // A credit sale to a cash customer is not rejected here: its credit
        // limit is 0, so posting requires sales.override_credit_limit.
        return $errors;
    }

    /**
     * @return array<string, list<string>>
     */
    public function lineErrors(int $index, ?Product $product, string $quantity, string $unitPrice): array
    {
        $prefix = "lines.{$index}";

        if ($product === null || ! $product->is_active) {
            return ["{$prefix}.product_id" => ['El producto no existe o está inactivo.']];
        }

        $errors = [];
        $qty = new Number($quantity);

        if ($qty <= 0) {
            $errors["{$prefix}.quantity"] = ['La cantidad debe ser mayor a 0.'];
        } elseif (! $product->unit?->allows_decimals && $qty != $qty->floor()) {
            $errors["{$prefix}.quantity"] = ["{$product->name} no admite decimales."];
        }

        if (new Number($unitPrice) < 0) {
            $errors["{$prefix}.unit_price"] = ['El precio no puede ser negativo.'];
        }

        return $errors;
    }
}
