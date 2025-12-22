import { History as HistoryIcon } from "lucide-react";
import { Solver } from "./Solver";
import { SolverHistory } from "./SolverHistory";

// Register
window.LiveKnowledge.registerPlugin({
  id: "problem-solver",
  routes: [
    {
      path: "/solver",
      element: <Solver />,
      layout: "page",
      title: "AI Problem Solver",
    },
    {
      path: "/solver/history",
      element: <SolverHistory />,
      layout: "sidebar",
      title: "Solver History",
    },
  ],
  sidebarItems: [
    {
      path: "/solver/history",
      label: "Solver History",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: HistoryIcon as any,
    },
  ],
});
