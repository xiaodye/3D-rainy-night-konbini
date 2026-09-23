import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { toon, attachOutline } from '../../materials/toon'
import StoreExterior from './StoreExterior'
import StoreInterior from './StoreInterior'
import Signage from './Signage'
import { STORE } from './layout'

// re-export so external consumers (GlassRain etc.) keep their import path
export { STORE }

/**
 * MORI MART convenience store building.
 *
 * The building is an open-front shell (side walls + back wall + roof +
 * floor slab) so the full interior is visible through the front glass.
 * The front is mostly glass: two big windows + automatic sliding door.
 * Warm glowing box seen from the street.
 */

export default function Store() {
  const shellRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    const cleanups: Array<() => void> = []
    shellRef.current?.children.forEach((c) => {
      if ((c as THREE.Mesh).isMesh) cleanups.push(attachOutline(c as THREE.Mesh, 0.03))
    })
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const w = STORE.x1 - STORE.x0
  const d = STORE.z1 - STORE.z0
  const T = 0.12 // wall thickness

  // glass material factory — each pane gets its own instance
  // (an R3F primitive object can only be attached once)
  const makeGlass = (opacity = 0.14) =>
    new THREE.MeshPhysicalMaterial({
      color: '#9fc4d8',
      transparent: true,
      opacity,
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.4,
    })

  const shellMat = toon('#d9d3c4')

  return (
    <group>
      {/* open-front shell: side walls + back wall + roof + floor slab */}
      <group ref={shellRef}>
        {/* left wall */}
        <mesh position={[STORE.x0 + T / 2, STORE.h / 2, STORE.cz]} castShadow receiveShadow>
          <boxGeometry args={[T, STORE.h, d]} />
          <primitive object={shellMat} attach="material" />
        </mesh>
        {/* right wall */}
        <mesh position={[STORE.x1 - T / 2, STORE.h / 2, STORE.cz]} castShadow receiveShadow>
          <boxGeometry args={[T, STORE.h, d]} />
          <primitive object={shellMat} attach="material" />
        </mesh>
        {/* back wall */}
        <mesh position={[STORE.cx, STORE.h / 2, STORE.z0 + T / 2]} castShadow receiveShadow>
          <boxGeometry args={[w, STORE.h, T]} />
          <primitive object={shellMat} attach="material" />
        </mesh>
        {/* roof slab */}
        <mesh position={[STORE.cx, STORE.h - 0.06, STORE.cz]} castShadow receiveShadow>
          <boxGeometry args={[w, T, d]} />
          <primitive object={toon('#c4beb0')} attach="material" />
        </mesh>
        {/* floor slab under the interior floor */}
        <mesh position={[STORE.cx, 0.03, STORE.cz]} receiveShadow>
          <boxGeometry args={[w, 0.06, d]} />
          <primitive object={toon('#3a414c')} attach="material" />
        </mesh>
      </group>

      {/* interior: shelves, register, chillers, ceiling... */}
      <StoreInterior />

      {/* --- front glass wall --- */}
      {/* left window */}
      <mesh position={[STORE.x0 + 1.15, 1.15, STORE.z1 + 0.005]}>
        <planeGeometry args={[1.7, 1.75]} />
        <primitive object={makeGlass()} attach="material" />
      </mesh>
      {/* right window */}
      <mesh position={[STORE.x1 - 0.95, 1.15, STORE.z1 + 0.005]}>
        <planeGeometry args={[1.2, 1.75]} />
        <primitive object={makeGlass()} attach="material" />
      </mesh>
      {/* door glass (sliding panels are animated in StoreExterior) */}
      <mesh position={[(STORE.x0 + STORE.x1) / 2 - 0.1, 1.15, STORE.z1 + 0.02]}>
        <planeGeometry args={[1.55, 1.9]} />
        <primitive object={makeGlass(0.1)} attach="material" />
      </mesh>

      {/* window frames */}
      <FrontFrames />

      {/* exterior props + sliding door */}
      <StoreExterior />

      {/* rooftop signage */}
      <Signage />
    </group>
  )
}

/** Thin toon frames dividing the front glass into panels */
function FrontFrames() {
  const frameMat = toon('#5a6470')
  const fz = STORE.z1 + 0.03
  const { x0, x1 } = STORE
  return (
    <group>
      {/* horizontal sill + header (header reaches the roof) */}
      <mesh position={[STORE.cx, 0.3, fz]}>
        <boxGeometry args={[x1 - x0, 0.6, 0.08]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[STORE.cx, 2.16, fz]}>
        <boxGeometry args={[x1 - x0, 0.68, 0.08]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* vertical mullions */}
      {[-2.0, -0.3, 0.35].map((x) => (
        <mesh key={x} position={[x, 1.15, fz]}>
          <boxGeometry args={[0.07, 1.75, 0.06]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
      ))}
      {/* door frame posts */}
      {[-0.95, 0.35].map((x) => (
        <mesh key={x} position={[x, 1.15, fz + 0.01]}>
          <boxGeometry args={[0.09, 1.95, 0.09]} />
          <primitive object={toon('#3d4550')} attach="material" />
        </mesh>
      ))}
    </group>
  )
}
