import { useEffect, useState } from "react";
import { Webhook } from "lucide-react";

// Define the interface for our history items
interface WebhookHistoryItem {
  id: string;
  url: string;
  event: string;
  status?: number;
  error?: string;
  payloadSummary?: string;
  createdAt: string;
}

export const WebhookHistory: React.FC = () => {
  const [history, setHistory] = useState<WebhookHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // The API endpoint we defined in the main process plugin code
      // We assume the APIServer mounts plugin routers at /api/plugins/:id
      const res = await fetch(
        "http://localhost:3000/api/plugins/webhook-plugin/history"
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch webhook history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Webhook className="h-6 w-6 text-blue-600" />
          Webhook History
        </h1>
        <button
          onClick={fetchHistory}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="text-gray-500 italic">No webhook history found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Time</th>
                <th className="px-4 py-3 font-medium text-gray-700">Event</th>
                <th className="px-4 py-3 font-medium text-gray-700">URL</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.event}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-500 truncate max-w-[200px]"
                    title={item.url}
                  >
                    {item.url}
                  </td>
                  <td className="px-4 py-3">
                    {item.error ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Failed
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status && item.status >= 200 && item.status < 300
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {item.status || "Unknown"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.error ? (
                      <span
                        className="text-red-600 truncate block max-w-[200px]"
                        title={item.error}
                      >
                        {item.error}
                      </span>
                    ) : (
                      <span
                        className="truncate block max-w-[200px]"
                        title={item.payloadSummary}
                      >
                        {item.payloadSummary || "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
