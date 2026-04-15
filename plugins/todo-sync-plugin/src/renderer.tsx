import { TodoReview } from "./TodoReview";

// Register with LiveKnowledge global interface
declare global {
  interface Window {
    LiveKnowledge: {
      registerPlugin: (plugin: unknown) => void;
    };
  }
}

window.LiveKnowledge.registerPlugin({
  id: "todo-sync",
  routes: [
    {
      path: "/todo-review",
      element: <TodoReview />,
      layout: "page",
      title: "Todo Review",
    },
  ],
});
