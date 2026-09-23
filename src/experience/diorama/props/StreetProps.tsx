import * as THREE from 'three'
import { toon, mulberry32 } from '../../materials/toon'

/**
 * Miscellaneous street furniture: trash bins, public notice board,
 * guardrail along the cross road, road mirror, small vegetation,
 * power distribution box, bicycle rack bar.
 * Slightly misaligned — traces of life.
 */

export default function StreetProps() {
  return (
    <group>
      {/* trash bins near the alley mouth (not perfectly aligned) */}
      <TrashBin position={[0.72, 0, -0.55]} color="#4a6a58" rotY={0.12} />
      <TrashBin position={[1.02, 0, -0.5]} color="#5e6a7a" rotY={-0.2} />

      {/* public notice board on sidewalk */}
      <NoticeBoard position={[-2.9, 0, 0.15]} />

      {/* guardrail along cross road west edge */}
      <Guardrail />

      {/* road mirror at the alley corner */}
      <RoadMirror position={[2.6, 0, -0.3]} />

      {/* small shrubs along the back of the sidewalk */}
      <Vegetation />

      {/* power distribution box behind notice board */}
      <mesh position={[-4.0, 0.35, 0.35]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.35]} />
        <primitive object={toon('#59626d')} attach="material" />
      </mesh>

      {/* bicycle rack bar on sidewalk */}
      <mesh position={[1.35, 0.24, 0.3]} rotation={[0, 0.15, 0]}>
        <torusGeometry args={[0.22, 0.02, 6, 16, Math.PI]} />
        <primitive object={toon('#8a936e')} attach="material" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */

function TrashBin({ position, color, rotY }: { position: [number, number, number]; color: string; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.13, 0.64, 12]} />
        <primitive object={toon(color)} attach="material" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 12]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
    </group>
  )
}

function NoticeBoard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0.1, 0]}>
      {/* posts */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 1.5, 6]} />
          <primitive object={toon('#4a5260')} attach="material" />
        </mesh>
      ))}
      {/* board + roof */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[1.35, 0.85, 0.06]} />
        <primitive object={toon('#5c656f')} attach="material" />
      </mesh>
      <mesh position={[0, 1.78, 0.04]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[1.45, 0.05, 0.22]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
      {/* posted papers (one slightly peeled) */}
      <mesh position={[-0.3, 1.32, 0.035]} rotation={[0, 0, 0.03]}>
        <planeGeometry args={[0.34, 0.44]} />
        <primitive object={toon('#d8d2c4')} attach="material" />
      </mesh>
      <mesh position={[0.28, 1.28, 0.035]} rotation={[0.06, 0.15, -0.05]}>
        <planeGeometry args={[0.3, 0.4]} />
        <primitive object={toon('#c9c3b4')} attach="material" />
      </mesh>
    </group>
  )
}

function Guardrail() {
  const railMat = toon('#6a7480')
  return (
    <group>
      {/* vertical posts + two rails along x=2.86, from z=-5 to z=-0.7 */}
      {Array.from({ length: 8 }, (_, i) => -4.8 + i * 0.62).map((z) => (
        <mesh key={z} position={[2.86, 0.32, z]}>
          <boxGeometry args={[0.05, 0.64, 0.05]} />
          <primitive object={toon('#4a5260')} attach="material" />
        </mesh>
      ))}
      {[0.18, 0.46].map((y) => (
        <mesh key={y} position={[2.86, y, -2.85]}>
          <boxGeometry args={[0.05, 0.07, 4.5]} />
          <primitive object={railMat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function RoadMirror({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 3.0, 6]} />
        <primitive object={toon('#4a5260')} attach="material" />
      </mesh>
      {/* convex mirror: sphere with high env reflection */}
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshStandardMaterial color="#aebfcc" roughness={0.08} metalness={0.95} envMapIntensity={2} />
      </mesh>
      <mesh position={[0, 2.88, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>
    </group>
  )
}

function Vegetation() {
  const rand = mulberry32(4242)
  const bushes: Array<{ x: number; z: number; s: number }> = []
  const spots: Array<[number, number]> = [
    [-4.4, -0.05], [-3.9, -0.1], [-0.6, -0.08], [2.3, -0.06], [3.4, -4.5], [-4.5, -3.8], [-1.5, -4.6], [1.8, -4.7],
  ]
  spots.forEach(([x, z]) => bushes.push({ x, z, s: 0.7 + rand() * 0.6 }))

  const leafMat = toon('#3d5a48')
  const leafMat2 = toon('#48654f')

  return (
    <group>
      {bushes.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} scale={b.s}>
          <mesh position={[0, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.2, 8, 6]} />
            <primitive object={i % 2 ? leafMat : leafMat2} attach="material" />
          </mesh>
          <mesh position={[0.14, 0.1, 0.06]}>
            <sphereGeometry args={[0.13, 7, 5]} />
            <primitive object={i % 2 ? leafMat2 : leafMat} attach="material" />
          </mesh>
          {/* wet leaves scattered at base */}
          <mesh position={[0.3, 0.012, 0.2]} rotation={[-Math.PI / 2, 0, rand() * 3]}>
            <circleGeometry args={[0.05, 6]} />
            <primitive object={toon('#6a5a3a')} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
