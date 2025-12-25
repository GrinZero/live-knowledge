/**
 * File filter module for the create-lk-plugin scaffold tool.
 * Responsible for filtering files based on plugin type and feature options.
 * @module filter
 */

import * as fs from "fs";
import * as path from "path";
import { ScaffoldError, ScaffoldErrorCode, PluginConfig } from "./types";

/**
 * Options for filtering files.
 */
export interface FilterOptions {
  /** Target directory containing the generated project */
  targetDir: string;
  /** Plugin configuration */
  config: PluginConfig;
}

/**
 * Files that are only needed for main process plugins.
 * These will be removed for renderer-only plugins.
 */
export const MAIN_ONLY_FILES = ["src/index.ts", "vite.main.config.ts"];

/**
 * Files that are only needed for renderer process plugins.
 * These will be removed for main-only plugins.
 */
export const RENDERER_ONLY_FILES = [
  "src/renderer.tsx",
  "src/components",
  "src/env.d.ts",
  "vite.renderer.config.ts",
];

/**
 * Files associated with specific features.
 * Key is the feature name, value is array of file paths to remove when feature is disabled.
 */
export const FEATURE_FILES: Record<string, string[]> = {
  page: ["src/components/ExamplePage.tsx"],
};

/**
 * Recursively removes a file or directory.
 *
 * @param targetPath - Path to remove
 */
function removePathSync(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
}

/**
 * Gets the list of files to remove based on plugin type.
 *
 * @param pluginType - The plugin type ('full', 'main-only', 'renderer-only')
 * @returns Array of relative file paths to remove
 */
export function getFilesToRemoveByType(
  pluginType: PluginConfig["type"],
): string[] {
  switch (pluginType) {
    case "main-only":
      // Remove renderer-related files
      return [...RENDERER_ONLY_FILES];
    case "renderer-only":
      // Remove main-related files
      return [...MAIN_ONLY_FILES];
    case "full":
    default:
      // Keep all files
      return [];
  }
}

/**
 * Gets the list of files to remove based on disabled features.
 *
 * @param features - The feature configuration
 * @returns Array of relative file paths to remove
 */
export function getFilesToRemoveByFeatures(
  features: PluginConfig["features"],
): string[] {
  const filesToRemove: string[] = [];

  for (const [featureName, files] of Object.entries(FEATURE_FILES)) {
    const featureEnabled = features[featureName as keyof typeof features];
    if (!featureEnabled) {
      filesToRemove.push(...files);
    }
  }

  return filesToRemove;
}

/**
 * Gets all files that should be removed based on plugin configuration.
 *
 * @param config - The plugin configuration
 * @returns Array of relative file paths to remove (deduplicated)
 */
export function getFilesToRemove(config: PluginConfig): string[] {
  const byType = getFilesToRemoveByType(config.type);
  const byFeatures = getFilesToRemoveByFeatures(config.features);

  // Combine and deduplicate
  const allFiles = [...byType, ...byFeatures];
  return [...new Set(allFiles)];
}

/**
 * Filters files in the target directory based on plugin configuration.
 * Removes files that are not needed for the specified plugin type and features.
 *
 * @param options - Filter options
 * @throws {ScaffoldError} If filtering fails
 *
 * @example
 * await filterFiles({
 *   targetDir: './my-plugin',
 *   config: {
 *     id: 'my-plugin',
 *     type: 'main-only',
 *     features: { sidebar: false, page: false, configSchema: true, httpApi: false }
 *   }
 * });
 */
export async function filterFiles(options: FilterOptions): Promise<void> {
  const { targetDir, config } = options;

  // Validate target directory exists
  if (!fs.existsSync(targetDir)) {
    throw new ScaffoldError(
      ScaffoldErrorCode.WRITE_FAILED,
      `Target directory not found: ${targetDir}`,
    );
  }

  const stats = fs.statSync(targetDir);
  if (!stats.isDirectory()) {
    throw new ScaffoldError(
      ScaffoldErrorCode.WRITE_FAILED,
      `Target path is not a directory: ${targetDir}`,
    );
  }

  try {
    const filesToRemove = getFilesToRemove(config);

    for (const relativePath of filesToRemove) {
      const fullPath = path.join(targetDir, relativePath);
      removePathSync(fullPath);
    }
  } catch (error) {
    if (error instanceof ScaffoldError) {
      throw error;
    }
    throw new ScaffoldError(
      ScaffoldErrorCode.WRITE_FAILED,
      `Failed to filter files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Checks if a file exists in the target directory.
 * Utility function for testing.
 *
 * @param targetDir - Target directory
 * @param relativePath - Relative path to check
 * @returns true if the file exists
 */
export function fileExists(targetDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(targetDir, relativePath));
}
