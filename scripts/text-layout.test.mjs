import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBalloonFitFontSize,
  estimateWrappedLineCount,
  layoutTextInBox,
  normalizeTextLayoutMode,
} from '../src/utils/textLayout.ts'

test('normalizeTextLayoutMode defaults older regions to balloon_fit', () => {
  assert.equal(normalizeTextLayoutMode(undefined), 'balloon_fit')
  assert.equal(normalizeTextLayoutMode('paragraph'), 'balloon_fit')
  assert.equal(normalizeTextLayoutMode('artistic'), 'artistic')
})

test('calculateBalloonFitFontSize shrinks long text to fit the balloon box', () => {
  const shortSize = calculateBalloonFitFontSize('ไปกันเถอะ', { width: 180, height: 80 }, 36)
  const longSize = calculateBalloonFitFontSize(
    'เรากำลังจะไปไหนกันครับพ่อ ที่นี่เหมือนจะไม่ปรากฏในแผนที่เลยนะ',
    { width: 180, height: 80 },
    36,
  )

  assert.ok(shortSize > longSize)
  assert.ok(longSize >= 8)
})

test('estimateWrappedLineCount respects manual line breaks', () => {
  const oneLine = estimateWrappedLineCount('หนึ่งบรรทัด', 400, 20)
  const twoLines = estimateWrappedLineCount('หนึ่ง\nสอง', 400, 20)

  assert.equal(oneLine, 1)
  assert.equal(twoLines, 2)
})

test('layoutTextInBox returns shared lines and overflow signal', () => {
  const layout = layoutTextInBox(
    'ไม่มีทางล่ะงั้นเหรอค พอร์ว่ามันอยู่ไปหนแค่ อดทนรออีกนิดเถอะ',
    { width: 160, height: 72 },
    32,
  )

  assert.ok(layout.lines.length > 1)
  assert.ok(layout.fontSize <= 32)
  assert.equal(typeof layout.overflow, 'boolean')
})
