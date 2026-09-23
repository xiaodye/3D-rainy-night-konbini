import Base from './Base'
import Store from './store/Store'
import Street from './street/Street'
import Alley from './street/Alley'
import Puddles from './street/Puddles'
import UtilityPole from './props/UtilityPole'
import StreetLamp from './props/StreetLamp'
import TrafficLight from './props/TrafficLight'
import VendingMachine from './props/VendingMachine'
import Bicycle from './props/Bicycle'
import StreetProps from './props/StreetProps'

/** The whole miniature world */
export default function Diorama() {
  return (
    <group>
      <Base />
      <Store />
      <Street />
      <Alley />
      <Puddles />
      <UtilityPole />
      <StreetLamp />
      <TrafficLight />
      <VendingMachine />
      <Bicycle />
      <StreetProps />
    </group>
  )
}
