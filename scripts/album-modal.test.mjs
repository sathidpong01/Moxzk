import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

test('album detail delete returns to the album list after successful removal', () => {
  const modal = read('src/components/Albums/AlbumListModal.tsx')

  assert.match(modal, /await deleteAlbum\(id\)/)
  assert.match(modal, /const albumState = useAlbumStore\.getState\(\)/)
  assert.match(modal, /const albumStillExists = albumState\.currentAlbum\?\.id === id \|\| albumState\.albums\.some\(\(album\) => album\.id === id\)/)
  assert.match(modal, /if \(albumStillExists\) return/)
  assert.match(modal, /setView\('list'\)/)
  assert.match(modal, /setCurrentAlbum\(null\)/)
  assert.match(modal, /setDetailLoadError\(null\)/)
})
