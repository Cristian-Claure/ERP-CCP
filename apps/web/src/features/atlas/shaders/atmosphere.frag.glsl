// Outer atmosphere: back-face shell with a fresnel glow, brighter on the day side.
uniform vec3 sunDirection;
uniform vec3 dayColor;
uniform vec3 twilightColor;

varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPositionW);
  // Back faces: the normal points away from the camera; the glow peaks at the limb.
  float rim = pow(clamp(0.62 + dot(viewDir, n), 0.0, 1.0), 3.5);
  float sun = dot(-n, sunDirection);
  vec3 color = mix(twilightColor, dayColor, smoothstep(-0.3, 0.5, sun));
  float intensity = rim * (0.25 + 0.95 * smoothstep(-0.45, 0.35, sun));
  gl_FragColor = vec4(color, intensity);
  #include <colorspace_fragment>
}
