# live-knowledge-app

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

## Debug with Web Demo Locally

If you want to debug desktop + webhook + web viewer end-to-end locally:

1. Start web demo in one terminal:

```bash
pnpm --filter @live-knowledge/web-demo dev
```

2. Start desktop app in another terminal:

```bash
pnpm --filter live-knowledge-app dev
```

3. Configure `webhook-plugin` target URL as `http://127.0.0.1:3010/api/webhook` and set `transferMode` to `multipart`.

4. Trigger monitoring in desktop app, then verify web demo receives events:

```bash
curl http://127.0.0.1:3010/api/events
```

## Tray icon guideline

The app now normalizes tray icon size by platform to avoid blurry or oversized tray icons:

- macOS: 18x18 (template image)
- Windows: 16x16
- Linux: 24x24
