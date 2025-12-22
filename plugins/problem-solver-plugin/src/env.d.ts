/// <reference types="vite/client" />

import type { ReactNode, ComponentType } from "react";

export interface RendererPlugin {
  id: string;
  routes?: {
    path: string;
    element: ReactNode;
    layout: "page" | "sidebar";
    title: string;
  }[];
  sidebarItems?: {
    path: string;
    label: string;
    icon: ComponentType<{ className?: string }> | ReactNode;
  }[];
}

declare global {
  interface Window {
    LiveKnowledge: {
      registerPlugin: (plugin: RendererPlugin) => void;
    };
  }
}
