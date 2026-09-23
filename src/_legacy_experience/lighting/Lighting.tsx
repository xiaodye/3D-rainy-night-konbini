import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useExperience, introState } from '../../state/store'
import { STORE } from '../diorama/store/layout'

/**
 * Lighting rig:
 *  - Very weak hemisphere ambient (cool navy) — basic visibility only
 *  - Main light: warm interior point light + spill spotlight onto sidewalk
 *  - Street lamp light lives in StreetLamp.tsx (shadow caster)
 *  - Vending machine light lives in VendingMachine.tsx
 *  - Procedural deep-navy environment map for wet reflections
 *
 * Entry transition (phase 'entering', 2.2s total):
 *  ambient 0–0.25 → store 0.25–0.55 → lamp 0.55–0.8 (in StreetLamp)
 *  → rain 0.8–1 (in Rain). Global exposure rises with progress so the
 *  model emerges from darkness.
 */

export default function Lighting() {
  const hemiRef = useRef<THREE.HemisphereLight>(null!)
  const storeLightRef = useRef<THREE.PointLight>(null!)
  const shelfLightRef = useRef<THREE.PointLight>(null!)
  const spillRef = useRef<THREE.SpotLight>(null!)

  const phase = useExperience((s) => s.phase)
  const setPhase = useExperience((s) => s.setPhase)

  useFrame(({ gl, clock }, dt) => {
    if (phase === 'entering') {
      introState.progress = Math.min(1, introState.progress + dt / 2.2)
      if (introState.progress >= 1) {
        introState.progress = 1
        setPhase('ready')
      }
    }
    const p = introState.progress

    // staged light ramp-up
    const hemiK = THREE.MathUtils.clamp(p / 0.25, 0.001, 1)
    const storeK = THREE.MathUtils.clamp((p - 0.25) / 0.3, 0, 1)

    if (hemiRef.current) hemiRef.current.intensity = 0.38 * hemiK
    if (storeLightRef.current) storeLightRef.current.intensity = 4.6 * storeK
    if (shelfLightRef.current) shelfLightRef.current.intensity = 1.8 * storeK
    if (spillRef.current) spillRef.current.intensity = 2.2 * storeK

    // global exposure: emerge from darkness (subtle, never fully black)
    gl.toneMappingExposure = 0.25 + 0.8 * THREE.MathUtils.smoothstep(p, 0, 0.85)

    void clock
  })

  return (
    <group>
      <hemisphereLight ref={hemiRef} args={['#2a3a5c', '#0a0e18', 0.38]} />
      {/* warm interior main light */}
      <pointLight
        ref={storeLightRef}
        position={[STORE.cx, 1.85, STORE.cz]}
        color="#ffd9a0"
        intensity={4.6}
        distance={7}
        decay={1.3}
      />
      {/* secondary warm fill over the shelf aisles */}
      <pointLight
        ref={shelfLightRef}
        position={[STORE.cx, 1.9, STORE.cz - 0.7]}
        color="#ffca7a"
        intensity={1.8}
        distance={4.5}
        decay={1.4}
      />
      {/* warm spill from the door onto the sidewalk */}
      <spotLight
        ref={spillRef}
        position={[STORE.cx, 1.5, STORE.z1 + 0.1]}
        angle={1.05}
        penumbra={0.75}
        distance={4.5}
        color="#ffca7a"
        intensity={2.2}
        target-position={[STORE.cx, 0, STORE.z1 + 1.1]}
      />
      {/* cool fill from above-right, no shadows — keeps navy mood on roofs */}
      <directionalLight position={[6, 8, 4]} intensity={0.14} color="#3a4e6e" />
      <EnvSetup />
    </group>
  )
}

/** Procedural deep-navy gradient environment (no HDRI download) */
function EnvSetup() {
  const { gl, scene } = useThree()

  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const envScene = new THREE.Scene()

    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          // deep navy gradient, hint of wet-street glow at horizon
          vec3 top = vec3(0.024, 0.037, 0.066);
          vec3 mid = vec3(0.043, 0.063, 0.104);
          vec3 bot = vec3(0.055, 0.075, 0.11);
          vec3 col = mix(bot, mid, smoothstep(0.0, 0.5, h));
          col = mix(col, top, smoothstep(0.5, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    const geo = new THREE.SphereGeometry(12, 24, 16)
    envScene.add(new THREE.Mesh(geo, mat))

    // sigma must stay 0 — the gradient is already smooth, and any blur
    // above ~0.04 exceeds PMREM's 20-sample limit (console warning)
    const rt = pmrem.fromScene(envScene, 0)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.5

    return () => {
      scene.environment = null
      rt.dispose()
      pmrem.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, [gl, scene])

  return null
}
