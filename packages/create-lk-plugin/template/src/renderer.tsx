// #if FEATURE_SIDEBAR
import { Layout } from "lucide-react";
// #endif FEATURE_SIDEBAR
// #if FEATURE_PAGE
import { ExamplePage } from "./components/ExamplePage";
// #endif FEATURE_PAGE

// 注册插件
window.LiveKnowledge.registerPlugin({
  id: "__PLUGIN_ID__",
  routes: [
    // #if FEATURE_PAGE
    {
      path: "/__PLUGIN_ID__",
      element: <ExamplePage />,
    },
    // #endif FEATURE_PAGE
  ],
  // #if FEATURE_SIDEBAR
  sidebarItems: [
    {
      path: "/__PLUGIN_ID__",
      label: "__PLUGIN_NAME__",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: Layout as any,
    },
  ],
  // #endif FEATURE_SIDEBAR
});
