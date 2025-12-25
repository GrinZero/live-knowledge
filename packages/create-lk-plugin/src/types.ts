/**
 * Core type definitions for the create-lk-plugin scaffold tool.
 * @module types
 */

/**
 * Error codes for scaffold operations.
 */
export enum ScaffoldErrorCode {
  /** Target directory already exists */
  DIR_EXISTS = "DIR_EXISTS",
  /** Invalid plugin name format */
  INVALID_NAME = "INVALID_NAME",
  /** File write operation failed */
  WRITE_FAILED = "WRITE_FAILED",
  /** Template rendering failed */
  TEMPLATE_ERROR = "TEMPLATE_ERROR",
  /** Template copy operation failed */
  COPY_FAILED = "COPY_FAILED",
  /** Variable replacement failed */
  REPLACE_FAILED = "REPLACE_FAILED",
}

/**
 * Custom error class for scaffold operations.
 */
export class ScaffoldError extends Error {
  constructor(
    public code: ScaffoldErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ScaffoldError";
  }
}

/**
 * Plugin type options.
 */
export type PluginType = "full" | "main-only" | "renderer-only";

/**
 * Feature options for plugin generation.
 */
export interface PluginFeatures {
  /** Whether to include sidebar menu item */
  sidebar: boolean;
  /** Whether to include standalone page route */
  page: boolean;
  /** Whether to include configuration schema */
  configSchema: boolean;
  /** Whether to include HTTP API endpoints */
  httpApi: boolean;
}

/**
 * Plugin configuration collected from user input.
 */
export interface PluginConfig {
  /** Plugin ID in kebab-case format */
  id: string;
  /** Plugin display name */
  name: string;
  /** Plugin description */
  description: string;
  /** Plugin version */
  version: string;
  /** Plugin type */
  type: PluginType;
  /** Feature options */
  features: PluginFeatures;
}

/**
 * Template file definition.
 */
export interface TemplateFile {
  /** Target file path relative to project root */
  path: string;
  /** Template content */
  content: string;
  /** Optional condition function to determine if file should be generated */
  condition?: (config: PluginConfig) => boolean;
}

/**
 * Options for the project generator.
 */
export interface GeneratorOptions {
  /** Target directory path */
  targetDir: string;
  /** Plugin configuration */
  config: PluginConfig;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
}

/**
 * Template context for rendering templates.
 */
export interface TemplateContext {
  /** Plugin ID in kebab-case */
  pluginId: string;
  /** Plugin class name in PascalCase */
  pluginClassName: string;
  /** Plugin display name */
  pluginName: string;
  /** Plugin description */
  pluginDescription: string;
  /** Plugin version */
  pluginVersion: string;
  /** Whether plugin has main process code */
  hasMain: boolean;
  /** Whether plugin has renderer process code */
  hasRenderer: boolean;
  /** Feature options */
  features: PluginFeatures;
}
