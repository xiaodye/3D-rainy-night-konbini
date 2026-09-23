import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { toon } from '../../materials/toon'
import { useExperience } from '../../../state/store'

/**
 * Traffic signal at the intersection, hanging from a pole.
 * Slowly cycles green → yellow → red. No shadows, pure emissive.
 */

export default function TrafficLight() {
  const greenRef = useRef<THREE.MeshStandardMaterial>(null!)
  const yellowRef = useRef<THREE.MeshStandardMaterial>(null!)
  const redRef = useRef<THREE.MeshStandardMaterial>(null!)

  const reducedMotion = useExperience((s) => s.reducedMotion)
  // freeze at green if reduced motion
  const cycle = useRef(reducedMotion ? 1 : 0)

  useFrame(({ clock }) => {
    if (reducedMotion) {
      setLamps('green')
      return
    }
    const t = clock.elapsedTime
    // green 8s → yellow 2s → red 8s
    const phase = t % 18
    if (phase < 8) setLamps('green')
    else if (phase < 10) setLamps('yellow')
    else setLamps('red')
    void cycle
  })

  function setLamps(active: 'green' | 'yellow' | 'red') {
    if (greenRef.current) greenRef.current.emissiveIntensity = active === 'green' ? 2.6 : 0.05
    if (yellowRef.current) yellowRef.current.emissiveIntensity = active === 'yellow' ? 2.6 : 0.05
    if (redRef.current) redRef.current.emissiveIntensity = active === 'red' ? 2.6 : 0.05
  }

  return (
    <group position={[2.72, 0, 1.12]}>
      {/* pole on sidewalk corner */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 3.2, 8]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* horizontal mast over the road */}
      <mesh position={[0.8, 3.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.7, 8]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* signal head hanging over intersection */}
      <group position={[1.5, 2.7, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.62, 0.18]} />
          <primitive object={toon('#2c333e')} attach="material" />
        </mesh>
        {/* lamps facing the main road (-z) */}
        <mesh position={[0, 0.19, -0.1]}>
          <circleGeometry args={[0.06, 12]} />
          <meshStandardMaterial ref={redRef} color="#331111" emissive="#ff5a4a" emissiveIntensity={0.05} />
        </mesh>
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[0.06, 12]} />
          <meshStandardMaterial ref={yellowRef} color="#332b11" emissive="#ffca5e" emissiveIntensity={0.05} />
        </mesh>
        <mesh position={[0, -0.19, -0.1]}>
          <circleGeometry args={[0.06, 12]} />
          <meshStandardMaterial ref={greenRef} color="#113322" emissive="#5ee89a" emissiveIntensity={2.6} />
        </mesh>
        {/* small hood over each lamp */}
        {[0.19, 0, -0.19].map((y) => (
          <mesh key={y} position={[0, y, -0.115]}>
            <boxGeometry args={[0.16, 0.03, 0.1]} />
            <primitive object={toon('#232b34')} attach="material" />
          </mesh>
        ))}
      </group>
      {/* pedestrian signal on pole */}
      <mesh position={[0.09, 2.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.16, 0.22]} />
        <meshStandardMaterial color="#221" emissive="#e8a05e" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
