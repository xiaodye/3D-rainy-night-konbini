import SceneDriver from './scene/SceneDriver'
import LoadingScreen from './narrative/LoadingScreen'
import ScrollNarrative from './narrative/ScrollNarrative'

export default function App() {
  return (
    <>
      {/* the WebGL diorama itself is built by public/diorama.js and mounts
          into <canvas id="c">; SceneDriver only drives its camera */}
      <SceneDriver />
      <ScrollNarrative />
      <LoadingScreen />
    </>
  )
}
