import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { attachOutline } from '../materials/toon'

/**
 * The diorama base: a 10x10 square slab floating in darkness.
 * Roads and every structure sit ON TOP of it; edges cut off naturally.
 */
export default function Base() {
  const topRef = useRef<THREE.Mesh>(null!)

  useEffect(() => {
    const cleanup = attachOutline(topRef.current, 0.03)
    return cleanup
  }, [])

  return (
    <group>
      {/* slab body: matte charcoal sides */}
      <mesh position={[0, -0.19, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 0.36, 10]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.92} metalness={0} />
      </mesh>
      {/* top surface: dark wet-ground tone (roads cover most of it) */}
      <mesh ref={topRef} position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#151a26" roughness={0.5} metalness={0.04} />
      </mesh>
      {/* faint bottom shadow so the model "floats" in darkness */}
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 11.5]} />
        <meshBasicMaterial color="#05070d" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}
