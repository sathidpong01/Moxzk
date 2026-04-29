# Codex Cloud Environment

This repo is ready to run in Codex cloud through the ChatGPT Codex web environment.
Use this page when creating or updating the environment at `https://chatgpt.com/codex`.

## Repository

- Repository: `Moxzk`
- Branch: `master`
- Agent instructions: keep the existing root `AGENTS.md` enabled. It points Codex to `.agents/AGENTS.md`, `.agents/active.md`, `.agents/team.md`, and the focused test commands.

## Runtime

Set package versions in the Codex environment to:

- Node.js: `20.19.x` or newer Node 20 LTS
- Package manager: npm

The repo includes `package-lock.json` and `.npmrc` with `legacy-peer-deps=true`; the setup script still passes `--legacy-peer-deps` explicitly so cloud installs match local behavior.

## Setup Script

Use this as the Codex setup script:

```bash
bash scripts/codex-cloud-setup.sh
```

For a one-time cache warmup or when diagnosing the environment, set this environment variable before running setup:

```bash
CODEX_CLOUD_VERIFY_SETUP=1
```

That makes setup run:

```bash
npm run build
npm test
```

Leave `CODEX_CLOUD_VERIFY_SETUP` unset for normal tasks so setup stays fast.

## Environment Variables

Safe non-secret defaults are written by `scripts/codex-cloud-setup.sh` for the agent phase:

```env
CI=1
VITE_CLOUDFLARE_API_URL=https://moxzk-api.sathidpong01.workers.dev
VITE_PANELCLEANER_BRIDGE_URL=http://localhost:5055
VITE_TRANSLATOR_API_URL=http://localhost:5003
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma4
```

Override `VITE_CLOUDFLARE_API_URL` in Codex environment settings only when you want cloud tasks to target a different Worker.

Do not add real `.env.local`, `.dev.vars`, Google OAuth secrets, smoke-test credentials, Cloudflare tokens, or Ollama API keys to the repo. Codex cloud secrets are only available during setup, so they are not useful for normal agent-phase app code unless the task is specifically about setup-time commands.

## Internet Access

Keep agent internet access off by default. Setup already has internet access for `npm ci`.

Enable agent internet only for tasks that explicitly need external resources, and prefer:

- Domain preset: Common dependencies
- HTTP methods: `GET`, `HEAD`, `OPTIONS`

For Cloudflare deploy, D1 remote migration, or deployed smoke tests, run the command locally unless you intentionally configure a short-lived Cloudflare token and allow the required Cloudflare API access for that task.

## What Works In Cloud

Good Codex cloud validation commands:

```bash
npm run build
npm test
npm run test:runtime
npm run test:editor
npm run test:export
npm run worker:check
```

Use focused tests first when the task scope is narrow.

## Cloud Limitations

Codex cloud runs in a Linux container. It is useful for TypeScript, React, Worker, Drizzle, and most service tests, but it is not the final acceptance path for this project.

- Windows Electron desktop behavior still needs local Windows verification.
- Local PanelCleaner and Ollama services are external machine dependencies and are not expected to be running in the Codex cloud container.
- Browser smoke tests that require local sample images, local services, or an interactive desktop should be verified locally after applying the cloud diff.
