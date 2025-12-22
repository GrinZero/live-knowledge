#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// Get current working directory
const cwd = process.cwd();

// Read package.json
const packageJsonPath = path.join(cwd, "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error("Error: package.json not found in current directory.");
  process.exit(1);
}

const packageJson = require(packageJsonPath);
const name = packageJson.name;
const version = packageJson.version;

if (!name || !version) {
  console.error('Error: package.json must contain "name" and "version".');
  process.exit(1);
}

// Check for renderer entry point if specified
if (packageJson.renderer) {
  const rendererPath = path.join(cwd, packageJson.renderer);
  if (!fs.existsSync(rendererPath)) {
    console.error(
      `Error: Renderer entry point not found: ${packageJson.renderer}`,
    );
    console.error(
      "Please ensure the renderer file exists or update package.json.",
    );
    process.exit(1);
  }
}

// Check for dist directory
const distPath = path.join(cwd, "dist");
if (!fs.existsSync(distPath)) {
  console.error(
    "Error: dist directory not found. Please build the plugin first.",
  );
  process.exit(1);
}

// Create output filename
const outputFilename = `${name}-${version}.zip`;
const outputPath = path.join(cwd, outputFilename);

console.log(`Packaging plugin: ${name} v${version}`);

try {
  const zip = new AdmZip();

  // Add package.json
  zip.addLocalFile(packageJsonPath);

  // Add dist directory
  zip.addLocalFolder(distPath, "dist");

  // Add README.md if exists
  const readmePath = path.join(cwd, "README.md");
  if (fs.existsSync(readmePath)) {
    zip.addLocalFile(readmePath);
  }

  // Add assets directory if exists
  const assetsPath = path.join(cwd, "assets");
  if (fs.existsSync(assetsPath)) {
    console.log("Including assets directory...");
    zip.addLocalFolder(assetsPath, "assets");
  }

  // Write zip file
  zip.writeZip(outputPath);

  console.log(`\nSuccess! Plugin packaged at: ${outputPath}`);
} catch (error) {
  console.error("Error creating zip file:", error);
  process.exit(1);
}
