// Internal API Client for this plugin
export const BASE_URL = "http://localhost:3000/api";

export const solverApi = {
  getContext: async (id: string) => {
    const res = await fetch(
      `${BASE_URL}/plugins/problem-solver/context?id=${id}`,
    );
    if (!res.ok) throw new Error("Failed to fetch solver context");
    return res.json();
  },
  getHistory: async () => {
    const res = await fetch(`${BASE_URL}/plugins/problem-solver/history`);
    if (!res.ok) throw new Error("Failed to fetch solver history");
    return res.json();
  },
  generateStream: async (
    problem: string,
    onChunk: (chunk: string) => void,
    screenshotPath?: string,
    signal?: AbortSignal,
  ) => {
    const res = await fetch(`${BASE_URL}/plugins/problem-solver/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, screenshotPath }),
      signal,
    });

    if (!res.ok || !res.body) {
      let errorMsg = "Failed to generate solution";
      try {
        const errorData = await res.json();
        if (errorData && errorData.error) {
          errorMsg = `Server Error: ${errorData.error}`;
        }
      } catch {
        errorMsg = `Server Error: ${res.status} ${res.statusText}`;
      }
      throw new Error(errorMsg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      onChunk(text);
    }
    const finalText = decoder.decode();
    if (finalText) {
      onChunk(finalText);
    }
  },
};
