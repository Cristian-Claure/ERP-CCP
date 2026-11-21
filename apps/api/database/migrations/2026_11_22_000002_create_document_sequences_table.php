<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gapless numbering per company and document type. Rows are locked
     * (SELECT ... FOR UPDATE) inside the posting transaction.
     */
    public function up(): void
    {
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('key', 50);
            $table->string('prefix', 10);
            $table->unsignedBigInteger('last_number')->default(0);
            $table->unsignedTinyInteger('padding')->default(6);
            $table->timestampsTz();

            $table->unique(['company_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
    }
};
