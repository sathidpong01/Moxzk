import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

test('single-page AI processing runs without the old fullscreen preview overlay', () => {
  const editStep = read('src/components/Steps/EditStep.tsx')
  const processingView = read('src/components/Processing/ProcessingView.tsx')
  const artboardWorkspace = read('src/components/Editor/ArtboardWorkspace.tsx')

  assert.match(editStep, /presentation="runner"/)
  assert.match(editStep, /activeProcessCard=\{activeProcessCard\}/)
  assert.match(artboardWorkspace, /ArtboardProcessCardOverlay/)
  assert.match(artboardWorkspace, /transformFunc=\{\(attrs\) =>/)
  assert.match(artboardWorkspace, /scaleX: 1/)
  assert.match(artboardWorkspace, /calc\(-100% - 12px\)/)
  assert.equal(editStep.includes('studio-canvas absolute inset-0 z-10 flex items-center justify-center'), false)
  assert.equal(processingView.includes('URL.createObjectURL(imageFile)'), false)
  assert.equal(processingView.includes('opacity-20'), false)
})

test('batch processing keeps per-page badges instead of a centered thumbnail overlay', () => {
  const imageStrip = read('src/components/Editor/ImageStrip.tsx')

  assert.match(imageStrip, /const statusMeta =/)
  assert.match(imageStrip, /cleaning: \{ label: 'คลีน'/)
  assert.match(imageStrip, /translating: \{ label: 'แปล'/)
  assert.equal(imageStrip.includes('absolute inset-0 flex items-center justify-center bg-black/50'), false)
})

test('text overset indicator is editor-only and stays out of export rendering', () => {
  const artboardWorkspace = read('src/components/Editor/ArtboardWorkspace.tsx')
  const canvasEditor = read('src/components/Editor/CanvasEditor.tsx')
  const exporter = read('src/services/exporter.ts')
  const exportRendering = read('src/services/exportRendering.ts')

  assert.match(artboardWorkspace, /OversetTextBadge/)
  assert.match(canvasEditor, /OversetTextBadge/)
  assert.match(artboardWorkspace, /ข้อความยังล้น/)
  assert.match(canvasEditor, /ข้อความยังล้น/)
  assert.equal(exporter.includes('…+'), false)
  assert.equal(exportRendering.includes('…+'), false)
})

test('text shape and artistic fit controls are exposed in panel and hud', () => {
  const propertiesPanel = read('src/components/Editor/PropertiesPanel.tsx')
  const textHud = read('src/components/Editor/ContextualTextHud.tsx')

  assert.match(propertiesPanel, /balloonShape/)
  assert.match(propertiesPanel, /artisticFit/)
  assert.match(propertiesPanel, /วงรี/)
  assert.match(propertiesPanel, /ก้อนเมฆ/)
  assert.match(propertiesPanel, /กล่อง/)
  assert.match(textHud, /hud:balloonShape/)
  assert.match(textHud, /hud:artisticFit/)
  assert.match(textHud, /รูปแบบกล่องข้อความ/)
  assert.equal(textHud.includes('min-w-[1040px]'), false)
})

test('artistic free behaves like object text while bubble-guided stays frame-constrained', () => {
  const artboardWorkspace = read('src/components/Editor/ArtboardWorkspace.tsx')
  const canvasEditor = read('src/components/Editor/CanvasEditor.tsx')
  const inlineEditor = read('src/components/Editor/InlineTextEditor.tsx')

  assert.equal(artboardWorkspace.includes('const textScaleX = node.scaleX()'), false)
  assert.equal(canvasEditor.includes('const textScaleX = node.scaleX()'), false)
  assert.match(artboardWorkspace, /const isArtisticFree = isArtistic && regionLayout\.artisticFit === 'free'/)
  assert.match(canvasEditor, /const isArtisticFree = isArtistic && regionLayout\.artisticFit === 'free'/)
  assert.match(artboardWorkspace, /fontSize: nextFontSize/)
  assert.match(canvasEditor, /fontSize: nextFontSize/)
  assert.match(artboardWorkspace, /getArtisticInlineTextEditorLayerSize/)
  assert.match(canvasEditor, /getArtisticInlineTextEditorLayerSize/)
  assert.match(inlineEditor, /wrap=\{constrainToFrame \? 'soft' : 'off'\}/)
  assert.match(inlineEditor, /whiteSpace: constrainToFrame \? 'pre-wrap' : 'pre'/)
  assert.equal(inlineEditor.includes("whiteSpace: isArtistic ? 'pre'"), false)
})

test('inline editor uses the same scaled font size and line height as canvas text', () => {
  const artboardWorkspace = read('src/components/Editor/ArtboardWorkspace.tsx')
  const canvasEditor = read('src/components/Editor/CanvasEditor.tsx')
  const inlineEditor = read('src/components/Editor/InlineTextEditor.tsx')

  assert.match(artboardWorkspace, /getInlineTextEditorFontSize/)
  assert.match(canvasEditor, /getInlineTextEditorFontSize/)
  assert.equal(artboardWorkspace.includes('Math.max(8, (inlineEditLayout?.fontSize'), false)
  assert.equal(canvasEditor.includes('Math.max(8, (inlineEditLayout?.fontSize'), false)
  assert.match(artboardWorkspace, /lineHeight=\{inlineEditLineHeight\}/)
  assert.match(canvasEditor, /lineHeight=\{inlineEditLineHeight\}/)
  assert.match(inlineEditor, /lineHeight: displayLineHeight/)
})
