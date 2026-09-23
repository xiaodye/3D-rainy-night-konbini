import { useMemo } from 'react'
import * as THREE from 'three'
import { toon, mulberry32 } from '../../materials/toon'

/**
 * Puddles: irregular dark mirror patches with high reflectivity.
 * Neon/warm reflections on the wet ground are faked with additive
 * gradient decals (cheap, looks great in a diorama).
 * Ripple animation lives in effects/Ripples.tsx.
 */

/** Irregular puddle shape: circle with noisy radius */
function puddleGeometry(seed: number, baseR: number): THREE.BufferGeometry {
  const geo = new THREE.CircleGeometry(baseR, 24)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const rand = mulberry32(seed)
  const noises = Array.from({ length: 25 }, () => 0.75 + rand() * 0.4)
  for (let i = 1; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const len = Math.hypot(x, y)
    if (len > 0.001) {
      const k = noises[i] ?? 1
      pos.setXY(i, (x / len) * baseR * k, (y / len) * baseR * k)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

const puddleMat = new THREE.MeshStandardMaterial({
  color: '#0b1220',
  roughness: 0.05,
  metalness: 0.92,
  envMapIntensity: 2.2,
})

/** Shared with effects/Ripples.tsx so ripples land inside puddles */
export const PUDDLE_SPOTS = [
  { seed: 11, r: 0.55, pos: [-1.3, 0.008, 1.35] as [number, number, number] },
  { seed: 22, r: 0.42, pos: [1.1, 0.008, 2.3] as [number, number, number] },
  { seed: 33, r: 0.5, pos: [3.7, 0.008, 0.4] as [number, number, number] },
  { seed: 44, r: 0.36, pos: [1.9, 0.008, -1.2] as [number, number, number] },
  { seed: 55, r: 0.3, pos: [-3.8, 0.008, 0.3] as [number, number, number] },
  { seed: 66, r: 0.45, pos: [4.3, 0.008, -2.8] as [number, number, number] },
]

export default function Puddles() {
  const geos = useMemo(() => PUDDLE_SPOTS, [])

  return (
    <group>
      {geos.map((g) => (
        <mesh key={g.seed} geometry={puddleGeometry(g.seed, g.r)} position={g.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={puddleMat} attach="material" />
        </mesh>
      ))}

      {/* fake light reflections on wet ground */}
      <GroundGlow position={[-1.2, 0.013, 0.75]} size={[1.6, 1.4]} color="#ffd9a0" opacity={0.34} />
      {/* store window warm spill toward street */}
      <GroundGlow position={[-1.25, 0.014, 0.42]} size={[2.6, 0.9]} color="#ffca7a" opacity={0.22} />
      {/* sign green tint reflection */}
      <GroundGlow position={[-1.2, 0.012, 1.75]} size={[2.2, 0.7]} color="#7fd8a0" opacity={0.12} />
      {/* vending machine cyan glow in alley */}
      <GroundGlow position={[1.75, 0.012, -1.15]} size={[1.1, 1.2]} color="#6fd8e8" opacity={0.3} />
      {/* traffic light tint at intersection */}
      <GroundGlow position={[3.6, 0.012, 1.0]} size={[0.9, 1.0]} color="#d86a5a" opacity={0.1} />
      {/* street lamp pool */}
      <GroundGlow position={[1.15, 0.015, 1.05]} size={[1.7, 1.7]} color="#b8d4ff" opacity={0.16} />
    </group>
  )
}

/* ------------------------------------------------------------------ */

/** Additive vertical-gradient ground decal = cheap neon reflection */
function GroundGlow({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number]
  size: [number, number]
  color: string
  opacity: number
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
