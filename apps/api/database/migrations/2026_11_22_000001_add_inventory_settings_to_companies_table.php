<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('allow_negative_stock')->default(false)->after('timezone');
            // How many days in the past a document_date may be (basis for period closing).
            $table->unsignedSmallInteger('document_backdate_days')->default(30)->after('allow_negative_stock');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['allow_negative_stock', 'document_backdate_days']);
        });
    }
};
