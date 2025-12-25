/**
 * Template copier module for the create-lk-plugin scaffold tool.
 * Responsible for copying template directory to target location.
 * @module copier
 */

import * as fs from "fs";
import * as path from "path";
import { ScaffoldError, ScaffoldErrorCode } from "./types";

/**
 * Options for copying template directory.
 */
export interface CopyOptions {
  /** Source template directory */
  templateDir: string;
  /** Target directory */
  targetDir: string;
  /** File/directory patterns to exclude (glob-like patterns) */
  exclude?: string[];
}

/**
 * Default patterns to exclude when copying template.
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  "dist",
  ".turbo",
  ".DS_Store",
  "*.log",
];

/**
 * Checks if a file/directory name matches any of the exclude patterns.
 *
 * @param name - The file or directory name to check
 * @param patterns - Array of patterns to match against
 * @returns true if the name matches any pattern, false otherwise
 */
export function matchesExcludePattern(
  name: string,
  patterns: string[],
): boolean {
  for (const pattern of patterns) {
    // Exact match
    if (name === pattern) {
      return true;
    }

    // Wildcard pattern (e.g., "*.log")
    if (pattern.startsWith("*")) {
      const suffix = pattern.slice(1);
      if (name.endsWith(suffix)) {
        return true;
      }
    }

    // Wildcard pattern (e.g., "test*")
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (name.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively copies a directory from source to target.
 *
 * @param srcDir - Source directory path
 * @param destDir - Destination directory path
 * @param excludePatterns - Patterns to exclude
 */
function copyDirectoryRecursive(
  srcDir: string,
  destDir: string,
  excludePatterns: string[],
): void {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read source directory contents
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // Skip if matches exclude pattern
    if (matchesExcludePattern(entry.name, excludePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy directory
      copyDirectoryRecursive(srcPath, destPath, excludePatterns);
    } else if (entry.isFile()) {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copies template directory to target location.
 *
 * @param options - Copy options
 * @throws {ScaffoldError} If copy operation fails
 *
 * @example
 * await copyTemplate({
 *   templateDir: './template',
 *   targetDir: './my-plugin',
 *   exclude: ['node_modules', 'dist']
 * });
 */
export async function copyTemplate(options: CopyOptions): Promise<void> {
  const {
    templateDir,
    targetDir,
    exclude = DEFAULT_EXCLUDE_PATTERNS,
  } = options;

  // Validate source directory exists
  if (!fs.existsSync(templateDir)) {
    throw new ScaffoldError(
      ScaffoldErrorCode.TEMPLATE_ERROR,
      `Template directory not found: ${templateDir}`,
    );
  }

  // Check if source is a directory
  const srcStats = fs.statSync(templateDir);
  if (!srcStats.isDirectory()) {
    throw new ScaffoldError(
      ScaffoldErrorCode.TEMPLATE_ERROR,
      `Template path is not a directory: ${templateDir}`,
    );
  }

  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy directory recursively
    copyDirectoryRecursive(templateDir, targetDir, exclude);
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    if (error instanceof ScaffoldError) {
      throw error;
    }

    throw new ScaffoldError(
      ScaffoldErrorCode.WRITE_FAILED,
      `Failed to copy template: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Gets the list of files that would be copied (for preview/testing).
 *
 * @param srcDir - Source directory path
 * @param excludePatterns - Patterns to exclude
 * @param basePath - Base path for relative paths (internal use)
 * @returns Array of relative file paths that would be copied
 */
export function getFilesToCopy(
  srcDir: string,
  excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS,
  basePath: string = "",
): string[] {
  const files: string[] = [];

  if (!fs.existsSync(srcDir)) {
    return files;
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath
      ? path.join(basePath, entry.name)
      : entry.name;

    // Skip if matches exclude pattern
    if (matchesExcludePattern(entry.name, excludePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively get files from subdirectory
      const subFiles = getFilesToCopy(
        path.join(srcDir, entry.name),
        excludePatterns,
        relativePath,
      );
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}
