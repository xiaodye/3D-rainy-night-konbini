import * as THREE from 'three'
import { toon } from '../../materials/toon'
import { STORE } from '../store/layout'

/**
 * The narrow alley to the right of the store (x ∈ [0.9, 2.9], z < 0.7).
 * Ground: darker concrete; a low fence closes the far end;
 * the vending machine + trash bins live here (props/).
 */

export default function Alley() {
  const x0 = STORE.x1
  const x1 = 2.9
  const cx = (x0 + x1) / 2

  const groundMat = new THREE.MeshStandardMaterial({ color: '#1e242f', roughness:0.45, metalness: 0.05 })

  return (
    <group>
      {/* alley ground */}
      <mesh position={[cx, 0.004, -2.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[x1 - x0, 5.2]} />
        <primitive object={groundMat} attach="material" />
      </mesh>

      {/* neighbor building wall fragment (far side of alley) */}
      <mesh position={[x1 - 0.06, 1.5, -3.6]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 3.0, 2.8]} />
        <primitive object={toon('#4a5260')} attach="material" />
      </mesh>
      {/* its small window, dark */}
      <mesh position={[x1 - 0.13, 1.8, -3.6]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.7, 0.9]} />
        <primitive object={toon('#232b38')} attach="material" />
      </mesh>
      {/* AC unit on that wall */}
      <mesh position={[x1 - 0.18, 2.2, -2.6]}>
        <boxGeometry args={[0.3, 0.25, 0.5]} />
        <primitive object={toon('#59626d')} attach="material" />
      </mesh>

      {/* exposed pipes on neighbor wall */}
      {[1.0, 1.3].map((y) => (
        <mesh key={y} position={[x1 - 0.1, y, -2.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
          <primitive object={toon('#3d4550')} attach="material" />
        </mesh>
      ))}

      {/* low fence closing the alley at the back */}
      <group position={[cx, 0, -4.6]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[x1 - x0, 0.06, 0.05]} />
          <primitive object={toon('#4a5560')} attach="material" />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[x1 - x0, 0.05, 0.05]} />
          <primitive object={toon('#4a5560')} attach="material" />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => x0 + 0.25 + i * 0.4).map((x) => (
          <mesh key={x} position={[x, 0.25, 0]}>
            <boxGeometry args={[0.05, 0.55, 0.05]} />
            <primitive object={toon('#3d4550')} attach="material" />
          </mesh>
        ))}
      </group>

      {/* bicycle parking area marking (painted lines on ground) */}
      <mesh position={[cx, 0.01, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, 0.04]} />
        <meshStandardMaterial color="#c9ceda" roughness={0.6} transparent opacity={0.4} />
      </mesh>
    </group>
  )
}
