import L from 'leaflet'

/** Brand-colored pin (no image assets: avoids the classic bundler marker-icon issue). */
export function pinIcon(color = '#6366f1'): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.6 14 35 14 35s12.5-12.4 12.5-21.8C26.5 6.4 21 1 14 1z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="13" r="4.5" fill="white"/></svg>`,
  })
}
