export { validatePluginName, toPascalCase, directoryExists } from "./utils";
export {
  ScaffoldError,
  ScaffoldErrorCode,
  type PluginConfig,
  type PluginFeatures,
  type PluginType,
  type TemplateFile,
  type GeneratorOptions,
  type TemplateContext,
} from "./types";
export {
  getTemplates,
  filterTemplates,
  createTemplateContext,
  hasMainProcess,
  hasRendererProcess,
  getCoreFiles,
  getMainProcessFiles,
  getRendererProcessFiles,
} from "./templates";
export { generatePackageJson } from "./templates/package-json";
export {
  copyTemplate,
  getFilesToCopy,
  matchesExcludePattern,
  DEFAULT_EXCLUDE_PATTERNS,
} from "./copier";
export {
  replaceVariables,
  processConditionalBlocks,
  processDirectory,
  processFile,
  findUnreplacedPlaceholders,
  shouldProcessFile,
  PLACEHOLDER_PATTERNS,
  FEATURE_TO_CONDITION,
  PROCESSABLE_EXTENSIONS,
  type ReplaceContext,
  type ConditionalOptions,
} from "./replacer";
export {
  filterFiles,
  getFilesToRemove,
  getFilesToRemoveByType,
  getFilesToRemoveByFeatures,
  fileExists,
  MAIN_ONLY_FILES,
  RENDERER_ONLY_FILES,
  FEATURE_FILES,
} from "./filter";
export {
  generateProject,
  getTemplateDir,
  createReplaceContext,
  validateOptions,
  getGeneratedFiles,
} from "./generator";
export {
  collectConfig,
  createDefaultConfig,
  buildQuestions,
  mergeConfig,
  validatePluginNameInput,
  generateDefaultName,
  hasMainProcess as promptsHasMainProcess,
  hasRendererProcess as promptsHasRendererProcess,
  DEFAULT_CONFIG,
  PLUGIN_TYPE_CHOICES,
  type PromptAnswers,
} from "./prompts";
