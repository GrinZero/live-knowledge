import {
  LiveKnowledgePlugin,
  PluginContext,
  Action,
} from "@live-knowledge/plugin-sdk";

/**
 * __PLUGIN_NAME__
 * __PLUGIN_DESCRIPTION__
 */
export class __PLUGIN_CLASS_NAME__ implements LiveKnowledgePlugin {
  id = "__PLUGIN_ID__";
  name = "__PLUGIN_NAME__";
  version = "__PLUGIN_VERSION__";
  description = "__PLUGIN_DESCRIPTION__";

  config: Record<string, unknown> = {};

  // #if FEATURE_CONFIG_SCHEMA
  configSchema = {
    type: "object",
    properties: {
      exampleOption: {
        type: "string",
        title: "示例选项",
        description: "这是一个示例配置项",
      },
    },
  };

  defaultConfig = {
    exampleOption: "默认值",
  };
  // #endif FEATURE_CONFIG_SCHEMA

  private context: PluginContext | null = null;

  /**
   * 插件初始化
   * @param context - 插件上下文，提供 AI、IPC、HTTP、数据库等服务
   */
  initialize(context: PluginContext) {
    this.context = context;
    console.log("[__PLUGIN_CLASS_NAME__] 插件已初始化");

    // #if FEATURE_HTTP_API
    // 注册 HTTP API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context.http.router.get("/status", (_req: any, res: any) => {
      res.json({ status: "ok", plugin: this.id });
    });
    // #endif FEATURE_HTTP_API
  }

  hooks = {
    /**
     * 获取插件上下文数据
     */
    getContext: async () => {
      return {
        pluginActive: true,
      };
    },

    /**
     * 丰富 AI 提示词
     */
    enrichPrompt: async () => {
      return `
[__PLUGIN_NAME__]
// 在此添加提示词增强逻辑
      `.trim();
    },

    /**
     * 处理动作
     */
    onAction: async (action: Action) => {
      if (action.type === "__PLUGIN_ID___action") {
        // 处理自定义动作
        return true;
      }
      return false;
    },
  };
}

export default __PLUGIN_CLASS_NAME__;
