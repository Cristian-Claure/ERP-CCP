<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('legal_name');
            $table->string('tax_id', 20)->unique()->comment('NIT');
            $table->char('currency', 3)->default('BOB');
            $table->string('timezone', 64)->default('America/La_Paz');
            $table->string('email')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
