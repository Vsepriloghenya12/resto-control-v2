export type DonutSegmentGeometry = {
  sharePercent: number
  length: number
  offset: number
}

export function buildDonutSegments(values: number[]): DonutSegmentGeometry[]
