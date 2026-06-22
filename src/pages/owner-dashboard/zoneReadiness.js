export function prepareZoneReadiness(zones) {
  const items = zones.slice(0, 5)
  return { items, isEmpty: items.length === 0 }
}

export function buildZoneRadar(zones, options = {}) {
  const center = options.center ?? 110
  const radius = options.radius ?? 82
  const dataCount = zones.length
  const axisCount = Math.max(5, dataCount)
  const average = dataCount
    ? Math.round(zones.reduce((sum, zone) => sum + Math.max(0, Math.min(100, zone.percent)), 0) / dataCount)
    : 0
  const points = Array.from({ length: axisCount }, (_, index) => {
    const percent = Math.max(0, Math.min(100, zones[index]?.percent ?? 0))
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axisCount
    const pointRadius = radius * percent / 100
    return {
      x: Number((center + Math.cos(angle) * pointRadius).toFixed(2)),
      y: Number((center + Math.sin(angle) * pointRadius).toFixed(2)),
    }
  })

  return { average, points }
}
