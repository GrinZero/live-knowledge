import {
  EventDispatchContext,
  EventTypeDefinition,
  LiveKnowledgePlugin,
  PluginContext,
} from "@live-knowledge/plugin-sdk";
import { spawn } from "node:child_process";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

const MAX_ATTACHMENT_UPPER_BOUND = 8;

type TransferMode = "json" | "multipart";
type ContentType =
  | "problem_solving"
  | "coding"
  | "meeting"
  | "document"
  | "unknown";
type ResourceMode = "raw" | "markdown" | "local_file";
type MultimodalMode = "raw" | "markitdown" | "local_file";
type EventMatchMode = "exact" | "prefix";

interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  events?: string[];
  transferMode?: TransferMode;
  maxAttachmentCount?: number;
  resourceMode?: ResourceMode;
  enableTypeDetection?: boolean;
  allowedContentTypes?: ContentType[];
  customEvents?: string[];
  eventMatchMode?: EventMatchMode;
  markitdownEnabled?: boolean;
}

interface MultimodalResource {
  mode: MultimodalMode;
  raw?: Record<string, unknown>;
  markdown?: string;
  localFiles?: string[];
}

interface EnvelopePayload {
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
  detectedType: ContentType;
  markdown?: string;
  multimodal: MultimodalResource;
  eventDomain?: string;
  eventSource?: string;
  eventTypeCatalog?: EventTypeDefinition[];
}

const LEGACY_EVENT_ALIASES: Record<string, string> = {
  insight_generated: "insight.generated",
  knowledge_created: "knowledge.created",
};

function normalizeEventName(event: string): string {
  return LEGACY_EVENT_ALIASES[event] || event;
}


