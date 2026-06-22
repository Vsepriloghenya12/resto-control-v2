export type ZoneReadinessItem = {
  label: string
  percent: number
  completed: string
  tone: 'good' | 'medium' | 'low'
}

export function prepareZoneReadiness(zones: ZoneReadinessItem[]): {
  items: ZoneReadinessItem[]
  isEmpty: boolean
}

export function buildZoneRadar(
  zones: Array<Pick<ZoneReadinessItem, 'label' | 'percent'>>,
  options?: { center?: number; radius?: number },
): {
  average: number
  points: Array<{ x: number; y: number }>
}
