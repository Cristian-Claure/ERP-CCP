"""Builds docs/LICENSES.md from the outputs of free license tools.

Inputs (generate them first, see the header of docs/LICENSES.md):
  web.json  license-checker@25 --json (all npm packages; filtered here to direct deps)
  api.json  composer licenses --format=json
  ai.json   {"package": {"version", "license"}} from importlib.metadata (what pip-licenses reads)

Usage: python docs/scripts/build_licenses.py web.json api.json ai.json > docs/LICENSES.md
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OSI = {
    'MIT', 'MIT-0', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'BlueOak-1.0.0',
    'MPL-2.0', 'LGPL-3.0-or-later', 'Python-2.0', 'Zlib', 'CC0-1.0', 'Unlicense', 'OFL-1.1',
}


def osi(lic: str) -> str:
    parts = [p.strip('() ') for p in lic.replace(' OR ', '|').replace(' AND ', '|').split('|')]
    return 'Sí' if parts and all(p in OSI for p in parts) else 'Revisar'


web_lic, api_lic, ai_lic = (json.loads(Path(p).read_text(encoding='utf-8-sig')) for p in sys.argv[1:4])

pkg = json.loads((ROOT / 'apps/web/package.json').read_text(encoding='utf-8'))
web_rows = []
for group, deps in (('runtime', pkg.get('dependencies', {})), ('dev', pkg.get('devDependencies', {}))):
    for name in sorted(deps):
        match = next((v for k, v in web_lic.items() if k.rsplit('@', 1)[0] == name), None)
        lic = (match or {}).get('licenses', '?')
        lic = ' OR '.join(lic) if isinstance(lic, list) else lic
        version = next((k.rsplit('@', 1)[1] for k in web_lic if k.rsplit('@', 1)[0] == name), '?')
        web_rows.append((name, version, group, lic))

composer = json.loads((ROOT / 'apps/api/composer.json').read_text(encoding='utf-8'))
api_rows = []
for group, deps in (('runtime', composer.get('require', {})), ('dev', composer.get('require-dev', {}))):
    for name in sorted(deps):
        if name == 'php' or name.startswith('ext-'):
            continue
        info = api_lic['dependencies'].get(name, {})
        api_rows.append((name, info.get('version', '?'), group, ' OR '.join(info.get('license', ['?']))))

ai_rows = [(n, v['version'], 'dev' if n in {'httpx', 'pytest', 'ruff'} else 'runtime', v['license']) for n, v in ai_lic.items()]


def table(rows):
    out = ['| Paquete | Versión | Uso | Licencia | OSI |', '|---|---|---|---|---|']
    out += [f'| `{n}` | {v} | {g} | {lic} | {osi(lic)} |' for n, v, g, lic in rows]
    return '\n'.join(out)


print(f"""# Licencias de dependencias

Regla del proyecto (CLAUDE.md): solo software libre con licencia aprobada por la OSI y recursos
gratuitos. Esta tabla lista las **dependencias directas**; las transitivas se auditan con las mismas
herramientas. Cualquier fila "Revisar" debe consultarse antes de mergear.

Generada con herramientas libres:

```bash
docker compose exec -T web npx --yes license-checker@25.0.1 --json > web.json   # BSD-3-Clause
docker compose exec -T api composer licenses --format=json > api.json
# apps/ai: metadatos de importlib.metadata (lo mismo que lee pip-licenses)
python docs/scripts/build_licenses.py web.json api.json ai.json > docs/LICENSES.md
```

## Descartadas por licencia

| Paquete | Licencia | Motivo | Alternativa usada |
|---|---|---|---|
| `react-leaflet` | Hippocratic-2.1 | No aprobada por la OSI | Wrapper propio sobre `leaflet` (BSD-2-Clause) |

## Web (`apps/web`)

{table(web_rows)}

## API (`apps/api`)

{table(api_rows)}

## Servicio IA (`apps/ai`)

{table(ai_rows)}

## Datos y servicios externos

Ver [`CREDITS.md`](CREDITS.md) (mapas, texturas y datos geográficos).
""")
