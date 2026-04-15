import React, { useState, useEffect } from "react";
import { Bot, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "react-router-dom";
import { solverApi } from "./api";

export const Solver: React.FC = () => {
  const [problem, setProblem] = useState<string>("");
  const [solution, setSolution] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    const init = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const id = searchParams.get("id");

        if (!id) {
          return;
        }

        const data = await solverApi.getContext(id);
        if (controller.signal.aborted) return;

        if (data && data.problem) {
          setProblem(data.problem);
          setSolution("");
          setLoading(true);
          generateSolution(
            data.problem,
            data.screenshotPath,
            controller.signal,
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to fetch problem context:", error);
        }
      }
    };

    init();
    return () => controller.abort();
  }, [location]);

  const generateSolution = async (
    text: string,
    screenshotPath?: string,
    signal?: AbortSignal,
  ) => {
    setLoading(true);
    try {
      await solverApi.generateStream(
        text,
        (chunk) => {
          setSolution((prev) => prev + chunk);
        },
        screenshotPath,
        signal,
      );
    } catch (error) {
      if (signal?.aborted) return;
      setSolution((prev) => prev + `\n\nError generating solution: ${error}`);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-6">
        {problem ? (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Problem Statement
              </h2>
              <p className="text-lg text-gray-900 leading-relaxed whitespace-pre-wrap">
                {problem}
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-200 to-transparent"></div>

              {loading && !solution ? (
                <div className="flex items-center gap-3 text-purple-600 animate-pulse pl-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Generating solution...</span>
                </div>
              ) : (
                <div className="pl-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      AI Solution
                    </h2>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm prose prose-purple max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {solution}
                    </ReactMarkdown>
                    {loading && (
                      <div className="flex items-center gap-2 mt-4 text-purple-400 not-prose">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Continuing...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-16 h-16 mb-4 opacity-20" />
            <p>Waiting for problem context...</p>
            <p className="text-sm mt-2">
              Trigger &quot;Solve Problem&quot; from the AI insights.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
