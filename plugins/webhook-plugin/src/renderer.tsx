import { Webhook } from "lucide-react";
import { WebhookHistory } from "./WebhookHistory";

// Register the plugin
window.LiveKnowledge.registerPlugin({
  id: "webhook-plugin",
  routes: [
    {
      path: "/webhook-history",
      element: <WebhookHistory />,
    },
  ],
  sidebarItems: [
    {
      path: "/webhook-history",
      label: "Webhooks",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: Webhook as any,
    },
  ],
});
