// Faint trail plus bright "particles" travelling from the warehouse to the customer.
uniform float time;
uniform float speed;

varying float vProgress;
varying float vSeed;
varying vec3 vColor;

void main() {
  float head = fract(time * speed + vSeed);
  float d = vProgress - head;
  // Two particles per arc, with a short comet tail behind each head.
  float p1 = smoothstep(-0.14, 0.0, d) * (1.0 - smoothstep(0.0, 0.012, d));
  float d2 = vProgress - fract(head + 0.5);
  float p2 = smoothstep(-0.14, 0.0, d2) * (1.0 - smoothstep(0.0, 0.012, d2));
  float trail = 0.16 * sin(3.14159 * vProgress);
  float alpha = clamp(trail + max(p1, p2), 0.0, 1.0);
  gl_FragColor = vec4(vColor * (0.7 + 0.8 * max(p1, p2)), alpha);
}
