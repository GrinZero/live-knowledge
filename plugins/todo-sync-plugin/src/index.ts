import {
  LiveKnowledgePlugin,
  PluginContext,
  Action,
} from "@live-knowledge/plugin-sdk";
import { BrowserWindow, app } from "electron";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";

export interface TodoItem {
  id: string;
  title: string;
  content?: string;
  status: "pending" | "synced" | "failed";
  source: string;
  createdAt: string;
}

export class TodoSyncPlugin implements LiveKnowledgePlugin {
  id = "todo-sync";
  name = "TODO Sync Plugin";
  version = "1.0.0";
  description =
    "Automatically detects TODO items from screen context and syncs them to macOS Notes or Notion.";

  config: Record<string, unknown> = {};

  configSchema = {
    type: "object",
    properties: {
      provider: {
        type: "string",
        title: "Sync Provider",
        enum: ["macos_notes", "notion"],
        default: "macos_notes",
      },
      notionApiKey: {
        type: "string",
        title: "Notion API Key",
        format: "password",
      },
      notionDatabaseId: {
        type: "string",
        title: "Notion Database ID",
      },
      macosNotesFolder: {
        type: "string",
        title: "macOS Notes Folder",
        default: "Notes",
      },
    },
  };

  defaultConfig = {
    provider: "macos_notes",
    macosNotesFolder: "Notes",
  };

  private reviewWindow: BrowserWindow | null = null;
  private pendingTodos: Map<string, TodoItem[]> = new Map();
  // @ts-ignore - may be used in future or kept for consistency
  private pluginContext: PluginContext | null = null;

  initialize(context: PluginContext) {
    this.pluginContext = context;

    // API to get pending todos for a session
    context.http.router.get("/pending", (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId || !this.pendingTodos.has(sessionId)) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json(this.pendingTodos.get(sessionId));
    });

    // API to sync confirmed todos
    context.http.router.post("/sync", async (req: Request, res: Response) => {
      const { sessionId, todos } = req.body;
      if (!sessionId || !todos || !Array.isArray(todos)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      try {
        const results = await this.performSync(todos);
        res.json({ success: true, results });
      } catch (error) {
        console.error("[TodoSyncPlugin] Sync failed:", error);
        res.status(500).json({ error: "Sync failed" });
      }
    });

    console.log("[TodoSyncPlugin] Initialized");
  }

  hooks = {
    enrichPrompt: async () => {
      return `
[TODO Sync Plugin]
If the user mentions or displays items that look like tasks, actions, or TODOs:
1. Identify the task title and any additional details.
2. Suggest an action with type "sync_todo" and payload containing an array of "todos", where each todo has "title" and optional "content".
3. The "todos" array should be part of the action payload.
      `.trim();
    },

    onAction: async (action: Action) => {
      if (action.type === "sync_todo") {
        const payload = action.payload as { todos: Array<{ title: string; content?: string }> };
        if (!payload.todos || !Array.isArray(payload.todos)) return false;

        const sessionId = uuidv4();
        const todos: TodoItem[] = payload.todos.map((t) => ({
          id: uuidv4(),
          title: t.title,
          content: t.content,
          status: "pending",
          source: "screen_context",
          createdAt: new Date().toISOString(),
        }));

        this.pendingTodos.set(sessionId, todos);
        this.openReviewWindow(sessionId);
        return true;
      }
      return false;
    },
  };

  private openReviewWindow(sessionId: string) {
    const urlHash = `#/todo-review?sessionId=${sessionId}`;
    const isDev = !app.isPackaged;

    // Use common logic for getting renderer URL or local file path
    const getRendererPath = () => {
      if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
        return `${process.env["ELECTRON_RENDERER_URL"]}${urlHash}`;
      } else {
        // Fallback for production: app.getAppPath() + out/renderer/index.html
        return `file://${join(app.getAppPath(), "out/renderer/index.html")}${urlHash}`;
      }
    };

    if (this.reviewWindow && !this.reviewWindow.isDestroyed()) {
      this.reviewWindow.focus();
      this.reviewWindow.loadURL(getRendererPath());
      return;
    }

    const preloadPath = join(app.getAppPath(), "out/preload/index.js");

    this.reviewWindow = new BrowserWindow({
      width: 600,
      height: 500,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.reviewWindow.on("ready-to-show", () => {
      this.reviewWindow?.show();
    });

    this.reviewWindow.on("closed", () => {
      this.reviewWindow = null;
    });

    this.reviewWindow.loadURL(getRendererPath());
  }

  private async performSync(todos: TodoItem[]) {
    const provider = (this.config.provider as string) || this.defaultConfig.provider;

    if (provider === "macos_notes") {
      return this.syncToMacOSNotes(todos);
    } else if (provider === "notion") {
      return this.syncToNotion(todos);
    }
    throw new Error(`Unknown provider: ${provider}`);
  }

  private async syncToMacOSNotes(todos: TodoItem[]) {
    const folder = (this.config.macosNotesFolder as string) || this.defaultConfig.macosNotesFolder;
    const results = [];

    for (const todo of todos) {
      try {
        const body = todo.content ? `${todo.title}\n\n${todo.content}` : todo.title;
        // Escape double quotes and backslashes for AppleScript string literals
        const escapedBody = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const escapedFolder = folder.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        const script = `
          tell application "Notes"
            tell folder "${escapedFolder}"
              make new note with properties {body: "${escapedBody}"}
            end tell
          end tell
        `;

        // Use spawn or at least pass the script via stdin to avoid shell injection
        // osascript -e reads from stdin if no file/command is provided
        const { spawn } = await import("child_process");
        const child = spawn("osascript", ["-e", script]);

        await new Promise((resolve, reject) => {
          child.on("close", (code) => {
            if (code === 0) resolve(true);
            else reject(new Error(`osascript exited with code ${code}`));
          });
          child.on("error", reject);
        });

        results.push({ id: todo.id, status: "synced" });
      } catch (err) {
        console.error(`Failed to sync to macOS Notes: ${todo.title}`, err);
        results.push({ id: todo.id, status: "failed", error: String(err) });
      }
    }
    return results;
  }

  private async syncToNotion(todos: TodoItem[]) {
    const apiKey = this.config.notionApiKey as string;
    const databaseId = this.config.notionDatabaseId as string;

    if (!apiKey || !databaseId) {
      throw new Error("Notion API Key or Database ID not configured");
    }

    const results = [];
    for (const todo of todos) {
      try {
        const response = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
              Name: {
                title: [{ text: { content: todo.title } }],
              },
            },
            children: todo.content ? [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: todo.content } }],
                },
              },
            ] : [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Notion API Error: ${JSON.stringify(errorData)}`);
        }

        results.push({ id: todo.id, status: "synced" });
      } catch (err) {
        console.error(`Failed to sync to Notion: ${todo.title}`, err);
        results.push({ id: todo.id, status: "failed", error: String(err) });
      }
    }
    return results;
  }
}

export default TodoSyncPlugin;
