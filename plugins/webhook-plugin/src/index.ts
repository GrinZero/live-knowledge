import {
  EventDispatchContext,
  LiveKnowledgePlugin,
  PluginContext,
} from "@live-knowledge/plugin-sdk";

interface WebhookEndpoint {
  url: string;
  events: string[];
}

export class WebhookPlugin implements LiveKnowledgePlugin {
  id = "webhook-plugin";
  name = "Webhook Integration";
  version = "2.0.0";
  description = "Forwards events to configured webhook endpoints via JSON POST.";

  config: Record<string, unknown> = {};

  configSchema = {
    type: "object",
    properties: {
      webhooks: {
        type: "array",
        title: "Webhook 列表",
        description: "配置需要触发的 Webhook",
        items: {
          type: "object",
          title: "Webhook 配置",
          properties: {
            url: {
              type: "string",
              title: "URL",
              description: "Webhook 接口地址",
            },
            events: {
              type: "array",
              title: "触发事件",
              description: "监听的事件类型（留空则监听所有事件）",
              items: { type: "string" },
            },
          },
        },
      },
    },
  };

  defaultConfig = {
    webhooks: [] as WebhookEndpoint[],
  };

  private context: PluginContext | null = null;

  initialize(context: PluginContext) {
    this.context = context;
    context.events.registerTypes([
      {
        type: "webhook.delivered",
        domain: "system",
        description: "Webhook plugin delivered an outbound webhook request.",
      },
      {
        type: "webhook.delivery_failed",
        domain: "system",
        description: "Webhook plugin failed to deliver an outbound webhook request.",
      },
    ]);
  }

  private convertBuffersToBase64(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Buffer.isBuffer(value)) {
        const newKey = key.replace(/Buffer$/, "Base64");
        result[newKey] = (value as Buffer).toString("base64");
      } else if (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        (value as Record<string, unknown>).type === "Buffer" &&
        Array.isArray((value as Record<string, unknown>).data)
      ) {
        const newKey = key.replace(/Buffer$/, "Base64");
        result[newKey] = Buffer.from(
          ((value as unknown) as { data: number[] }).data,
        ).toString("base64");
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  hooks = {
    onEvent: async (
      event: string,
      payload: Record<string, unknown>,
      dispatchContext?: EventDispatchContext,
    ) => {
      const webhooks =
        (this.config.webhooks as WebhookEndpoint[]) ||
        (this.defaultConfig.webhooks as WebhookEndpoint[]);

      if (!Array.isArray(webhooks)) return;

      for (const endpoint of webhooks) {
        if (!endpoint.url) continue;

        // Event filter: empty array or missing → forward all
        if (
          Array.isArray(endpoint.events) &&
          endpoint.events.length > 0 &&
          !endpoint.events.includes(event)
        ) {
          continue;
        }

        // Build POST body from context.envelope or construct one
        const convertedPayload = this.convertBuffersToBase64(payload);
        const body = dispatchContext?.envelope
          ? {
              ...dispatchContext.envelope,
              payload: convertedPayload,
            }
          : {
              type: event,
              payload: convertedPayload,
              emittedAt: new Date().toISOString(),
            };

        try {
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (this.context) {
            await this.context.events.emit("webhook.delivered", {
              url: endpoint.url,
              event,
              statusCode: response.status,
            });
          }
        } catch (error) {
          if (this.context) {
            await this.context.events.emit("webhook.delivery_failed", {
              url: endpoint.url,
              event,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    },
  };
}
