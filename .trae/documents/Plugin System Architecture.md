# Plugin System Architecture for Live Knowledge

## 1. Overview

The goal is to create a highly extensible plugin system that allows external modules to hook into the `live-knowledge-app` lifecycle. This will cover:

* **Input (Context)**: Gathering additional context before analysis.

* **AI Core (Prompting)**: Modifying prompts to detect specific scenarios.

* **Output (Actions)**: Executing custom actions based on generated insights.

## 2. Architecture Components

### 2.1 Plugin Interface

We will define a standardized `Plugin` interface that all plugins must implement.

```typescript
export interface LiveKnowledgePlugin {
  id: string
  name: string
  version: string
  description?: string
  
  hooks?: {
    // Input Phase: Gather extra context (e.g. git branch, calendar)
    getContext?: () => Promise<Record<string, unknown>>
    
    // Core Phase: Modify system prompt or inject rules
    enrichPrompt?: (currentContext: Record<string, unknown>) => Promise<string | void>
    
    // Output Phase: Handle specific actions
    onAction?: (action: Action) => Promise<boolean>
  }
}
```

### 2.2 Plugin Manager (`src/main/services/PluginManager.ts`)

A central service responsible for:

* Loading and registering plugins.

* Exposing methods for other services to invoke hooks (`getContexts`, `getPromptAdditions`, `executeAction`).

* Managing the lifecycle of plugins.

### 2.3 Integration Points

#### A. Monitoring Service (`src/main/services/MonitoringService.ts`)

* **Context Collection**: Before calling `aiEngine.analyzeContextFrames`, it will call `pluginManager.getContexts()` to gather data from all plugins.

* **Action Execution**: When an action is triggered (via user interaction or automation), it will delegate to `pluginManager.executeAction()`.

#### B. AI Engine (`src/main/services/AIEngine.ts`)

* **Prompt Construction**: In `buildPrompt`, it will call `pluginManager.getPromptAdditions()` to inject plugin-specific instructions (e.g., "If you see a Jira ticket number, extract it").

* **Action Schema**: It will dynamically update the "suggestedActions" schema in the prompt to include actions defined by plugins.

## 3. Implementation Plan

### Step 1: Core Infrastructure

1. Create `src/types/plugin.d.ts` to define the plugin interfaces.
2. Implement `src/main/services/PluginManager.ts` to manage registration and hook execution.
3. Update `ServiceContainer` (or main entry) to initialize `PluginManager`.

### Step 2: Hook Integration

1. **Modify** **`MonitoringService`**:

   * Inject `PluginManager`.

   * Collect plugin context during the monitoring loop.
2. **Modify** **`AIEngine`**:

   * Inject `PluginManager`.

   * Append plugin instructions to the system prompt.

### Step 3: Example Plugin

Create a built-in "Demo Plugin" (e.g., a "DevTools Plugin") to verify the flow:

* **Context**: Reads `package.json` to detect project type.

* **Prompt**: "If user is editing `package.json`, suggest checking for security audits."

* **Action**: `run_audit` (logs to console for now).

## 4. Scalability

* **New Inputs**: Plugins can simply implement `getContext` to feed data like audio transcripts or IDE status.

* **New Scenarios**: Plugins use `enrichPrompt` to teach the AI new detection rules without changing core code.

* **New Outputs**: Plugins register `onAction` handlers to perform real-world side effects (API calls, file writes).

