/**
 * Integration tests for the create-lk-plugin scaffold tool.
 * Tests the complete project generation workflow and validates generated project structure.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 3.1-3.7, 4.5
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateProject } from "./generator";
import { PluginConfig } from "./types";

/**
 * Generator for valid kebab-case plugin IDs.
 */
const validPluginIdArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
    minLength: 2,
    maxLength: 10,
  })
  .chain((chars) => {
    // Ensure first char is a letter
    const firstChar = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz");
    return firstChar.map((first) => first + chars.join(""));
  })
  .filter((name) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) && name.length >= 2);

/**
 * Generator for plugin display names (JSON-safe).
 */
const validPluginNameArb = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
    ),
    {
      minLength: 1,
      maxLength: 30,
    },
  )
  .map((chars) => chars.join(""))
  .filter((s) => s.trim().length > 0);

/**
 * Generator for plugin descriptions (JSON-safe).
 */
const validDescriptionArb = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-",
    ),
    {
      minLength: 0,
      maxLength: 50,
    },
  )
  .map((chars) => chars.join(""));

/**
 * Generator for semantic version strings.
 */
const validVersionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Generator for plugin type.
 */
const pluginTypeArb = fc.constantFrom(
  "full",
  "main-only",
  "renderer-only",
) as fc.Arbitrary<PluginConfig["type"]>;

/**
 * Generator for plugin features.
 */
const pluginFeaturesArb = fc.record({
  sidebar: fc.boolean(),
  page: fc.boolean(),
  configSchema: fc.boolean(),
  httpApi: fc.boolean(),
});

/**
 * Generator for complete PluginConfig.
 */
const pluginConfigArb = fc
  .tuple(
    validPluginIdArb,
    validPluginNameArb,
    validDescriptionArb,
    validVersionArb,
    pluginTypeArb,
    pluginFeaturesArb,
  )
  .map(([id, name, description, version, type, features]) => ({
    id,
    name,
    description,
    version,
    type,
    features,
  }));

/**
 * Generator for full plugin config (includes both main and renderer).
 */
const fullPluginConfigArb = pluginConfigArb.map((config) => ({
  ...config,
  type: "full" as const,
}));

/**
 * Generator for main-only plugin config.
 */
const mainOnlyPluginConfigArb = pluginConfigArb.map((config) => ({
  ...config,
  type: "main-only" as const,
  features: {
    ...config.features,
    sidebar: false,
    page: false,
  },
}));

/**
 * Generator for renderer-only plugin config.
 */
const rendererOnlyPluginConfigArb = pluginConfigArb.map((config) => ({
  ...config,
  type: "renderer-only" as const,
  features: {
    ...config.features,
    configSchema: false,
    httpApi: false,
  },
}));

/**
 * Feature: plugin-scaffold, Property 4: Package.json 完整性
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * For any generated package.json file, it should contain:
 * - Correct main and renderer entry points
 * - @live-knowledge/plugin-sdk dependency
 * - build/lint/lint:fix/pack script commands
 */
describe("Property 4: Package.json Completeness", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate package.json with correct entry points for any valid config", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read and parse package.json
        const packageJsonPath = path.join(targetDir, "package.json");
        expect(fs.existsSync(packageJsonPath)).toBe(true);

        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );

        // Verify entry points
        expect(packageJson.main).toBe("./dist/index.js");
        expect(packageJson.renderer).toBe("./dist/renderer.global.js");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate package.json with plugin-sdk dependency for any valid config", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read and parse package.json
        const packageJsonPath = path.join(targetDir, "package.json");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );

        // Verify plugin-sdk dependency
        expect(packageJson.dependencies).toBeDefined();
        expect(
          packageJson.dependencies["@live-knowledge/plugin-sdk"],
        ).toBeDefined();

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate package.json with required scripts for any valid config", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read and parse package.json
        const packageJsonPath = path.join(targetDir, "package.json");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );

        // Verify required scripts
        expect(packageJson.scripts).toBeDefined();
        expect(packageJson.scripts.build).toBeDefined();
        expect(packageJson.scripts.lint).toBeDefined();
        expect(packageJson.scripts["lint:fix"]).toBeDefined();
        expect(packageJson.scripts.pack).toBeDefined();

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should replace plugin metadata in package.json correctly", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read and parse package.json
        const packageJsonPath = path.join(targetDir, "package.json");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );

        // Verify plugin metadata is replaced
        expect(packageJson.name).toBe(config.id);
        expect(packageJson.version).toBe(config.version);
        expect(packageJson.description).toBe(config.description);

        // Verify no unreplaced placeholders
        const packageJsonStr = JSON.stringify(packageJson);
        expect(packageJsonStr).not.toContain("__PLUGIN_");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: plugin-scaffold, Property 5: 主进程代码结构
 * Validates: Requirements 3.4, 3.5
 *
 * For any plugin configuration that includes main process,
 * the generated src/index.ts should contain:
 * - A class implementing LiveKnowledgePlugin interface
 * - initialize method
 * - hooks object structure
 */
