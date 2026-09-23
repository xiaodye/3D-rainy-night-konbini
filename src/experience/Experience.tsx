import Diorama from './diorama/Diorama'
import Lighting from './lighting/Lighting'
import Rain from './effects/Rain'
import Ripples from './effects/Ripples'
import Drips from './effects/Drips'
import GlassRain from './effects/GlassRain'
import CameraRig from './CameraRig'
import Effects from './postprocessing/Effects'

/**
 * Composes the whole 3D world:
 * Environment (fog/bg set in SceneCanvas) + Diorama + Lighting + Rain
 * + CameraRig + PostProcessing.
 */
export default function Experience() {
  return (
    <>
      <CameraRig />
      <Lighting />
      <Diorama />
      <Rain />
      <Ripples />
      <Drips />
      <GlassRain />
      <Effects />
    </>
  )
}
