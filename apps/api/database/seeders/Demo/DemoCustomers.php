<?php

namespace Database\Seeders\Demo;

/**
 * Deterministic demo customers placed in REAL zones (approximate centers
 * of neighborhoods, cities and foreign business districts), with a small
 * jitter so they do not overlap. Names and tax ids are fictitious.
 *
 * Each zone says which warehouse serves it (CEN / EQP / P3M), which the
 * sales simulation uses (and Atlas draws as arcs).
 */
final class DemoCustomers
{
    /**
     * [label, city, department, country, lat, lng, radius (deg), count, profile, warehouse]
     * profile: retail | market (wholesale) | business (corporate) | mixed
     */
    private const ZONES = [
        // ---- Santa Cruz de la Sierra (most customers) ----------------------
        ['Equipetrol', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7642, -63.1958, 0.006, 7, 'business', 'EQP'],
        ['Urbarí', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7975, -63.1985, 0.005, 4, 'mixed', 'EQP'],
        ['Las Palmas', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.8003, -63.2105, 0.005, 4, 'retail', 'EQP'],
        ['Sirari', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7712, -63.1962, 0.004, 3, 'business', 'EQP'],
        ['Centro', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7834, -63.1821, 0.005, 6, 'mixed', 'EQP'],
        ['La Ramada', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7921, -63.1892, 0.004, 5, 'market', 'EQP'],
        ['El Trompillo', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.8012, -63.1781, 0.005, 3, 'retail', 'EQP'],
        ['Doble Vía La Guardia', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.8150, -63.2200, 0.008, 3, 'retail', 'EQP'],
        ['Plan 3000', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.8270, -63.1262, 0.010, 9, 'retail', 'P3M'],
        ['Villa 1ro de Mayo', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7702, -63.1201, 0.008, 6, 'retail', 'P3M'],
        ['Pampa de la Isla', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7605, -63.1148, 0.007, 3, 'retail', 'P3M'],
        ['Cotoca', 'Cotoca', 'Santa Cruz', 'BO', -17.7531, -62.9972, 0.006, 2, 'retail', 'P3M'],
        ['Barrio Norte', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7452, -63.1748, 0.007, 5, 'mixed', 'CEN'],
        ['Los Pozos', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7791, -63.1731, 0.003, 4, 'market', 'CEN'],
        ['Mutualista', 'Santa Cruz de la Sierra', 'Santa Cruz', 'BO', -17.7592, -63.1612, 0.004, 3, 'market', 'CEN'],
        ['Montero', 'Montero', 'Santa Cruz', 'BO', -17.3381, -63.2501, 0.008, 2, 'market', 'CEN'],
        ['Warnes', 'Warnes', 'Santa Cruz', 'BO', -17.5101, -63.1652, 0.006, 2, 'business', 'CEN'],
        // ---- Rest of Bolivia (served from the central warehouse) ------------
        ['Centro', 'La Paz', 'La Paz', 'BO', -16.4955, -68.1336, 0.006, 3, 'mixed', 'CEN'],
        ['Sopocachi', 'La Paz', 'La Paz', 'BO', -16.5090, -68.1262, 0.004, 2, 'business', 'CEN'],
        ['Calacoto', 'La Paz', 'La Paz', 'BO', -16.5421, -68.0781, 0.005, 2, 'business', 'CEN'],
        ['Miraflores', 'La Paz', 'La Paz', 'BO', -16.5001, -68.1182, 0.004, 1, 'retail', 'CEN'],
        ['Ceja', 'El Alto', 'La Paz', 'BO', -16.5052, -68.1631, 0.006, 3, 'market', 'CEN'],
        ['Av. 6 de Marzo', 'El Alto', 'La Paz', 'BO', -16.5251, -68.1802, 0.006, 2, 'market', 'CEN'],
        ['Centro', 'Cochabamba', 'Cochabamba', 'BO', -17.3935, -66.1570, 0.006, 3, 'market', 'CEN'],
        ['Cala Cala', 'Cochabamba', 'Cochabamba', 'BO', -17.3701, -66.1641, 0.005, 3, 'business', 'CEN'],
        ['Quillacollo', 'Quillacollo', 'Cochabamba', 'BO', -17.3922, -66.2781, 0.006, 2, 'retail', 'CEN'],
        ['Centro', 'Sucre', 'Chuquisaca', 'BO', -19.0475, -65.2596, 0.006, 3, 'mixed', 'CEN'],
        ['Centro', 'Tarija', 'Tarija', 'BO', -21.5355, -64.7296, 0.006, 3, 'mixed', 'CEN'],
        ['Centro', 'Oruro', 'Oruro', 'BO', -17.9696, -67.1150, 0.006, 2, 'market', 'CEN'],
        ['Centro', 'Potosí', 'Potosí', 'BO', -19.5836, -65.7531, 0.006, 2, 'retail', 'CEN'],
        ['Centro', 'Trinidad', 'Beni', 'BO', -14.8333, -64.9000, 0.006, 2, 'mixed', 'CEN'],
        ['Centro', 'Cobija', 'Pando', 'BO', -11.0267, -68.7692, 0.005, 2, 'mixed', 'CEN'],
    ];

