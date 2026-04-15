import { useState, useEffect } from "react";
import { Check, Loader2, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface TodoItem {
  id: string;
  title: string;
  content?: string;
  status: "pending" | "synced" | "failed";
}

export const TodoReview = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<
    Record<string, { status: string; error?: string }>
  >({});

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/plugin/todo-sync/pending?sessionId=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTodos(data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch todos:", err);
          setError("Failed to load todos");
          setLoading(false);
        });
    }
  }, [sessionId]);

  const handleSync = async () => {
    if (!sessionId || todos.length === 0) return;

    setSyncing(true);
    try {
      const response = await fetch(`/api/plugin/todo-sync/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, todos }),
      });
      const result = await response.json();

      if (result.success) {
        const resultsMap = result.results.reduce(
          (
            acc: Record<string, { status: string; error?: string }>,
            res: { id: string; status: string; error?: string },
          ) => {
            acc[res.id] = { status: res.status, error: res.error };
            return acc;
          },
          {},
        );
        setSyncResults(resultsMap);
      } else {
        setError(result.error || "Sync failed");
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTodo = (id: string, updates: Partial<TodoItem>) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        正在加载待办事项...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-destructive">
        <p className="mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border rounded hover:bg-muted"
        >
          重试
        </button>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        暂无待办事项。
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">确认并同步待办事项</h1>
        <button
          onClick={handleSync}
          disabled={syncing || todos.length === 0}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          同步到第三方应用
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {todos.map((todo) => {
          const result = syncResults[todo.id];
          return (
            <div
              key={todo.id}
              className="p-4 border rounded-lg bg-card group relative"
            >
              <div className="flex items-start gap-3">
                <input
                  type="text"
                  value={todo.title}
                  onChange={(e) =>
                    updateTodo(todo.id, { title: e.target.value })
                  }
                  className="flex-1 font-medium bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-1"
                />
                {!result && (
                  <button
                    onClick={() => removeTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {result?.status === "synced" && (
                  <div className="text-green-500">
                    <Check className="w-5 h-5" />
                  </div>
                )}
                {result?.status === "failed" && (
                  <div className="text-red-500 text-xs">
                    同步失败: {result.error}
                  </div>
                )}
              </div>
              <textarea
                value={todo.content || ""}
                onChange={(e) =>
                  updateTodo(todo.id, { content: e.target.value })
                }
                placeholder="添加备注..."
                className="w-full mt-2 text-sm text-muted-foreground bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-1 resize-none"
                rows={2}
              />
            </div>
          );
        })}
      </div>

      {Object.keys(syncResults).length > 0 && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg text-sm flex justify-between items-center">
          <span>
            同步任务完成 (
            {
              Object.values(syncResults).filter((r) => r.status === "synced")
                .length
            }
            /{todos.length})
          </span>
          <button
            onClick={() => window.close()}
            className="text-primary hover:underline"
          >
            关闭窗口
          </button>
        </div>
      )}
    </div>
  );
};
