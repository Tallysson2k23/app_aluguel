export const city = {
  id: 'santa-cruz-do-capibaribe-pe',
  name: 'Santa Cruz do Capibaribe',
  state: 'PE',
  center: [-7.9552, -36.2047] as [number, number],
  zoom: 14,
}
export const gridScale = 500
export type Area = { south: number; west: number; north: number; east: number }
export const initialArea: Area = {
  south: city.center[0] - .025, north: city.center[0] + .025,
  west: city.center[1] - .035, east: city.center[1] + .035,
}
export const tileUrl = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const tileAttribution = import.meta.env.VITE_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

