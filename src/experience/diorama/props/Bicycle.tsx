import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { toon, attachOutline } from '../../materials/toon'
import { useExperience } from '../../../state/store'

/**
 * A parked bicycle on the sidewalk, leaning slightly on its kickstand.
 * Completely still. Hoverable → outline strength slightly up.
 */
export default function Bicycle({ position = [0.55, 0, -0.12] }: { position?: [number, number, number] }) {
  const wheelRef = useRef<THREE.Group>(null!)
  const frameRef = useRef<THREE.Group>(null!)

  const hovered = useExperience((s) => s.hovered === 'bicycle')
  const setHovered = useExperience((s) => s.setHovered)

  useEffect(() => {
    const cleanups: Array<() => void> = []
    if (wheelRef.current) cleanups.push(attachOutline(wheelRef.current.children[0] as THREE.Mesh, 0.014))
    if (frameRef.current)
      frameRef.current.children.forEach((c) => {
        if ((c as THREE.Mesh).isMesh) cleanups.push(attachOutline(c as THREE.Mesh, 0.012))
      })
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const frameMat = hovered ? toon('#7a9ab0') : toon('#5a7a8e')
  const tireMat = hovered ? toon('#3a4450') : toon('#222831')
  const wheelR = 0.24

  return (
    <group
      position={position}
      rotation={[0, 0.5, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered('bicycle')
      }}
      onPointerOut={() => setHovered(null)}
    >
      {/* wheels */}
      <group ref={wheelRef}>
        <mesh position={[0, wheelR, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[wheelR, 0.022, 8, 24]} />
          <primitive object={tireMat} attach="material" />
        </mesh>
        <mesh position={[0.86, wheelR, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[wheelR, 0.022, 8, 24]} />
          <primitive object={tireMat} attach="material" />
        </mesh>
      </group>

      {/* frame: seat tube, top tube, down tube, stays */}
      <group ref={frameRef}>
        {/* down tube */}
        <mesh position={[0.28, 0.28, 0]} rotation={[0, 0, -0.72]}>
          <cylinderGeometry args={[0.016, 0.016, 0.68, 6]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
        {/* seat tube */}
        <mesh position={[0.16, 0.42, 0]} rotation={[0, 0, 0.22]}>
          <cylinderGeometry args={[0.016, 0.016, 0.42, 6]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
        {/* top tube */}
        <mesh position={[0.5, 0.48, 0]} rotation={[0, 0, -0.06]}>
          <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
        {/* seat stays pair */}
        <mesh position={[0.2, 0.34, 0.05]} rotation={[0.15, 0, 0.75]}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
        <mesh position={[0.2, 0.34, -0.05]} rotation={[-0.15, 0, 0.75]}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
          <primitive object={frameMat} attach="material" />
        </mesh>
      </group>

      {/* saddle */}
      <mesh position={[0.12, 0.64, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.09]} />
        <primitive object={toon('#2c333e')} attach="material" />
      </mesh>
      {/* handlebar */}
      <mesh position={[0.84, 0.58, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.34, 6]} />
        <primitive object={toon('#8a936e')} attach="material" />
      </mesh>
      <mesh position={[0.84, 0.52, 0]}>
        <boxGeometry args={[0.05, 0.14, 0.05]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* basket */}
      <mesh position={[0.95, 0.72, 0]}>
        <boxGeometry args={[0.22, 0.14, 0.24]} />
        <primitive object={toon('#8a7a5a')} attach="material" />
      </mesh>
      {/* kickstand */}
      <mesh position={[0.3, 0.12, 0.1]} rotation={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.3, 6]} />
        <primitive object={toon('#39424e')} attach="material" />
      </mesh>

      {/* hover: no visible UI, only the material lift above */}
    </group>
  )
}
