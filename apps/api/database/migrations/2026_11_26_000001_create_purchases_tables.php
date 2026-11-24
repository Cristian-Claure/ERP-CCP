<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Purchases (Phase 3, ADR 0006): suppliers, purchase orders (OC-) and their
 * receipts (REC-), which double as the supplier invoice in this phase. Each
 * posted receipt generates its ENT- through the inventory Actions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            // OCs above this total need purchases.approve (and someone other than their creator).
            $table->decimal('purchase_approval_threshold', 14, 2)->default(5000)->after('quote_validity_days');
            // Over-receipt allowed above the ordered quantity (0 = none).
            $table->decimal('purchase_receipt_tolerance_pct', 5, 2)->default(0)->after('purchase_approval_threshold');
            // Invoice price vs OC price difference that needs a reason.
            $table->decimal('purchase_price_variance_pct', 5, 2)->default(2)->after('purchase_receipt_tolerance_pct');
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('tax_id', 30);               // NIT (or foreign tax id)
            $table->string('name', 200);                // razón social
            $table->string('contact_name', 120)->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('address')->nullable();
            $table->char('country', 2)->default('BO');
            $table->string('city', 80)->nullable();
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->unsignedSmallInteger('payment_terms_days')->default(0); // 0 = cash
            $table->unsignedSmallInteger('lead_time_days')->default(7);
            $table->boolean('issues_invoice')->default(true);
            // Derived cache of SUM(supplier_ledger_entries.amount); see suppliers:verify.
            $table->decimal('balance', 14, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'tax_id']);
            $table->index(['company_id', 'name']);
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('number', 30)->nullable();   // OC-, assigned on approval
            $table->string('status', 20)->default('draft'); // draft|approved|partially_received|received|cancelled
            $table->date('order_date');
            $table->date('expected_date')->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('approved_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'supplier_id']);
        });

        Schema::create('purchase_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_price', 14, 2);       // agreed price (VAT included if the supplier invoices)
            $table->decimal('line_total', 14, 2);
            // Derived cache of the posted receipts (see suppliers:verify).
            $table->decimal('received_quantity', 14, 4)->default(0);
            $table->timestampsTz();

            $table->unique(['purchase_order_id', 'product_id']);
        });

        DB::statement('ALTER TABLE purchase_order_lines ADD CONSTRAINT po_lines_quantity_positive CHECK (quantity > 0 AND received_quantity >= 0)');

        Schema::create('purchase_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('number', 30);               // REC-
            $table->string('status', 20)->default('posted'); // posted | voided
            $table->date('receipt_date');
            $table->string('supplier_invoice_number', 40)->nullable();
            $table->date('supplier_invoice_date')->nullable();
            $table->boolean('issues_invoice');          // snapshot of the supplier flag
            $table->decimal('invoice_total', 14, 2);    // owed to the supplier
            $table->decimal('vat_credit', 14, 2);       // crédito fiscal (13 % por dentro)
            $table->decimal('net_total', 14, 2);
            $table->decimal('additional_costs_total', 14, 2)->default(0);
            $table->decimal('cost_total', 14, 2);       // net + additional costs (inventory value)
            $table->date('due_date');
            $table->decimal('paid_amount', 14, 2)->default(0); // derived cache
            $table->text('price_variance_reason')->nullable();
            $table->foreignId('inventory_document_id')->nullable()->constrained('inventory_documents')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'supplier_id', 'status']);
            $table->index(['company_id', 'receipt_date']);
        });

        // One supplier invoice number per supplier (a voided receipt frees it).
        DB::statement("CREATE UNIQUE INDEX purchase_receipts_invoice_unique ON purchase_receipts (company_id, supplier_id, supplier_invoice_number) WHERE supplier_invoice_number IS NOT NULL AND status <> 'voided'");

        Schema::create('purchase_receipt_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_line_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_price', 14, 2);       // invoiced
            $table->decimal('order_unit_price', 14, 2); // snapshot of the OC price
            $table->decimal('price_variance_pct', 8, 2)->default(0);
            $table->boolean('price_variance_flag')->default(false);
            $table->decimal('line_total', 14, 2);
            $table->decimal('vat', 14, 2);
            $table->decimal('net', 14, 2);
            $table->decimal('additional_cost', 14, 2)->default(0);
            $table->decimal('cost_total', 14, 2);
            $table->decimal('unit_cost', 14, 4);        // ADR 0004 costing precision
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('purchase_receipt_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_receipt_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);                 // freight | unloading | other
            $table->string('description', 120)->nullable();
            $table->decimal('amount', 14, 2);
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement('ALTER TABLE purchase_receipt_costs ADD CONSTRAINT receipt_costs_amount_positive CHECK (amount > 0)');

        $this->payables();
    }

    /** Accounts payable: mirror of receivables (payments PAG-, allocations, immutable ledger). */
    private function payables(): void
    {
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->string('number', 30);
            $table->string('status', 20)->default('posted'); // posted | voided
            $table->date('payment_date');
            $table->string('method', 20);
            $table->decimal('amount', 14, 2);
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'supplier_id', 'status']);
        });

        DB::statement('ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_amount_positive CHECK (amount > 0)');

        Schema::create('supplier_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained('supplier_payments')->restrictOnDelete();
            $table->foreignId('purchase_receipt_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['payment_id', 'purchase_receipt_id']);
            $table->index('purchase_receipt_id');
        });

        DB::statement('ALTER TABLE supplier_payment_allocations ADD CONSTRAINT supplier_allocations_amount_positive CHECK (amount > 0)');

        Schema::create('supplier_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->string('kind', 20);                 // charge | payment | reversal
            $table->decimal('amount', 14, 2);           // signed: + increases what we owe
            $table->decimal('balance_after', 14, 2);
            $table->date('entry_date');
            $table->date('due_date')->nullable();
            $table->string('source_type', 40);          // purchase_receipt | supplier_payment
            $table->unsignedBigInteger('source_id');
            $table->string('description');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['company_id', 'supplier_id', 'id'], 'supplier_ledger_statement_index');
        });

        DB::statement('CREATE UNIQUE INDEX supplier_ledger_source_unique ON supplier_ledger_entries (source_type, source_id, kind)');
    }

    public function down(): void
    {
        foreach (['supplier_ledger_entries', 'supplier_payment_allocations', 'supplier_payments', 'purchase_receipt_costs',
            'purchase_receipt_lines', 'purchase_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['purchase_approval_threshold', 'purchase_receipt_tolerance_pct', 'purchase_price_variance_pct']);
        });
    }
};
