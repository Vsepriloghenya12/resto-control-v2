import test from 'node:test'
import assert from 'node:assert/strict'

test('keeps the first five readiness zones in their existing order', async () => {
  let prepareZoneReadiness

  try {
    ({ prepareZoneReadiness } = await import('../src/pages/owner-dashboard/zoneReadiness.js'))
  } catch {
    assert.fail('prepareZoneReadiness is not implemented')
  }

  const zones = Array.from({ length: 7 }, (_, index) => ({
    label: `Зона ${index + 1}`,
    percent: 10 * index,
    completed: `${index} из 7`,
    tone: 'medium',
  }))

  const result = prepareZoneReadiness(zones)

  assert.equal(result.isEmpty, false)
  assert.deepEqual(result.items.map((item) => item.label), ['Зона 1', 'Зона 2', 'Зона 3', 'Зона 4', 'Зона 5'])
})

test('returns an explicit empty state when there are no zones', async () => {
  let prepareZoneReadiness

  try {
    ({ prepareZoneReadiness } = await import('../src/pages/owner-dashboard/zoneReadiness.js'))
  } catch {
    assert.fail('prepareZoneReadiness is not implemented')
  }

  assert.deepEqual(prepareZoneReadiness([]), { items: [], isEmpty: true })
})

test('builds radar points from zone percentages and calculates the average', async () => {
  let buildZoneRadar

  try {
    ({ buildZoneRadar } = await import('../src/pages/owner-dashboard/zoneReadiness.js'))
  } catch {
    assert.fail('buildZoneRadar is not implemented')
  }

  const radar = buildZoneRadar([
    { label: 'Зал', percent: 100 },
    { label: 'Кухня', percent: 50 },
    { label: 'Бар', percent: 0 },
  ], { center: 100, radius: 80 })

  assert.equal(radar.average, 50)
  assert.equal(radar.points.length, 5)
  assert.deepEqual(radar.points[0], { x: 100, y: 20 })
  assert.deepEqual(radar.points[1], { x: 138.04, y: 87.64 })
  assert.deepEqual(radar.points[2], { x: 100, y: 100 })
  assert.deepEqual(radar.points[3], { x: 100, y: 100 })
  assert.deepEqual(radar.points[4], { x: 100, y: 100 })
})

test('keeps a five-axis radar when only one zone has data', async () => {
  let buildZoneRadar

  try {
    ({ buildZoneRadar } = await import('../src/pages/owner-dashboard/zoneReadiness.js'))
  } catch {
    assert.fail('buildZoneRadar is not implemented')
  }

  const radar = buildZoneRadar([{ label: 'Администратор', percent: 100 }], { center: 100, radius: 80 })

  assert.equal(radar.points.length, 5)
  assert.deepEqual(radar.points[0], { x: 100, y: 20 })
  assert.deepEqual(radar.points.slice(1), [
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 100 },
  ])
})
