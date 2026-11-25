<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Point of sale (Phase 2b): barcode lookup, the cashier's warehouse and the
 * cash tendered / change of counter sales (shown on the 80 mm ticket).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index(['company_id', 'barcode']);
        });

        Schema::table('users', function (Blueprint $table) {
            // Warehouse the POS opens with (per-user preference; validated against the active company).
            $table->foreignId('pos_warehouse_id')->nullable()->after('company_id')->constrained('warehouses')->nullOnDelete();
        });

        Schema::table('sales_documents', function (Blueprint $table) {
            // 'desk' (sales editor) or 'pos' (counter). Informative: the engine is the same.
            $table->string('channel', 10)->default('desk')->after('type');
            $table->decimal('cash_received', 14, 2)->nullable()->after('payment_method');
            $table->decimal('change_amount', 14, 2)->nullable()->after('cash_received');
        });
    }

    public function down(): void
    {
        Schema::table('sales_documents', function (Blueprint $table) {
            $table->dropColumn(['channel', 'cash_received', 'change_amount']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pos_warehouse_id');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'barcode']);
        });
    }
};
