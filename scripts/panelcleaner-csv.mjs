export function parsePanelCleanerCsv(csv) {
  const rows = parseCsvRows(csv)
  if (rows.length <= 1) return []

  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1

  const filenameIndex = indexOf('filename', 'file')
  const startXIndex = indexOf('startx', 'minx', 'x')
  const startYIndex = indexOf('starty', 'miny', 'y')
  const endXIndex = indexOf('endx', 'maxx')
  const endYIndex = indexOf('endy', 'maxy')
  const widthIndex = indexOf('width', 'w')
  const heightIndex = indexOf('height', 'h')
  const textIndex = indexOf('text', 'ocr', 'content')

  return rows.slice(1).flatMap((row) => {
    const text = textIndex >= 0 ? (row[textIndex] ?? '').trim() : ''
    if (!text) return []

    const startX = parseNumber(row[startXIndex])
    const startY = parseNumber(row[startYIndex])
    const endX = parseNumber(row[endXIndex])
    const endY = parseNumber(row[endYIndex])
    const width = parseNumber(row[widthIndex])
    const height = parseNumber(row[heightIndex])

    if (startX == null || startY == null) return []

    const boxWidth = width ?? (endX != null ? endX - startX : 100)
    const boxHeight = height ?? (endY != null ? endY - startY : 30)

    return [{
      filename: filenameIndex >= 0 ? row[filenameIndex] ?? '' : '',
      text,
      bbox: {
        x: startX,
        y: startY,
        width: Math.max(1, boxWidth),
        height: Math.max(1, boxHeight),
      },
    }]
  })
}

export function parseCsvRows(csv) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const next = csv[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      field += '"'
      i++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
