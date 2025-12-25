/**
 * Tests for the replacer module.
 * Includes property-based tests and unit tests.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 2.7, 3.4-3.7, 4.5
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  replaceVariables,
  processConditionalBlocks,
  processDirectory,
  findUnreplacedPlaceholders,
  ReplaceContext,
  ConditionalOptions,
} from "./replacer";

/**
 * Generator for valid kebab-case plugin IDs.
 */
const validPluginIdArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
    minLength: 2,
    maxLength: 30,
  })
  .filter(
    (name) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) && !name.includes("--"),
  );

/**
 * Generator for valid PascalCase class names.
 */
const validClassNameArb = fc
  .array(
    fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
      minLength: 2,
      maxLength: 10,
    }),
    { minLength: 1, maxLength: 4 },
  )
  .map((parts) =>
    parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(""),
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
  .string({ minLength: 0, maxLength: 200 })
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
 * Generator for complete ReplaceContext.
 */
const replaceContextArb = fc
  .tuple(
    validPluginIdArb,
    validClassNameArb,
    validPluginNameArb,
    validDescriptionArb,
    validVersionArb,
  )
  .map(([id, className, name, description, version]) => ({
    PLUGIN_ID: id,
    PLUGIN_CLASS_NAME: className,
    PLUGIN_NAME: name,
    PLUGIN_DESCRIPTION: description,
    PLUGIN_VERSION: version,
  }));

/**
 * Feature: plugin-scaffold, Property 3: 变量替换完整性
 * Validates: Requirements 2.7
 *
 * For any generated project file, there should be no unreplaced placeholders (__PLUGIN_*__).
 */
describe("Property 3: Variable Replacement Completeness", () => {
  /**
   * Generator for template content containing all placeholders.
   */
  const templateContentArb = fc.constant(`
export class __PLUGIN_CLASS_NAME__ {
  id = "__PLUGIN_ID__";
  name = "__PLUGIN_NAME__";
  version = "__PLUGIN_VERSION__";
  description = "__PLUGIN_DESCRIPTION__";
}
`);

  it("should replace all placeholders in template content", () => {
    fc.assert(
      fc.property(
        replaceContextArb,
        templateContentArb,
        (context, template) => {
          const result = replaceVariables(template, context);

          // No unreplaced placeholders should remain
          const unreplaced = findUnreplacedPlaceholders(result);
          return unreplaced.length === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should correctly replace each placeholder with its value", () => {
    fc.assert(
      fc.property(replaceContextArb, (context) => {
        const template = `
id: __PLUGIN_ID__
class: __PLUGIN_CLASS_NAME__
name: __PLUGIN_NAME__
desc: __PLUGIN_DESCRIPTION__
ver: __PLUGIN_VERSION__
`;
        const result = replaceVariables(template, context);

        return (
          result.includes(`id: ${context.PLUGIN_ID}`) &&
          result.includes(`class: ${context.PLUGIN_CLASS_NAME}`) &&
          result.includes(`name: ${context.PLUGIN_NAME}`) &&
          result.includes(`desc: ${context.PLUGIN_DESCRIPTION}`) &&
          result.includes(`ver: ${context.PLUGIN_VERSION}`)
        );
      }),
      { numRuns: 100 },
    );
  });

  it("should handle multiple occurrences of the same placeholder", () => {
    fc.assert(
      fc.property(
        replaceContextArb,
        fc.integer({ min: 2, max: 10 }),
        (context, count) => {
          // Create template with multiple occurrences
          const template = Array(count).fill("__PLUGIN_ID__").join(" ");
          const result = replaceVariables(template, context);

          // All occurrences should be replaced
          const expected = Array(count).fill(context.PLUGIN_ID).join(" ");
          return result === expected;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve content without placeholders", () => {
    fc.assert(
      fc.property(
        replaceContextArb,
        fc
          .string({ minLength: 0, maxLength: 100 })
          .filter((s) => !s.includes("__PLUGIN")),
        (context, content) => {
          const result = replaceVariables(content, context);
          return result === content;
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Unit tests for conditional block processing.
 * Validates: Requirements 3.7, 4.5
 */
describe("Conditional Block Processing", () => {
  const defaultFeatures = {
    sidebar: false,
    page: false,
    configSchema: false,
    httpApi: false,
  };

  describe("processConditionalBlocks", () => {
    it("should remove block when feature is disabled", () => {
      const content = `before
// #if FEATURE_SIDEBAR
const sidebar = true;
// #endif FEATURE_SIDEBAR
after`;

      const result = processConditionalBlocks(content, {
        features: { ...defaultFeatures, sidebar: false },
      });

      expect(result).toBe("before\nafter");
      expect(result).not.toContain("sidebar");
      expect(result).not.toContain("#if");
      expect(result).not.toContain("#endif");
    });

    it("should keep content when feature is enabled", () => {
      const content = `before
// #if FEATURE_SIDEBAR
const sidebar = true;
// #endif FEATURE_SIDEBAR
after`;

      const result = processConditionalBlocks(content, {
        features: { ...defaultFeatures, sidebar: true },
      });

      expect(result).toContain("const sidebar = true;");
      expect(result).not.toContain("#if");
      expect(result).not.toContain("#endif");
    });

    it("should handle multiple different conditional blocks", () => {
      const content = `
// #if FEATURE_SIDEBAR
sidebar code
// #endif FEATURE_SIDEBAR
// #if FEATURE_PAGE
page code
// #endif FEATURE_PAGE
// #if FEATURE_CONFIG_SCHEMA
config code
// #endif FEATURE_CONFIG_SCHEMA
`;

      const result = processConditionalBlocks(content, {
        features: {
          sidebar: true,
          page: false,
          configSchema: true,
          httpApi: false,
        },
      });

      expect(result).toContain("sidebar code");
      expect(result).not.toContain("page code");
      expect(result).toContain("config code");
    });

    it("should handle HTTP API conditional block", () => {
      const content = `
// #if FEATURE_HTTP_API
context.http.router.get("/status", handler);
// #endif FEATURE_HTTP_API
`;

      const enabledResult = processConditionalBlocks(content, {
        features: { ...defaultFeatures, httpApi: true },
      });
      expect(enabledResult).toContain("context.http.router.get");

      const disabledResult = processConditionalBlocks(content, {
        features: { ...defaultFeatures, httpApi: false },
      });
      expect(disabledResult.trim()).toBe("");
    });

    it("should preserve indentation inside blocks", () => {
      const content = `class Plugin {
  // #if FEATURE_CONFIG_SCHEMA
  configSchema = {
    type: "object",
  };
  // #endif FEATURE_CONFIG_SCHEMA
}`;

      const result = processConditionalBlocks(content, {
        features: { ...defaultFeatures, configSchema: true },
      });

      expect(result).toContain("  configSchema = {");
      expect(result).toContain('    type: "object",');
    });

    it("should handle blocks with no content between markers", () => {
      const content = `before
// #if FEATURE_SIDEBAR
// #endif FEATURE_SIDEBAR
after`;

      const result = processConditionalBlocks(content, {
        features: { ...defaultFeatures, sidebar: false },
      });

      expect(result).toBe("before\nafter");
    });

    it("should handle content with no conditional blocks", () => {
      const content = `const x = 1;
const y = 2;`;

      const result = processConditionalBlocks(content, {
        features: defaultFeatures,
      });

      expect(result).toBe(content);
    });

    it("should handle real-world template content", () => {
      const content = `import { Layout } from "lucide-react";
// #if FEATURE_SIDEBAR
import { SidebarIcon } from "lucide-react";
// #endif FEATURE_SIDEBAR
// #if FEATURE_PAGE
import { ExamplePage } from "./components/ExamplePage";
// #endif FEATURE_PAGE

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
    },
  ],
  // #endif FEATURE_SIDEBAR
});`;

      const result = processConditionalBlocks(content, {
        features: {
          sidebar: true,
          page: false,
          configSchema: false,
          httpApi: false,
        },
      });

      expect(result).toContain('import { SidebarIcon } from "lucide-react";');
      expect(result).not.toContain("ExamplePage");
      expect(result).toContain("sidebarItems:");
      // routes: key is always present, but the page content inside should be removed
      expect(result).toContain("routes: [");
      expect(result).not.toContain("element: <ExamplePage />");
      expect(result).not.toContain("#if");
      expect(result).not.toContain("#endif");
    });
  });
});

/**
 * Integration tests for processDirectory.
 */
describe("processDirectory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "replacer-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const testContext: ReplaceContext = {
    PLUGIN_ID: "my-plugin",
    PLUGIN_CLASS_NAME: "MyPlugin",
    PLUGIN_NAME: "My Plugin",
    PLUGIN_DESCRIPTION: "A test plugin",
    PLUGIN_VERSION: "1.0.0",
  };

  const testOptions: ConditionalOptions = {
    features: {
      sidebar: true,
      page: true,
      configSchema: false,
      httpApi: false,
    },
  };

  it("should process all files in directory", async () => {
    // Create test files
    fs.writeFileSync(
      path.join(tempDir, "index.ts"),
      'export const id = "__PLUGIN_ID__";',
    );
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.writeFileSync(
      path.join(tempDir, "src", "main.ts"),
      'const name = "__PLUGIN_NAME__";',
    );

    await processDirectory(tempDir, testContext, testOptions);

    const indexContent = fs.readFileSync(
      path.join(tempDir, "index.ts"),
      "utf-8",
    );
    const mainContent = fs.readFileSync(
      path.join(tempDir, "src", "main.ts"),
      "utf-8",
    );

    expect(indexContent).toBe('export const id = "my-plugin";');
    expect(mainContent).toBe('const name = "My Plugin";');
  });

  it("should process conditional blocks in files", async () => {
    const content = `
// #if FEATURE_SIDEBAR
const sidebar = true;
// #endif FEATURE_SIDEBAR
// #if FEATURE_CONFIG_SCHEMA
const config = {};
// #endif FEATURE_CONFIG_SCHEMA
`;
    fs.writeFileSync(path.join(tempDir, "test.ts"), content);

    await processDirectory(tempDir, testContext, testOptions);

    const result = fs.readFileSync(path.join(tempDir, "test.ts"), "utf-8");
    expect(result).toContain("const sidebar = true;");
    expect(result).not.toContain("const config = {};");
  });

  it("should skip non-processable files", async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02]);
    fs.writeFileSync(path.join(tempDir, "image.png"), binaryContent);
    fs.writeFileSync(
      path.join(tempDir, "index.ts"),
      'const id = "__PLUGIN_ID__";',
    );

    await processDirectory(tempDir, testContext, testOptions);

    // Binary file should be unchanged
    const imageContent = fs.readFileSync(path.join(tempDir, "image.png"));
    expect(imageContent).toEqual(binaryContent);

    // TS file should be processed
    const tsContent = fs.readFileSync(path.join(tempDir, "index.ts"), "utf-8");
    expect(tsContent).toBe('const id = "my-plugin";');
  });

  it("should throw error for non-existent directory", async () => {
    await expect(
      processDirectory("/non/existent/path", testContext, testOptions),
    ).rejects.toThrow("Directory not found");
  });
});
