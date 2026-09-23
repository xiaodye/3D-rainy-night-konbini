import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { toon, attachOutline, mulberry32 } from '../../materials/toon'
import { useExperience, introState } from '../../../state/store'

/**
 * Vending machine in the alley — cyan glow, the second-brightest
 * exterior element after the store. Hoverable (brightness up slightly).
 */
export default function VendingMachine({ position = [1.72, 0, -1.15] }: { position?: [number, number, number] }) {
  const bodyRef = useRef<THREE.Mesh>(null!)
  const frontMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)

  const hovered = useExperience((s) => s.hovered === 'vending')
  const setHovered = useExperience((s) => s.setHovered)
  const hoverK = useRef(1)

  useEffect(() => {
    return attachOutline(bodyRef.current, 0.025)
  }, [])

  // drink cans inside: deterministic colored rows
  const cans = useMemo(() => {
    const rand = mulberry32(77)
    const colors = ['#c98f5a', '#d8a8b0', '#7a9db8', '#d8b26a', '#8a9e6a', '#e8e2d4']
    const out: Array<{ y: number; x: number; c: string }> = []
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 5; i++) {
        out.push({ y: 0.55 + row * 0.32, x: -0.14 + i * 0.07, c: colors[Math.floor(rand() * colors.length)] })
      }
    }
    return out
  }, [])

  useFrame((_, dt) => {
    // hover easing
    const target = hovered ? 1.5 : 1
    hoverK.current += (target - hoverK.current) * Math.min(1, dt * 6)

    // intro phase 2 (0.25–0.55)
    const introK = THREE.MathUtils.clamp((introState.progress - 0.25) / 0.3, 0, 1)
    const k = introK * hoverK.current
    if (frontMatRef.current) frontMatRef.current.emissiveIntensity = 1.3 * k
    if (lightRef.current) lightRef.current.intensity = 1.1 * k
  })

  return (
    <group position={position} rotation={[0, -0.28, 0]}>
      {/* body (hoverable) */}
      <mesh
        ref={bodyRef}
        position={[0, 0.95, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered('vending')
        }}
        onPointerOut={() => setHovered(null)}
      >
        <boxGeometry args={[0.85, 1.9, 0.62]} />
        <primitive object={toon('#39505e')} attach="material" />
      </mesh>

      {/* glowing front panel */}
      <mesh position={[0, 1.06, -0.315]}>
        <planeGeometry args={[0.66, 1.4]} />
        <meshStandardMaterial
          ref={frontMatRef}
          color="#1a3038"
          emissive="#6fd8e8"
          emissiveIntensity={1.3}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* drink cans behind glass */}
      {cans.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, -0.27]}>
          <boxGeometry args={[0.05, 0.13, 0.08]} />
          <primitive object={toon(c.c)} attach="material" />
        </mesh>
      ))}

      {/* selection buttons */}
      <mesh position={[0.3, 0.62, -0.315]}>
        <planeGeometry args={[0.16, 0.7]} />
        <meshStandardMaterial color="#22303a" emissive="#9fe8f0" emissiveIntensity={0.5} />
      </mesh>

      {/* coin slot panel */}
      <mesh position={[0.32, 1.68, -0.315]}>
        <planeGeometry args={[0.14, 0.22]} />
        <primitive object={toon('#2c3a44')} attach="material" />
      </mesh>

      {/* collection flap */}
      <mesh position={[0, 0.18, -0.315]}>
        <planeGeometry args={[0.4, 0.2]} />
        <primitive object={toon('#22303a')} attach="material" />
      </mesh>

      {/* soft cyan light spilling into the alley */}
      <pointLight ref={lightRef} position={[0, 1.1, -0.7]} color="#6fd8e8" intensity={1.1} distance={3.2} />

      {/* side ad decal — abstract toon panel, no real brand */}
      <mesh position={[0.43, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 0.8]} />
        <primitive object={toon('#4a6a78')} attach="material" />
      </mesh>
    </group>
  )
}
