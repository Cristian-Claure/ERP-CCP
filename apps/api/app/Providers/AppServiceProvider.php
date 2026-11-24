<?php

namespace App\Providers;

use App\Domain\Atlas\Listeners\InvalidateAtlasCache;
use App\Domain\Atlas\Services\AtlasCache;
use App\Domain\Purchases\Contracts\PurchaseSuggestionProvider;
use App\Domain\Purchases\Events\PurchasingChanged;
use App\Domain\Purchases\Services\MinStockVelocitySuggester;
use App\Domain\Sales\Events\CustomerSaved;
use App\Domain\Sales\Events\PaymentRegistered;
use App\Domain\Sales\Events\PaymentVoided;
use App\Domain\Sales\Events\SalesDocumentPosted;
use App\Domain\Sales\Events\SalesDocumentVoided;
use App\Domain\Shared\MorphMap;
use App\Domain\Shared\Tenancy\CurrentCompany;
use App\Infrastructure\Ai\AiClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CurrentCompany::class);

        // Phase 3 heuristic; Phase 5 swaps it for the AI demand forecast.
        $this->app->bind(PurchaseSuggestionProvider::class, MinStockVelocitySuggester::class);

        $this->app->singleton(AiClient::class, fn () => new AiClient(
            baseUrl: (string) config('services.ai.url'),
            token: (string) config('services.ai.token'),
            timeout: (int) config('services.ai.timeout'),
        ));
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());

        // Stable aliases stored in polymorphic columns (audit_logs, model_has_roles...),
        // so moving a class between namespaces never breaks existing rows.
        Relation::enforceMorphMap(MorphMap::MAP);
        JsonResource::withoutWrapping();

        // 5 attempts per minute per email+IP, plus 20 per minute per IP.
        RateLimiter::for('login', function (Request $request) {
            $email = Str::lower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by($email.'|'.$request->ip()),
                Limit::perMinute(20)->by('ip:'.$request->ip()),
            ];
        });

        // Atlas read model is cached per company; these events change what it shows.
        foreach ([SalesDocumentPosted::class, SalesDocumentVoided::class, PaymentRegistered::class, PaymentVoided::class, CustomerSaved::class] as $event) {
            Event::listen($event, InvalidateAtlasCache::class);
        }
        Event::listen(PurchasingChanged::class, fn (PurchasingChanged $e) => app(AtlasCache::class)->bump($e->companyId));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));
    }
}
