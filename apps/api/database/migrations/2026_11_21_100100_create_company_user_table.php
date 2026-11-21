<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Company membership (N:M). users.company_id is the *active* company and
     * must always be one of the user's memberships.
     */
    public function up(): void
    {
        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['company_id', 'user_id']);
            $table->index('user_id');
        });

        // Spatie teams columns (team = company): enforce referential integrity.
        Schema::table('roles', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('model_has_permissions', fn (Blueprint $table) => $table->dropForeign(['company_id']));
        Schema::table('model_has_roles', fn (Blueprint $table) => $table->dropForeign(['company_id']));
        Schema::table('roles', fn (Blueprint $table) => $table->dropForeign(['company_id']));
        Schema::dropIfExists('company_user');
    }
};
