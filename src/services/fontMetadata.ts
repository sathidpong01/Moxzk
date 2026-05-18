export interface FontFileMetadata {
  weight?: number
  style?: 'normal' | 'italic'
}

/**
 * Reads weight/style from a raw SFNT font file (.ttf/.otf) by walking its
 * table directory. WOFF/WOFF2 are compressed and skipped — callers should fall
 * back to filename-derived defaults. Always defensive: returns {} on any error.
 */
export function parseFontMetadata(buffer: ArrayBuffer): FontFileMetadata {
  try {
    const view = new DataView(buffer)
    if (view.byteLength < 12) return {}

    const sfntVersion = view.getUint32(0)
    // 0x00010000 = TrueType, 'OTTO' = CFF/OpenType, 'true'/'typ1' = legacy Mac.
    const isSfnt = sfntVersion === 0x00010000
      || sfntVersion === 0x4f54544f
      || sfntVersion === 0x74727565
      || sfntVersion === 0x74797031
    if (!isSfnt) return {}

    const numTables = view.getUint16(4)
    let os2Offset: number | null = null
    let headOffset: number | null = null

    for (let i = 0; i < numTables; i += 1) {
      const record = 12 + i * 16
      if (record + 16 > view.byteLength) break
      const tag = String.fromCharCode(
        view.getUint8(record),
        view.getUint8(record + 1),
        view.getUint8(record + 2),
        view.getUint8(record + 3),
      )
      const offset = view.getUint32(record + 8)
      if (tag === 'OS/2') os2Offset = offset
      else if (tag === 'head') headOffset = offset
    }

    const result: FontFileMetadata = {}

    if (os2Offset != null && os2Offset + 64 <= view.byteLength) {
      const weight = view.getUint16(os2Offset + 4) // usWeightClass
      if (weight >= 1 && weight <= 1000) result.weight = weight
      const fsSelection = view.getUint16(os2Offset + 62)
      if (fsSelection & 0x01) result.style = 'italic' // bit 0 = ITALIC
    }

    if (result.style == null && headOffset != null && headOffset + 46 <= view.byteLength) {
      const macStyle = view.getUint16(headOffset + 44)
      if (macStyle & 0x02) result.style = 'italic' // bit 1 = italic
    }

    return result
  } catch {
    return {}
  }
}
