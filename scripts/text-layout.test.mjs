import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBalloonFitFontSize,
  estimateWrappedLineCount,
  getRegionTextLayout,
  layoutTextInBox,
  measureArtisticTextSize,
  normalizeTextArtisticFit,
  normalizeTextAlign,
  normalizeTextBalloonShape,
  normalizeTextLayoutMode,
} from '../src/utils/textLayout.ts'

test('normalizeTextLayoutMode defaults older regions to balloon_fit', () => {
  assert.equal(normalizeTextLayoutMode(undefined), 'balloon_fit')
  assert.equal(normalizeTextLayoutMode('paragraph'), 'balloon_fit')
  assert.equal(normalizeTextLayoutMode('artistic'), 'artistic')
})

test('normalizeTextAlign defaults older regions to center', () => {
  assert.equal(normalizeTextAlign(undefined), 'center')
  assert.equal(normalizeTextAlign('left'), 'left')
  assert.equal(normalizeTextAlign('center'), 'center')
  assert.equal(normalizeTextAlign('right'), 'right')
  assert.equal(normalizeTextAlign('bad'), 'center')
})

test('text shape and artistic fit normalizers preserve old regions safely', () => {
  assert.equal(normalizeTextBalloonShape(undefined, 'normal'), 'round')
  assert.equal(normalizeTextBalloonShape(undefined, 'narration'), 'box')
  assert.equal(normalizeTextBalloonShape('bubble', 'normal'), 'round')
  assert.equal(normalizeTextBalloonShape('cloud', 'normal'), 'cloud')
  assert.equal(normalizeTextBalloonShape('bad', 'narration'), 'box')
  assert.equal(normalizeTextArtisticFit(undefined), 'free')
  assert.equal(normalizeTextArtisticFit('bubble_guided'), 'bubble_guided')
  assert.equal(normalizeTextArtisticFit('bad'), 'free')
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

test('measureArtisticTextSize preserves manual blank lines', () => {
  const measured = measureArtisticTextSize('A\n\nBBBB', 10, {
    lineHeight: 1.2,
    measureText: (text, fontSize) => text.length * fontSize,
  })

  assert.deepEqual(measured.lines, ['A', '', 'BBBB'])
  assert.equal(measured.width, 40)
  assert.equal(measured.height, 36)
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

test('balloon fit uses a tighter bubble safe area for rounded speech balloons', () => {
  const layout = layoutTextInBox(
    'ไม่ต้องกังวลเรื่องนั้นหรอก พ่อรู้ว่ามันอยู่ที่ไหน อดทนรออีกนิดนะ',
    { width: 220, height: 88 },
    34,
    { readableMinFontSize: 8 },
  )

  assert.ok(layout.paddingX >= 20)
  assert.ok(layout.paddingY >= 10)
  assert.ok(layout.lines.length >= 3)
  assert.ok(layout.lineWidths[0] < layout.lineWidths[Math.floor(layout.lineWidths.length / 2)])
  assert.equal(layout.overflow, false)
})

test('round bubbles prefer balanced Thai lines over crowded edge lines', () => {
  const layout = layoutTextInBox(
    'ไม่ต้องกังวลเรื่องนั้นหรอก พ่อรู้ว่ามันอยู่ที่ไหน อดทนรออีกนิดนะ',
    { width: 220, height: 88 },
    34,
    { shape: 'round', readableMinFontSize: 8 },
  )

  assert.ok(layout.lines.length >= 5)
  assert.ok(layout.fontSize < 14)
  assert.equal(layout.overflow, false)
})

test('cloud bubbles reserve a safer irregular edge than round bubbles', () => {
  const text = 'ไม่ต้องกังวลเรื่องนั้นหรอก พ่อรู้ว่ามันอยู่ที่ไหน อดทนรออีกนิดนะ'
  const bbox = { width: 220, height: 88 }
  const round = layoutTextInBox(text, bbox, 34, { shape: 'round', readableMinFontSize: 8 })
  const cloud = layoutTextInBox(text, bbox, 34, { shape: 'cloud', readableMinFontSize: 8 })

  assert.ok(cloud.paddingX > round.paddingX)
  assert.ok(cloud.paddingY >= round.paddingY)
  assert.ok(cloud.lineWidths[0] < round.lineWidths[0])
  assert.equal(cloud.overflow, false)
})

test('narration boxes keep rectangular line widths and smaller padding', () => {
  const layout = layoutTextInBox(
    'เรื่องเล่าเบื้องหลังของสถานที่นี้เริ่มขึ้นเมื่อนานมาแล้ว',
    { width: 260, height: 74 },
    28,
    { shape: 'box' },
  )

  assert.ok(layout.paddingX < 20)
  assert.ok(layout.lineWidths.every((width) => width === layout.lineWidths[0]))
  assert.equal(layout.overflow, false)
})

test('overflow reports min_font when a valid bubble box still cannot show all text', () => {
  const layout = layoutTextInBox(
    'ข้อความภาษาไทยที่ยาวมากเกินกว่าจะใส่ลงในกรอบเล็กมากได้ครบทุกคำโดยไม่ตัด',
    { width: 58, height: 24 },
    36,
    { shape: 'round', minFontSize: 8, readableMinFontSize: 8 },
  )

  assert.equal(layout.overflow, true)
  assert.equal(layout.overflowReason, 'min_font')
})

test('balloon fit clamps below-readable text and reports readability overflow', () => {
  const layout = layoutTextInBox(
    'ข้อความภาษาไทยที่ยาวมากจนถ้าพยายามใส่ให้ครบในบับเบิลนี้จะต้องลดตัวอักษรเล็กเกินอ่านง่าย',
    { width: 160, height: 58 },
    34,
    { shape: 'round' },
  )

  assert.equal(layout.fontSize, 12)
  assert.equal(layout.overflow, true)
  assert.equal(layout.overflowReason, 'readability')
})

test('region layout defaults narration to box and keeps artistic free unwrapped', () => {
  const baseRegion = {
    id: 'r1',
    bbox: { x: 0, y: 0, width: 220, height: 82 },
    originalText: '',
    translatedText: 'เรื่องเล่าภูมิหลังสั้น ๆ ในกล่อง',
    mood: 'narration',
    suggestedFont: 'narration',
    fontSize: 28,
    fontColor: '#000000',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    textLayoutMode: 'balloon_fit',
  }
  const narration = getRegionTextLayout(baseRegion, 'เรื่องเล่าภูมิหลังสั้น ๆ ในกล่อง')

  assert.equal(narration.mode, 'balloon_fit')
  assert.equal(narration.balloonShape, 'box')
  assert.ok(narration.lineWidths.every((width) => width === narration.lineWidths[0]))

  const artistic = getRegionTextLayout({
    ...baseRegion,
    textLayoutMode: 'artistic',
    artisticFit: 'free',
  }, 'ประโยคยาวที่โหมดอิสระต้องไม่ถูก wrap ใหม่อัตโนมัติ')

  assert.equal(artistic.mode, 'artistic')
  assert.equal(artistic.artisticFit, 'free')
  assert.equal(artistic.fontSize, 28)
  assert.deepEqual(artistic.lines, ['ประโยคยาวที่โหมดอิสระต้องไม่ถูก wrap ใหม่อัตโนมัติ'])
  assert.equal(artistic.overflow, false)
  assert.ok(artistic.innerWidth > baseRegion.bbox.width)
  assert.equal(artistic.scaleX, 1)
  assert.equal(artistic.scaleY, 1)
})

test('artistic bubble-guided layout uses bubble safe area and warns about clipped text', () => {
  const text = 'ประโยคยาวมากที่ผู้ใช้ตั้งใจวางเองแต่ยังล้นออกจาก bubble'
  const layout = getRegionTextLayout({
    id: 'r1',
    bbox: { x: 0, y: 0, width: 120, height: 38 },
    originalText: '',
    translatedText: text,
    mood: 'normal',
    suggestedFont: 'normal',
    fontSize: 24,
    fontColor: '#000000',
    rotation: 0,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    textLayoutMode: 'artistic',
    artisticFit: 'bubble_guided',
    balloonShape: 'round',
  }, text)

  assert.equal(layout.mode, 'artistic')
  assert.equal(layout.artisticFit, 'bubble_guided')
  assert.ok(layout.paddingX > 0)
  assert.ok(layout.lines.length > 1)
  assert.equal(layout.lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''))
  assert.equal(layout.overflow, true)
  assert.equal(layout.overflowReason, 'clipped')
})
