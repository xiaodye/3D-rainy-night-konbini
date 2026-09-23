import * as THREE from 'three'
import { toon } from '../../materials/toon'

/**
 * Street layout on the 10x10 base:
 *  - Main road (E-W):  z ∈ [0.7, 3.1], full width
 *  - Cross road (N-S): x ∈ [2.9, 5.0], full depth → L-corner intersection
 *  - Sidewalk in front of store: z ∈ [-0.4, 0.7]  (x < 2.9)
 *  - Alley strip right of store handled by Alley.tsx
 *
 * Wet asphalt: roughness 0.25 / metalness 0.05 — reflections come from
 * scene env + fake mirror decals (Puddles.tsx).
 */

export const ROAD = {
  main: { z0: 0.7, z1: 3.1 },
  cross: { x0: 2.9, x1: 5.0 },
  sidewalk: { z0: -0.4, z1: 0.7 },
}

const asphaltMat = () =>
  new THREE.MeshStandardMaterial({ color: '#232a36', roughness: 0.28, metalness: 0.06 })

const lineMat = (c = '#c9ceda', o = 0.85) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, transparent: true, opacity: o })

export default function Street() {
  return (
    <group>
      {/* main road */}
      <mesh position={[0, 0.005, (ROAD.main.z0 + ROAD.main.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, ROAD.main.z1 - ROAD.main.z0]} />
        <primitive object={asphaltMat()} attach="material" />
      </mesh>
      {/* cross road */}
      <mesh position={[(ROAD.cross.x0 + ROAD.cross.x1) / 2, 0.005, -2.45]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD.cross.x1 - ROAD.cross.x0, 7.55]} />
        <primitive object={asphaltMat()} attach="material" />
      </mesh>

      {/* sidewalk in front of store (slightly raised) */}
      <Sidewalk />

      {/* markings */}
      <Markings />
    </group>
  )
}

/* ------------------------------------------------------------------ */

function Sidewalk() {
  const paveMat = new THREE.MeshStandardMaterial({ color: '#39404d', roughness: 0.55, metalness: 0.04 })
  const curbMat = toon('#2c333e')

  return (
    <group>
      {/* slab in front of store up to cross road */}
      <mesh position={[(-5 + ROAD.cross.x0) / 2, 0.055, (ROAD.sidewalk.z0 + ROAD.sidewalk.z1) / 2]} receiveShadow>
        <boxGeometry args={[ROAD.cross.x0 + 5, 0.11, ROAD.sidewalk.z1 - ROAD.sidewalk.z0]} />
        <primitive object={paveMat} attach="material" />
      </mesh>
      {/* sidewalk along cross road (west side) */}
      <mesh position={[ROAD.cross.x0 - 0.45, 0.055, -2.65]} receiveShadow>
        <boxGeometry args={[0.9, 0.11, 4.7]} />
        <primitive object={paveMat} attach="material" />
      </mesh>

      {/* curbs (darker edge) */}
      <mesh position={[(-5 + ROAD.cross.x0) / 2, 0.05, ROAD.sidewalk.z1 - 0.04]}>
        <boxGeometry args={[ROAD.cross.x0 + 5, 0.1, 0.08]} />
        <primitive object={curbMat} attach="material" />
      </mesh>
      <mesh position={[ROAD.cross.x0 - 0.88, 0.05, -2.65]}>
        <boxGeometry args={[0.08, 0.1, 4.7]} />
        <primitive object={curbMat} attach="material" />
      </mesh>

      {/* pavement joint lines (subtle) */}
      {[-3.4, -1.9, -0.4, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.112, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, 1.06]} />
          <primitive object={lineMat('#2a313c', 0.9)} attach="material" />
        </mesh>
      ))}

      {/* drainage gutter along curb (dark recess) */}
      <mesh position={[(-5 + ROAD.cross.x0) / 2, 0.113, ROAD.sidewalk.z1 - 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROAD.cross.x0 + 5, 0.09]} />
        <primitive object={lineMat('#11151d', 0.95)} attach="material" />
      </mesh>
      {/* grate lines over gutter */}
      {Array.from({ length: 24 }, (_, i) => -4.8 + i * 0.42).map((x) => (
        <mesh key={x} position={[x, 0.114, ROAD.sidewalk.z1 - 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.015, 0.11]} />
          <primitive object={lineMat('#0d1017', 1)} attach="material" />
        </mesh>
      ))}

      {/* wet leaves near gutter */}
      {[
        [-2.2, 0.55], [-2.05, 0.62], [-1.1, 0.58], [0.4, 0.63], [0.55, 0.55],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.115, z]} rotation={[-Math.PI / 2, 0, i * 1.3]}>
          <circleGeometry args={[0.045, 6]} />
          <primitive object={toon(i % 2 ? '#6a5a3a' : '#7a6242')} attach="material" />
        </mesh>
      ))}

      {/* manhole on main road */}
      <mesh position={[-2.6, 0.012, 2.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshStandardMaterial color="#1c222c" roughness={0.35} metalness={0.3} />
      </mesh>

      {/* manhole on cross road */}
      <mesh position={[3.9, 0.012, -1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshStandardMaterial color="#1c222c" roughness={0.35} metalness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */

function Markings() {
  return (
    <group>
      {/* center dashed line on main road */}
      {Array.from({ length: 7 }, (_, i) => -4.6 + i * 1.45).map((x) => (
        <mesh key={x} position={[x, 0.011, 1.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.09]} />
          <primitive object={lineMat()} attach="material" />
        </mesh>
      ))}
      {/* center line on cross road */}
      {Array.from({ length: 5 }, (_, i) => -3.4 + i * 1.35).map((z) => (
        <mesh key={z} position={[3.95, 0.011, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, 0.7]} />
          <primitive object={lineMat()} attach="material" />
        </mesh>
      ))}

      {/* stop line before intersection */}
      <mesh position={[2.2, 0.011, 0.95]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 0.55]} />
        <primitive object={lineMat()} attach="material" />
      </mesh>

      {/* zebra crossing across cross road */}
      {Array.from({ length: 6 }, (_, i) => 3.1 + i * 0.33).map((x) => (
        <mesh key={x} position={[x, 0.011, 1.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.17, 2.2]} />
          <primitive object={lineMat('#c9ceda', 0.75)} attach="material" />
        </mesh>
      ))}

      {/* parking bay markings on main road edge */}
      {[-4.2, -3.2].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.011, 2.75]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.06, 0.6]} />
            <primitive object={lineMat('#c9ceda', 0.5)} attach="material" />
          </mesh>
        </group>
      ))}
      <mesh position={[-3.7, 0.011, 2.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.05, 0.05]} />
        <primitive object={lineMat('#c9ceda', 0.5)} attach="material" />
      </mesh>
      <mesh position={[-3.7, 0.011, 3.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.05, 0.05]} />
        <primitive object={lineMat('#c9ceda', 0.5)} attach="material" />
      </mesh>
    </group>
  )
}
