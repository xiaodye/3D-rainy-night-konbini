import SceneDriver from './scene/SceneDriver'
import LoadingScreen from './narrative/LoadingScreen'
import ScrollNarrative from './narrative/ScrollNarrative'
import WaterPanel from './ui/WaterPanel'
import ViewSwitch from './ui/ViewSwitch'

export default function App() {
  return (
    <>
      {/* WebGL diorama 本体由 src/scene/diorama 构建并挂载进
          <canvas id="scene">；SceneDriver 只负责驱动相机 */}
      <SceneDriver />
      <ScrollNarrative />
      <ViewSwitch />
      <WaterPanel />
      <LoadingScreen />
    </>
  )
}
