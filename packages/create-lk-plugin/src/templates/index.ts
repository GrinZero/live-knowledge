/**
 * Template manager for the create-lk-plugin scaffold tool.
 * Manages and provides template files based on plugin configuration.
 * @module templates
 */

import { PluginConfig, TemplateFile, TemplateContext } from "../types";
import { toPascalCase } from "../utils";

/**
 * Creates a template context from plugin configuration.
 * This context is used for rendering template content.
 *
 * @param config - The plugin configuration
 * @returns Template context for rendering
 */
export function createTemplateContext(config: PluginConfig): TemplateContext {
  const hasMain = config.type === "full" || config.type === "main-only";
  const hasRenderer = config.type === "full" || config.type === "renderer-only";

  return {
    pluginId: config.id,
    pluginClassName: toPascalCase(config.id),
    pluginName: config.name,
    pluginDescription: config.description,
    pluginVersion: config.version,
    hasMain,
    hasRenderer,
    features: config.features,
  };
}

/**
 * Returns all template files for a given plugin configuration.
 * Templates are filtered based on the plugin type and feature options.
 *
 * @param config - The plugin configuration
 * @returns Array of template files to generate
 *
 * @example
 * const templates = getTemplates({
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   description: 'A sample plugin',
 *   version: '1.0.0',
 *   type: 'full',
 *   features: { sidebar: true, page: true, configSchema: false, httpApi: false }
 * });
 */
export function getTemplates(config: PluginConfig): TemplateFile[] {
  const allTemplates = getAllTemplates();

  // Filter templates based on conditions
  return filterTemplates(allTemplates, config);
}

/**
 * Filters templates based on their condition functions.
 * Templates without conditions are always included.
 *
 * @param templates - Array of all possible templates
 * @param config - The plugin configuration for condition evaluation
 * @returns Filtered array of templates that should be generated
 */
export function filterTemplates(
  templates: TemplateFile[],
  config: PluginConfig,
): TemplateFile[] {
  return templates.filter((template) => {
    // If no condition, always include
    if (!template.condition) {
      return true;
    }
    // Evaluate condition function
    return template.condition(config);
  });
}

/**
 * Returns all possible template files with their conditions.
 * This is the master list of all templates that can be generated.
 * Content for each template will be provided by specific template modules.
 *
 * @returns Array of all template files with conditions
 */
function getAllTemplates(): TemplateFile[] {
  return [
    // Core configuration files (always generated)
    {
      path: "package.json",
      content: "", // Content will be provided by package-json.ts template
    },
    {
      path: "tsconfig.json",
      content: "", // Content will be provided by config-files.ts template
    },
    {
      path: "eslint.config.mjs",
      content: "", // Content will be provided by config-files.ts template
    },
    {
      path: "README.md",
      content: "", // Content will be provided by readme.ts template
    },

    // Main process files (conditional)
    {
      path: "vite.main.config.ts",
      content: "", // Content will be provided by config-files.ts template
      condition: (config: PluginConfig) =>
        config.type === "full" || config.type === "main-only",
    },
    {
      path: "src/index.ts",
      content: "", // Content will be provided by main-process.ts template
      condition: (config: PluginConfig) =>
        config.type === "full" || config.type === "main-only",
    },

    // Renderer process files (conditional)
    {
      path: "vite.renderer.config.ts",
      content: "", // Content will be provided by config-files.ts template
      condition: (config: PluginConfig) =>
        config.type === "full" || config.type === "renderer-only",
    },
    {
      path: "src/renderer.tsx",
      content: "", // Content will be provided by renderer-process.ts template
      condition: (config: PluginConfig) =>
        config.type === "full" || config.type === "renderer-only",
    },
    {
      path: "src/env.d.ts",
      content: "", // Content will be provided by config-files.ts template
      condition: (config: PluginConfig) =>
        config.type === "full" || config.type === "renderer-only",
    },

    // Component files (conditional on page feature)
    {
      path: "src/components/ExamplePage.tsx",
      content: "", // Content will be provided by components.ts template
      condition: (config: PluginConfig) =>
        (config.type === "full" || config.type === "renderer-only") &&
        config.features.page,
    },
  ];
}

/**
 * Checks if a plugin configuration requires main process code.
 *
 * @param config - The plugin configuration
 * @returns true if main process code should be generated
 */
export function hasMainProcess(config: PluginConfig): boolean {
  return config.type === "full" || config.type === "main-only";
}

/**
 * Checks if a plugin configuration requires renderer process code.
 *
 * @param config - The plugin configuration
 * @returns true if renderer process code should be generated
 */
export function hasRendererProcess(config: PluginConfig): boolean {
  return config.type === "full" || config.type === "renderer-only";
}

/**
 * Gets the list of core files that are always generated.
 *
 * @returns Array of core file paths
 */
export function getCoreFiles(): string[] {
  return ["package.json", "tsconfig.json", "eslint.config.mjs", "README.md"];
}

/**
 * Gets the list of main process specific files.
 *
 * @returns Array of main process file paths
 */
export function getMainProcessFiles(): string[] {
  return ["vite.main.config.ts", "src/index.ts"];
}

/**
 * Gets the list of renderer process specific files.
 *
 * @returns Array of renderer process file paths
 */
export function getRendererProcessFiles(): string[] {
  return ["vite.renderer.config.ts", "src/renderer.tsx", "src/env.d.ts"];
}
