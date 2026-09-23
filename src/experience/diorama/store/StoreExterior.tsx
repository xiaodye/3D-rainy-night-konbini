import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { toon, attachOutline } from '../../materials/toon'
import { useExperience } from '../../../state/store'
import { STORE } from './layout'

/**
 * Exterior details: awning, animated sliding door, doormat, posters,
 * promo stickers, umbrella stand, trash bin, AC units, drainpipe,
 * meter box, wall pipes, back door, bicycle rack.
 */

export default function StoreExterior() {
  return (
    <group>
      <Awning />
      <SlidingDoor />
      <FrontDetails />
      <SideAndBack />
    </group>
  )
}

/* ------------------------------------------------------------------ */

function Awning() {
  const ref = useRef<THREE.Mesh>(null!)
  useEffect(() => {
    return attachOutline(ref.current, 0.025)
  }, [])
  // flat canopy protruding over the front glass
  const y = 2.28
  const zOut = STORE.z1 + 0.52
  return (
    <group>
      <mesh ref={ref} position={[STORE.cx, y, (STORE.z1 + zOut) / 2]} castShadow>
        <boxGeometry args={[STORE.x1 - STORE.x0 + 0.15, 0.09, 1.08]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* warm strip light under the awning */}
      <mesh position={[STORE.cx, y - 0.055, STORE.z1 + 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STORE.x1 - STORE.x0 - 0.2, 0.8]} />
        <meshStandardMaterial color="#332211" emissive="#ffd9a0" emissiveIntensity={1.15} roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */

/** Automatic sliding door: opens randomly every 15–30s, waits 1–2s, closes. */
function SlidingDoor() {
  const leftRef = useRef<THREE.Mesh>(null!)
  const rightRef = useRef<THREE.Mesh>(null!)

  const state = useRef({
    open: 0, // 0 closed .. 1 open
    target: 0,
    nextAt: 6 + Math.random() * 10,
    holdUntil: 0,
  })

  const reducedMotion = useExperience((s) => s.reducedMotion)

  useFrame(({ clock }) => {
    const s = state.current
    if (reducedMotion) {
      s.open = 0
    } else {
      const t = clock.elapsedTime
      if (s.target === 0 && t > s.nextAt) {
        s.target = 1
        s.holdUntil = t + 1.2 + Math.random() * 0.8
      } else if (s.target === 1 && t > s.holdUntil) {
        s.target = 0
        s.nextAt = t + 15 + Math.random() * 15
      }
      // ease toward target
      const speed = 1.6
      s.open += Math.sign(s.target - s.open) * Math.min(speed * 0.016, Math.abs(s.target - s.open))
    }
    const slide = s.open * 0.62
    if (leftRef.current) leftRef.current.position.x = -0.32 - slide
    if (rightRef.current) rightRef.current.position.x = 0.32 + slide
  })

  const makeGlass = () =>
    new THREE.MeshPhysicalMaterial({
      color: '#a8cce0',
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.15,
      envMapIntensity: 1.2,
    })

  const doorY = 1.05
  const doorZ = STORE.z1 + 0.02

  return (
    <group>
      {/* left panel */}
      <mesh ref={leftRef} position={[-0.32, doorY, doorZ]}>
        <boxGeometry args={[0.68, 2.1, 0.05]} />
        <primitive object={makeGlass()} attach="material" />
      </mesh>
      {/* right panel */}
      <mesh ref={rightRef} position={[0.32, doorY, doorZ]}>
        <boxGeometry args={[0.68, 2.1, 0.05]} />
        <primitive object={makeGlass()} attach="material" />
      </mesh>
      {/* door rail */}
      <mesh position={[STORE.cx + 0.1, 2.14, doorZ]}>
        <boxGeometry args={[1.9, 0.06, 0.08]} />
        <primitive object={toon('#3d4550')} attach="material" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */

function FrontDetails() {
  const posterMat = (c: string) => toon(c)
  return (
    <group>
      {/* doormat */}
      <mesh position={[STORE.cx - 0.1, 0.012, STORE.z1 + 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.55]} />
        <meshStandardMaterial color="#2c3038" roughness={0.95} />
      </mesh>

      {/* umbrella stand (right of door) */}
      <group position={[STORE.x1 - 0.28, 0, STORE.z1 + 0.34]}>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.14, 0.11, 0.56, 10]} />
          <primitive object={toon('#4a5560')} attach="material" />
        </mesh>
        {/* two closed umbrellas, different angles */}
        {[
          { rot: 0.16, tilt: 0.1 },
          { rot: -0.2, tilt: -0.14 },
        ].map((u, i) => (
          <group key={i} rotation={[u.tilt, u.rot, 0]} position={[0.02 * (i ? -1 : 1), 0.4, 0]}>
            <mesh>
              <cylinderGeometry args={[0.014, 0.014, 0.72, 6]} />
              <primitive object={toon(i ? '#6e5a4a' : '#3f5568')} attach="material" />
            </mesh>
          </group>
        ))}
      </group>

      {/* posters on front wall (slightly curled = slight offset) */}
      <mesh position={[STORE.x0 + 0.42, 1.5, STORE.z1 + 0.055]} rotation={[0, 0, 0.03]}>
        <planeGeometry args={[0.5, 0.7]} />
        <primitive object={posterMat('#c9a25e')} attach="material" />
      </mesh>
      <mesh position={[STORE.x1 - 0.42, 1.55, STORE.z1 + 0.05]} rotation={[0, 0, -0.025]}>
        <planeGeometry args={[0.42, 0.58]} />
        <primitive object={posterMat('#7a8f6a')} attach="material" />
      </mesh>

      {/* promo stickers on window (tiny, low contrast) */}
      {[
        [-2.45, 1.7],
        [-1.35, 0.72],
        [0.52, 1.62],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, STORE.z1 + 0.045]}>
          <planeGeometry args={[0.16, 0.16]} />
          <primitive object={toon(i === 1 ? '#d8b26a' : '#b0574e')} attach="material" />
        </mesh>
      ))}

      {/* bicycle parking marks on sidewalk (painted) handled in Street */}
    </group>
  )
}

