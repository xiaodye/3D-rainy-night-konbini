import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { attachOutline } from '../../materials/toon'
import { useExperience } from '../../../state/store'
import { STORE } from './layout'

/**
 * Rooftop sign: "MORI MART" canvas texture, soft-green glow.
 * Brand color: muted green (#7fd8a0-ish), NOT copied from any real chain.
 * Very subtle brightness fluctuation, never a hard flicker.
 */

function makeSignTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')!

  // sign background: deep green panel
  ctx.fillStyle = '#0d3a2b'
  ctx.fillRect(0, 0, 1024, 256)

  // border line
  ctx.strokeStyle = 'rgba(160, 230, 190, 0.5)'
  ctx.lineWidth = 8
  ctx.strokeRect(14, 14, 996, 228)

  // brand text
  ctx.fillStyle = '#d9f7e6'
  ctx.font = '600 118px "Helvetica Neue", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '18px'
  ctx.fillText('MORI MART', 512, 128)

  // small sub text
  ctx.font = '400 34px "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = 'rgba(160, 230, 190, 0.75)'
  ctx.letterSpacing = '10px'
  ctx.fillText('CONVENIENCE · 24 HRS', 512, 208)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export default function Signage() {
  const groupRef = useRef<THREE.Group>(null!)
  const signRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)

  const tex = useMemo(() => makeSignTexture(), [])

  // side sign texture (vertical)
  const sideTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#0d3a2b'
    ctx.fillRect(0, 0, 256, 512)
    ctx.fillStyle = '#d9f7e6'
    ctx.font = '600 92px "Helvetica Neue", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // vertical MORI MART
    const chars = 'MORI MART'.split('')
    chars.forEach((ch, i) => {
      if (ch === ' ') return
      ctx.fillText(ch, 128, 52 + i * 52)
    })
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    groupRef.current.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.outlined) {
        cleanups.push(attachOutline(o as THREE.Mesh, 0.025))
      }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const reducedMotion = useExperience((s) => s.reducedMotion)
  const hovered = useExperience((s) => s.hovered === 'sign')
  const setHovered = useExperience((s) => s.setHovered)
  const intensity = useRef(1.35) // eased actual value
  const BREATH_BASE = 1.35
  const HOVER_BASE = 1.9

  useFrame(({ clock }, dt) => {
    // hover easing toward a slightly brighter sign
    const target = hovered ? HOVER_BASE : BREATH_BASE
    intensity.current += (target - intensity.current) * Math.min(1, dt * 5)
    if (reducedMotion) {
      if (matRef.current) matRef.current.emissiveIntensity = intensity.current
      return
    }
    const t = clock.elapsedTime
    // extremely subtle breathing, amplitude ±4%
    const k = 1 + Math.sin(t * 0.7) * 0.035 + Math.sin(t * 2.3) * 0.015
    if (matRef.current) matRef.current.emissiveIntensity = intensity.current * k
  })

  return (
    <group ref={groupRef}>
      {/* rooftop main sign (hoverable) */}
      <group position={[STORE.cx, STORE.h + 0.34, STORE.z1 - 0.15]}>
        <mesh
          ref={signRef}
          userData={{ outlined: true }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered('sign')
          }}
          onPointerOut={() => setHovered(null)}
        >
          <boxGeometry args={[3.4, 0.66, 0.14]} />
          <meshStandardMaterial
            ref={matRef}
            map={tex}
            emissiveMap={tex}
            emissive="#ffffff"
            emissiveIntensity={intensity.current}
            color="#666666"
            roughness={0.6}
          />
        </mesh>
      </group>

      {/* side sign on alley wall */}
      <mesh position={[STORE.x1 + 0.015, 1.75, STORE.cz - 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial
          map={sideTex}
          emissiveMap={sideTex}
          emissive="#ffffff"
          emissiveIntensity={1.1}
          color="#666666"
          roughness={0.6}
        />
      </mesh>

      {/* small promo lightbox near the door */}
      <mesh position={[STORE.x0 + 0.55, 1.35, STORE.z1 + 0.05]}>
        <boxGeometry args={[0.42, 0.6, 0.06]} />
        <meshStandardMaterial
          color="#222"
          emissive="#ffca7a"
          emissiveIntensity={0.9}
          roughness={0.7}
        />
      </mesh>
    </group>
  )
}
