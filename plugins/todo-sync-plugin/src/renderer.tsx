import { TodoReview } from "./TodoReview";

// Register with LiveKnowledge global interface
(window as any).LiveKnowledge.registerPlugin({
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
