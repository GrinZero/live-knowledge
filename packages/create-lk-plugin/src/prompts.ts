/**
 * Interactive prompts module for collecting plugin configuration.
 * Uses inquirer to implement interactive Q&A flow.
 *
 * @module prompts
 */

import inquirer from "inquirer";
import { PluginConfig, PluginType, PluginFeatures } from "./types";
import { validatePluginName } from "./utils";

/**
 * Default plugin configuration values.
 */
export const DEFAULT_CONFIG: Omit<PluginConfig, "id"> = {
  name: "",
  description: "",
  version: "1.0.0",
  type: "full",
  features: {
    sidebar: true,
    page: true,
    configSchema: false,
    httpApi: false,
  },
};

/**
 * Plugin type choices for the interactive prompt.
 */
export const PLUGIN_TYPE_CHOICES = [
  {
    name: "完整插件 (Full Plugin) - 包含主进程和渲染进程",
    value: "full" as PluginType,
  },
  {
    name: "仅后端 (Main Only) - 仅包含主进程代码",
    value: "main-only" as PluginType,
  },
  {
    name: "仅前端 (Renderer Only) - 仅包含渲染进程代码",
    value: "renderer-only" as PluginType,
  },
];

/**
 * Checks if the plugin type includes main process.
 * @param type - Plugin type
 * @returns true if the plugin has main process
 */
export function hasMainProcess(type: PluginType): boolean {
  return type === "full" || type === "main-only";
}

/**
 * Checks if the plugin type includes renderer process.
 * @param type - Plugin type
 * @returns true if the plugin has renderer process
 */
export function hasRendererProcess(type: PluginType): boolean {
  return type === "full" || type === "renderer-only";
}

/**
 * Validates plugin name input.
 * @param input - User input
 * @returns true if valid, error message if invalid
 */
export function validatePluginNameInput(input: string): boolean | string {
  if (!input || input.trim().length === 0) {
    return "插件名称不能为空";
  }
  if (!validatePluginName(input)) {
    return "插件名称必须是 kebab-case 格式 (例如: my-plugin)，只能包含小写字母、数字和连字符";
  }
  return true;
}

/**
 * Generates a default display name from plugin ID.
 * Converts kebab-case to Title Case.
 * @param id - Plugin ID in kebab-case
 * @returns Display name in Title Case
 */
