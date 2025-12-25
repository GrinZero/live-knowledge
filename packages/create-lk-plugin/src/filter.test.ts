/**
 * Tests for the filter module.
 * Includes property-based tests for plugin type file filtering.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 2.3-2.6
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  filterFiles,
  getFilesToRemove,
  getFilesToRemoveByType,
  getFilesToRemoveByFeatures,
  fileExists,
  MAIN_ONLY_FILES,
  RENDERER_ONLY_FILES,
} from "./filter";
import { PluginConfig } from "./types";

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
 * Creates a mock project directory with all template files.
 */
function createMockProjectDir(tempDir: string): void {
  // Create all possible files that might exist in a full plugin
  const allFiles = [
    "package.json",
    "tsconfig.json",
    "eslint.config.mjs",
    "README.md",
    "vite.main.config.ts",
    "vite.renderer.config.ts",
    "src/index.ts",
    "src/renderer.tsx",
    "src/env.d.ts",
    "src/components/ExamplePage.tsx",
  ];

  for (const file of allFiles) {
    const fullPath = path.join(tempDir, file);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, `// ${file}`);
  }
}

/**
 * Feature: plugin-scaffold, Property 9: 插件类型文件过滤
 * Validates: Requirements 2.3
 *
 * For main-only plugins, renderer-related files should not be generated.
 * For renderer-only plugins, main-related files should not be generated.
 */
