<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Quotes, invoices and sales notes share one table (type). Money is
 * NUMERIC(14,2); prices include VAT and VAT is broken down (ADR 0005).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);                     // quote | invoice | sales_note
            $table->string('status', 20)->default('draft'); // draft | posted | voided
            $table->string('number', 30)->nullable();       // COT- / VTA- / NV-, assigned on posting
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->date('document_date');
            $table->date('valid_until')->nullable();        // quotes
            $table->string('payment_terms', 10)->default('cash'); // cash | credit
            $table->date('due_date')->nullable();
            $table->string('payment_method', 20)->nullable(); // cash sales: method of the automatic receipt

            $table->decimal('subtotal', 14, 2)->default(0);            // Σ qty × price
            $table->decimal('line_discount_total', 14, 2)->default(0);
            $table->decimal('global_discount', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);               // VAT included
            $table->decimal('iva_amount', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2)->default(0);          // total − VAT
            $table->decimal('cost_total', 14, 2)->nullable();          // posting snapshot
            $table->decimal('margin_total', 14, 2)->nullable();
            // Derived cache of SUM(allocations of posted payments); see customers:verify.
            $table->decimal('paid_amount', 14, 2)->default(0);

            $table->foreignId('quote_id')->nullable()->constrained('sales_documents')->restrictOnDelete();
            $table->foreignId('inventory_document_id')->nullable()->constrained('inventory_documents')->restrictOnDelete();

            $table->foreignId('below_cost_authorized_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('below_cost_authorized_at')->nullable();
            $table->text('below_cost_reason')->nullable();
            $table->foreignId('credit_override_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('credit_override_at')->nullable();
            $table->text('credit_override_reason')->nullable();

            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
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
            $table->index(['company_id', 'customer_id', 'status']);
        });

        DB::statement('ALTER TABLE sales_documents ADD CONSTRAINT sales_documents_amounts_check CHECK (total >= 0 AND paid_amount >= 0 AND paid_amount <= total)');

        Schema::create('sales_document_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('sales_documents')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_price', 14, 2);                 // VAT included
            $table->decimal('discount_amount', 14, 2)->default(0); // line discount
            $table->decimal('gross_amount', 14, 2)->default(0);    // qty × price − line discount
            $table->decimal('global_discount_share', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);           // gross − global share
            $table->decimal('iva_amount', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2)->default(0);
            $table->decimal('unit_cost', 14, 4)->nullable();       // average cost at posting
            $table->decimal('cost_total', 14, 2)->nullable();
            $table->decimal('margin', 14, 2)->nullable();          // net − cost
            $table->string('notes')->nullable();
            $table->timestampsTz();

            $table->index(['document_id', 'position']);
            $table->index(['company_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_document_lines');
        Schema::dropIfExists('sales_documents');
    }
};