export function generateDefaultName(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Raw answers from inquirer prompts.
 */
export interface PromptAnswers {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  type?: PluginType;
  "features.sidebar"?: boolean;
  "features.page"?: boolean;
  "features.configSchema"?: boolean;
  "features.httpApi"?: boolean;
}

/**
 * Builds the list of questions for inquirer based on partial config.
 * @param defaults - Partial default configuration
 * @returns Array of inquirer questions
 */
export function buildQuestions(
  defaults?: Partial<PluginConfig>,
): inquirer.QuestionCollection<PromptAnswers> {
  const questions: inquirer.QuestionCollection<PromptAnswers> = [
    // Plugin ID (kebab-case)
    {
      type: "input",
      name: "id",
      message: "插件名称 (kebab-case 格式):",
      validate: validatePluginNameInput,
      when: () => !defaults?.id,
    },
    // Plugin display name
    {
      type: "input",
      name: "name",
      message: "插件显示名称:",
      default: (answers: PromptAnswers) =>
        generateDefaultName(answers.id || defaults?.id || ""),
      when: () => !defaults?.name,
    },
    // Plugin description
    {
      type: "input",
      name: "description",
      message: "插件描述:",
      default: DEFAULT_CONFIG.description,
      when: () => defaults?.description === undefined,
    },
    // Plugin version
    {
      type: "input",
      name: "version",
      message: "插件版本:",
      default: DEFAULT_CONFIG.version,
      when: () => !defaults?.version,
    },
    // Plugin type
    {
      type: "list",
      name: "type",
      message: "插件类型:",
      choices: PLUGIN_TYPE_CHOICES,
      default: DEFAULT_CONFIG.type,
      when: () => !defaults?.type,
    },
    // Sidebar feature (only for renderer-containing plugins)
    {
      type: "confirm",
      name: "features.sidebar",
      message: "是否需要侧边栏菜单项?",
      default: DEFAULT_CONFIG.features.sidebar,
      when: (answers: PromptAnswers) => {
        const type = answers.type || defaults?.type || DEFAULT_CONFIG.type;
        return (
          hasRendererProcess(type) && defaults?.features?.sidebar === undefined
        );
      },
    },
    // Page feature (only for renderer-containing plugins)
    {
      type: "confirm",
      name: "features.page",
      message: "是否需要独立页面路由?",
      default: DEFAULT_CONFIG.features.page,
      when: (answers: PromptAnswers) => {
        const type = answers.type || defaults?.type || DEFAULT_CONFIG.type;
        return (
          hasRendererProcess(type) && defaults?.features?.page === undefined
        );
      },
    },
    // Config schema feature (only for main-containing plugins)
    {
      type: "confirm",
      name: "features.configSchema",
      message: "是否需要配置 Schema (configSchema)?",
      default: DEFAULT_CONFIG.features.configSchema,
      when: (answers: PromptAnswers) => {
        const type = answers.type || defaults?.type || DEFAULT_CONFIG.type;
        return (
          hasMainProcess(type) && defaults?.features?.configSchema === undefined
        );
      },
    },
    // HTTP API feature (only for main-containing plugins)
    {
      type: "confirm",
      name: "features.httpApi",
      message: "是否需要 HTTP API 端点?",
      default: DEFAULT_CONFIG.features.httpApi,
      when: (answers: PromptAnswers) => {
        const type = answers.type || defaults?.type || DEFAULT_CONFIG.type;
        return (
          hasMainProcess(type) && defaults?.features?.httpApi === undefined
        );
      },
    },
  ];

  return questions;
}

/**
 * Merges user answers with defaults to create complete config.
 * @param answers - User answers from inquirer
 * @param defaults - Default values
 * @returns Complete plugin configuration
 */
export function mergeConfig(
  answers: PromptAnswers,
  defaults?: Partial<PluginConfig>,
): PluginConfig {
  const type = answers.type || defaults?.type || DEFAULT_CONFIG.type;

  // Build features based on plugin type
  const features: PluginFeatures = {
    sidebar: hasRendererProcess(type)
      ? (answers["features.sidebar"] ??
        defaults?.features?.sidebar ??
        DEFAULT_CONFIG.features.sidebar)
      : false,
    page: hasRendererProcess(type)
      ? (answers["features.page"] ??
        defaults?.features?.page ??
        DEFAULT_CONFIG.features.page)
      : false,
    configSchema: hasMainProcess(type)
      ? (answers["features.configSchema"] ??
        defaults?.features?.configSchema ??
        DEFAULT_CONFIG.features.configSchema)
      : false,
    httpApi: hasMainProcess(type)
      ? (answers["features.httpApi"] ??
        defaults?.features?.httpApi ??
        DEFAULT_CONFIG.features.httpApi)
      : false,
  };

  const id = answers.id || defaults?.id || "";

  return {
    id,
    name:
      answers.name || defaults?.name || generateDefaultName(id) || "My Plugin",
    description: answers.description ?? defaults?.description ?? "",
    version: answers.version || defaults?.version || DEFAULT_CONFIG.version,
    type,
    features,
  };
}

/**
 * Collects plugin configuration through interactive prompts.
 *
 * @param defaults - Optional default configuration from CLI arguments
 * @returns Complete plugin configuration
 *
 * @example
 * // Interactive mode
 * const config = await collectConfig();
 *
 * @example
 * // With defaults from CLI
 * const config = await collectConfig({ id: 'my-plugin', type: 'full' });
 */
export async function collectConfig(
  defaults?: Partial<PluginConfig>,
): Promise<PluginConfig> {
  const questions = buildQuestions(defaults);
  const answers = await inquirer.prompt<PromptAnswers>(questions);
  return mergeConfig(answers, defaults);
}

/**
 * Creates a complete config with all defaults applied (non-interactive).
 * Useful for --yes flag or testing.
 *
 * @param id - Plugin ID (required)
 * @param overrides - Optional overrides for default values
 * @returns Complete plugin configuration
 */
export function createDefaultConfig(
  id: string,
  overrides?: Partial<Omit<PluginConfig, "id">>,
): PluginConfig {
  return {
    id,
    name: overrides?.name || generateDefaultName(id),
    description: overrides?.description ?? DEFAULT_CONFIG.description,
    version: overrides?.version || DEFAULT_CONFIG.version,
    type: overrides?.type || DEFAULT_CONFIG.type,
    features: {
      ...DEFAULT_CONFIG.features,
      ...overrides?.features,
    },
  };
}
