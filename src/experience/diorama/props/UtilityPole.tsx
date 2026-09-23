import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { toon, attachOutline } from '../../materials/toon'
import { useExperience } from '../../../state/store'

/**
 * Utility poles along the main road with drooping electric wires
 * (CatmullRomCurve3 + TubeGeometry). Wires sway very slightly in wind.
 * Wires fade out near the base edge — "a small world cut out".
 */

function wireCurve(
  a: THREE.Vector3,
  b: THREE.Vector3,
  sag: number,
): THREE.CatmullRomCurve3 {
  const mid = a.clone().add(b).multiplyScalar(0.5)
  mid.y -= sag
  return new THREE.CatmullRomCurve3([a, mid, b])
}

export default function UtilityPole() {
  const wiresRef = useRef<THREE.Group>(null!)

  const reducedMotion = useExperience((s) => s.reducedMotion)

  // wire geometries (static shapes; sway done via group rotation)
  const wires = useMemo(() => {
    const poleTop = (x: number, y: number, z: number) => [
      new THREE.Vector3(x - 0.18, y, z),
      new THREE.Vector3(x, y + 0.02, z),
      new THREE.Vector3(x + 0.18, y, z),
    ]
    const p1 = poleTop(-4.2, 3.05, 3.55) // near west edge
    const p2 = poleTop(1.35, 3.05, 3.55) // mid

    const curves: THREE.CatmullRomCurve3[] = []
    for (let i = 0; i < 3; i++) {
      curves.push(wireCurve(p1[i], p2[i], 0.28))
    }
    // second span heading off the base edge
    curves.push(wireCurve(new THREE.Vector3(1.35, 3.05, 3.55), new THREE.Vector3(5.05, 3.02, 3.55), 0.3))
    curves.push(wireCurve(new THREE.Vector3(1.35, 2.88, 3.55), new THREE.Vector3(5.05, 2.86, 3.55), 0.25))
    // short stub wire from west pole heading off west edge
    curves.push(wireCurve(new THREE.Vector3(-4.2, 3.05, 3.55), new THREE.Vector3(-5.05, 3.0, 3.55), 0.18))

    return curves.map((c) => new THREE.TubeGeometry(c, 24, 0.012, 5, false))
  }, [])

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.elapsedTime
    // extremely subtle sway
    if (wiresRef.current) {
      wiresRef.current.rotation.z = Math.sin(t * 0.6) * 0.004
      wiresRef.current.rotation.x = Math.cos(t * 0.43) * 0.003
    }
  })

  return (
    <group>
      {/* pole 1 — west */}
      <UtilityPoleUnit position={[-4.2, 0, 3.55]} height={3.2} />
      {/* pole 2 — mid */}
      <UtilityPoleUnit position={[1.35, 0, 3.55]} height={3.2} />

      {/* wires */}
      <group ref={wiresRef}>
        {wires.map((geo, i) => (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial color="#171c26" roughness={0.7} />
          </mesh>
        ))}
      </group>

    </group>
  )
}

function UtilityPoleUnit({ position, height }: { position: [number, number, number]; height: number }) {
  const poleRef = useRef<THREE.Mesh>(null!)
  useEffect(() => {
    return attachOutline(poleRef.current, 0.02)
  }, [])
  return (
    <group position={position}>
      {/* pole */}
      <mesh ref={poleRef} position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, height, 8]} />
        <primitive object={toon('#4a5260')} attach="material" />
      </mesh>
      {/* crossarms */}
      <mesh position={[0, height - 0.15, 0]}>
        <boxGeometry args={[0.66, 0.05, 0.05]} />
        <primitive object={toon('#3a424c')} attach="material" />
      </mesh>
      <mesh position={[0, height - 0.34, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <primitive object={toon('#3a424c')} attach="material" />
      </mesh>
      {/* transformer drum */}
      <mesh position={[0.14, height - 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.26, 10]} />
        <primitive object={toon('#59626d')} attach="material" />
      </mesh>
      {/* small street sign on pole */}
      <mesh position={[0.08, 1.7, 0.06]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.12, 0.02]} />
        <primitive object={toon('#7a9db8')} attach="material" />
      </mesh>
      {/* cable loop */}
      <mesh position={[0, 2.35, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <primitive object={toon('#2c333e')} attach="material" />
      </mesh>
    </group>
  )
}
