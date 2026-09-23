import SceneDriver from './scene/SceneDriver'
import LoadingScreen from './narrative/LoadingScreen'
import ScrollNarrative from './narrative/ScrollNarrative'
import WaterPanel from './ui/WaterPanel'
import ViewSwitch from './ui/ViewSwitch'

export default function App() {
  return (
    <>
      {/* the WebGL diorama itself is built by /diorama.js and mounts into
          <canvas id="scene">; SceneDriver only drives its camera */}
      <SceneDriver />
      <ScrollNarrative />
      <ViewSwitch />
      <WaterPanel />
      <LoadingScreen />
    </>
  )
}