/* ------------------------------------------------------------------ */

function SideAndBack() {
  return (
    <group>
      {/* AC outdoor units on roof */}
      {[
        [STORE.x0 + 0.7, STORE.z0 + 0.8, 0.12],
        [STORE.x0 + 1.9, STORE.z0 + 0.7, -0.08],
      ].map(([x, z, rot], i) => (
        <group key={i} position={[x, STORE.h + 0.17, z]} rotation={[0, rot as number, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.34, 0.42]} />
            <primitive object={toon('#59626d')} attach="material" />
          </mesh>
          {/* fan grill */}
          <mesh position={[0, 0.02, 0.215]}>
            <circleGeometry args={[0.15, 12]} />
            <primitive object={toon('#3a424c')} attach="material" />
          </mesh>
        </group>
      ))}

      {/* roof access hatch */}
      <mesh position={[STORE.cx + 0.8, STORE.h + 0.08, STORE.cz + 0.6]}>
        <boxGeometry args={[0.4, 0.16, 0.4]} />
        <primitive object={toon('#4a5560')} attach="material" />
      </mesh>

      {/* drainpipe down the back-right corner */}
      <mesh position={[STORE.x1 - 0.07, STORE.h / 2, STORE.z0 + 0.08]}>
        <cylinderGeometry args={[0.035, 0.035, STORE.h, 8]} />
        <primitive object={toon('#48525c')} attach="material" />
      </mesh>
      {/* elbow + horizontal run along back wall */}
      <mesh position={[STORE.cx - 0.4, 0.25, STORE.z0 + 0.07]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.033, 0.033, 2.2, 8]} />
        <primitive object={toon('#48525c')} attach="material" />
      </mesh>

      {/* electric meter box + wall pipes on back wall */}
      <mesh position={[STORE.x0 + 1.1, 1.55, STORE.z0 - 0.005]}>
        <boxGeometry args={[0.3, 0.4, 0.12]} />
        <primitive object={toon('#5c656f')} attach="material" />
      </mesh>
      {[1.9, 2.15].map((y) => (
        <mesh key={y} position={[STORE.cx + 0.6, y, STORE.z0 - 0.01]}>
          <boxGeometry args={[2.4, 0.05, 0.05]} />
          <primitive object={toon('#3d4550')} attach="material" />
        </mesh>
      ))}

      {/* back door */}
      <mesh position={[STORE.cx - 0.9, 0.9, STORE.z0 - 0.01]}>
        <boxGeometry args={[0.75, 1.8, 0.06]} />
        <primitive object={toon('#6a7480')} attach="material" />
      </mesh>
      {/* step */}
      <mesh position={[STORE.cx - 0.9, 0.06, STORE.z0 - 0.18]}>
        <boxGeometry args={[0.85, 0.12, 0.32]} />
        <primitive object={toon('#565f68')} attach="material" />
      </mesh>
    </group>
  )
}
