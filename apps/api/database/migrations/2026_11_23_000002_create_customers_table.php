<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 20);        // ci | ci_complement | nit | passport | cex
            $table->string('document_number', 20);
            $table->string('complement', 5)->default(''); // CI complement ("1A"); '' keeps the unique index simple
            $table->string('name', 200);                 // razón social / full name
            $table->string('email')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('department', 80)->nullable();
            $table->char('country', 2)->default('BO');   // ISO 3166-1 alpha-2
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->string('payment_terms', 10)->default('cash'); // cash | credit
            $table->unsignedSmallInteger('credit_days')->default(0);
            $table->decimal('credit_limit', 14, 2)->default(0);
            $table->string('segment', 20)->default('retail');     // retail | wholesale | corporate
            // Derived cache of SUM(customer_ledger_entries.amount); see customers:verify.
            $table->decimal('balance', 14, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'document_type', 'document_number', 'complement'], 'customers_document_unique');
            $table->index(['company_id', 'name']);
            $table->index(['company_id', 'city']);
            $table->index(['company_id', 'segment']);
        });

        DB::statement('ALTER TABLE customers ADD CONSTRAINT customers_credit_non_negative CHECK (credit_limit >= 0)');

        Schema::table('companies', function (Blueprint $table) {
            // Walk-in customer ("Sin nombre / S/N") used by the POS.
            $table->foreignId('default_customer_id')->nullable()->after('quote_validity_days')
                ->constrained('customers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_customer_id');
        });
        Schema::dropIfExists('customers');
    }
};
