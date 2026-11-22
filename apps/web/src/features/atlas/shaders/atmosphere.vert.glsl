varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPositionW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
