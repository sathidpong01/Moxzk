import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parsePanelCleanerCsv } from './panelcleaner-csv.mjs'

test('parsePanelCleanerCsv parses PanelCleaner-style OCR CSV', () => {
  const rows = parsePanelCleanerCsv('filename,startx,starty,endx,endy,text\npage.png,10,20,110,80,"こんにちは"\n')

  assert.deepEqual(rows, [{
    filename: 'page.png',
    text: 'こんにちは',
    bbox: { x: 10, y: 20, width: 100, height: 60 },
  }])
})

test('parsePanelCleanerCsv handles quoted commas', () => {
  const rows = parsePanelCleanerCsv('filename,startx,starty,endx,endy,text\npage.png,1,2,11,22,"hello, world"\n')

  assert.equal(rows[0].text, 'hello, world')
  assert.deepEqual(rows[0].bbox, { x: 1, y: 2, width: 10, height: 20 })
})
