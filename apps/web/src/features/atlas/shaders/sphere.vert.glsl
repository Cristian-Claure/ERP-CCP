// Shared vertex shader for the Earth and the cloud layer.
varying vec2 vUv;
varying vec3 vNormalW;   // world-space normal
varying vec3 vPositionW; // world-space position

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPositionW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
