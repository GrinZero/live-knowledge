/**
 * Unit tests for the copier module.
 * Tests directory copying and file exclusion functionality.
 *
 * Feature: plugin-scaffold
 * Validates: Requirements 1.1, 1.3
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  copyTemplate,
  matchesExcludePattern,
  getFilesToCopy,
  DEFAULT_EXCLUDE_PATTERNS,
} from "./copier";
import { ScaffoldError, ScaffoldErrorCode } from "./types";

describe("copier module", () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "copier-test-"));
    sourceDir = path.join(tempDir, "source");
    targetDir = path.join(tempDir, "target");

    // Create source directory structure
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("matchesExcludePattern", () => {
    it("should match exact pattern", () => {
      expect(matchesExcludePattern("node_modules", ["node_modules"])).toBe(
        true,
      );
      expect(matchesExcludePattern("dist", ["dist"])).toBe(true);
    });

    it("should not match different names", () => {
      expect(matchesExcludePattern("src", ["node_modules"])).toBe(false);
      expect(matchesExcludePattern("index.ts", ["dist"])).toBe(false);
    });

    it("should match wildcard suffix pattern (*.log)", () => {
      expect(matchesExcludePattern("error.log", ["*.log"])).toBe(true);
      expect(matchesExcludePattern("debug.log", ["*.log"])).toBe(true);
      expect(matchesExcludePattern("file.txt", ["*.log"])).toBe(false);
    });

    it("should match wildcard prefix pattern (test*)", () => {
      expect(matchesExcludePattern("test-file.ts", ["test*"])).toBe(true);
      expect(matchesExcludePattern("testing", ["test*"])).toBe(true);
      expect(matchesExcludePattern("mytest", ["test*"])).toBe(false);
    });

    it("should match against multiple patterns", () => {
      const patterns = ["node_modules", "dist", "*.log"];
      expect(matchesExcludePattern("node_modules", patterns)).toBe(true);
      expect(matchesExcludePattern("dist", patterns)).toBe(true);
      expect(matchesExcludePattern("error.log", patterns)).toBe(true);
      expect(matchesExcludePattern("src", patterns)).toBe(false);
    });
  });

  describe("copyTemplate", () => {
    it("should copy a simple file", async () => {
      // Create a source file
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "export default {};");

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: targetDir,
        exclude: [],
      });

      expect(fs.existsSync(path.join(targetDir, "index.ts"))).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "index.ts"), "utf-8")).toBe(
        "export default {};",
      );
    });

    it("should copy nested directories", async () => {
      // Create nested structure
      fs.mkdirSync(path.join(sourceDir, "src", "components"), {
        recursive: true,
      });
      fs.writeFileSync(path.join(sourceDir, "src", "index.ts"), "// main");
      fs.writeFileSync(
        path.join(sourceDir, "src", "components", "Button.tsx"),
        "// button",
      );

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: targetDir,
        exclude: [],
      });

      expect(fs.existsSync(path.join(targetDir, "src", "index.ts"))).toBe(true);
      expect(
        fs.existsSync(path.join(targetDir, "src", "components", "Button.tsx")),
      ).toBe(true);
    });

    it("should exclude files matching patterns", async () => {
      // Create files including ones to exclude
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");
      fs.writeFileSync(path.join(sourceDir, "error.log"), "error log");
      fs.mkdirSync(path.join(sourceDir, "node_modules"));
      fs.writeFileSync(
        path.join(sourceDir, "node_modules", "package.json"),
        "{}",
      );

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: targetDir,
        exclude: ["node_modules", "*.log"],
      });

      expect(fs.existsSync(path.join(targetDir, "index.ts"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "error.log"))).toBe(false);
      expect(fs.existsSync(path.join(targetDir, "node_modules"))).toBe(false);
    });

    it("should use default exclude patterns when not specified", async () => {
      // Create files that should be excluded by default
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");
      fs.mkdirSync(path.join(sourceDir, "node_modules"));
      fs.writeFileSync(
        path.join(sourceDir, "node_modules", "dep.js"),
        "// dep",
      );
      fs.mkdirSync(path.join(sourceDir, "dist"));
      fs.writeFileSync(path.join(sourceDir, "dist", "bundle.js"), "// bundle");

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: targetDir,
      });

      expect(fs.existsSync(path.join(targetDir, "index.ts"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "node_modules"))).toBe(false);
      expect(fs.existsSync(path.join(targetDir, "dist"))).toBe(false);
    });

    it("should throw error if template directory does not exist", async () => {
      const nonExistentDir = path.join(tempDir, "non-existent");

      await expect(
        copyTemplate({
          templateDir: nonExistentDir,
          targetDir: targetDir,
        }),
      ).rejects.toThrow(ScaffoldError);

      await expect(
        copyTemplate({
          templateDir: nonExistentDir,
          targetDir: targetDir,
        }),
      ).rejects.toMatchObject({
        code: ScaffoldErrorCode.TEMPLATE_ERROR,
      });
    });

    it("should throw error if template path is a file, not directory", async () => {
      const filePath = path.join(tempDir, "file.txt");
      fs.writeFileSync(filePath, "content");

      await expect(
        copyTemplate({
          templateDir: filePath,
          targetDir: targetDir,
        }),
      ).rejects.toThrow(ScaffoldError);
    });

    it("should create target directory if it does not exist", async () => {
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");

      const nestedTarget = path.join(tempDir, "nested", "deep", "target");

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: nestedTarget,
        exclude: [],
      });

      expect(fs.existsSync(path.join(nestedTarget, "index.ts"))).toBe(true);
    });

    it("should preserve file contents exactly", async () => {
      const content = `
import { something } from 'somewhere';

export function test() {
  return "Hello, World!";
}
`.trim();

      fs.writeFileSync(path.join(sourceDir, "test.ts"), content);

      await copyTemplate({
        templateDir: sourceDir,
        targetDir: targetDir,
        exclude: [],
      });

      expect(fs.readFileSync(path.join(targetDir, "test.ts"), "utf-8")).toBe(
        content,
      );
    });
  });

  describe("getFilesToCopy", () => {
    it("should return list of files to copy", () => {
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");
      fs.mkdirSync(path.join(sourceDir, "src"));
      fs.writeFileSync(path.join(sourceDir, "src", "utils.ts"), "// utils");

      const files = getFilesToCopy(sourceDir, []);

      expect(files).toContain("index.ts");
      expect(files).toContain(path.join("src", "utils.ts"));
    });

    it("should exclude files matching patterns", () => {
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");
      fs.writeFileSync(path.join(sourceDir, "error.log"), "error");
      fs.mkdirSync(path.join(sourceDir, "node_modules"));
      fs.writeFileSync(
        path.join(sourceDir, "node_modules", "dep.js"),
        "// dep",
      );

      const files = getFilesToCopy(sourceDir, ["node_modules", "*.log"]);

      expect(files).toContain("index.ts");
      expect(files).not.toContain("error.log");
      expect(files).not.toContain(path.join("node_modules", "dep.js"));
    });

    it("should return empty array for non-existent directory", () => {
      const files = getFilesToCopy(path.join(tempDir, "non-existent"));
      expect(files).toEqual([]);
    });

    it("should use default exclude patterns", () => {
      fs.writeFileSync(path.join(sourceDir, "index.ts"), "// main");
      fs.mkdirSync(path.join(sourceDir, "node_modules"));
      fs.writeFileSync(
        path.join(sourceDir, "node_modules", "dep.js"),
        "// dep",
      );

      const files = getFilesToCopy(sourceDir);

      expect(files).toContain("index.ts");
      expect(files).not.toContain(path.join("node_modules", "dep.js"));
    });
  });

  describe("DEFAULT_EXCLUDE_PATTERNS", () => {
    it("should include common patterns to exclude", () => {
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain("node_modules");
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain("dist");
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain(".DS_Store");
    });
  });
});
