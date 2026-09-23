/**
 * Store layout constants — isolated in their own module to avoid
 * circular imports (Store ↔ StoreInterior/StoreExterior/Signage/Alley).
 *
 * Footprint: x ∈ [-3.4, 0.9], z ∈ [-3.3, -0.4], height 2.5.
 * Front faces +z (main street), right side faces +x (alley).
 */
export const STORE = {
  x0: -3.4,
  x1: 0.9,
  z0: -3.3,
  z1: -0.4,
  h: 2.5,
  wall: 0.12,
  get cx() {
    return (this.x0 + this.x1) / 2
  },
  get cz() {
    return (this.z0 + this.z1) / 2
  },
}
