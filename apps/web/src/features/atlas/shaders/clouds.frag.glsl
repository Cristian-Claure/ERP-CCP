// Cloud layer: density from the cloud map, lit by the sun (dark on the night side).
uniform sampler2D cloudsMap;
uniform vec3 sunDirection;
uniform float opacity;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  float density = texture2D(cloudsMap, vUv).r;
  float light = clamp(dot(normalize(vNormalW), sunDirection) * 1.4 + 0.25, 0.0, 1.0);
  vec3 color = mix(vec3(0.04, 0.05, 0.08), vec3(1.0), light);
  gl_FragColor = vec4(color, density * opacity * (0.25 + 0.75 * light));
  #include <colorspace_fragment>
}