    /** International corporate customers: [city, country, lat, lng, name, tax id] */
    private const INTERNATIONAL = [
        ['Lima', 'PE', -12.0931, -77.0465, 'Andes Pacífico Distribuciones S.A.C.', '20601234571'],
        ['Arequipa', 'PE', -16.3989, -71.5350, 'Sur Andino Comercial S.A.C.', '20456789123'],
        ['Santiago', 'CL', -33.4168, -70.6060, 'Cordillera Importaciones SpA', '76543210-K'],
        ['Iquique', 'CL', -20.2141, -70.1524, 'Zofri Logística del Norte Ltda.', '77123456-3'],
        ['Buenos Aires', 'AR', -34.6037, -58.3816, 'Río de la Plata Trading S.R.L.', '30-71234567-9'],
        ['Salta', 'AR', -24.7859, -65.4117, 'Norte Grande Mayorista S.A.', '30-70987654-1'],
        ['São Paulo', 'BR', -23.5613, -46.6565, 'Paulista Comércio Exterior Ltda.', '12345678000190'],
        ['Corumbá', 'BR', -19.0077, -57.6511, 'Pantanal Atacadista Ltda.', '98765432000155'],
        ['Asunción', 'PY', -25.2867, -57.6470, 'Guaraní Distribuidora S.A.', '80012345-6'],
        ['Ciudad del Este', 'PY', -25.5097, -54.6111, 'Triple Frontera Import S.A.', '80098765-2'],
        ['Miami', 'US', 25.7743, -80.1937, 'Brickell Latam Supply LLC', '61-1234567'],
        ['Houston', 'US', 29.7604, -95.3698, 'Gulf Andean Foods Inc.', '74-7654321'],
        ['Madrid', 'ES', 40.4237, -3.6920, 'Iberoandina Alimentación S.L.', 'B87654321'],
        ['Barcelona', 'ES', 41.3874, 2.1686, 'Mediterrània Import Export S.L.', 'B65432198'],
        ['Shanghai', 'CN', 31.2304, 121.4737, 'Huangpu Global Sourcing Co., Ltd.', '91310000MA1K4XXXX1'],
    ];

    private const FIRST_NAMES = ['María', 'José', 'Juan', 'Rosa', 'Carlos', 'Ana', 'Luis', 'Carmen', 'Jorge', 'Elena', 'Miguel', 'Patricia', 'Fernando', 'Lucía', 'Roberto', 'Silvia', 'Mario', 'Gabriela', 'Daniel', 'Verónica', 'Ricardo', 'Sandra', 'Óscar', 'Mónica', 'Hugo', 'Claudia'];

