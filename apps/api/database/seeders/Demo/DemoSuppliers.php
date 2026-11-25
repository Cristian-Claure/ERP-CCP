<?php

namespace Database\Seeders\Demo;

/**
 * 15 demo suppliers: most Bolivian, some importers (BR, CL, AR, CN). Foreign
 * suppliers and two informal local ones do not issue a Bolivian invoice
 * (no fiscal credit; import VAT at customs is out of scope, ADR 0006).
 *
 * [tax id, name, contact, country, city, lat, lng, terms days, lead days, invoice, category, freight % (0 = none)]
 */
final class DemoSuppliers
{
    public const LIST = [
        ['1023456027', 'Distribuidora Oriental SRL', 'Marcelo Suárez', 'BO', 'Santa Cruz de la Sierra', '-17.760100', '-63.159800', 30, 3, true, 'Abarrotes', 0],
        ['1015987023', 'Molinos del Este SA', 'Carla Rivero', 'BO', 'Warnes', '-17.512600', '-63.163900', 15, 4, true, 'Abarrotes', 1.2],
        ['4598712', 'Comercial Abasto Los Pozos', 'Don Teófilo Mamani', 'BO', 'Santa Cruz de la Sierra', '-17.784700', '-63.177600', 0, 1, false, 'Abarrotes', 0],
        ['1028741029', 'Embotelladora Cruceña SA', 'Jimena Paz', 'BO', 'Santa Cruz de la Sierra', '-17.731900', '-63.137700', 21, 2, true, 'Bebidas', 0],
        ['1020398025', 'Cervecería Andina SA', 'Rodrigo Quispe', 'BO', 'La Paz', '-16.495500', '-68.133600', 30, 6, true, 'Bebidas', 2.5],
        ['1017733021', 'Química Industrial Boliviana SRL', 'Patricia Rojas', 'BO', 'Cochabamba', '-17.393500', '-66.157000', 30, 5, true, 'Limpieza', 2.0],
        ['5871239', 'Distribuidora Limpiamax', 'Wilson Choque', 'BO', 'Santa Cruz de la Sierra', '-17.809200', '-63.198100', 0, 2, false, 'Limpieza', 0],
        ['45.871.236/0001-90', 'Cosméticos do Brasil Ltda', 'Fernanda Oliveira', 'BR', 'São Paulo', '-23.550500', '-46.633300', 45, 25, false, 'Cuidado personal', 6.5],
        ['1026654020', 'Droguería del Sur SRL', 'Andrea Vaca', 'BO', 'Tarija', '-21.535500', '-64.729600', 30, 6, true, 'Cuidado personal', 2.0],
        ['1019874026', 'Ferretería Industrial El Alto SRL', 'Freddy Condori', 'BO', 'El Alto', '-16.504900', '-68.163300', 30, 6, true, 'Ferretería', 3.0],
        ['76.452.981-3', 'Aceros del Pacífico SpA', 'Ignacio Fuentes', 'CL', 'Iquique', '-20.213000', '-70.152500', 60, 20, false, 'Ferretería', 7.0],
        ['1024477028', 'Pinturas del Valle SRL', 'Mónica Arce', 'BO', 'Cochabamba', '-17.372400', '-66.143800', 30, 5, true, 'Ferretería', 1.5],
        ['91440300MA5G8K2X7L', 'Shenzhen Brightway Electric Co., Ltd.', 'Lily Chen', 'CN', 'Shenzhen', '22.543100', '114.057900', 60, 45, false, 'Eléctricos', 9.0],
        ['30-71458963-9', 'Cables y Conductores Argentinos SA', 'Martín Gómez', 'AR', 'Buenos Aires', '-34.603700', '-58.381600', 45, 20, false, 'Eléctricos', 6.0],
        ['1021145024', 'Electro Red Bolivia SRL', 'Javier Méndez', 'BO', 'Santa Cruz de la Sierra', '-17.774300', '-63.182500', 30, 3, true, 'Eléctricos', 0],
    ];
}
