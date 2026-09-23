import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { rippleBus, useExperience } from '../../state/store'
import { STORE } from '../diorama/store/Store'

/**
 * Eaves drips: occasional drops fall from the awning edge, land with a
 * tiny splash ripple. Small CPU particle pool (~24) — negligible cost.
 */

interface Drop {
  x: number
  z: number
  y: number
  speed: number
  alive: boolean
}

export default function Drips() {
  const isMobile = useExperience((s) => s.isMobile)
  const reducedMotion = useExperience((s) => s.reducedMotion)

  const POINTS = isMobile ? 10 : 24
  const pointsRef = useRef<THREE.Points>(null!)

  const drops = useMemo<Drop[]>(() => {
    return Array.from({ length: POINTS }, () => ({
      x: STORE.x0 + 0.4 + Math.random() * (STORE.x1 - STORE.x0 - 0.8),
      z: STORE.z1 + 1.02 + (Math.random() - 0.5) * 0.05,
      y: 2.24,
      speed: 0,
      alive: false,
    }))
  }, [POINTS])

  const nextDrop = useRef(0)

  const { geometry } = useMemo(() => {
    const positions = new Float32Array(POINTS * 3)
    for (let i = 0; i < POINTS; i++) {
      positions[i * 3 + 1] = -10 // hidden
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry: g }
  }, [POINTS])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const posAttr = geometry.attributes.position as THREE.BufferAttribute

    if (!reducedMotion && t > nextDrop.current) {
      // release 1–3 drops at once (heavier release occasionally)
      const n = 1 + Math.floor(Math.random() * 3)
      for (let k = 0; k < n; k++) {
        const d = drops.find((d) => !d.alive)
        if (d) {
          d.alive = true
          d.y = 2.24
          d.speed = 0.4
          d.x = STORE.x0 + 0.4 + Math.random() * (STORE.x1 - STORE.x0 - 0.8)
        }
      }
      nextDrop.current = t + 0.35 + Math.random() * 1.4
    }

    drops.forEach((d, i) => {
      if (!d.alive) {
        posAttr.setXYZ(i, 0, -10, 0)
        return
      }
      d.speed += 7.5 * dt // gravity-ish
      d.y -= d.speed * dt
      if (d.y <= 0.02) {
        // splash!
        d.alive = false
        rippleBus.spawn?.(d.x, d.z + (Math.random() - 0.5) * 0.3)
        posAttr.setXYZ(i, 0, -10, 0)
      } else {
        posAttr.setXYZ(i, d.x, d.y, d.z)
      }
    })
    posAttr.needsUpdate = true
    void pointsRef
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#9fb8d8"
        size={0.035}
        transparent
        opacity={0.65}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
