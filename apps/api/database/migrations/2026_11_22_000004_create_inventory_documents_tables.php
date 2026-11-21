<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Precision (ADR 0004): quantities NUMERIC(14,4), unit costs NUMERIC(14,4),
     * inventory values NUMERIC(16,4) (internal costing precision).
     */
    public function up(): void
    {
        Schema::create('inventory_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);    // entry | exit | transfer | adjustment
            $table->string('status', 20)->default('draft'); // draft | posted | voided
            $table->string('number', 30)->nullable(); // assigned on posting, e.g. ENT-000001
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('destination_warehouse_id')->nullable()->constrained('warehouses')->restrictOnDelete();
            $table->date('document_date');
            $table->string('adjustment_reason', 30)->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->decimal('total_cost', 16, 4)->nullable();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('posted_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'type', 'number']);
            $table->unique(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'status', 'type']);
            $table->index(['company_id', 'document_date']);
        });

        Schema::create('inventory_document_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('inventory_documents')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            // entry/exit/transfer: requested quantity (> 0). adjustment: signed difference, set on posting.
            $table->decimal('quantity', 14, 4)->nullable();
            // adjustment only
            $table->decimal('counted_quantity', 14, 4)->nullable();
            $table->decimal('system_quantity', 14, 4)->nullable();
            // entry: input. others: average cost used, snapshot on posting.
            $table->decimal('unit_cost', 14, 4)->nullable();
            $table->decimal('total_cost', 16, 4)->nullable();
            $table->string('notes')->nullable();
            $table->timestampsTz();

            $table->index(['document_id', 'position']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('document_id')->constrained('inventory_documents')->restrictOnDelete();
            $table->foreignId('document_line_id')->constrained('inventory_document_lines')->restrictOnDelete();
            $table->string('kind', 20); // in | out | transfer_in | transfer_out | adjust_in | adjust_out
            $table->decimal('quantity', 14, 4);      // signed
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('total_cost', 16, 4);    // signed
            $table->decimal('quantity_after', 14, 4);
            $table->decimal('avg_cost_after', 14, 4);
            $table->decimal('value_after', 16, 4);
            $table->foreignId('reverses_movement_id')->nullable()->constrained('stock_movements')->restrictOnDelete();
            $table->date('document_date');
            $table->timestampTz('occurred_at');      // posting moment: defines kardex order
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['company_id', 'product_id', 'warehouse_id', 'id'], 'stock_movements_kardex_index');
            $table->index(['company_id', 'occurred_at']);
            $table->index('document_id');
        });

        // Idempotency guard at DB level: a line can produce each movement kind once,
        // and each original movement can be reversed once. NULLS NOT DISTINCT (PG15+)
        // makes the NULL reverses_movement_id of original movements count as equal.
        DB::statement('CREATE UNIQUE INDEX stock_movements_idempotency_unique ON stock_movements (document_line_id, kind, reverses_movement_id) NULLS NOT DISTINCT');

        Schema::create('stock_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 14, 4)->default(0);
            $table->decimal('avg_cost', 14, 4)->default(0);
            $table->decimal('total_value', 16, 4)->default(0);
            $table->foreignId('last_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['product_id', 'warehouse_id']);
            $table->index(['company_id', 'warehouse_id']);
        });

        // Valuation invariant (ADR 0004): never negative value nor negative average cost.
        DB::statement('ALTER TABLE stock_balances ADD CONSTRAINT stock_balances_value_non_negative CHECK (total_value >= 0 AND avg_cost >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_balances');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_document_lines');
        Schema::dropIfExists('inventory_documents');
    }
};
