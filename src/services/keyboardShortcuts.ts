export type EditorShortcutKey =
  | 'z'
  | 'y'
  | 's'
  | 'k'
  | 'Enter'
  | ' '
  | 'b'
  | 'e'
  | 'v'
  | 'i'
  | '['
  | ']'
  | 'Escape'
  | 'Delete'
  | 'Backspace'
  | string

const CODE_SHORTCUTS: Record<string, EditorShortcutKey> = {
  KeyZ: 'z',
  KeyY: 'y',
  KeyS: 's',
  KeyK: 'k',
  KeyB: 'b',
  KeyE: 'e',
  KeyV: 'v',
  KeyI: 'i',
  BracketLeft: '[',
  BracketRight: ']',
  Space: ' ',
  Enter: 'Enter',
  Escape: 'Escape',
  Delete: 'Delete',
  Backspace: 'Backspace',
}

export function getEditorShortcutKey(event: Pick<KeyboardEvent, 'key' | 'code'>): EditorShortcutKey {
  const codeShortcut = CODE_SHORTCUTS[event.code]
  if (codeShortcut) return codeShortcut

  return event.key.length === 1 ? event.key.toLowerCase() : event.key
}
