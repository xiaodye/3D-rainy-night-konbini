import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useExperience, introState } from '../../state/store'

/**
 * Steady autumn rain — LineSegments, fully GPU-driven.
 * Each drop = 2 vertices sharing attributes; the vertex shader loops
 * the fall. Nearby drops are more visible; distant ones fade (fog-like).
 */

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aLen;
  attribute float aEnd;
  uniform float uTime;
  uniform float uHeight;
  varying float vFogDepth;

  void main() {
    vec3 p = position;
    float fall = mod(uTime * aSpeed + aSeed * uHeight * 7.13, uHeight);
    p.y = uHeight - fall + aEnd * aLen;
    // gentle wind drift
    p.x += sin(uTime * 0.4 + aSeed * 6.2831) * 0.22;
    p.z += cos(uTime * 0.31 + aSeed * 4.7123) * 0.1;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFogDepth;

  void main() {
    // near: visible; far: dissolving into the night
    float depthFade = smoothstep(26.0, 5.0, vFogDepth);
    float a = uOpacity * depthFade;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

export default function Rain() {
  const isMobile = useExperience((s) => s.isMobile)
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const { geometry, count } = useMemo(() => {
    const count = isMobile ? 900 : 3200
    const positions = new Float32Array(count * 2 * 3)
    const seeds = new Float32Array(count * 2)
    const speeds = new Float32Array(count * 2)
    const lens = new Float32Array(count * 2)
    const ends = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 13
      const z = (Math.random() - 0.5) * 13
      const seed = Math.random()
      const speed = 7.5 + Math.random() * 4 // units/s
      const len = 0.16 + Math.random() * 0.22

      for (let v = 0; v < 2; v++) {
        const o = (i * 2 + v) * 3
        positions[o] = x
        positions[o + 1] = 0 // computed in shader
        positions[o + 2] = z
        seeds[i * 2 + v] = seed
        speeds[i * 2 + v] = speed
        lens[i * 2 + v] = len
        ends[i * 2 + v] = v // 0 = tail, 1 = head
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geometry.setAttribute('aLen', new THREE.BufferAttribute(lens, 1))
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
    return { geometry, count }
  }, [isMobile])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.elapsedTime
    // rain fades in during the last intro phase (0.8–1)
    const k = THREE.MathUtils.clamp((introState.progress - 0.8) / 0.2, 0, 1)
    matRef.current.uniforms.uOpacity.value = 0.32 * k
  })

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
          uHeight: { value: 9 },
          uColor: { value: new THREE.Color('#8fa8c8') },
          uOpacity: { value: 0 },
        }}
      />
    </lineSegments>
  )
}
