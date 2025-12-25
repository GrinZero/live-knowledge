#!/usr/bin/env npx tsx
/**
 * Script to verify that the template project can be built successfully.
 * This script:
 * 1. Copies the template to a temporary directory within the workspace
 * 2. Replaces placeholders with valid values
 * 3. Installs dependencies (using workspace resolution)
 * 4. Runs the build
 * 5. Cleans up
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PLACEHOLDERS = {
  __PLUGIN_ID__: "test-plugin",
  __PLUGIN_CLASS_NAME__: "TestPlugin",
  __PLUGIN_NAME__: "Test Plugin",
  __PLUGIN_DESCRIPTION__: "A test plugin for verification",
  __PLUGIN_VERSION__: "1.0.0",
};

function replaceInFile(filePath: string): void {
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [placeholder, value] of Object.entries(PLACEHOLDERS)) {
    content = content.replace(new RegExp(placeholder, "g"), value);
  }
  fs.writeFileSync(filePath, content);
}

function processDirectory(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist") {
        processDirectory(fullPath);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".json") ||
        entry.name.endsWith(".md"))
    ) {
      replaceInFile(fullPath);
    }
  }
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const templateDir = path.resolve(scriptDir, "../template");
  // Use a temp directory within the workspace so pnpm workspace resolution works
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  const tempDir = path.join(workspaceRoot, ".temp-plugin-test");

  console.log("📁 Template directory:", templateDir);
  console.log("📁 Temp directory:", tempDir);

  // Clean up any previous test directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  try {
    // Step 1: Copy template to temp directory
    console.log("\n📋 Copying template...");
    copyDir(templateDir, tempDir);

    // Step 2: Replace placeholders
    console.log("🔄 Replacing placeholders...");
    processDirectory(tempDir);

    // Step 3: Install dependencies
    console.log("📦 Installing dependencies...");
    execSync("pnpm install", { cwd: tempDir, stdio: "inherit" });

    // Step 4: Build the project
    console.log("🔨 Building project...");
    execSync("pnpm run build", { cwd: tempDir, stdio: "inherit" });

    // Step 5: Verify output files exist
    console.log("✅ Verifying output files...");
    const distDir = path.join(tempDir, "dist");
    const expectedFiles = ["index.js", "renderer.global.js"];
    for (const file of expectedFiles) {
      const filePath = path.join(distDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Expected output file not found: ${file}`);
      }
      console.log(`  ✓ ${file}`);
    }

    console.log("\n🎉 Template verification successful!");
  } catch (error) {
    console.error("\n❌ Template verification failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main();
