import test from 'node:test'
import assert from 'node:assert/strict'

test('normalizes segment values into one complete 100% donut', async () => {
  let buildDonutSegments

  try {
    ({ buildDonutSegments } = await import('../src/pages/owner-dashboard/donutGeometry.js'))
  } catch {
    assert.fail('buildDonutSegments is not implemented')
  }

  const segments = buildDonutSegments([20, 30, 10, 40])

  assert.deepEqual(segments.map((segment) => segment.sharePercent), [20, 30, 10, 40])
  assert.deepEqual(segments.map((segment) => segment.offset), [0, 20, 50, 60])
  assert.equal(segments.reduce((sum, segment) => sum + segment.length, 0), 100)
})

test('one 20% segment leaves exactly 80% for the remaining segments', async () => {
  let buildDonutSegments

  try {
    ({ buildDonutSegments } = await import('../src/pages/owner-dashboard/donutGeometry.js'))
  } catch {
    assert.fail('buildDonutSegments is not implemented')
  }

  const segments = buildDonutSegments([20, 30, 10, 40])

  assert.equal(segments[0].length, 20)
  assert.equal(segments.slice(1).reduce((sum, segment) => sum + segment.length, 0), 80)
})

test('returns an empty donut when every value is zero', async () => {
  let buildDonutSegments

  try {
    ({ buildDonutSegments } = await import('../src/pages/owner-dashboard/donutGeometry.js'))
  } catch {
    assert.fail('buildDonutSegments is not implemented')
  }

  const segments = buildDonutSegments([0, -5, 0, 0])

  assert.deepEqual(segments.map((segment) => segment.sharePercent), [0, 0, 0, 0])
  assert.equal(segments.reduce((sum, segment) => sum + segment.length, 0), 0)
})
