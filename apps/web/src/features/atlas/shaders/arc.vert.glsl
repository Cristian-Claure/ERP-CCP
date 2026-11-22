// Arcs warehouse → customer, all merged in one LineSegments geometry.
attribute float progress; // 0 at the warehouse, 1 at the customer
attribute float seed;     // per-arc phase so particles are not synchronized
attribute vec3 arcColor;

varying float vProgress;
varying float vSeed;
varying vec3 vColor;

void main() {
  vProgress = progress;
  vSeed = seed;
  vColor = arcColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
