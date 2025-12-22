/// <reference types="vite/client" />

import type { ReactNode, ComponentType } from "react";

export interface RendererPlugin {
  id: string;
  routes?: {
    path: string;
    element: ReactNode;
  }[];
  sidebarItems?: {
    path: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];
}

declare global {
  interface Window {
    LiveKnowledge: {
      registerPlugin: (plugin: RendererPlugin) => void;
    };
  }
}
