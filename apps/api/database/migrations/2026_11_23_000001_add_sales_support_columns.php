<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Columns that existing tables need for Sales (Phase 2) and Atlas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            // Sales notes (non-fiscal) may or may not show the VAT breakdown (ADR 0005).
            $table->boolean('sales_note_vat_breakdown')->default(false)->after('document_backdate_days');
            // Days a quote stays valid by default.
            $table->unsignedSmallInteger('quote_validity_days')->default(15)->after('sales_note_vat_breakdown');
        });

        Schema::table('products', function (Blueprint $table) {
            // Price list (VAT included, ADR 0005). Nullable: not every product is sold.
            $table->decimal('sale_price', 14, 2)->nullable()->after('min_stock');
            $table->decimal('min_price', 14, 2)->nullable()->after('sale_price');
        });

        Schema::table('warehouses', function (Blueprint $table) {
            $table->decimal('latitude', 9, 6)->nullable()->after('address');
            $table->decimal('longitude', 9, 6)->nullable()->after('latitude');
        });

        Schema::table('inventory_documents', function (Blueprint $table) {
            // Business document that generated this one (e.g. a sale -> its SAL-).
            $table->string('source_type', 40)->nullable()->after('reference');
            $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::table('inventory_documents', function (Blueprint $table) {
            $table->dropIndex(['source_type', 'source_id']);
            $table->dropColumn(['source_type', 'source_id']);
        });
        Schema::table('warehouses', fn (Blueprint $table) => $table->dropColumn(['latitude', 'longitude']));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn(['sale_price', 'min_price']));
        Schema::table('companies', fn (Blueprint $table) => $table->dropColumn(['sales_note_vat_breakdown', 'quote_validity_days']));
    }
};
