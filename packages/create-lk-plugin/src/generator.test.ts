/**
 * Tests for the generator module.
 * Includes property-based tests for project generation.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 1.1, 1.3, 1.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  generateProject,
  getTemplateDir,
  createReplaceContext,
  validateOptions,
  getGeneratedFiles,
} from "./generator";
import { getFilesToCopy, DEFAULT_EXCLUDE_PATTERNS } from "./copier";
import { getFilesToRemove } from "./filter";
import { findUnreplacedPlaceholders } from "./replacer";
import { PluginConfig, ScaffoldError, ScaffoldErrorCode } from "./types";

/**
 * Generator for valid kebab-case plugin IDs.
 */
const validPluginIdArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
    minLength: 2,
    maxLength: 20,
  })
  .filter(
    (name) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) && !name.includes("--"),
  );

/**
 * Generator for plugin display names.
 */
const validPluginNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !s.includes("__PLUGIN"));

/**
 * Generator for plugin descriptions.
 */
const validDescriptionArb = fc
  .string({ minLength: 0, maxLength: 100 })
  .filter((s) => !s.includes("__PLUGIN"));

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
 * Feature: plugin-scaffold, Property 1: 项目目录创建
 * Validates: Requirements 1.1
 *
 * For any valid plugin name (kebab-case format), executing the scaffold command
 * should create a directory named after that plugin.
 */
describe("Property 1: Project Directory Creation", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should create a directory with the plugin name for any valid kebab-case name", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Ensure directory doesn't exist before
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Verify directory was created
        const exists = fs.existsSync(targetDir);
        const isDirectory = exists && fs.statSync(targetDir).isDirectory();

        // Clean up for next iteration
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        return exists && isDirectory;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject invalid plugin names", () => {
    const invalidNames = [
      "MyPlugin", // PascalCase
      "my_plugin", // snake_case
      "my plugin", // spaces
      "123plugin", // starts with number
      "-plugin", // starts with hyphen
      "plugin-", // ends with hyphen
      "my--plugin", // consecutive hyphens
      "a", // too short
    ];

    for (const invalidName of invalidNames) {
      const config: PluginConfig = {
        id: invalidName,
        name: "Test Plugin",
        description: "Test",
        version: "1.0.0",
        type: "full",
        features: {
          sidebar: true,
          page: true,
          configSchema: false,
          httpApi: false,
        },
      };

      const targetDir = path.join(tempDir, invalidName);

      expect(() => {
        validateOptions({ targetDir, config });
      }).toThrow(ScaffoldError);
    }
  });

  it("should throw error if directory already exists without overwrite flag", () => {
    const config: PluginConfig = {
      id: "existing-plugin",
      name: "Existing Plugin",
      description: "Test",
      version: "1.0.0",
      type: "full",
      features: {
        sidebar: true,
        page: true,
        configSchema: false,
        httpApi: false,
      },
    };

    const targetDir = path.join(tempDir, config.id);

    // Create the directory first
    fs.mkdirSync(targetDir, { recursive: true });

    expect(() => {
      validateOptions({ targetDir, config });
    }).toThrow(ScaffoldError);

    try {
      validateOptions({ targetDir, config });
    } catch (error) {
      expect((error as ScaffoldError).code).toBe(ScaffoldErrorCode.DIR_EXISTS);
    }
  });

  it("should allow overwriting existing directory with overwrite flag", async () => {
    const config: PluginConfig = {
      id: "overwrite-plugin",
      name: "Overwrite Plugin",
      description: "Test",
      version: "1.0.0",
      type: "full",
      features: {
        sidebar: true,
        page: true,
        configSchema: false,
        httpApi: false,
      },
    };

    const targetDir = path.join(tempDir, config.id);

    // Create the directory first with some content
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "old-file.txt"), "old content");

    // Should not throw with overwrite flag
    await generateProject({ targetDir, config, overwrite: true });

    // Verify new project was created
    expect(fs.existsSync(path.join(targetDir, "package.json"))).toBe(true);
    // Old file should be gone
    expect(fs.existsSync(path.join(targetDir, "old-file.txt"))).toBe(false);
  });
});

/**
 * Feature: plugin-scaffold, Property 2: 模板文件完整复制
 * Validates: Requirements 1.3, 1.4
 *
 * For any valid plugin configuration, the generated project should contain
 * all applicable template files (filtered by plugin type).
 */
