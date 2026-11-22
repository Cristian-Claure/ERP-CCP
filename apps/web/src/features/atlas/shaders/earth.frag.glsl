// Earth: day map lit by the real sun, city lights on the night side, oceans
// reflecting the sun (specular mask) and relief from a bump map.
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specularMap;
uniform sampler2D bumpMap;
uniform vec3 sunDirection; // unit, world space
uniform float bumpScale;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPositionW;

// Bump mapping from screen-space derivatives (Mikkelsen, "Bump Mapping Unparametrized Surfaces").
vec3 perturbNormal(vec3 surfPos, vec3 surfNorm, float height) {
  vec3 dPdx = dFdx(surfPos);
  vec3 dPdy = dFdy(surfPos);
  float dHdx = dFdx(height);
  float dHdy = dFdy(height);
  vec3 r1 = cross(dPdy, surfNorm);
  vec3 r2 = cross(surfNorm, dPdx);
  float det = dot(dPdx, r1);
  vec3 grad = sign(det) * (dHdx * r1 + dHdy * r2);
  return normalize(abs(det) * surfNorm - grad);
}

void main() {
  vec3 geoNormal = normalize(vNormalW);
  float height = texture2D(bumpMap, vUv).r * bumpScale;
  vec3 n = perturbNormal(vPositionW, geoNormal, height);
  vec3 viewDir = normalize(cameraPosition - vPositionW);

  // Day/night blend from the geometric normal (soft terminator ≈ civil twilight).
  float sunDot = dot(geoNormal, sunDirection);
  float dayMix = smoothstep(-0.12, 0.22, sunDot);

  vec3 day = texture2D(dayMap, vUv).rgb;
  float diffuse = max(dot(n, sunDirection), 0.0);
  vec3 dayColor = day * (0.12 + 0.95 * diffuse);

  // City lights: warm tint, only where it is dark.
  vec3 lights = texture2D(nightMap, vUv).rgb;
  vec3 nightColor = lights * vec3(1.35, 1.12, 0.82) * 1.6 + day * 0.025;

  vec3 color = mix(nightColor, dayColor, dayMix);

  // Sun glint on the oceans.
  float ocean = texture2D(specularMap, vUv).r;
  vec3 halfway = normalize(sunDirection + viewDir);
  float spec = pow(max(dot(n, halfway), 0.0), 60.0) * ocean * dayMix;
  color += vec3(1.0, 0.95, 0.85) * spec * 0.7;

  // Thin blue haze towards the limb (the atmosphere layer adds the outer glow).
  float fresnel = pow(1.0 - max(dot(geoNormal, viewDir), 0.0), 3.0);
  color += vec3(0.25, 0.5, 1.0) * fresnel * (0.15 + 0.5 * dayMix);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
