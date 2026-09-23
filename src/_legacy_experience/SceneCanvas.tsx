import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { useExperience } from '../state/store'

export default function SceneCanvas() {
  const setQuality = useExperience((s) => s.setQuality)
  const measured = useRef(false)

  useEffect(() => {
    if (measured.current) return
    measured.current = true
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setQuality(isMobile, reducedMotion)
  }, [setQuality])

  const isMobile = useExperience((s) => s.isMobile)

  return (
    <div className="webgl">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        camera={{ fov: 42, near: 0.1, far: 80, position: [-8.5, 8.5, 11] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <color attach="background" args={['#070b14']} />
        <fog attach="fog" args={['#070b14', 16, 40]} />
        <Experience />
      </Canvas>
    </div>
  )
}