    private const LAST_NAMES = ['Quispe', 'Mamani', 'Rojas', 'Flores', 'Vargas', 'Gutiérrez', 'Justiniano', 'Suárez', 'Áñez', 'Rivero', 'Peña', 'Choque', 'Cuéllar', 'Montaño', 'Saavedra', 'Roca', 'Pinto', 'Salvatierra', 'Ortiz', 'Arteaga', 'Méndez', 'Limpias', 'Terrazas', 'Zabala'];

    private const SHOPS = ['Tienda', 'Minimarket', 'Abarrotes', 'Comercial', 'Distribuidora', 'Ferretería', 'Almacén', 'Bodega', 'Despensa', 'Micromercado'];

    private const SHOP_SUFFIX = ['Doña Rosa', 'El Progreso', 'San Martín', 'La Económica', 'Los Andes', 'El Carmen', 'Santa Rita', 'El Cruceño', 'La Esquina', 'Don Lucho', 'El Ahorro', 'San Antonio', 'La Familia', 'Virgen de Cotoca', 'El Pahuichi', 'La Feria'];

    private const COMPANIES = ['Grupo', 'Industrias', 'Servicios', 'Constructora', 'Inversiones', 'Corporación', 'Hotel', 'Restaurante', 'Clínica', 'Colegio'];

    private const COMPANY_SUFFIX = ['Oriente', 'Chiquitano', 'Guapay', 'Piraí', 'Illimani', 'Tunari', 'Andino', 'Amazónico', 'Mojeño', 'Chaco', 'Sajama', 'Altiplano', 'Bermejo', 'Itenez'];

    /**
     * @return list<array<string, mixed>> customer attributes + 'warehouse' code + 'payment_profile'
     */
    public static function build(): array
    {
        $customers = [];
        $seq = 0;

        foreach (self::ZONES as $z) {
            [$zone, $city, $department, $country, $lat, $lng, $radius, $count, $profile, $warehouse] = $z;
            for ($i = 0; $i < $count; $i++) {
                $seq++;
                $segment = self::segmentFor($profile, $i);
                $customers[] = [
                    ...self::identity($segment, $seq),
                    ...self::credit($segment, $seq),
                    'address' => self::address($zone, $seq),
                    'city' => $city,
                    'department' => $department,
                    'country' => $country,
                    'latitude' => self::jitter($lat, $radius),
                    'longitude' => self::jitter($lng, $radius),
                    'phone' => self::phone($city),
                    'segment' => $segment,
                    'warehouse' => $warehouse,
                ];
            }
        }

        foreach (self::INTERNATIONAL as $i => [$city, $country, $lat, $lng, $name, $taxId]) {
            $customers[] = [
                'document_type' => 'nit', // foreign tax id (RUC/RUT/CUIT/CNPJ/EIN/CIF/USCC)
                'document_number' => preg_replace('/[^0-9A-Za-z\-]/', '', $taxId),
                'complement' => '',
                'name' => $name,
                'email' => 'compras'.($i + 1).'@cliente-internacional.test',
                'payment_terms' => 'credit',
                'credit_days' => [30, 45, 60][$i % 3],
                'credit_limit' => (string) (20000 + 6000 * ($i % 4)).'.00',
                'payment_profile' => ['punctual', 'punctual', 'late', 'partial'][$i % 4],
                'address' => 'Distrito comercial',
                'city' => $city,
                'department' => null,
                'country' => $country,
                'latitude' => self::jitter($lat, 0.01),
                'longitude' => self::jitter($lng, 0.01),
                'phone' => null,
                'segment' => 'corporate',
                'warehouse' => 'CEN',
            ];
        }

        return $customers;
    }