export class WebhookPlugin implements LiveKnowledgePlugin {
  id = "webhook-plugin";
  name = "Webhook Integration";
  version = "1.5.0";
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
              description:
                "监听的事件类型（支持任意字符串；留空则监听所有），可填写 insight.generated、knowledge.created 或其它已注册事件。",
              items: {
                type: "string",
              },
            },
            customEvents: {
              type: "array",
              title: "自定义事件",
              description: "手动补充事件名，会与 events 合并后匹配。",
              items: {
                type: "string",
              },
            },
            eventMatchMode: {
              type: "string",
              title: "事件匹配模式",
              description: "exact 精确匹配；prefix 前缀匹配。",
              enum: ["exact", "prefix"],
            },
            transferMode: {
              type: "string",
              title: "传输模式",
              description: "json 仅发送结构化数据；multipart 会附带截图文件",
              enum: ["json", "multipart"],
            },
            resourceMode: {
              type: "string",
              title: "资源模式",
              description:
                "统一多模态资源输出：raw（结构化 JSON）、markdown（MarkItDown 文本）或 local_file（仅本地路径）。",
              enum: ["raw", "markdown", "local_file"],
            },
            maxAttachmentCount: {
              type: "number",
              title: "最大附件数量",
              description: "multipart 模式下最多上传多少张截图",
              minimum: 1,
              maximum: 8,
            },
            enableTypeDetection: {
              type: "boolean",
              title: "启用类型识别",
              description: "先识别事件内容类型，再决定是否发送。",
              default: false,
            },
            allowedContentTypes: {
              type: "array",
              title: "允许发送的内容类型",
              description:
                "只有识别结果命中该列表时才发送（启用类型识别时生效）。",
              items: {
                type: "string",
                enum: [
                  "problem_solving",
                  "coding",
                  "meeting",
                  "document",
                  "unknown",
                ],
              },
            },
            markitdownEnabled: {
              type: "boolean",
              title: "启用 MarkItDown",
              description:
                "在 Electron 侧尝试把截图转换为 markdown 并随 webhook 发送。",
              default: false,
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
        events: ["insight.generated", "knowledge.created"],
        transferMode: "json",
        resourceMode: "raw",
        enableTypeDetection: false,
        eventMatchMode: "exact",
        markitdownEnabled: false,
        maxAttachmentCount: 3,
      },
    ],
  };

  private context: PluginContext | null = null;

  initialize(context: PluginContext) {
    this.context = context;
    console.log("[WebhookPlugin] Initialized", context);
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

  private detectContentType(payload: Record<string, unknown>): ContentType {
    const text = JSON.stringify(payload).toLowerCase();

    if (
      text.includes("题") ||
      text.includes("problem") ||
      text.includes("答案") ||
      text.includes("解题") ||
      text.includes("solution")
    ) {
      return "problem_solving";
    }

    if (
      text.includes("error") ||
      text.includes("bug") ||
      text.includes("stack") ||
      text.includes("代码") ||
      text.includes("function")
    ) {
      return "coding";
    }

    if (
      text.includes("meeting") ||
      text.includes("calendar") ||
      text.includes("会议")
    ) {
      return "meeting";
    }

    if (
      text.includes("文档") ||
      text.includes("markdown") ||
      text.includes("doc")
    ) {
      return "document";
    }

    return "unknown";
  }

  private createMarkdown(
    event: string,
    payload: Record<string, unknown>,
    detectedType: ContentType,
  ): string {
    return [
      `# Live Knowledge Event`,
      ``,
      `- event: ${event}`,
      `- detectedType: ${detectedType}`,
      `- timestamp: ${new Date().toISOString()}`,
      ``,
      `## Payload`,
      "```json",
      JSON.stringify(payload, null, 2),
      "```",
    ].join("\n");
  }

  private async convertWithMarkItDown(
    filePath?: string,
  ): Promise<string | null> {
    if (!filePath) return null;

    return await new Promise((resolve) => {
      const child = spawn("python", ["-m", "markitdown", filePath], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("close", (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve(stdout.trim());
          return;
        }

        if (stderr.trim()) {
          console.warn(
            "[WebhookPlugin] markitdown conversion skipped:",
            stderr,
          );
        }
        resolve(null);
      });

      child.on("error", () => resolve(null));
    });
  }

  private async buildMultimodalResource(
    event: string,
    payload: Record<string, unknown>,
    hook: WebhookConfig,
    detectedType: ContentType,
  ): Promise<MultimodalResource> {
    const localFiles = this.collectScreenshotPaths(payload);
    const resourceMode = hook.resourceMode || "raw";

    let markdown: string | undefined;
    if (resourceMode === "markdown") {
      markdown = this.createMarkdown(event, payload, detectedType);
    }

    if (hook.markitdownEnabled && !markdown) {
      const converted = await this.convertWithMarkItDown(localFiles[0]);
      if (converted) {
        markdown = converted;
      }
    }

    if (resourceMode === "local_file") {
      return {
        mode: "local_file",
        localFiles,
      };
    }

    if (markdown) {
      return {
        mode: "markitdown",
        raw: payload,
        markdown,
        localFiles,
      };
    }

    return {
      mode: "raw",
      raw: payload,
      localFiles,
    };
  }

  private shouldSendByEvent(hook: WebhookConfig, event: string): boolean {
    const normalizedEvent = normalizeEventName(event);
    const eventRules = [
      ...(hook.events || []),
      ...(hook.customEvents || []),
    ]
      .filter(Boolean)
      .map((rule) => normalizeEventName(rule));
    if (eventRules.length === 0) return true;

    const mode = hook.eventMatchMode || "exact";
    if (mode === "prefix") {
      return eventRules.some((rule) => normalizedEvent.startsWith(rule));
    }

    return eventRules.includes(normalizedEvent);
  }

  private async buildEnvelope(
    event: string,
    payload: Record<string, unknown>,
    hook: WebhookConfig,
    context?: EventDispatchContext,
  ): Promise<EnvelopePayload> {
    const detectedType = hook.enableTypeDetection
      ? this.detectContentType(payload)
      : "unknown";

    const multimodal = await this.buildMultimodalResource(event, payload, hook, detectedType);

    const envelope: EnvelopePayload = {
      event: normalizeEventName(event),
      timestamp: new Date().toISOString(),
      payload,
      detectedType,
      markdown: multimodal.markdown,
      multimodal,
      eventDomain: context?.envelope.domain,
      eventSource: context?.envelope.source,
      eventTypeCatalog: context?.eventTypes,
    };

    return envelope;
  }

  private shouldSendByType(hook: WebhookConfig, type: ContentType): boolean {
    if (!hook.enableTypeDetection) {
      return true;
    }

    if (!hook.allowedContentTypes || hook.allowedContentTypes.length === 0) {
      return true;
    }

    return hook.allowedContentTypes.includes(type);
  }

  private async sendJsonWebhook(
    hook: WebhookConfig,
    envelope: EnvelopePayload,
  ): Promise<Response> {
    return fetch(hook.url, {
      method: "POST",
      headers: hook.headers || { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
  }

  private async sendMultipartWebhook(
    hook: WebhookConfig,
    envelope: EnvelopePayload,
  ): Promise<{ response: Response; uploadedFiles: string[] }> {
    const formData = new FormData();
    const files = envelope.multimodal.localFiles || this.collectScreenshotPaths(envelope.payload);
    const maxAttachmentCount = Math.max(
      1,
      Math.min(hook.maxAttachmentCount ?? 3, MAX_ATTACHMENT_UPPER_BOUND),
    );
    const uploadedFiles: string[] = [];

    formData.append("event", envelope.event);
    formData.append("timestamp", envelope.timestamp);
    formData.append("detectedType", envelope.detectedType);
    formData.append("payload", JSON.stringify(envelope.payload));
    formData.append("multimodal", JSON.stringify(envelope.multimodal));
    if (envelope.eventDomain) {
      formData.append("eventDomain", envelope.eventDomain);
    }
    if (envelope.eventSource) {
      formData.append("eventSource", envelope.eventSource);
    }
    if (envelope.eventTypeCatalog) {
      formData.append("eventTypeCatalog", JSON.stringify(envelope.eventTypeCatalog));
    }
    if (envelope.markdown) {
      formData.append("markdown", envelope.markdown);
    }

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
    onEvent: async (
      event: string,
      payload: Record<string, unknown>,
      dispatchContext?: EventDispatchContext,
    ) => {
      console.log(`[WebhookPlugin] Received event: ${event}`);

      const webhooks =
        (this.config.webhooks as WebhookConfig[]) ||
        (this.defaultConfig.webhooks as WebhookConfig[]);

      if (!Array.isArray(webhooks)) {
        console.error("[WebhookPlugin] Webhooks config must be an array");
        return;
      }

      for (const hook of webhooks) {
        if (!this.shouldSendByEvent(hook, event)) {
          continue;
        }

        if (!hook.url) continue;

        const envelope = await this.buildEnvelope(event, payload, hook, dispatchContext);
        if (!this.shouldSendByType(hook, envelope.detectedType)) {
          console.log(
            `[WebhookPlugin] Skip webhook ${hook.url} because detected type is ${envelope.detectedType}`,
          );
          continue;
        }

        try {
          console.log(`[WebhookPlugin] Triggering webhook: ${hook.url}`);

          let response: Response;
          let uploadedFiles: string[] = [];

          if (hook.transferMode === "multipart") {
            const result = await this.sendMultipartWebhook(hook, envelope);
            response = result.response;
            uploadedFiles = result.uploadedFiles;
          } else {
            response = await this.sendJsonWebhook(hook, envelope);
          }

          if (this.context) {
            try {
              await this.context.events.emit("webhook.delivered", {
                targetUrl: hook.url,
                event: normalizeEventName(event),
                status: response.status,
                transferMode: hook.transferMode || "json",
              });

              await this.context.database.createKnowledgeItem({
                userId: "default_user",
                type: "webhook_log",
                title: `Webhook Trigger: ${normalizeEventName(event)}`,
                content: JSON.stringify({
                  url: hook.url,
                  event: normalizeEventName(event),
                  status: response.status,
                  statusText: response.statusText,
                  transferMode: hook.transferMode || "json",
                  resourceMode: hook.resourceMode || "raw",
                  detectedType: envelope.detectedType,
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
              await this.context.events.emit("webhook.delivery_failed", {
                targetUrl: hook.url,
                event: normalizeEventName(event),
                error: error instanceof Error ? error.message : String(error),
              });

              await this.context.database.createKnowledgeItem({
                userId: "default_user",
                type: "webhook_log",
                title: `Webhook Failed: ${normalizeEventName(event)}`,
                content: JSON.stringify({
                  url: hook.url,
                  event: normalizeEventName(event),
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
