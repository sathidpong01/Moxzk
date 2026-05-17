import { execFileSync } from 'node:child_process'
import path from 'node:path'

// Squirrel.Windows does not register file associations the way the NSIS
// target's `fileAssociations` config did. We re-create the `.moxzk`
// association ourselves during the Squirrel install/update/uninstall events.
//
// All writes go to HKCU (per-user) to match Squirrel's per-user install under
// %LocalAppData% — this needs no elevation. Registration is best-effort: a
// failure here must never block install, so every reg.exe call is guarded.

const PROG_ID = 'Moxzk.Project'
const FILE_EXT = '.moxzk'
const CLASSES_ROOT = 'HKCU\\Software\\Classes'

function launcherStubPath(): string {
  // During Squirrel events process.execPath is the versioned
  // app-<version>\Moxzk.exe; the stable launcher stub sits one level up.
  return path.resolve(path.dirname(process.execPath), '..', 'Moxzk.exe')
}

function reg(args: string[]): void {
  try {
    execFileSync('reg', args, { stdio: 'ignore' })
  } catch {
    // Best-effort: never block a Squirrel install/uninstall on registry I/O.
  }
}

function registerFileAssociation(): void {
  const exe = launcherStubPath()
  reg(['add', `${CLASSES_ROOT}\\${PROG_ID}`, '/ve', '/d', 'Moxzk Project', '/f'])
  reg(['add', `${CLASSES_ROOT}\\${PROG_ID}\\DefaultIcon`, '/ve', '/d', `${exe},0`, '/f'])
  reg(['add', `${CLASSES_ROOT}\\${PROG_ID}\\shell\\open\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f'])
  reg(['add', `${CLASSES_ROOT}\\${FILE_EXT}`, '/ve', '/d', PROG_ID, '/f'])
}

function unregisterFileAssociation(): void {
  reg(['delete', `${CLASSES_ROOT}\\${PROG_ID}`, '/f'])
  reg(['delete', `${CLASSES_ROOT}\\${FILE_EXT}`, '/f'])
}

// Tell the Windows shell that file associations changed (SHCNE_ASSOCCHANGED).
// Without this, Explorer keeps showing the stale/generic icon for .moxzk files
// until the icon cache is rebuilt or the user signs out.
function notifyShellAssociationChanged(): void {
  try {
    execFileSync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Add-Type -Namespace Shell -Name Notify -MemberDefinition "
        + "'[DllImport(\"shell32.dll\")] public static extern void "
        + "SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);'; "
        + '[Shell.Notify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)',
    ], { stdio: 'ignore' })
  } catch {
    // Best-effort: the icon still refreshes on next sign-in if this fails.
  }
}

// Called while a Squirrel event flag is being handled, before the process
// exits. electron-squirrel-startup separately handles shortcut creation.
export function applySquirrelFileAssociations(): void {
  if (process.platform !== 'win32') return
  const squirrelEvent = process.argv[1]
  if (squirrelEvent === '--squirrel-install' || squirrelEvent === '--squirrel-updated') {
    registerFileAssociation()
    notifyShellAssociationChanged()
  } else if (squirrelEvent === '--squirrel-uninstall') {
    unregisterFileAssociation()
    notifyShellAssociationChanged()
  }
}
