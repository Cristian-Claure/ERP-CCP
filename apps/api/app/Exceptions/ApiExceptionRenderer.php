<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Renders every API error with one consistent envelope:
 *
 * {
 *   "error": {
 *     "status": 422,
 *     "code": "validation_failed",
 *     "message": "Human readable message (es)",
 *     "details": { "field": ["..."] }   // optional
 *   }
 * }
 */
class ApiExceptionRenderer
{
    public function render(Throwable $e, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*') && ! $request->expectsJson()) {
            return null;
        }

        return match (true) {
            $e instanceof ValidationException => $this->respond(422, 'validation_failed', 'Los datos enviados no son válidos.', $e->errors()),
            $e instanceof AuthenticationException => $this->respond(401, 'unauthenticated', 'No has iniciado sesión o tu sesión expiró.'),
            $e instanceof AuthorizationException,
            $e instanceof AccessDeniedHttpException => $this->respond(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
            $e instanceof ModelNotFoundException,
            $e instanceof NotFoundHttpException => $this->respond(404, 'not_found', 'El recurso solicitado no existe.'),
            $e instanceof MethodNotAllowedHttpException => $this->respond(405, 'method_not_allowed', 'Método HTTP no permitido.'),
            $e instanceof TokenMismatchException => $this->respond(419, 'csrf_token_mismatch', 'La sesión expiró. Recarga la página e inténtalo de nuevo.'),
            $e instanceof ThrottleRequestsException => $this->respond(429, 'too_many_requests', 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', headers: $e->getHeaders()),
            $e instanceof HttpExceptionInterface => $this->respond(
                $e->getStatusCode(),
                'http_error',
                $e->getMessage() !== '' ? $e->getMessage() : 'Error en la solicitud.',
                headers: $e->getHeaders(),
            ),
            default => $this->respond(500, 'server_error', 'Ocurrió un error inesperado. Inténtalo más tarde.', debug: $this->debugInfo($e)),
        };
    }

    /**
     * @param  array<string, mixed>|null  $details
     * @param  array<string, string>  $headers
     * @param  array<string, mixed>|null  $debug
     */
    private function respond(int $status, string $code, string $message, ?array $details = null, array $headers = [], ?array $debug = null): JsonResponse
    {
        $error = ['status' => $status, 'code' => $code, 'message' => $message];

        if ($details !== null) {
            $error['details'] = $details;
        }

        if ($debug !== null) {
            $error['debug'] = $debug;
        }

        return new JsonResponse(['error' => $error], $status, $headers);
    }

    /**
     * Only exposed when APP_DEBUG=true; never in production.
     *
     * @return array<string, mixed>|null
     */
    private function debugInfo(Throwable $e): ?array
    {
        if (! config('app.debug')) {
            return null;
        }

        return [
            'exception' => $e::class,
            'message' => $e->getMessage(),
            'file' => $e->getFile().':'.$e->getLine(),
        ];
    }
}
