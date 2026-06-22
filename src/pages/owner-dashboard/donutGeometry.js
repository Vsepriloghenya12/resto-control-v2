export function buildDonutSegments(values) {
  const safeValues = values.map((value) => Math.max(0, Number(value) || 0))
  const total = safeValues.reduce((sum, value) => sum + value, 0)

  if (!total) {
    return safeValues.map(() => ({
      sharePercent: 0,
      length: 0,
      offset: 0,
    }))
  }

  let offset = 0

  return safeValues.map((value, index) => {
    const isLast = index === safeValues.length - 1
    const length = isLast
      ? Number((100 - offset).toFixed(2))
      : Number((value / total * 100).toFixed(2))
    const segment = {
      sharePercent: length,
      length,
      offset,
    }

    offset = Number((offset + length).toFixed(2))
    return segment
  })
}
