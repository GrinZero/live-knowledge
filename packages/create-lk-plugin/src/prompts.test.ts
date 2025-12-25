/**
 * Unit tests for the prompts module.
 * Tests default value application and conditional prompt triggering.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 2.1-2.6
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  PLUGIN_TYPE_CHOICES,
  hasMainProcess,
  hasRendererProcess,
  validatePluginNameInput,
  generateDefaultName,
  buildQuestions,
  mergeConfig,
  createDefaultConfig,
  PromptAnswers,
} from "./prompts";
import { PluginConfig } from "./types";

describe("Prompts Module", () => {
  describe("DEFAULT_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_CONFIG.version).toBe("1.0.0");
      expect(DEFAULT_CONFIG.type).toBe("full");
      expect(DEFAULT_CONFIG.features.sidebar).toBe(true);
      expect(DEFAULT_CONFIG.features.page).toBe(true);
      expect(DEFAULT_CONFIG.features.configSchema).toBe(false);
      expect(DEFAULT_CONFIG.features.httpApi).toBe(false);
    });
  });

  describe("PLUGIN_TYPE_CHOICES", () => {
    it("should have three plugin type options", () => {
      expect(PLUGIN_TYPE_CHOICES).toHaveLength(3);
      expect(PLUGIN_TYPE_CHOICES.map((c) => c.value)).toEqual([
        "full",
        "main-only",
        "renderer-only",
      ]);
    });
  });

  describe("hasMainProcess", () => {
    it("should return true for full plugin", () => {
      expect(hasMainProcess("full")).toBe(true);
    });

    it("should return true for main-only plugin", () => {
      expect(hasMainProcess("main-only")).toBe(true);
    });

    it("should return false for renderer-only plugin", () => {
      expect(hasMainProcess("renderer-only")).toBe(false);
    });
  });

  describe("hasRendererProcess", () => {
    it("should return true for full plugin", () => {
      expect(hasRendererProcess("full")).toBe(true);
    });

    it("should return false for main-only plugin", () => {
      expect(hasRendererProcess("main-only")).toBe(false);
    });

    it("should return true for renderer-only plugin", () => {
      expect(hasRendererProcess("renderer-only")).toBe(true);
    });
  });

  describe("validatePluginNameInput", () => {
    it("should return true for valid kebab-case names", () => {
      expect(validatePluginNameInput("my-plugin")).toBe(true);
      expect(validatePluginNameInput("hello-world")).toBe(true);
      expect(validatePluginNameInput("test123")).toBe(true);
    });

    it("should return error message for empty input", () => {
      expect(validatePluginNameInput("")).toBe("插件名称不能为空");
      expect(validatePluginNameInput("   ")).toBe("插件名称不能为空");
    });

    it("should return error message for invalid names", () => {
      const errorMsg =
        "插件名称必须是 kebab-case 格式 (例如: my-plugin)，只能包含小写字母、数字和连字符";
      expect(validatePluginNameInput("MyPlugin")).toBe(errorMsg);
      expect(validatePluginNameInput("my_plugin")).toBe(errorMsg);
      expect(validatePluginNameInput("my--plugin")).toBe(errorMsg);
    });
  });

  describe("generateDefaultName", () => {
    it("should convert kebab-case to Title Case", () => {
      expect(generateDefaultName("my-plugin")).toBe("My Plugin");
      expect(generateDefaultName("hello-world-test")).toBe("Hello World Test");
      expect(generateDefaultName("simple")).toBe("Simple");
    });

    it("should handle empty string", () => {
      expect(generateDefaultName("")).toBe("");
    });
  });

  describe("buildQuestions", () => {
    it("should include all questions when no defaults provided", () => {
      const questions = buildQuestions();
      expect(Array.isArray(questions)).toBe(true);
      const questionsArray = questions as unknown[];
      expect(questionsArray.length).toBeGreaterThan(0);
    });

    it("should skip id question when id is provided in defaults", () => {
      const questions = buildQuestions({ id: "my-plugin" }) as Array<{
        name: string;
        when?: () => boolean;
      }>;
      const idQuestion = questions.find((q) => q.name === "id");
      // The when function should return false
      expect(idQuestion?.when?.()).toBe(false);
    });

    it("should skip name question when name is provided in defaults", () => {
      const questions = buildQuestions({ name: "My Plugin" }) as Array<{
        name: string;
        when?: () => boolean;
      }>;
      const nameQuestion = questions.find((q) => q.name === "name");
      expect(nameQuestion?.when?.()).toBe(false);
    });

    it("should skip type question when type is provided in defaults", () => {
      const questions = buildQuestions({ type: "full" }) as Array<{
        name: string;
        when?: () => boolean;
      }>;
      const typeQuestion = questions.find((q) => q.name === "type");
      expect(typeQuestion?.when?.()).toBe(false);
    });
  });

  describe("Conditional Prompt Triggering", () => {
    type QuestionWithWhen = {
      name: string;
      when?: (answers: PromptAnswers) => boolean;
    };

    describe("Renderer features for different plugin types", () => {
      it("should show sidebar question for full plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const sidebarQuestion = questions.find(
          (q) => q.name === "features.sidebar",
        );
        // Simulate answers with type: full
        expect(sidebarQuestion?.when?.({ type: "full" })).toBe(true);
      });

      it("should show sidebar question for renderer-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const sidebarQuestion = questions.find(
          (q) => q.name === "features.sidebar",
        );
        expect(sidebarQuestion?.when?.({ type: "renderer-only" })).toBe(true);
      });

      it("should NOT show sidebar question for main-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const sidebarQuestion = questions.find(
          (q) => q.name === "features.sidebar",
        );
        expect(sidebarQuestion?.when?.({ type: "main-only" })).toBe(false);
      });

      it("should show page question for full plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const pageQuestion = questions.find((q) => q.name === "features.page");
        expect(pageQuestion?.when?.({ type: "full" })).toBe(true);
      });

      it("should NOT show page question for main-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const pageQuestion = questions.find((q) => q.name === "features.page");
        expect(pageQuestion?.when?.({ type: "main-only" })).toBe(false);
      });
    });

    describe("Main features for different plugin types", () => {
      it("should show configSchema question for full plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const configQuestion = questions.find(
          (q) => q.name === "features.configSchema",
        );
        expect(configQuestion?.when?.({ type: "full" })).toBe(true);
      });

      it("should show configSchema question for main-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const configQuestion = questions.find(
          (q) => q.name === "features.configSchema",
        );
        expect(configQuestion?.when?.({ type: "main-only" })).toBe(true);
      });

      it("should NOT show configSchema question for renderer-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const configQuestion = questions.find(
          (q) => q.name === "features.configSchema",
        );
        expect(configQuestion?.when?.({ type: "renderer-only" })).toBe(false);
      });

      it("should show httpApi question for full plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const httpQuestion = questions.find(
          (q) => q.name === "features.httpApi",
        );
        expect(httpQuestion?.when?.({ type: "full" })).toBe(true);
      });

      it("should NOT show httpApi question for renderer-only plugin", () => {
        const questions = buildQuestions() as QuestionWithWhen[];
        const httpQuestion = questions.find(
          (q) => q.name === "features.httpApi",
        );
        expect(httpQuestion?.when?.({ type: "renderer-only" })).toBe(false);
      });
    });

    describe("Skip questions when defaults provided", () => {
      it("should skip sidebar question when sidebar default is provided", () => {
        const questions = buildQuestions({
          features: {
            sidebar: true,
            page: false,
            configSchema: false,
            httpApi: false,
          },
        }) as QuestionWithWhen[];
        const sidebarQuestion = questions.find(
          (q) => q.name === "features.sidebar",
        );
        // Even for full plugin, should skip because default is provided
        expect(sidebarQuestion?.when?.({ type: "full" })).toBe(false);
      });

      it("should skip configSchema question when configSchema default is provided", () => {
        const questions = buildQuestions({
          features: {
            sidebar: false,
            page: false,
            configSchema: true,
            httpApi: false,
          },
        }) as QuestionWithWhen[];
        const configQuestion = questions.find(
          (q) => q.name === "features.configSchema",
        );
        expect(configQuestion?.when?.({ type: "full" })).toBe(false);
      });
    });
  });

  describe("mergeConfig", () => {
    it("should merge answers with defaults correctly", () => {
      const answers: PromptAnswers = {
        id: "test-plugin",
        name: "Test Plugin",
        description: "A test plugin",
        version: "2.0.0",
        type: "full",
        "features.sidebar": true,
        "features.page": false,
        "features.configSchema": true,
        "features.httpApi": false,
      };

      const config = mergeConfig(answers);

      expect(config.id).toBe("test-plugin");
      expect(config.name).toBe("Test Plugin");
      expect(config.description).toBe("A test plugin");
      expect(config.version).toBe("2.0.0");
      expect(config.type).toBe("full");
      expect(config.features.sidebar).toBe(true);
      expect(config.features.page).toBe(false);
      expect(config.features.configSchema).toBe(true);
      expect(config.features.httpApi).toBe(false);
    });

    it("should use defaults when answers are missing", () => {
      const answers: PromptAnswers = {
        id: "my-plugin",
      };
      const defaults: Partial<PluginConfig> = {
        name: "My Plugin",
        version: "1.0.0",
        type: "full",
      };

      const config = mergeConfig(answers, defaults);

      expect(config.id).toBe("my-plugin");
      expect(config.name).toBe("My Plugin");
      expect(config.version).toBe("1.0.0");
      expect(config.type).toBe("full");
    });

    it("should disable renderer features for main-only plugin", () => {
      const answers: PromptAnswers = {
        id: "main-plugin",
        type: "main-only",
        "features.sidebar": true, // Should be ignored
        "features.page": true, // Should be ignored
      };

      const config = mergeConfig(answers);

      expect(config.features.sidebar).toBe(false);
      expect(config.features.page).toBe(false);
    });

    it("should disable main features for renderer-only plugin", () => {
      const answers: PromptAnswers = {
        id: "renderer-plugin",
        type: "renderer-only",
        "features.configSchema": true, // Should be ignored
        "features.httpApi": true, // Should be ignored
      };

      const config = mergeConfig(answers);

      expect(config.features.configSchema).toBe(false);
      expect(config.features.httpApi).toBe(false);
    });

    it("should generate default name from id when name is not provided", () => {
      const answers: PromptAnswers = {
        id: "my-awesome-plugin",
      };

      const config = mergeConfig(answers);

      expect(config.name).toBe("My Awesome Plugin");
    });
  });

  describe("createDefaultConfig", () => {
    it("should create config with all defaults", () => {
      const config = createDefaultConfig("my-plugin");

      expect(config.id).toBe("my-plugin");
      expect(config.name).toBe("My Plugin");
      expect(config.description).toBe("");
      expect(config.version).toBe("1.0.0");
      expect(config.type).toBe("full");
      expect(config.features).toEqual(DEFAULT_CONFIG.features);
    });

    it("should allow overriding defaults", () => {
      const config = createDefaultConfig("my-plugin", {
        name: "Custom Name",
        version: "2.0.0",
        type: "main-only",
        features: {
          sidebar: false,
          page: false,
          configSchema: true,
          httpApi: true,
        },
      });

      expect(config.id).toBe("my-plugin");
      expect(config.name).toBe("Custom Name");
      expect(config.version).toBe("2.0.0");
      expect(config.type).toBe("main-only");
      expect(config.features.configSchema).toBe(true);
      expect(config.features.httpApi).toBe(true);
    });

    it("should partially override features", () => {
      const config = createDefaultConfig("my-plugin", {
        features: {
          sidebar: false,
          page: true,
          configSchema: true,
          httpApi: false,
        },
      });

      expect(config.features.sidebar).toBe(false);
      expect(config.features.page).toBe(true);
      expect(config.features.configSchema).toBe(true);
      expect(config.features.httpApi).toBe(false);
    });
  });
});
