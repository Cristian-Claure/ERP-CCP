<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Accounts receivable: payments (COB-), their allocation to sales, and the
 * immutable customer ledger (charges +, payments −, reversals ±).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('number', 30);
            $table->string('status', 20)->default('posted'); // posted | voided
            $table->date('payment_date');
            $table->string('method', 20);   // cash | transfer | qr | card | check
            $table->decimal('amount', 14, 2);
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            // Receipt generated automatically by a cash sale (voided with it).
            $table->foreignId('sales_document_id')->nullable()->constrained('sales_documents')->restrictOnDelete();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'customer_id', 'status']);
            $table->index(['company_id', 'payment_date']);
        });

        DB::statement('ALTER TABLE customer_payments ADD CONSTRAINT customer_payments_amount_positive CHECK (amount > 0)');

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained('customer_payments')->restrictOnDelete();
            $table->foreignId('sales_document_id')->constrained('sales_documents')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['payment_id', 'sales_document_id']);
            $table->index('sales_document_id');
        });

        DB::statement('ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0)');

        Schema::create('customer_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('kind', 20);              // charge | payment | reversal
            $table->decimal('amount', 14, 2);        // signed: + increases the debt
            $table->decimal('balance_after', 14, 2);
            $table->date('entry_date');
            $table->date('due_date')->nullable();    // charges
            $table->string('source_type', 40);       // sales_document | customer_payment
            $table->unsignedBigInteger('source_id');
            $table->string('description');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['company_id', 'customer_id', 'id'], 'customer_ledger_statement_index');
            $table->index(['source_type', 'source_id']);
        });

        // Idempotency guard: each source produces each kind of entry once.
        DB::statement('CREATE UNIQUE INDEX customer_ledger_source_unique ON customer_ledger_entries (source_type, source_id, kind)');
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_ledger_entries');
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('customer_payments');
    }
};