describe("Property 5: Main Process Code Structure", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate main process code with LiveKnowledgePlugin implementation for full plugins", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        expect(fs.existsSync(indexPath)).toBe(true);

        const content = fs.readFileSync(indexPath, "utf-8");

        // Verify LiveKnowledgePlugin import
        expect(content).toContain("LiveKnowledgePlugin");
        expect(content).toContain("implements LiveKnowledgePlugin");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate main process code with initialize method for full plugins", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Verify initialize method exists
        expect(content).toContain("initialize(context: PluginContext)");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate main process code with hooks structure for full plugins", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Verify hooks object structure
        expect(content).toContain("hooks = {");
        expect(content).toContain("getContext:");
        expect(content).toContain("enrichPrompt:");
        expect(content).toContain("onAction:");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate main process code for main-only plugins", async () => {
    await fc.assert(
      fc.asyncProperty(mainOnlyPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        expect(fs.existsSync(indexPath)).toBe(true);

        const content = fs.readFileSync(indexPath, "utf-8");

        // Verify core structure
        expect(content).toContain("LiveKnowledgePlugin");
        expect(content).toContain("initialize");
        expect(content).toContain("hooks");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should NOT generate main process code for renderer-only plugins", async () => {
    await fc.assert(
      fc.asyncProperty(rendererOnlyPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Main process file should NOT exist for renderer-only plugins
        const indexPath = path.join(targetDir, "src", "index.ts");
        expect(fs.existsSync(indexPath)).toBe(false);

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should replace plugin class name correctly in main process code", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Verify no unreplaced placeholders
        expect(content).not.toContain("__PLUGIN_");

        // Verify plugin ID is used
        expect(content).toContain(`id = "${config.id}"`);

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: plugin-scaffold, Property 6: 渲染进程代码结构
 * Validates: Requirements 3.6
 *
 * For any plugin configuration that includes renderer process,
 * the generated src/renderer.tsx should contain window.LiveKnowledge.registerPlugin call.
 */
describe("Property 6: Renderer Process Code Structure", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate renderer code with registerPlugin call for full plugins", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        expect(fs.existsSync(rendererPath)).toBe(true);

        const content = fs.readFileSync(rendererPath, "utf-8");

        // Verify registerPlugin call
        expect(content).toContain("window.LiveKnowledge.registerPlugin");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should generate renderer code for renderer-only plugins", async () => {
    await fc.assert(
      fc.asyncProperty(rendererOnlyPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        expect(fs.existsSync(rendererPath)).toBe(true);

        const content = fs.readFileSync(rendererPath, "utf-8");

        // Verify registerPlugin call
        expect(content).toContain("window.LiveKnowledge.registerPlugin");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should NOT generate renderer code for main-only plugins", async () => {
    await fc.assert(
      fc.asyncProperty(mainOnlyPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Renderer file should NOT exist for main-only plugins
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        expect(fs.existsSync(rendererPath)).toBe(false);

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should replace plugin ID correctly in renderer code", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        const content = fs.readFileSync(rendererPath, "utf-8");

        // Verify no unreplaced placeholders
        expect(content).not.toContain("__PLUGIN_");

        // Verify plugin ID is used
        expect(content).toContain(`id: "${config.id}"`);

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("should include routes array in renderer code", async () => {
    await fc.assert(
      fc.asyncProperty(fullPluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        const content = fs.readFileSync(rendererPath, "utf-8");

        // Verify routes array exists
        expect(content).toContain("routes:");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: plugin-scaffold, Property 7: 条件性功能过滤
 * Validates: Requirements 3.7, 4.5
 *
 * For any configuration with specific features disabled,
 * the generated code should NOT contain the corresponding feature code blocks.
 */
describe("Property 7: Conditional Feature Filtering", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Generator for config with sidebar disabled.
   */
  const sidebarDisabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      sidebar: false,
    },
  }));

  /**
   * Generator for config with sidebar enabled.
   */
  const sidebarEnabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      sidebar: true,
    },
  }));

  /**
   * Generator for config with page disabled.
   */
  const pageDisabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      page: false,
    },
  }));

  /**
   * Generator for config with page enabled.
   */
  const pageEnabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      page: true,
    },
  }));

  /**
   * Generator for config with configSchema disabled.
   */
  const configSchemaDisabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      configSchema: false,
    },
  }));

  /**
   * Generator for config with configSchema enabled.
   */
  const configSchemaEnabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      configSchema: true,
    },
  }));

  /**
   * Generator for config with httpApi disabled.
   */
  const httpApiDisabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      httpApi: false,
    },
  }));

  /**
   * Generator for config with httpApi enabled.
   */
  const httpApiEnabledConfigArb = pluginConfigArb.map((config) => ({
    ...config,
    type: "full" as const,
    features: {
      ...config.features,
      httpApi: true,
    },
  }));

  it("should NOT include sidebar code when sidebar feature is disabled", async () => {
    await fc.assert(
      fc.asyncProperty(sidebarDisabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        if (!fs.existsSync(rendererPath)) {
          // renderer-only plugins won't have this file
          return true;
        }

        const content = fs.readFileSync(rendererPath, "utf-8");

        // Should NOT contain sidebarItems when sidebar is disabled
        const hasSidebarItems = content.includes("sidebarItems:");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_SIDEBAR") ||
          content.includes("#endif FEATURE_SIDEBAR");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return !hasSidebarItems && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should include sidebar code when sidebar feature is enabled", async () => {
    await fc.assert(
      fc.asyncProperty(sidebarEnabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        const content = fs.readFileSync(rendererPath, "utf-8");

        // Should contain sidebarItems when sidebar is enabled
        const hasSidebarItems = content.includes("sidebarItems:");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_SIDEBAR") ||
          content.includes("#endif FEATURE_SIDEBAR");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return hasSidebarItems && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should NOT include page code when page feature is disabled", async () => {
    await fc.assert(
      fc.asyncProperty(pageDisabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        if (!fs.existsSync(rendererPath)) {
          return true;
        }

        const content = fs.readFileSync(rendererPath, "utf-8");

        // Should NOT contain ExamplePage import when page is disabled
        const hasExamplePageImport = content.includes("import { ExamplePage }");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_PAGE") ||
          content.includes("#endif FEATURE_PAGE");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return !hasExamplePageImport && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should include page code when page feature is enabled", async () => {
    await fc.assert(
      fc.asyncProperty(pageEnabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read renderer file
        const rendererPath = path.join(targetDir, "src", "renderer.tsx");
        const content = fs.readFileSync(rendererPath, "utf-8");

        // Should contain ExamplePage import when page is enabled
        const hasExamplePageImport = content.includes("import { ExamplePage }");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_PAGE") ||
          content.includes("#endif FEATURE_PAGE");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return hasExamplePageImport && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should NOT include configSchema code when configSchema feature is disabled", async () => {
    await fc.assert(
      fc.asyncProperty(configSchemaDisabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        if (!fs.existsSync(indexPath)) {
          return true;
        }

        const content = fs.readFileSync(indexPath, "utf-8");

        // Should NOT contain configSchema when feature is disabled
        const hasConfigSchema = content.includes("configSchema =");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_CONFIG_SCHEMA") ||
          content.includes("#endif FEATURE_CONFIG_SCHEMA");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return !hasConfigSchema && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should include configSchema code when configSchema feature is enabled", async () => {
    await fc.assert(
      fc.asyncProperty(configSchemaEnabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should contain configSchema when feature is enabled
        const hasConfigSchema = content.includes("configSchema =");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_CONFIG_SCHEMA") ||
          content.includes("#endif FEATURE_CONFIG_SCHEMA");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return hasConfigSchema && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should NOT include httpApi code when httpApi feature is disabled", async () => {
    await fc.assert(
      fc.asyncProperty(httpApiDisabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        if (!fs.existsSync(indexPath)) {
          return true;
        }

        const content = fs.readFileSync(indexPath, "utf-8");

        // Should NOT contain HTTP API registration when feature is disabled
        const hasHttpApi = content.includes("context.http.router");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_HTTP_API") ||
          content.includes("#endif FEATURE_HTTP_API");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return !hasHttpApi && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should include httpApi code when httpApi feature is enabled", async () => {
    await fc.assert(
      fc.asyncProperty(httpApiEnabledConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Read main process file
        const indexPath = path.join(targetDir, "src", "index.ts");
        const content = fs.readFileSync(indexPath, "utf-8");

        // Should contain HTTP API registration when feature is enabled
        const hasHttpApi = content.includes("context.http.router");

        // Should NOT contain conditional block markers
        const hasConditionalMarkers =
          content.includes("#if FEATURE_HTTP_API") ||
          content.includes("#endif FEATURE_HTTP_API");

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return hasHttpApi && !hasConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });

  it("should never contain any conditional block markers in generated files", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Clean up before test
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Check all text files for conditional markers
        let noConditionalMarkers = true;

        function checkDirectory(dir: string): void {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              checkDirectory(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
                const content = fs.readFileSync(fullPath, "utf-8");
                if (
                  content.includes("#if FEATURE_") ||
                  content.includes("#endif FEATURE_")
                ) {
                  noConditionalMarkers = false;
                }
              }
            }
          }
        }

        checkDirectory(targetDir);

        // Clean up after test
        fs.rmSync(targetDir, { recursive: true, force: true });

        return noConditionalMarkers;
      }),
      { numRuns: 100 },
    );
  });
});
