/**
 * Project generator module for the create-lk-plugin scaffold tool.
 * Integrates copier, replacer, and filter modules to generate complete plugin projects.
 * @module generator
 */

import * as fs from "fs";
import * as path from "path";
import {
  ScaffoldError,
  ScaffoldErrorCode,
  GeneratorOptions,
  PluginConfig,
} from "./types";
import {
  copyTemplate,
  DEFAULT_EXCLUDE_PATTERNS,
  getFilesToCopy,
} from "./copier";
import { processDirectory, ReplaceContext } from "./replacer";
import { filterFiles, getFilesToRemove } from "./filter";
import { toPascalCase, validatePluginName, directoryExists } from "./utils";

/**
 * Gets the path to the template directory.
 * The template is located relative to this module.
 *
 * @returns Absolute path to the template directory
 */
export function getTemplateDir(): string {
  // In development, template is at ../template relative to src
  // In production (dist), template is at ../template relative to dist
  const possiblePaths = [
    path.resolve(__dirname, "../template"),
    path.resolve(__dirname, "../../template"),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }

  // Default to the first path (will throw error later if not found)
  return possiblePaths[0];
}

/**
 * Creates the replacement context from plugin configuration.
 *
 * @param config - Plugin configuration
 * @returns Replacement context for variable substitution
 */
export function createReplaceContext(config: PluginConfig): ReplaceContext {
  return {
    PLUGIN_ID: config.id,
    PLUGIN_CLASS_NAME: toPascalCase(config.id),
    PLUGIN_NAME: config.name,
    PLUGIN_DESCRIPTION: config.description,
    PLUGIN_VERSION: config.version,
  };
}

/**
 * Validates the generator options before proceeding.
 *
 * @param options - Generator options to validate
 * @throws {ScaffoldError} If validation fails
 */
export function validateOptions(options: GeneratorOptions): void {
  const { targetDir, config, overwrite } = options;

  // Validate plugin name
  if (!validatePluginName(config.id)) {
    throw new ScaffoldError(
      ScaffoldErrorCode.INVALID_NAME,
      `Invalid plugin name: "${config.id}". Plugin name must be in kebab-case format (e.g., "my-plugin").`,
    );
  }

  // Check if target directory already exists
  if (directoryExists(targetDir) && !overwrite) {
    throw new ScaffoldError(
      ScaffoldErrorCode.DIR_EXISTS,
      `Target directory already exists: ${targetDir}. Use overwrite option to replace.`,
    );
  }
}

/**
 * Cleans up the target directory on failure.
 *
 * @param targetDir - Directory to clean up
 */
function cleanupOnFailure(targetDir: string): void {
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Generates a complete plugin project.
 *
 * This function orchestrates the entire project generation process:
 * 1. Validates options and plugin configuration
 * 2. Copies the template directory to the target location
 * 3. Replaces placeholder variables with actual values
 * 4. Processes conditional blocks based on feature flags
 * 5. Filters out unnecessary files based on plugin type
 *
 * @param options - Generator options
 * @throws {ScaffoldError} If generation fails at any step
 *
 * @example
 * await generateProject({
 *   targetDir: './my-plugin',
 *   config: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     description: 'A sample plugin',
 *     version: '1.0.0',
 *     type: 'full',
 *     features: {
 *       sidebar: true,
 *       page: true,
 *       configSchema: false,
 *       httpApi: false
 *     }
 *   }
 * });
 */
export async function generateProject(
  options: GeneratorOptions,
): Promise<void> {
  const { targetDir, config, overwrite } = options;

  // Step 1: Validate options
  validateOptions(options);

  // Get template directory
  const templateDir = getTemplateDir();

  // If overwrite is enabled and directory exists, remove it first
  if (overwrite && fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  try {
    // Step 2: Copy template to target directory
    await copyTemplate({
      templateDir,
      targetDir,
      exclude: DEFAULT_EXCLUDE_PATTERNS,
    });

    // Step 3: Create replacement context
    const replaceContext = createReplaceContext(config);

    // Step 4: Process all files (replace variables and handle conditional blocks)
    await processDirectory(targetDir, replaceContext, {
      features: config.features,
    });

    // Step 5: Filter files based on plugin type and features
    await filterFiles({
      targetDir,
      config,
    });
  } catch (error) {
    // Clean up on failure
    cleanupOnFailure(targetDir);

    // Re-throw ScaffoldError as-is
    if (error instanceof ScaffoldError) {
      throw error;
    }

    // Wrap other errors
    throw new ScaffoldError(
      ScaffoldErrorCode.WRITE_FAILED,
      `Failed to generate project: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Gets the list of files that will be generated for a given configuration.
 * Useful for preview/dry-run functionality.
 *
 * @param config - Plugin configuration
 * @returns Array of relative file paths that will be generated
 */
export function getGeneratedFiles(config: PluginConfig): string[] {
  const templateDir = getTemplateDir();
  const allFiles = getFilesToCopy(templateDir, DEFAULT_EXCLUDE_PATTERNS);
  const filesToRemove = getFilesToRemove(config);

  // Filter out files that will be removed
  return allFiles.filter((file: string) => {
    return !filesToRemove.some(
      (removePattern: string) =>
        file === removePattern || file.startsWith(removePattern + "/"),
    );
  });
}
