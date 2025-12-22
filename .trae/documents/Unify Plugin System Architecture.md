# Unify Plugin System Architecture

I will refactor the plugin system to support a unified package structure where a single zip file can contain both main process and renderer process code.

## Key Changes

1.  **Unified Package Structure**:
    - Plugins will define a `renderer` entry point in their `package.json`, alongside the existing `main` entry point.
    - Example `package.json`:
      ```json
      {
        "name": "my-plugin",
        "main": "dist/main.js",
        "renderer": "dist/renderer.js"
      }
      ```

2.  **Plugin SDK & Packaging (`pack.js`)**:
    - Update the `pack.js` script to validate the `renderer` field in `package.json`.
    - Ensure the renderer entry file exists before packaging.

3.  **Main Process (`PluginManager.ts`)**:
    - Update `PluginManager` to read the `renderer` field from `package.json` during installation and loading.
    - Store the path to the renderer entry point.
    - Expose a new IPC API `plugins:getRendererPlugins` that allows the renderer process to fetch the list of available UI plugins and their entry scripts.

4.  **Renderer Process (`plugin-registry.ts` & `main.tsx`)**:
    - Expose a global registration API `window.LiveKnowledge.registerPlugin` for loaded plugins to use.
    - Implement a `loadInstalledPlugins` function that fetches plugin scripts from the main process and loads them dynamically (via `<script>` tags).
    - Initialize this loader on app startup.

5.  **Preload Script (`preload/index.ts`)**:
    - Expose the `getRendererPlugins` API to the renderer via context bridge.

## Implementation Steps

1.  **Update `packages/plugin-sdk/bin/pack.js`**: Add checks for `renderer` entry.
2.  **Update `apps/desktop/src/main/services/PluginManager.ts`**:
    - Modify `installPluginFromZip`/`Tarball` to parse `renderer` field.
    - Modify `loadPluginFromFile` to find `package.json` and register renderer entry.
    - Add `getRendererPlugins` IPC handler.
3.  **Update `apps/desktop/src/preload/index.ts`**: Add `getRendererPlugins` to `api.plugins`.
4.  **Update `apps/desktop/src/renderer/src/plugin-registry.ts`**:
    - Add `loadInstalledPlugins`.
    - Setup `window.LiveKnowledge`.
5.  **Update `apps/desktop/src/renderer/src/main.tsx`**: Call `loadInstalledPlugins`.

This architecture allows developers to build a single `dist` folder containing both `main.js` and `renderer.js`, zip it, and the user only needs to install that one zip file. The system handles the distribution of code to the respective processes.
