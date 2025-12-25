/**
 * Validates if a plugin name follows kebab-case format.
 * Valid names:
 * - Start with a lowercase letter
 * - End with a lowercase letter or number
 * - Contain only lowercase letters, numbers, and hyphens
 * - No consecutive hyphens
 * - Minimum 2 characters
 *
 * @param name - The plugin name to validate
 * @returns true if the name is valid kebab-case, false otherwise
 */
export function validatePluginName(name: string): boolean {
  if (!name || name.length < 2) {
    return false;
  }

  // Must match kebab-case pattern:
  // - Start with lowercase letter
  // - End with lowercase letter or number
  // - Only lowercase letters, numbers, and single hyphens
  const kebabCaseRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;

  if (!kebabCaseRegex.test(name)) {
    return false;
  }

  // No consecutive hyphens
  if (name.includes("--")) {
    return false;
  }

  return true;
}

/**
 * Converts a kebab-case string to PascalCase.
 *
 * @param name - The kebab-case string to convert
 * @returns The PascalCase version of the string
 *
 * @example
 * toPascalCase('my-plugin') // returns 'MyPlugin'
 * toPascalCase('hello-world-test') // returns 'HelloWorldTest'
 */
export function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Checks if a directory exists at the given path.
 *
 * @param dirPath - The path to check
 * @returns true if the directory exists, false otherwise
 *
 * @example
 * directoryExists('./my-plugin') // returns true if directory exists
 */
export function directoryExists(dirPath: string): boolean {
  const fs = require("fs");
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