describe("Property 9: Plugin Type File Filtering", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("main-only plugins should not have renderer files after filtering", () => {
    fc.assert(
      fc.property(pluginFeaturesArb, (features) => {
        // Create fresh mock directory for each test
        const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-pbt-"));
        try {
          createMockProjectDir(testDir);

          const config: PluginConfig = {
            id: "test-plugin",
            name: "Test Plugin",
            description: "A test plugin",
            version: "1.0.0",
            type: "main-only",
            features,
          };

          // Run filter synchronously (the function is async but uses sync fs operations)
          filterFiles({ targetDir: testDir, config });

          // Verify no renderer files exist
          for (const file of RENDERER_ONLY_FILES) {
            if (fileExists(testDir, file)) {
              return false;
            }
          }

          // Verify main files still exist
          for (const file of MAIN_ONLY_FILES) {
            if (!fileExists(testDir, file)) {
              return false;
            }
          }

          return true;
        } finally {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });

  it("renderer-only plugins should not have main files after filtering", () => {
    fc.assert(
      fc.property(pluginFeaturesArb, (features) => {
        const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-pbt-"));
        try {
          createMockProjectDir(testDir);

          const config: PluginConfig = {
            id: "test-plugin",
            name: "Test Plugin",
            description: "A test plugin",
            version: "1.0.0",
            type: "renderer-only",
            features,
          };

          filterFiles({ targetDir: testDir, config });

          // Verify no main files exist
          for (const file of MAIN_ONLY_FILES) {
            if (fileExists(testDir, file)) {
              return false;
            }
          }

          // Verify renderer files still exist (except those filtered by features)
          const featureFilteredFiles = getFilesToRemoveByFeatures(features);
          for (const file of RENDERER_ONLY_FILES) {
            // Skip files that are also filtered by features
            if (featureFilteredFiles.includes(file)) {
              continue;
            }
            if (!fileExists(testDir, file)) {
              return false;
            }
          }

          return true;
        } finally {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });

  it("full plugins should keep both main and renderer files", () => {
    fc.assert(
      fc.property(pluginFeaturesArb, (features) => {
        const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-pbt-"));
        try {
          createMockProjectDir(testDir);

          const config: PluginConfig = {
            id: "test-plugin",
            name: "Test Plugin",
            description: "A test plugin",
            version: "1.0.0",
            type: "full",
            features,
          };

          filterFiles({ targetDir: testDir, config });

          // Verify main files exist
          for (const file of MAIN_ONLY_FILES) {
            if (!fileExists(testDir, file)) {
              return false;
            }
          }

          // Verify renderer files exist (except those filtered by features)
          const featureFilteredFiles = getFilesToRemoveByFeatures(features);
          for (const file of RENDERER_ONLY_FILES) {
            if (featureFilteredFiles.includes(file)) {
              continue;
            }
            if (!fileExists(testDir, file)) {
              return false;
            }
          }

          return true;
        } finally {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Unit tests for filter module functions.
 */
describe("Filter Module Unit Tests", () => {
  describe("getFilesToRemoveByType", () => {
    it("should return renderer files for main-only type", () => {
      const files = getFilesToRemoveByType("main-only");
      expect(files).toEqual(RENDERER_ONLY_FILES);
    });

    it("should return main files for renderer-only type", () => {
      const files = getFilesToRemoveByType("renderer-only");
      expect(files).toEqual(MAIN_ONLY_FILES);
    });

    it("should return empty array for full type", () => {
      const files = getFilesToRemoveByType("full");
      expect(files).toEqual([]);
    });
  });

  describe("getFilesToRemoveByFeatures", () => {
    it("should return page files when page feature is disabled", () => {
      const files = getFilesToRemoveByFeatures({
        sidebar: true,
        page: false,
        configSchema: true,
        httpApi: true,
      });
      expect(files).toContain("src/components/ExamplePage.tsx");
    });

    it("should return empty array when all features are enabled", () => {
      const files = getFilesToRemoveByFeatures({
        sidebar: true,
        page: true,
        configSchema: true,
        httpApi: true,
      });
      expect(files).toEqual([]);
    });
  });

  describe("getFilesToRemove", () => {
    it("should combine type and feature filters", () => {
      const config: PluginConfig = {
        id: "test",
        name: "Test",
        description: "Test",
        version: "1.0.0",
        type: "main-only",
        features: {
          sidebar: false,
          page: false,
          configSchema: false,
          httpApi: false,
        },
      };

      const files = getFilesToRemove(config);

      // Should include renderer files (from type filter)
      expect(files).toContain("src/renderer.tsx");
      expect(files).toContain("vite.renderer.config.ts");
    });

    it("should deduplicate files", () => {
      const config: PluginConfig = {
        id: "test",
        name: "Test",
        description: "Test",
        version: "1.0.0",
        type: "main-only",
        features: {
          sidebar: false,
          page: false,
          configSchema: false,
          httpApi: false,
        },
      };

      const files = getFilesToRemove(config);
      const uniqueFiles = [...new Set(files)];

      expect(files.length).toBe(uniqueFiles.length);
    });
  });

  describe("filterFiles", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-unit-"));
      createMockProjectDir(tempDir);
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should remove renderer files for main-only plugin", async () => {
      const config: PluginConfig = {
        id: "test",
        name: "Test",
        description: "Test",
        version: "1.0.0",
        type: "main-only",
        features: {
          sidebar: true,
          page: true,
          configSchema: true,
          httpApi: true,
        },
      };

      await filterFiles({ targetDir: tempDir, config });

      expect(fileExists(tempDir, "src/index.ts")).toBe(true);
      expect(fileExists(tempDir, "src/renderer.tsx")).toBe(false);
      expect(fileExists(tempDir, "src/components")).toBe(false);
    });

    it("should remove main files for renderer-only plugin", async () => {
      const config: PluginConfig = {
        id: "test",
        name: "Test",
        description: "Test",
        version: "1.0.0",
        type: "renderer-only",
        features: {
          sidebar: true,
          page: true,
          configSchema: true,
          httpApi: true,
        },
      };

      await filterFiles({ targetDir: tempDir, config });

      expect(fileExists(tempDir, "src/index.ts")).toBe(false);
      expect(fileExists(tempDir, "src/renderer.tsx")).toBe(true);
      expect(fileExists(tempDir, "src/components/ExamplePage.tsx")).toBe(true);
    });

    it("should throw error for non-existent directory", async () => {
      const config: PluginConfig = {
        id: "test",
        name: "Test",
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

      await expect(
        filterFiles({ targetDir: "/non/existent/path", config }),
      ).rejects.toThrow("Target directory not found");
    });
  });
});
