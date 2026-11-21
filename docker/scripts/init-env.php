<?php
// Creates .env from .env.example (if missing) and fills empty secrets.
// Runs inside a throwaway PHP container so the host needs no PHP.
$root = getcwd();
$env = "$root/.env";

if (!file_exists($env)) {
    copy("$root/.env.example", $env);
    echo "Created .env from .env.example\n";
}

$contents = file_get_contents($env);
$secrets = [
    'APP_KEY' => fn () => 'base64:' . base64_encode(random_bytes(32)),
    'AI_SERVICE_TOKEN' => fn () => bin2hex(random_bytes(32)),
];

foreach ($secrets as $key => $generate) {
    $pattern = '/^' . $key . '=[ \t]*$/m';
    if (preg_match($pattern, $contents)) {
        $contents = preg_replace($pattern, $key . '=' . $generate(), $contents);
        echo "Generated $key\n";
    }
}

file_put_contents($env, $contents);