describe("Property 2: Template File Complete Copy", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should copy all applicable template files for any valid configuration", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Ensure directory doesn't exist before
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Get expected files
        const templateDir = getTemplateDir();
        const allTemplateFiles = getFilesToCopy(
          templateDir,
          DEFAULT_EXCLUDE_PATTERNS,
        );
        const filesToRemove = getFilesToRemove(config);

        // Calculate expected files (template files minus filtered files)
        const expectedFiles = allTemplateFiles.filter((file) => {
          return !filesToRemove.some(
            (removePattern) =>
              file === removePattern || file.startsWith(removePattern + "/"),
          );
        });

        // Verify all expected files exist
        let allFilesExist = true;
        for (const file of expectedFiles) {
          const fullPath = path.join(targetDir, file);
          if (!fs.existsSync(fullPath)) {
            allFilesExist = false;
            break;
          }
        }

        // Clean up for next iteration
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        return allFilesExist;
      }),
      { numRuns: 100 },
    );
  });

  it("should include core files for all plugin types", async () => {
    const coreFiles = [
      "package.json",
      "tsconfig.json",
      "eslint.config.mjs",
      "README.md",
    ];

    const types: PluginConfig["type"][] = [
      "full",
      "main-only",
      "renderer-only",
    ];

    for (const type of types) {
      const config: PluginConfig = {
        id: `test-${type}-plugin`,
        name: "Test Plugin",
        description: "Test",
        version: "1.0.0",
        type,
        features: {
          sidebar: true,
          page: true,
          configSchema: true,
          httpApi: true,
        },
      };

      const targetDir = path.join(tempDir, config.id);

      await generateProject({ targetDir, config });

      for (const file of coreFiles) {
        expect(
          fs.existsSync(path.join(targetDir, file)),
          `${file} should exist for ${type} plugin`,
        ).toBe(true);
      }

      // Clean up
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("should replace all placeholders in generated files", async () => {
    await fc.assert(
      fc.asyncProperty(pluginConfigArb, async (config) => {
        const targetDir = path.join(tempDir, config.id);

        // Ensure directory doesn't exist before
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Generate project
        await generateProject({ targetDir, config });

        // Check all text files for unreplaced placeholders
        let noUnreplacedPlaceholders = true;

        function checkDirectory(dir: string): void {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              checkDirectory(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (
                [".ts", ".tsx", ".js", ".jsx", ".json", ".md"].includes(ext)
              ) {
                const content = fs.readFileSync(fullPath, "utf-8");
                const unreplaced = findUnreplacedPlaceholders(content);
                if (unreplaced.length > 0) {
                  noUnreplacedPlaceholders = false;
                }
              }
            }
          }
        }

        checkDirectory(targetDir);

        // Clean up for next iteration
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        return noUnreplacedPlaceholders;
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Unit tests for generator helper functions.
 */
describe("Generator Helper Functions", () => {
  describe("getTemplateDir", () => {
    it("should return a valid template directory path", () => {
      const templateDir = getTemplateDir();
      expect(fs.existsSync(templateDir)).toBe(true);
      expect(fs.statSync(templateDir).isDirectory()).toBe(true);
    });

    it("should contain expected template files", () => {
      const templateDir = getTemplateDir();
      expect(fs.existsSync(path.join(templateDir, "package.json"))).toBe(true);
      expect(fs.existsSync(path.join(templateDir, "src", "index.ts"))).toBe(
        true,
      );
    });
  });

  describe("createReplaceContext", () => {
    it("should create correct context from config", () => {
      const config: PluginConfig = {
        id: "my-awesome-plugin",
        name: "My Awesome Plugin",
        description: "A great plugin",
        version: "2.0.0",
        type: "full",
        features: {
          sidebar: true,
          page: true,
          configSchema: false,
          httpApi: false,
        },
      };

      const context = createReplaceContext(config);

      expect(context.PLUGIN_ID).toBe("my-awesome-plugin");
      expect(context.PLUGIN_CLASS_NAME).toBe("MyAwesomePlugin");
      expect(context.PLUGIN_NAME).toBe("My Awesome Plugin");
      expect(context.PLUGIN_DESCRIPTION).toBe("A great plugin");
      expect(context.PLUGIN_VERSION).toBe("2.0.0");
    });

    it("should convert kebab-case to PascalCase correctly", () => {
      const testCases = [
        { id: "my-plugin", expected: "MyPlugin" },
        { id: "hello-world-test", expected: "HelloWorldTest" },
        { id: "simple", expected: "Simple" },
        { id: "a1-b2-c3", expected: "A1B2C3" },
      ];

      for (const { id, expected } of testCases) {
        const config: PluginConfig = {
          id,
          name: "Test",
          description: "Test",
          version: "1.0.0",
          type: "full",
          features: {
            sidebar: false,
            page: false,
            configSchema: false,
            httpApi: false,
          },
        };

        const context = createReplaceContext(config);
        expect(context.PLUGIN_CLASS_NAME).toBe(expected);
      }
    });
  });

  describe("getGeneratedFiles", () => {
    it("should return list of files for full plugin", () => {
      const config: PluginConfig = {
        id: "test-plugin",
        name: "Test Plugin",
        description: "Test",
        version: "1.0.0",
        type: "full",
        features: {
          sidebar: true,
          page: true,
          configSchema: true,
          httpApi: true,
        },
      };

      const files = getGeneratedFiles(config);

      expect(files).toContain("package.json");
      expect(files).toContain("src/index.ts");
      expect(files).toContain("src/renderer.tsx");
    });

    it("should exclude renderer files for main-only plugin", () => {
      const config: PluginConfig = {
        id: "test-plugin",
        name: "Test Plugin",
        description: "Test",
        version: "1.0.0",
        type: "main-only",
        features: {
          sidebar: false,
          page: false,
          configSchema: true,
          httpApi: true,
        },
      };

      const files = getGeneratedFiles(config);

      expect(files).toContain("package.json");
      expect(files).toContain("src/index.ts");
      expect(files).not.toContain("src/renderer.tsx");
      expect(files).not.toContain("vite.renderer.config.ts");
    });

    it("should exclude main files for renderer-only plugin", () => {
      const config: PluginConfig = {
        id: "test-plugin",
        name: "Test Plugin",
        description: "Test",
        version: "1.0.0",
        type: "renderer-only",
        features: {
          sidebar: true,
          page: true,
          configSchema: false,
          httpApi: false,
        },
      };

      const files = getGeneratedFiles(config);

      expect(files).toContain("package.json");
      expect(files).not.toContain("src/index.ts");
      expect(files).toContain("src/renderer.tsx");
      expect(files).not.toContain("vite.main.config.ts");
    });
  });
});
