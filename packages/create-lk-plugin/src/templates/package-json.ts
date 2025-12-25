/**
 * Package.json template generator for the create-lk-plugin scaffold tool.
 * Generates package.json content based on plugin configuration.
 * @module templates/package-json
 */

import { TemplateContext } from "../types";

/**
 * Plugin manifest interface representing the generated package.json structure.
 */
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main?: string;
  renderer?: string;
  types?: string;
  scripts: {
    build: string;
    lint: string;
    "lint:fix": string;
    pack: string;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Generates the package.json content for a plugin project.
 * The content is dynamically adjusted based on the plugin configuration:
 * - Main-only plugins: only main entry point, no renderer dependencies
 * - Renderer-only plugins: only renderer entry point, includes React dependencies
 * - Full plugins: both entry points and all dependencies
 *
 * @param context - The template context containing plugin configuration
 * @returns The package.json content as a formatted JSON string
 *
 * @example
 * const content = generatePackageJson({
 *   pluginId: 'my-plugin',
 *   pluginName: 'My Plugin',
 *   pluginDescription: 'A sample plugin',
 *   pluginVersion: '1.0.0',
 *   hasMain: true,
 *   hasRenderer: true,
 *   pluginClassName: 'MyPlugin',
 *   features: { sidebar: true, page: true, configSchema: false, httpApi: false }
 * });
 */
export function generatePackageJson(context: TemplateContext): string {
  const manifest = buildManifest(context);
  return JSON.stringify(manifest, null, 2);
}

/**
 * Builds the plugin manifest object based on the template context.
 *
 * @param context - The template context
 * @returns The plugin manifest object
 */
function buildManifest(context: TemplateContext): PluginManifest {
  const manifest: PluginManifest = {
    name: context.pluginId,
    version: context.pluginVersion,
    description: context.pluginDescription,
    scripts: buildScripts(context),
    dependencies: buildDependencies(),
    devDependencies: buildDevDependencies(context),
  };

  // Add entry points based on plugin type
  if (context.hasMain) {
    manifest.main = "./dist/index.js";
    manifest.types = "./dist/index.d.ts";
  }

  if (context.hasRenderer) {
    manifest.renderer = "./dist/renderer.global.js";
  }

  // Add peer dependencies for renderer plugins
  if (context.hasRenderer) {
    manifest.peerDependencies = buildPeerDependencies();
  }

  return manifest;
}

/**
 * Builds the scripts section of package.json.
 * The build script is adjusted based on whether the plugin has main/renderer processes.
 *
 * @param context - The template context
 * @returns The scripts object
 */
function buildScripts(context: TemplateContext): PluginManifest["scripts"] {
  let buildCommand: string;

  if (context.hasMain && context.hasRenderer) {
    // Full plugin: build both main and renderer
    buildCommand =
      "vite build -c vite.main.config.ts && vite build -c vite.renderer.config.ts";
  } else if (context.hasMain) {
    // Main-only plugin
    buildCommand = "vite build -c vite.main.config.ts";
  } else {
    // Renderer-only plugin
    buildCommand = "vite build -c vite.renderer.config.ts";
  }

  return {
    build: buildCommand,
    lint: "eslint .",
    "lint:fix": "eslint . --fix",
    pack: "lk-pack",
  };
}

/**
 * Builds the dependencies section of package.json.
 * Always includes the plugin SDK as a dependency.
 *
 * @returns The dependencies object
 */
function buildDependencies(): Record<string, string> {
  return {
    "@live-knowledge/plugin-sdk": "workspace:*",
  };
}

/**
 * Builds the devDependencies section of package.json.
 * Includes React plugin only for renderer plugins.
 *
 * @param context - The template context
 * @returns The devDependencies object
 */
function buildDevDependencies(
  context: TemplateContext,
): Record<string, string> {
  const devDeps: Record<string, string> = {
    typescript: "^5.0.0",
    vite: "^5.4.21",
    "vite-plugin-dts": "^4.5.4",
    eslint: "^9.36.0",
  };

  // Add React plugin for renderer plugins
  if (context.hasRenderer) {
    devDeps["@vitejs/plugin-react"] = "^4.3.4";
  }

  return devDeps;
}

/**
 * Builds the peerDependencies section of package.json.
 * Only included for plugins with renderer process.
 *
 * @returns The peerDependencies object
 */
function buildPeerDependencies(): Record<string, string> {
  return {
    react: "*",
    "react-router-dom": "*",
  };
}
