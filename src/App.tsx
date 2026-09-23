import SceneCanvas from './experience/SceneCanvas'
import LoadingScreen from './narrative/LoadingScreen'
import ScrollNarrative from './narrative/ScrollNarrative'

export default function App() {
  return (
    <>
      <SceneCanvas />
      <ScrollNarrative />
      <LoadingScreen />
    </>
  )
}
