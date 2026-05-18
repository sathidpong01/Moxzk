// electron-squirrel-startup ships no type declarations. Its CommonJS entry
// evaluates the Squirrel startup flags on require and exports the resulting
// boolean ("should this process exit immediately?").
declare module 'electron-squirrel-startup' {
  const startupHandled: boolean
  export default startupHandled
}
