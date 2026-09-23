import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { toon, attachOutline } from '../../materials/toon'
import { useExperience, introState } from '../../../state/store'

/**
 * Street lamp on the sidewalk in front of the store.
 * The ONLY real shadow-casting light in the scene.
 * Occasionally flickers very subtly.
 */
export default function StreetLamp({ position = [1.15, 0, 0.42] }: { position?: [number, number, number] }) {
  const poleRef = useRef<THREE.Mesh>(null!)
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const spotRef = useRef<THREE.SpotLight>(null!)
  const flicker = useRef({ next: 4 + Math.random() * 6, until: 0, dim: 1 })

  const reducedMotion = useExperience((s) => s.reducedMotion)

  useEffect(() => {
    return attachOutline(poleRef.current, 0.02)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = flicker.current

    // intro: lamp lights up in phase 3 of the entry transition (0.55–0.8)
    const intro = introState.progress
    const introK = THREE.MathUtils.clamp((intro - 0.55) / 0.25, 0, 1)

    let k = 1
    if (!reducedMotion) {
      if (t > f.next) {
        f.until = t + 0.12 + Math.random() * 0.2
        f.next = t + 5 + Math.random() * 11
      }
      if (t < f.until) {
        f.dim = 0.72 + Math.random() * 0.2
      } else {
        f.dim = 1
      }
      k = f.dim
    }

    const final = introK * k
    if (headMatRef.current) headMatRef.current.emissiveIntensity = 2.2 * final
    if (spotRef.current) spotRef.current.intensity = 2.6 * final
  })

  return (
    <group position={position}>
      {/* pole */}
      <mesh ref={poleRef} position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.055, 2.7, 8]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* curved neck (simplified: angled arm) */}
      <mesh position={[0, 2.66, 0.16]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.42, 8]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* lamp head */}
      <mesh position={[0, 2.78, 0.34]} castShadow>
        <boxGeometry args={[0.18, 0.1, 0.34]} />
        <primitive object={toon('#2c333e')} attach="material" />
      </mesh>
      {/* glowing lens */}
      <mesh position={[0, 2.72, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.14, 0.28]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#334"
          emissive="#cfe2ff"
          emissiveIntensity={2.2}
        />
      </mesh>
      {/* the shadow-casting light */}
      <spotLight
        ref={spotRef}
        position={[0, 2.68, 0.34]}
        angle={0.95}
        penumbra={0.6}
        distance={7}
        color="#b8d4ff"
        intensity={2.6}
        castShadow
        shadow-mapsize={[1024, 1024]}
        shadow-bias={-0.0004}
        target-position={[0, 0, 0.2]}
      />
    </group>
  )
}
