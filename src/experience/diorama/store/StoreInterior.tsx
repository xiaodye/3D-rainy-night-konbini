import { useRef, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { toon, mulberry32 } from '../../materials/toon'
import { STORE } from './layout'

/**
 * The store interior — the heart of the diorama.
 * Must read clearly through the front glass: shelves with colorful
 * products (InstancedMesh), register, oden counter, coffee machine,
 * drink chillers, magazine rack, back door, lockers, floor guide.
 *
 * Interior floor is slightly raised; ceiling at 2.2 with light panels.
 * Warm ~3800K light comes from Lighting.tsx + emissive ceiling panels.
 */

const IN = {
  x0: STORE.x0 + 0.12,
  x1: STORE.x1 - 0.12,
  z0: STORE.z0 + 0.12,
  z1: STORE.z1 - 0.1,
  ceil: 2.2,
  floorY: 0.07,
}

/* Japanese-ish product palette (muted, not cyberpunk) */
const PRODUCT_COLORS = [
  '#c98f5a', '#a8b88a', '#d8a8b0', '#7a9db8', '#d8b26a', '#e8e2d4',
  '#b0574e', '#8a9e6a', '#c4785a', '#9a8e78', '#6e88a0', '#d4c08a',
  '#7f9a8a', '#b8988a', '#5f7a8a', '#cfa070',
]

interface BoxSpec {
  pos: [number, number, number]
  scale: [number, number, number]
  color: string
}

/** Generate all product instances deterministically */
function buildProducts(): BoxSpec[] {
  const rand = mulberry32(20260923)
  const out: BoxSpec[] = []

  const shelfRow = (
    cx: number, cz: number, w: number, depth: number,
    levels: number, perRow: number, yBase: number, levelH: number,
  ) => {
    for (let l = 0; l < levels; l++) {
      const y = yBase + l * levelH
      for (let i = 0; i < perRow; i++) {
        const t = (i + 0.5) / perRow - 0.5
        const x = cx + t * w
        const jitter = (rand() - 0.5) * 0.02
        const h = 0.09 + rand() * 0.07
        const wd = w / perRow * (0.55 + rand() * 0.25)
        const dp = depth * (0.6 + rand() * 0.3)
        out.push({
          pos: [x + jitter, y + h / 2 + 0.005, cz + (rand() - 0.5) * 0.03],
          scale: [wd, h, dp],
          color: PRODUCT_COLORS[Math.floor(rand() * PRODUCT_COLORS.length)],
        })
      }
    }
  }

  // island gondola shelves (two rows, center of store)
  shelfRow(-0.35, -1.62, 1.7, 0.42, 4, 9, 0.32, 0.34)
  shelfRow(-0.35, -2.5, 1.7, 0.42, 4, 9, 0.32, 0.34)

  return out
}

/* ------------------------------------------------------------------ */

export default function StoreInterior() {
  return (
    <group>
      {/* floor */}
      <mesh position={[(IN.x0 + IN.x1) / 2, IN.floorY, (IN.z0 + IN.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[IN.x1 - IN.x0, IN.z1 - IN.z0]} />
        <meshStandardMaterial color="#cfc9ba" roughness={0.35} metalness={0.05} />
      </mesh>

      {/* ceiling with recessed light panels */}
      <Ceiling />

      {/* in-store ad banner on the shell's back wall */}
      <mesh position={[-0.6, 1.7, STORE.z0 + 0.14]}>
        <planeGeometry args={[1.1, 0.55]} />
        <primitive object={toon('#e0b25e')} attach="material" />
      </mesh>

      {/* register area */}
      <Register />

      {/* shelves */}
      <Gondolas />
      <LeftWallShelf />
      <BackWallShelf />

      {/* drink chillers along right wall */}
      <Chillers />

      {/* magazine rack near front-right */}
      <MagazineRack />

      {/* back-of-store door + lockers */}
      <BackArea />

      {/* floor guidance decals */}
      <FloorGuide />
    </group>
  )
}

/* ------------------------------------------------------------------ */

function Ceiling() {
  return (
    <group>
      <mesh position={[(IN.x0 + IN.x1) / 2, IN.ceil, (IN.z0 + IN.z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[IN.x1 - IN.x0, IN.z1 - IN.z0]} />
        <meshStandardMaterial color="#e9e4d6" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* glowing light strips */}
      {[-2.4, -1.6, -0.8].map((z) => (
        <mesh key={z} position={[(IN.x0 + IN.x1) / 2, IN.ceil - 0.015, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[IN.x1 - IN.x0 - 0.5, 0.28]} />
          <meshStandardMaterial color="#fff6e0" emissive="#ffe9c4" emissiveIntensity={2.4} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

/** Register counter + POS + coffee machine + oden counter */
function Register() {
  return (
    <group>
      {/* L-shaped counter (two boxes) */}
      <mesh position={[-2.55, 0.42, -0.95]} castShadow>
        <boxGeometry args={[1.15, 0.7, 0.55]} />
        <primitive object={toon('#e6e0d2')} attach="material" />
      </mesh>
      <mesh position={[-2.05, 0.42, -1.35]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.85]} />
        <primitive object={toon('#e6e0d2')} attach="material" />
      </mesh>
      {/* counter top trim */}
      <mesh position={[-2.55, 0.79, -0.95]}>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <primitive object={toon('#b8b2a4')} attach="material" />
      </mesh>

      {/* POS register */}
      <mesh position={[-2.4, 0.95, -1.0]}>
        <boxGeometry args={[0.3, 0.28, 0.22]} />
        <primitive object={toon('#3d4550')} attach="material" />
      </mesh>
      <mesh position={[-2.4, 1.12, -0.96]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.26, 0.18]} />
        <meshStandardMaterial color="#222" emissive="#8fd8b0" emissiveIntensity={0.8} />
      </mesh>

      {/* oden counter (steaming pots) */}
      <mesh position={[-1.55, 0.5, -0.92]}>
        <boxGeometry args={[0.6, 0.86, 0.5]} />
        <primitive object={toon('#8a6a4a')} attach="material" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-1.75 + i * 0.2, 0.94, -0.92]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 10]} />
          <meshStandardMaterial color="#5a4632" emissive="#e8b46a" emissiveIntensity={0.35} />
        </mesh>
      ))}

      {/* coffee machine behind counter */}
      <mesh position={[-2.6, 1.05, -1.42]}>
        <boxGeometry args={[0.42, 0.5, 0.35]} />
        <primitive object={toon('#4a5560')} attach="material" />
      </mesh>
      <mesh position={[-2.6, 1.16, -1.23]}>
        <planeGeometry args={[0.3, 0.12]} />
        <meshStandardMaterial color="#222" emissive="#ff9a5e" emissiveIntensity={0.7} />
      </mesh>

      {/* cigarette showcase behind register (dark glass cabinet) */}
      <mesh position={[-2.62, 1.1, -1.85]}>
        <boxGeometry args={[0.35, 1.0, 0.9]} />
        <primitive object={toon('#333b46')} attach="material" />
      </mesh>
      <mesh position={[-2.43, 1.2, -1.85]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 0.6]} />
        <meshStandardMaterial color="#3a3f4a" emissive="#d8c8a0" emissiveIntensity={0.35} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */

/** Island gondola shelves with instanced products */
function Gondolas() {
  const gondola = (cz: number) => {
    const frame = toon('#d2ccbe')
    return (
      <group key={cz} position={[-0.35, IN.floorY, cz]}>
        {/* base + back panel */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[1.8, 0.24, 0.5]} />
          <primitive object={frame} attach="material" />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[1.8, 1.3, 0.06]} />
          <primitive object={frame} attach="material" />
        </mesh>
        {/* shelf boards */}
        {[0.32, 0.66, 1.0, 1.34].map((y) => (
          <mesh key={y} position={[0, y, 0.03]}>
            <boxGeometry args={[1.72, 0.03, 0.46]} />
            <primitive object={toon('#c4beb0')} attach="material" />
          </mesh>
        ))}
        {/* price tag strips (front edges) */}
        {[0.32, 0.66, 1.0, 1.34].map((y) => (
          <mesh key={'tag' + y} position={[0, y + 0.035, 0.26]}>
            <boxGeometry args={[1.68, 0.025, 0.015]} />
            <primitive object={toon('#f2ede0')} attach="material" />
          </mesh>
        ))}
      </group>
    )
  }

  return (
    <group>
      {gondola(-1.62)}
      {gondola(-2.5)}
      <Products />
    </group>
  )
}

/** All products in a single InstancedMesh */
function Products() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const specs = useMemo(() => buildProducts(), [])

  useLayoutEffect(() => {
    const m = ref.current
    const mat4 = new THREE.Matrix4()
    const color = new THREE.Color()
    specs.forEach((s, i) => {
      mat4.compose(
        new THREE.Vector3(...s.pos),
        new THREE.Quaternion(),
        new THREE.Vector3(...s.scale),
      )
      m.setMatrixAt(i, mat4)
      m.setColorAt(i, color.set(s.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [specs])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, specs.length]} key={specs.length}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        roughness={0.55}
        metalness={0.05}
        emissive="#ffffff"
        emissiveIntensity={0.06}
      />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */

function LeftWallShelf() {
  return (
    <group position={[IN.x0 + 0.3, IN.floorY, -2.1]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.9, 0.2, 0.4]} />
        <primitive object={toon('#d2ccbe')} attach="material" />
      </mesh>
      {[0.45, 0.8, 1.15, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0.02]}>
          <boxGeometry args={[1.86, 0.03, 0.38]} />
          <primitive object={toon('#c4beb0')} attach="material" />
        </mesh>
      ))}
      {/* household goods: a few larger boxes, muted tones */}
      {[
        [-0.6, 0.55, '#8a9e6a'],
        [-0.15, 0.56, '#9a8e78'],
        [0.35, 0.55, '#7f9a8a'],
        [-0.4, 0.9, '#b8988a'],
        [0.15, 0.91, '#6e88a0'],
      ].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 0.02]}>
          <boxGeometry args={[0.28, 0.22, 0.24]} />
          <primitive object={toon(c as string)} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function BackWallShelf() {
  return (
    <group position={[-1.6, IN.floorY, IN.z0 + 0.25]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.4, 0.2, 0.42]} />
        <primitive object={toon('#d2ccbe')} attach="material" />
      </mesh>
      {[0.45, 0.8, 1.15, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2.36, 0.03, 0.4]} />
          <primitive object={toon('#c4beb0')} attach="material" />
        </mesh>
      ))}
      {/* bento/onigiri zone: warmer colors */}
      {[
        [-0.95, 0.56, '#d8b26a'], [-0.55, 0.56, '#c98f5a'], [-0.15, 0.56, '#a8b88a'],
        [0.25, 0.56, '#d8a8b0'], [0.65, 0.56, '#e8e2d4'],
        [-0.75, 0.91, '#b0574e'], [-0.3, 0.91, '#cfa070'], [0.15, 0.91, '#7f9a8a'],
      ].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 0]}>
          <boxGeometry args={[0.3, 0.16, 0.26]} />
          <primitive object={toon(c as string)} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

