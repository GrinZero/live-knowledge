/**
 * Variable replacer module for the create-lk-plugin scaffold tool.
 * Responsible for replacing placeholders and processing conditional blocks.
 * @module replacer
 */

import * as fs from "fs";
import * as path from "path";
import { ScaffoldError, ScaffoldErrorCode, PluginFeatures } from "./types";

/**
 * Context for variable replacement in template files.
 */
export interface ReplaceContext {
  /** Plugin ID in kebab-case */
  PLUGIN_ID: string;
  /** Plugin class name in PascalCase */
  PLUGIN_CLASS_NAME: string;
  /** Plugin display name */
  PLUGIN_NAME: string;
  /** Plugin description */
  PLUGIN_DESCRIPTION: string;
  /** Plugin version */
  PLUGIN_VERSION: string;
}

/**
 * Options for processing conditional blocks.
 */
export interface ConditionalOptions {
  /** Feature flags for conditional processing */
  features: PluginFeatures;
}

/**
 * All placeholder patterns used in templates.
 */
export const PLACEHOLDER_PATTERNS = [
  "__PLUGIN_ID__",
  "__PLUGIN_CLASS_NAME__",
  "__PLUGIN_NAME__",
  "__PLUGIN_DESCRIPTION__",
  "__PLUGIN_VERSION__",
] as const;

/**
 * Mapping from feature names to conditional block identifiers.
 */
export const FEATURE_TO_CONDITION: Record<keyof PluginFeatures, string> = {
  sidebar: "FEATURE_SIDEBAR",
  page: "FEATURE_PAGE",
  configSchema: "FEATURE_CONFIG_SCHEMA",
  httpApi: "FEATURE_HTTP_API",
};

/**
 * Replaces all placeholder variables in the given content.
 *
 * @param content - The file content with placeholders
 * @param context - The replacement context with values
 * @returns The content with all placeholders replaced
 *
 * @example
 * const result = replaceVariables(
 *   'export class __PLUGIN_CLASS_NAME__ {}',
 *   { PLUGIN_CLASS_NAME: 'MyPlugin', ... }
 * );
 * // result: 'export class MyPlugin {}'
 */
export function replaceVariables(
  content: string,
  context: ReplaceContext,
): string {
  let result = content;

  // Helper function to escape special replacement patterns ($&, $`, $', etc.)
  const escapeReplacement = (str: string): string => {
    return str.replace(/\$/g, "$$$$");
  };

  // Replace each placeholder with its corresponding value
  // Use escaped values to handle special $ patterns in replacement strings
  result = result.replace(
    /__PLUGIN_ID__/g,
    escapeReplacement(context.PLUGIN_ID),
  );
  result = result.replace(
    /__PLUGIN_CLASS_NAME__/g,
    escapeReplacement(context.PLUGIN_CLASS_NAME),
  );
  result = result.replace(
    /__PLUGIN_NAME__/g,
    escapeReplacement(context.PLUGIN_NAME),
  );
  result = result.replace(
    /__PLUGIN_DESCRIPTION__/g,
    escapeReplacement(context.PLUGIN_DESCRIPTION),
  );
  result = result.replace(
    /__PLUGIN_VERSION__/g,
    escapeReplacement(context.PLUGIN_VERSION),
  );

  return result;
}

/**
 * Checks if content contains any unreplaced placeholders.
 *
 * @param content - The content to check
 * @returns Array of unreplaced placeholder names, empty if all replaced
 */
export function findUnreplacedPlaceholders(content: string): string[] {
  const unreplaced: string[] = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (content.includes(pattern)) {
      unreplaced.push(pattern);
    }
  }

  return unreplaced;
}

/**
 * Processes conditional blocks in the content based on feature flags.
 * Removes blocks for disabled features, keeps content for enabled features.
 *
 * Conditional block format:
 * ```
 * // #if FEATURE_NAME
 * ... code to include if feature is enabled ...
 * // #endif FEATURE_NAME
 * ```
 *
 * @param content - The file content with conditional blocks
 * @param options - Options containing feature flags
 * @returns The content with conditional blocks processed
 *
 * @example
 * const result = processConditionalBlocks(
 *   '// #if FEATURE_SIDEBAR\nconst sidebar = true;\n// #endif FEATURE_SIDEBAR',
 *   { features: { sidebar: false, ... } }
 * );
 * // result: '' (block removed because sidebar is false)
 */
