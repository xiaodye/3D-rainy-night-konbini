import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { STORE } from '../diorama/store/layout'

/**
 * Rain streaks on the storefront glass: a shader overlay plane just in
 * front of the windows — slow vertical trails, extremely faint.
 * The glass stays transparent; the store remains fully visible.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float streak = 0.0;

    // two layers of slow vertical trails moving at different speeds
    float col1 = floor(uv.x * 68.0);
    float row1 = floor(uv.y * 3.0 + uTime * 0.14);
    float s1 = hash(vec2(col1, row1));
    streak += smoothstep(0.82, 0.98, s1) * 0.9;

    float col2 = floor(uv.x * 120.0 + 31.0);
    float row2 = floor(uv.y * 4.0 - uTime * 0.09);
    float s2 = hash(vec2(col2, row2));
    streak += smoothstep(0.88, 0.99, s2) * 0.6;

    // sparse static droplets
    float dot_ = smoothstep(0.985, 1.0, hash(floor(uv * vec2(140.0, 90.0))));

    float a = streak * 0.07 + dot_ * 0.12;
    // fade streaks near the edges of the glass
    a *= smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    gl_FragColor = vec4(vec3(0.72, 0.82, 0.92), a);
  }
`

export default function GlassRain() {
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  const w = STORE.x1 - STORE.x0 - 0.3
  return (
    <group>
      {/* one overlay across the whole glass front, just outside */}
      <mesh position={[STORE.cx - 0.05, 1.15, STORE.z1 + 0.075]}>
        <planeGeometry args={[w, 2.05]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          uniforms={{ uTime: { value: 0 } }}
        />
      </mesh>
    </group>
  )
}
