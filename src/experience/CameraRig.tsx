import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useExperience, introState } from '../state/store'

/**
 * CameraRig — owns the camera.
 *
 *  - 5 scene keyframes (position + lookAt), scroll-driven with
 *    smoothstep segments + exponential damping (slow, cinematic)
 *  - Idle at the top: lightweight custom orbit (drag to rotate,
 *    Cmd/Ctrl + wheel to zoom) with clamped ranges; influence fades
 *    out as soon as the user scrolls, camera returns to the scroll path
 *  - Plain wheel always scrolls the page (never hijacked)
 *  - Pointer parallax ±3° always layered on top (desktop)
 *  - Intro: while 'entering', damping is slow so the camera glides
 *    toward the opening frame for ~2.5s; reducedMotion snaps instantly
 */

interface Keyframe {
  pos: [number, number, number]
  target: [number, number, number]
}

const KEYFRAMES: Keyframe[] = [
  // Scene 01 — Arrival: distant, slightly above, whole diorama
  { pos: [-8.6, 8.2, 10.6], target: [0, 0.4, 0] },
  // Scene 02 — Storefront: down to street eye-level in front of the door
  { pos: [-1.6, 1.55, 6.6], target: [-1.2, 1.3, -0.6] },
  // Scene 03 — Inside: close to the glass, focus through the window
  { pos: [-0.9, 1.45, 2.35], target: [-1.3, 1.25, -2.0] },
  // Scene 04 — Street Corner: around the right side, alley & vending machine
  { pos: [7.6, 2.1, 3.3], target: [1.2, 0.9, -1.6] },
  // Scene 05 — Night: pulled back low across the front — the glowing box
  { pos: [-7.0, 2.7, 9.6], target: [-1.2, 1.0, -1.2] },
]

const smooth = (t: number) => t * t * (3 - 2 * t)

export default function CameraRig() {
  const { camera, gl } = useThree()
  const isMobile = useExperience((s) => s.isMobile)
  const reducedMotion = useExperience((s) => s.reducedMotion)

  // reusable temp objects — zero per-frame allocation
  const tmp = useMemo(
    () => ({
      scrollPos: new THREE.Vector3(),
      scrollTarget: new THREE.Vector3(),
      kfA: new THREE.Vector3(),
      kfB: new THREE.Vector3(),
      tA: new THREE.Vector3(),
      tB: new THREE.Vector3(),
      base: new THREE.Vector3(),
      orbitPos: new THREE.Vector3(),
      spherical: new THREE.Spherical(),
    }),
    [],
  )

  // ------- orbit state (idle only) -------
  const orbit = useRef({
    azimuth: 0,
    polar: 0,
    zoom: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

  // ------- pointer parallax -------
  const parallax = useRef({ x: 0, y: 0, sx: 0, sy: 0 })

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      if (isMobile) return
      orbit.current.dragging = true
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
    }
    const onPointerMove = (e: PointerEvent) => {
      // parallax target (always)
      parallax.current.x = (e.clientX / window.innerWidth) * 2 - 1
      parallax.current.y = (e.clientY / window.innerHeight) * 2 - 1

      if (!orbit.current.dragging) return
      const dx = e.clientX - orbit.current.lastX
      const dy = e.clientY - orbit.current.lastY
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
      orbit.current.azimuth = THREE.MathUtils.clamp(orbit.current.azimuth - dx * 0.004, -0.55, 0.55)
      orbit.current.polar = THREE.MathUtils.clamp(orbit.current.polar - dy * 0.003, -0.3, 0.22)
    }
    const onPointerUp = () => {
      orbit.current.dragging = false
    }
    // Cmd/Ctrl + wheel = zoom the diorama (idle only); plain wheel always scrolls the page
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const p = useExperience.getState().scrollProgress
      if (p > 0.02) return
      e.preventDefault()
      orbit.current.zoom = THREE.MathUtils.clamp(orbit.current.zoom + e.deltaY * 0.0012, 0.55, 1.7)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl, isMobile])

  // ------- per-frame camera update -------
  useFrame((_, dt) => {
    const state = useExperience.getState()
    const p = state.scrollProgress
    const entering = state.phase === 'entering'

    // intro: slow glide (~2.5s); reduced motion: snap
    let dampingK = 3.2
    if (reducedMotion) dampingK = 1000
    else if (entering && introState.progress < 0.5) dampingK = 0.9

    const damping = 1 - Math.exp(-dampingK * dt)

    // 1) scroll path position
    const t = THREE.MathUtils.clamp(p, 0, 1) * (KEYFRAMES.length - 1)
    const i = Math.min(Math.floor(t), KEYFRAMES.length - 2)
    const f = smooth(t - i)

    tmp.kfA.set(...KEYFRAMES[i].pos)
    tmp.kfB.set(...KEYFRAMES[i + 1].pos)
    tmp.scrollPos.lerpVectors(tmp.kfA, tmp.kfB, f)

    tmp.tA.set(...KEYFRAMES[i].target)
    tmp.tB.set(...KEYFRAMES[i + 1].target)
    tmp.scrollTarget.lerpVectors(tmp.tA, tmp.tB, f)

    // 2) orbit blend — only meaningful near the top (idle)
    const idleInfluence = THREE.MathUtils.clamp(1 - p / 0.1, 0, 1)

    if (idleInfluence > 0.001) {
      const o = orbit.current
      tmp.base.copy(tmp.scrollPos).sub(tmp.scrollTarget)
      tmp.spherical.setFromVector3(tmp.base)
      tmp.spherical.radius = THREE.MathUtils.clamp(tmp.spherical.radius * o.zoom, 6, 22)
      tmp.spherical.theta = THREE.MathUtils.clamp(tmp.spherical.theta + o.azimuth, 0.35, Math.PI - 0.35)
      tmp.spherical.phi = THREE.MathUtils.clamp(tmp.spherical.phi + o.polar, 0.22, 1.35)

      tmp.orbitPos.setFromSpherical(tmp.spherical).add(tmp.scrollTarget)
      tmp.scrollPos.lerp(tmp.orbitPos, idleInfluence)
    }

    // 3) pointer parallax offset (damped)
    if (!isMobile && !reducedMotion) {
      parallax.current.sx += (parallax.current.x - parallax.current.sx) * damping
      parallax.current.sy += (parallax.current.y - parallax.current.sy) * damping
      tmp.scrollPos.x += parallax.current.sx * 0.32
      tmp.scrollPos.y += -parallax.current.sy * 0.18
    }

    // 4) apply with damping
    if (reducedMotion) {
      camera.position.copy(tmp.scrollPos)
      camera.lookAt(tmp.scrollTarget)
    } else {
      camera.position.lerp(tmp.scrollPos, damping)
      camera.lookAt(tmp.scrollTarget)
    }
  })

  return null
}
