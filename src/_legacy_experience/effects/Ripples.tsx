import { useLayoutEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { rippleBus, useExperience } from '../../state/store'
import { PUDDLE_SPOTS } from '../diorama/street/Puddles'

/**
 * Puddle ripples: an InstancedMesh of flat rings, 5–15 alive at once.
 * Random position (biased to puddles), size, speed, opacity.
 * rippleBus lets drips / anything spawn ripples on demand.
 */

const MAX = 18

interface Ripple {
  x: number
  z: number
  t: number
  dur: number
  maxR: number
  seed: number
}

export default function Ripples() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const ripples = useRef<Ripple[]>([])
  const nextSpawn = useRef(0.2)

  const reducedMotion = useExperience((s) => s.reducedMotion)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    // register spawner for drips etc.
    rippleBus.spawn = (x, z) => {
      if (ripples.current.length < MAX) {
        ripples.current.push({
          x,
          z,
          t: 0,
          dur: 0.9 + Math.random() * 0.7,
          maxR: 0.1 + Math.random() * 0.16,
          seed: Math.random() * Math.PI,
        })
      }
    }
    return () => {
      rippleBus.spawn = null
    }
  }, [])

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.elapsedTime

    // ambient rain-hit ripples (skip when reduced motion / before intro)
    if (!reducedMotion && t > nextSpawn.current) {
      nextSpawn.current = t + 0.25 + Math.random() * 0.55
      const spot = PUDDLE_SPOTS[Math.floor(Math.random() * PUDDLE_SPOTS.length)]
      if (ripples.current.length < 15) {
        ripples.current.push({
          x: spot.pos[0] + (Math.random() - 0.5) * spot.r * 1.4,
          z: spot.pos[2] + (Math.random() - 0.5) * spot.r * 1.4,
          t: 0,
          dur: 0.8 + Math.random() * 0.8,
          maxR: 0.08 + Math.random() * 0.14,
          seed: Math.random() * Math.PI,
        })
      }
    }

    // update lifecycle
    ripples.current = ripples.current.filter((r) => r.t < r.dur)
    ripples.current.forEach((r) => (r.t += dt))

    // write instances
    for (let i = 0; i < MAX; i++) {
      const r = ripples.current[i]
      if (r) {
        const k = r.t / r.dur
        const ease = 1 - Math.pow(1 - k, 2.2)
        const s = Math.max(0.001, r.maxR * ease)
        dummy.position.set(r.x, 0.02, r.z)
        dummy.rotation.set(-Math.PI / 2, 0, r.seed)
        dummy.scale.setScalar(s)
        // fade: brighter early, fading out — additive blending turns
        // dimmer color into lower opacity
        const fade = Math.pow(1 - k, 1.4) * 0.5
        color.setRGB(fade * 0.62, fade * 0.74, fade * 0.85)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.0001)
        color.setRGB(0, 0, 0)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <ringGeometry args={[0.86, 1, 28]} />
      <meshBasicMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
