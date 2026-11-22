"""Builds the Atlas assets from public-domain sources.

/raw (read-only): NASA Blue Marble / Black Marble / topography / clouds (via the
three-globe & globe.gl example mirrors) and Natural Earth (world-atlas TopoJSON,
admin-1 GeoJSON). Output: /out/textures/*.webp and /out/geo/*.json.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RAW = Path('/raw')
OUT = Path('/out')
(OUT / 'textures').mkdir(parents=True, exist_ok=True)
(OUT / 'geo').mkdir(parents=True, exist_ok=True)


def save(img, name, quality=82):
    path = OUT / 'textures' / name
    img.save(path, 'WEBP', quality=quality, method=6)
    print(f'{name:22} {img.size} {path.stat().st_size / 1024:8.0f} KB')


# ---- Color maps: 4K + 2K (the only ones offered in 4K) ------------------------
day = Image.open(RAW / 'earth-blue-marble.jpg').convert('RGB')
night = Image.open(RAW / 'earth-night.jpg').convert('RGB')
for img, base in ((day, 'day'), (night, 'night')):
    save(img.resize((4096, 2048), Image.LANCZOS), f'{base}-4k.webp', 80)
    save(img.resize((2048, 1024), Image.LANCZOS), f'{base}-2k.webp', 82)

# ---- Bump (relief) 2K ------------------------------------------------------------
bump = Image.open(RAW / 'earth-topology.png').convert('L').resize((2048, 1024), Image.LANCZOS)
save(bump, 'bump-2k.webp', 78)

# ---- Clouds 2K (grayscale, used as alpha) ------------------------------------------
clouds = Image.open(RAW / 'clouds.png').convert('RGBA').getchannel('A').resize((2048, 1024), Image.LANCZOS)
save(clouds, 'clouds-2k.webp', 78)


# ---- Specular 2K: oceans white, land black (rasterized Natural Earth 50m) --------
def decode_topojson(topo, name):
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    arcs = []
    for arc in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(indexes):
        pts = []
        for i in indexes:
            a = arcs[i] if i >= 0 else list(reversed(arcs[~i]))
            pts.extend(a if not pts else a[1:])
        return pts

    for geom in topo['objects'][name]['geometries']:
        polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']] if geom['type'] == 'Polygon' else []
        for poly in polys:
            yield [ring(r) for r in poly]


W, H = 2048, 1024
land = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(land)
topo = json.loads((RAW / 'countries-50m.json').read_text())


def to_px(lon, lat):
    return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)


for poly in decode_topojson(topo, 'countries'):
    outer = poly[0]
    # Make the ring continuous across the antimeridian, then draw it and its ±360° copies.
    fixed, offset, prev = [], 0.0, None
    for lon, lat in outer:
        if prev is not None and abs(lon - prev) > 180:
            offset += -360 if lon > prev else 360
        prev = lon
        fixed.append((lon + offset, lat))
    for shift in (-360, 0, 360):
        draw.polygon([to_px(lon + shift, lat) for lon, lat in fixed], fill=255)

land = land.filter(ImageFilter.GaussianBlur(1.2))
specular = Image.eval(land, lambda v: 255 - v)
save(specular, 'specular-2k.webp', 80)

# ---- Geo: country borders (TopoJSON as published) + Bolivia departments -----------
for name in ('countries-110m.json', 'countries-50m.json'):
    (OUT / 'geo' / name).write_bytes((RAW / name).read_bytes())
    print(f'{name:22} {(OUT / "geo" / name).stat().st_size / 1024:8.0f} KB')


def rnd(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 4), round(coords[1], 4)]
    return [rnd(c) for c in coords]


admin = json.loads((RAW / 'admin1-10m.geojson').read_text(encoding='utf-8'))
features = [
    {
        'type': 'Feature',
        'properties': {'name': f['properties'].get('name'), 'iso': f['properties'].get('iso_3166_2')},
        'geometry': {'type': f['geometry']['type'], 'coordinates': rnd(f['geometry']['coordinates'])},
    }
    for f in admin['features']
    if f['properties'].get('iso_a2') == 'BO'
]
path = OUT / 'geo' / 'bolivia-admin1.json'
path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'bolivia-admin1.json    {len(features)} departments {path.stat().st_size / 1024:8.0f} KB')
