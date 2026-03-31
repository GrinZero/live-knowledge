import { Webhook as WebhookIcon, FileCode, Trash, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface WebhookLogEntry {
  id: string;
  url: string;
  event: string;
  status: "success" | "failed";
  statusCode?: number;
  error?: string;
  timestamp: string;
  requestBody?: Record<string, unknown>;
}

function WebhookLogsPage(): React.JSX.Element {
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadWebhookLogs = async () => {
    setLogsLoading(true);
    try {
      // @ts-ignore - window.api.plugins.invoke is provided by preload
      const logs = (await window.api.plugins.invoke("webhook-plugin:getLogs")) as WebhookLogEntry[] | null;
      setWebhookLogs(logs || []);
    } catch (error) {
      console.error("Failed to load webhook logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const clearWebhookLogs = async () => {
    try {
      // @ts-ignore - window.api.plugins.invoke is provided by preload
      await window.api.plugins.invoke("webhook-plugin:clearLogs");
      setWebhookLogs([]);
    } catch (error) {
      console.error("Failed to clear webhook logs:", error);
    }
  };

  useEffect(() => {
    loadWebhookLogs();
    // Refresh logs every 3 seconds
    const interval = setInterval(loadWebhookLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Webhook 日志</h1>
          <p className="text-sm text-gray-500 mt-1">查看所有 webhook 事件发送记录</p>
        </div>
        {webhookLogs.length > 0 && (
          <button
            onClick={clearWebhookLogs}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash className="w-4 h-4" />
            清空日志
          </button>
        )}
      </div>

      {logsLoading && webhookLogs.length === 0 ? (
        <div className="py-16 text-center text-gray-400">加载中...</div>
      ) : webhookLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">暂无日志记录</p>
          <p className="text-sm text-gray-400 mt-1">发送 webhook 后将显示日志</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {webhookLogs.map((log) => (
            <div key={log.id} className="p-5 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  {log.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <span
                    className={`font-medium ${
                      log.status === "success" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {log.status === "success" ? "成功" : "失败"}
                  </span>
                  {log.statusCode && (
                    <span className="text-sm text-gray-400">HTTP {log.statusCode}</span>
                  )}
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(log.timestamp).toLocaleString("zh-CN")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">URL:</span>
                  <code className="ml-2 text-gray-600 break-all">{log.url}</code>
                </div>
                <div>
                  <span className="text-gray-400">事件:</span>
                  <code className="ml-2 text-gray-600">{log.event}</code>
                </div>
              </div>

              {log.error && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm">
                  <span className="text-red-500 font-medium">错误:</span>
                  <span className="text-red-600 ml-2">{log.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Register plugin with sidebar items
// @ts-ignore - layout property is valid in the actual plugin system
window.LiveKnowledge.registerPlugin({
  id: "webhook-plugin",
  routes: [
    {
      path: "/webhook-logs",
      element: <WebhookLogsPage />,
      layout: "page",
      title: "Webhook 日志",
    },
  ],
  sidebarItems: [
    {
      path: "/webhook-logs",
      label: "Webhook 日志",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: WebhookIcon as any,
    },
  ],
});