/** Glowing drink chillers along the right wall (visible from street) */
function Chillers() {
  const chiller = (z: number, hue: string) => (
    <group key={z} position={[IN.x1 - 0.3, IN.floorY, z]}>
      {/* body */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.55, 2.0, 0.8]} />
        <primitive object={toon('#59626d')} attach="material" />
      </mesh>
      {/* glowing front (glass) */}
      <mesh position={[-0.281, 1.15, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.72, 1.5]} />
        <meshStandardMaterial
          color="#3a4048"
          emissive={hue}
          emissiveIntensity={1.5}
          transparent
          opacity={0.75}
        />
      </mesh>
      {/* drink silhouettes: colored bars inside */}
      {[-0.25, 0, 0.25].map((zz, i) => (
        <mesh key={i} position={[-0.24, 1.15, zz]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.14, 1.1]} />
          <primitive object={toon(['#c98f5a', '#a8b88a', '#7a9db8'][i])} attach="material" />
        </mesh>
      ))}
    </group>
  )
  return (
    <group>
      {chiller(-2.75, '#ffd9a0')}
      {chiller(-1.85, '#ffd9a0')}
      {chiller(-0.95, '#a8e0d0')}
    </group>
  )
}

/* ------------------------------------------------------------------ */

function MagazineRack() {
  return (
    <group position={[IN.x1 - 0.32, IN.floorY, -0.75]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.7, 1.0, 0.28]} />
        <primitive object={toon('#d2ccbe')} attach="material" />
      </mesh>
      {[0.35, 0.65, 0.95].map((y) => (
        <mesh key={y} position={[0, y, 0.15]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.62, 0.3, 0.03]} />
          <primitive object={toon('#b0574e')} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function BackArea() {
  return (
    <group>
      {/* back-of-store door on back wall */}
      <mesh position={[-2.85, 1.0, IN.z0 + 0.05]}>
        <boxGeometry args={[0.72, 1.85, 0.06]} />
        <primitive object={toon('#8a936e')} attach="material" />
      </mesh>
      {/* lockers */}
      {[0.2, 0.52].map((dx) => (
        <mesh key={dx} position={[IN.x0 + 0.5 + dx, 1.1, IN.z0 + 0.07]}>
          <boxGeometry args={[0.28, 1.7, 0.1]} />
          <primitive object={toon('#6e88a0')} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function FloorGuide() {
  return (
    <group>
      {/* guidance decal strip from door to register */}
      <mesh position={[-1.7, IN.floorY + 0.005, -0.7]} rotation={[-Math.PI / 2, 0, 0.06]}>
        <planeGeometry args={[0.16, 1.1]} />
        <meshStandardMaterial color="#7f9a8a" roughness={0.6} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}
