import { LiveKnowledgePlugin, PluginContext } from "@live-knowledge/plugin-sdk";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

const MAX_ATTACHMENT_UPPER_BOUND = 8;

interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  events?: string[];
  transferMode?: "json" | "multipart";
  maxAttachmentCount?: number;
}

export class WebhookPlugin implements LiveKnowledgePlugin {
  id = "webhook-plugin";
  name = "Webhook Integration";
  version = "1.1.0";
  description =
    "Triggers external webhooks when knowledge or insights are generated.";

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
            headers: {
              type: "object",
              title: "Headers",
              description: "HTTP 请求头",
              additionalProperties: { type: "string" },
            },
            events: {
              type: "array",
              title: "触发事件",
              description: "监听的事件类型（留空则监听所有）",
              items: {
                type: "string",
                enum: ["insight_generated", "knowledge_created"],
              },
            },
            transferMode: {
              type: "string",
              title: "传输模式",
              description: "json 仅发送结构化数据；multipart 会附带截图文件",
              enum: ["json", "multipart"],
            },
            maxAttachmentCount: {
              type: "number",
              title: "最大附件数量",
              description: "multipart 模式下最多上传多少张截图",
              minimum: 1,
              maximum: 8,
            },
          },
        },
      },
    },
  };

  defaultConfig = {
    webhooks: [
      {
        url: "https://httpbin.org/post",
        headers: {
          "Content-Type": "application/json",
        },
        events: ["insight_generated", "knowledge_created"],
        transferMode: "json",
        maxAttachmentCount: 3,
      },
    ],
  };

  private context: PluginContext | null = null;

  initialize(context: PluginContext) {
    this.context = context;
    console.log("[WebhookPlugin] Initialized", context);

    context.http.router.get("/history", async (_req, res) => {
      try {
        const items = await context.database.getKnowledgeItems(100);
        const history = items
          .filter((item) => item.type === "webhook_log")
          .map((item) => {
            try {
              const content = JSON.parse(item.content);
              return {
                id: item.id,
                ...content,
                createdAt: item.createdAt,
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        res.json(history);
      } catch (error) {
        console.error("[WebhookPlugin] Failed to fetch history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
      }
    });
  }

  private collectScreenshotPaths(payload: Record<string, unknown>): string[] {
    const pathCandidates = new Set<string>();

    const walk = (value: unknown): void => {
      if (!value) return;

      if (typeof value === "string") {
        const normalized = value.toLowerCase().replaceAll("\\", "/");
        if (
          (normalized.includes("/") || normalized.includes(":")) &&
          (normalized.endsWith(".png") ||
            normalized.endsWith(".jpg") ||
            normalized.endsWith(".jpeg") ||
            normalized.endsWith(".webp"))
        ) {
          pathCandidates.add(value);
        }
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }

      if (typeof value === "object") {
        for (const [key, nested] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (
            key.toLowerCase().includes("screenshot") ||
            key.toLowerCase().includes("image")
          ) {
            walk(nested);
            continue;
          }

          if (typeof nested === "object") {
            walk(nested);
          }
        }
      }
    };

    walk(payload);
    return [...pathCandidates];
  }

  private async sendJsonWebhook(
    hook: WebhookConfig,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(hook.url, {
      method: "POST",
      headers: hook.headers || { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        payload,
      }),
    });
  }

  private async sendMultipartWebhook(
    hook: WebhookConfig,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ response: Response; uploadedFiles: string[] }> {
    const formData = new FormData();
    const files = this.collectScreenshotPaths(payload);
    const maxAttachmentCount = Math.max(
      1,
      Math.min(hook.maxAttachmentCount ?? 3, MAX_ATTACHMENT_UPPER_BOUND),
    );
    const uploadedFiles: string[] = [];

    formData.append("event", event);
    formData.append("timestamp", new Date().toISOString());
    formData.append("payload", JSON.stringify(payload));

    for (const filePath of files.slice(0, maxAttachmentCount)) {
      try {
        const fileBuffer = await readFile(filePath);
        const fileName = basename(filePath);
        formData.append("files", new Blob([fileBuffer]), fileName);
        uploadedFiles.push(fileName);
      } catch (error) {
        console.warn(
          "[WebhookPlugin] Failed to attach screenshot:",
          filePath,
          error,
        );
      }
    }

    const headers = { ...(hook.headers || {}) };
    delete headers["Content-Type"];

    const response = await fetch(hook.url, {
      method: "POST",
      headers,
      body: formData,
    });

    return { response, uploadedFiles };
  }

  hooks = {
    onEvent: async (event: string, payload: Record<string, unknown>) => {
      console.log(`[WebhookPlugin] Received event: ${event}`);

      const webhooks =
        (this.config.webhooks as WebhookConfig[]) ||
        (this.defaultConfig.webhooks as WebhookConfig[]);

      if (!Array.isArray(webhooks)) {
        console.error("[WebhookPlugin] Webhooks config must be an array");
        return;
      }

      for (const hook of webhooks) {
        if (
          hook.events &&
          hook.events.length > 0 &&
          !hook.events.includes(event)
        ) {
          continue;
        }

        if (!hook.url) continue;

        try {
          console.log(`[WebhookPlugin] Triggering webhook: ${hook.url}`);

          let response: Response;
          let uploadedFiles: string[] = [];

          if (hook.transferMode === "multipart") {
            const result = await this.sendMultipartWebhook(
              hook,
              event,
              payload,
            );
            response = result.response;
            uploadedFiles = result.uploadedFiles;
          } else {
            response = await this.sendJsonWebhook(hook, event, payload);
          }

          if (this.context) {
            try {
              await this.context.database.createKnowledgeItem({
                userId: "default_user",
                type: "webhook_log",
                title: `Webhook Trigger: ${event}`,
                content: JSON.stringify({
                  url: hook.url,
                  event,
                  status: response.status,
                  statusText: response.statusText,
                  transferMode: hook.transferMode || "json",
                  uploadedFiles,
                  payloadSummary: Object.keys(payload).join(", "),
                }),
                metadata: { url: hook.url, status: response.status },
                confidence: 1.0,
              });
            } catch (dbError) {
              console.error("[WebhookPlugin] Failed to save history:", dbError);
            }
          }
        } catch (error) {
          console.error(
            `[WebhookPlugin] Error triggering webhook ${hook.url}:`,
            error,
          );

          if (this.context) {
            try {
              await this.context.database.createKnowledgeItem({
                userId: "default_user",
                type: "webhook_log",
                title: `Webhook Failed: ${event}`,
                content: JSON.stringify({
                  url: hook.url,
                  event,
                  error: error instanceof Error ? error.message : String(error),
                }),
                metadata: { url: hook.url, error: true },
                confidence: 1.0,
              });
            } catch (dbError) {
              console.error(
                "[WebhookPlugin] Failed to save error history:",
                dbError,
              );
            }
          }
        }
      }
    },
  };
}
