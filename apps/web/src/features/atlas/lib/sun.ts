import { Vector3 } from 'three'

import { latLngToVector3 } from './geo'

const DEG = Math.PI / 180

export interface SubsolarPoint {
  /** Solar declination = latitude where the sun is at the zenith (degrees). */
  lat: number
  /** Longitude where it is local solar noon (degrees, −180..180). */
  lng: number
  /** Equation of time, minutes (apparent − mean solar time). */
  equationOfTime: number
}

const normalize180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/**
 * Point of the Earth where the sun is overhead at a given UTC instant.
 * Low-precision solar coordinates (Astronomical Almanac / NOAA), accurate to
 * ~0.01° in declination — more than enough for the day/night terminator.
 */
export function subsolarPoint(date: Date): SubsolarPoint {
  const n = date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545.0 // days since J2000.0
  const L = (280.46 + 0.9856474 * n) % 360 // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG // ecliptic longitude
  const epsilon = (23.439 - 0.0000004 * n) * DEG // obliquity

  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / DEG
  const rightAscension = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) / DEG
  const eotDegrees = normalize180(L - rightAscension)

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lng = normalize180(-(utcHours * 15 - 180 + eotDegrees))

  return { lat: declination, lng, equationOfTime: eotDegrees * 4 }
}

/** Unit vector from the Earth's center towards the sun (scene coordinates). */
export function sunDirection(date: Date, target = new Vector3()): Vector3 {
  const { lat, lng } = subsolarPoint(date)
  return latLngToVector3(lat, lng, 1, target).normalize()
}
