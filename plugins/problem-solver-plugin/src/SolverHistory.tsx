import { useState, useEffect } from "react";
import {
  Clock,
  MessageSquare,
  History as HistoryIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { solverApi } from "./api";

interface HistoryItem {
  id: string;
  problem: string;
  solution: string;
  createdAt: string;
  screenshotPath?: string;
}

export const SolverHistory: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await solverApi.getHistory();
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
          <HistoryIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">问题解决历史</h1>
          <p className="text-sm text-gray-500">查看 AI 助手解决过的历史问题</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">加载中...</div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
            <p>暂无历史记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((item) => (
              <div key={item.id} className="bg-white group">
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-4"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-md font-medium">
                        Problem Solver
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {item.problem}
                    </h3>
                  </div>
                  <button className="text-gray-400 group-hover:text-gray-600">
                    {expandedId === item.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {expandedId === item.id && (
                  <div className="px-6 pb-6 pt-0 border-t border-gray-50 bg-gray-50/50">
                    <div className="mt-4 prose prose-purple max-w-none text-sm bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.solution}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