export function processConditionalBlocks(
  content: string,
  options: ConditionalOptions,
): string {
  let result = content;

  // Process each feature's conditional blocks
  for (const [featureKey, conditionName] of Object.entries(
    FEATURE_TO_CONDITION,
  )) {
    const featureEnabled = options.features[featureKey as keyof PluginFeatures];

    // Pattern to match conditional blocks (handles both // and /* */ comment styles)
    // Matches: // #if CONDITION_NAME ... // #endif CONDITION_NAME
    const blockPattern = new RegExp(
      `^[ \\t]*\\/\\/[ \\t]*#if[ \\t]+${conditionName}[ \\t]*\\r?\\n([\\s\\S]*?)^[ \\t]*\\/\\/[ \\t]*#endif[ \\t]+${conditionName}[ \\t]*\\r?\\n?`,
      "gm",
    );

    if (featureEnabled) {
      // Keep the content inside the block, remove the markers
      result = result.replace(blockPattern, "$1");
    } else {
      // Remove the entire block including markers
      result = result.replace(blockPattern, "");
    }
  }

  return result;
}

/**
 * File extensions that should be processed for variable replacement.
 */
export const PROCESSABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".mjs",
  ".cjs",
];

/**
 * Checks if a file should be processed for variable replacement.
 *
 * @param filePath - The file path to check
 * @returns true if the file should be processed
 */
export function shouldProcessFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return PROCESSABLE_EXTENSIONS.includes(ext);
}

/**
 * Processes a single file: replaces variables and handles conditional blocks.
 *
 * @param filePath - Path to the file to process
 * @param context - Variable replacement context
 * @param conditionalOptions - Options for conditional block processing
 * @throws {ScaffoldError} If file processing fails
 */
export async function processFile(
  filePath: string,
  context: ReplaceContext,
  conditionalOptions: ConditionalOptions,
): Promise<void> {
  if (!shouldProcessFile(filePath)) {
    return;
  }

  try {
    // Read file content
    let content = fs.readFileSync(filePath, "utf-8");

    // Process conditional blocks first
    content = processConditionalBlocks(content, conditionalOptions);

    // Then replace variables
    content = replaceVariables(content, context);

    // Write back
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (error) {
    if (error instanceof ScaffoldError) {
      throw error;
    }
    throw new ScaffoldError(
      ScaffoldErrorCode.REPLACE_FAILED,
      `Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Recursively processes all files in a directory.
 *
 * @param dir - Directory path to process
 * @param context - Variable replacement context
 * @param conditionalOptions - Options for conditional block processing
 * @throws {ScaffoldError} If directory processing fails
 *
 * @example
 * await processDirectory(
 *   './my-plugin',
 *   { PLUGIN_ID: 'my-plugin', PLUGIN_CLASS_NAME: 'MyPlugin', ... },
 *   { features: { sidebar: true, page: true, ... } }
 * );
 */
export async function processDirectory(
  dir: string,
  context: ReplaceContext,
  conditionalOptions: ConditionalOptions,
): Promise<void> {
  if (!fs.existsSync(dir)) {
    throw new ScaffoldError(
      ScaffoldErrorCode.REPLACE_FAILED,
      `Directory not found: ${dir}`,
    );
  }

  const stats = fs.statSync(dir);
  if (!stats.isDirectory()) {
    throw new ScaffoldError(
      ScaffoldErrorCode.REPLACE_FAILED,
      `Path is not a directory: ${dir}`,
    );
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        await processDirectory(fullPath, context, conditionalOptions);
      } else if (entry.isFile()) {
        // Process file
        await processFile(fullPath, context, conditionalOptions);
      }
    }
  } catch (error) {
    if (error instanceof ScaffoldError) {
      throw error;
    }
    throw new ScaffoldError(
      ScaffoldErrorCode.REPLACE_FAILED,
      `Failed to process directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