    private static function segmentFor(string $profile, int $i): string
    {
        return match ($profile) {
            'business' => $i % 3 === 2 ? 'wholesale' : 'corporate',
            'market' => $i % 4 === 3 ? 'retail' : 'wholesale',
            'mixed' => ['retail', 'wholesale', 'corporate', 'retail'][$i % 4],
            default => $i % 5 === 4 ? 'wholesale' : 'retail',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private static function identity(string $segment, int $seq): array
    {
        if ($segment === 'retail' && $seq % 3 !== 0) {
            $first = self::FIRST_NAMES[mt_rand(0, count(self::FIRST_NAMES) - 1)];
            $last1 = self::LAST_NAMES[mt_rand(0, count(self::LAST_NAMES) - 1)];
            $last2 = self::LAST_NAMES[mt_rand(0, count(self::LAST_NAMES) - 1)];
            $withComplement = $seq % 7 === 0;

            return [
                'document_type' => $withComplement ? 'ci_complement' : 'ci',
                'document_number' => (string) mt_rand(3_000_000, 13_999_999),
                'complement' => $withComplement ? mt_rand(1, 9).chr(65 + mt_rand(0, 5)) : '',
                'name' => "{$first} {$last1} {$last2}",
                'email' => null,
            ];
        }

        $name = $segment === 'corporate'
            ? self::COMPANIES[$seq % count(self::COMPANIES)].' '.self::COMPANY_SUFFIX[mt_rand(0, count(self::COMPANY_SUFFIX) - 1)].' '.['S.R.L.', 'S.A.', 'Ltda.'][$seq % 3]
            : self::SHOPS[mt_rand(0, count(self::SHOPS) - 1)].' '.self::SHOP_SUFFIX[mt_rand(0, count(self::SHOP_SUFFIX) - 1)];

        return [
            'document_type' => 'nit',
            'document_number' => (string) mt_rand(100_000_000, 999_999_999).(string) mt_rand(10, 99),
            'complement' => '',
            'name' => $name,
            'email' => 'contacto'.$seq.'@cliente-demo.test',
        ];
    }

    /**
     * Credit conditions and how the customer pays (drives the simulation):
     * punctual, late (pays well after the due date), partial (pays in two
     * parts) or defaulter (stops paying: overdue debt).
     *
     * @return array<string, mixed>
     */
    private static function credit(string $segment, int $seq): array
    {
        if ($segment === 'retail' && $seq % 4 !== 1) {
            return ['payment_terms' => 'cash', 'credit_days' => 0, 'credit_limit' => '0', 'payment_profile' => 'cash'];
        }

        $profile = match ($seq % 9) {
            0, 4 => 'late',
            7 => 'defaulter',
            5 => 'partial',
            default => 'punctual',
        };

        [$days, $limit] = match ($segment) {
            'corporate' => [[30, 45, 60][$seq % 3], 9000 + 2500 * ($seq % 5)],
            'wholesale' => [[15, 30][$seq % 2], 3500 + 900 * ($seq % 6)],
            default => [15, 1500 + 300 * ($seq % 4)],
        };

        // Some customers with a tight limit: they end up near (or at) it.
        if ($seq % 6 === 3) {
            $limit = (int) ($limit * 0.55);
        }

        return [
            'payment_terms' => 'credit',
            'credit_days' => $days,
            'credit_limit' => $limit.'.00',
            'payment_profile' => $profile,
        ];
    }

    private static function address(string $zone, int $seq): string
    {
        $streets = ['Calle', 'Av.', 'Pasaje'];

        return sprintf('%s %d, %s', $streets[$seq % 3], 100 + ($seq * 37) % 1900, $zone);
    }

    private static function phone(string $city): string
    {
        return '+591 '.(mt_rand(0, 3) === 0 ? ['La Paz' => '2', 'El Alto' => '2', 'Cochabamba' => '4'][$city] ?? '3' : '7').mt_rand(1_000_000, 9_999_999);
    }

    private static function jitter(float $value, float $radius): string
    {
        return number_format($value + (mt_rand(-1000, 1000) / 1000) * $radius, 6, '.', '');
    }
}
