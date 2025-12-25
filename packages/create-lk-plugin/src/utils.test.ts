import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validatePluginName } from "./utils";

/**
 * Feature: plugin-scaffold, Property 11: 插件名称验证
 * Validates: Requirements 1.1
 *
 * For any non-kebab-case plugin name, the scaffold should reject and return an error.
 */
describe("Property 11: Plugin Name Validation", () => {
  // Generator for valid kebab-case names
  const validKebabCaseArb = fc
    .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
      minLength: 2,
      maxLength: 50,
    })
    .filter(
      (name) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) && !name.includes("--"),
    );

  // Generator for invalid names (uppercase letters)
  const invalidUppercaseArb = fc
    .stringOf(
      fc.constantFrom(
        ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-",
      ),
      {
        minLength: 2,
        maxLength: 50,
      },
    )
    .filter((name) => /[A-Z]/.test(name));

  // Generator for names starting with number or hyphen
  const invalidStartArb = fc
    .tuple(
      fc.constantFrom(..."0123456789-"),
      fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
        minLength: 1,
        maxLength: 49,
      }),
    )
    .map(([start, rest]) => start + rest);

  // Generator for names ending with hyphen
  const invalidEndArb = fc
    .tuple(
      fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
        minLength: 1,
        maxLength: 49,
      }),
      fc.constant("-"),
    )
    .map(([start, end]) => start + end);

  // Generator for names with consecutive hyphens
  const consecutiveHyphensArb = fc
    .tuple(
      fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
        minLength: 1,
        maxLength: 20,
      }),
      fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
        minLength: 1,
        maxLength: 20,
      }),
    )
    .map(([before, after]) => before + "--" + after);

  it("should accept all valid kebab-case names", () => {
    fc.assert(
      fc.property(validKebabCaseArb, (name) => {
        return validatePluginName(name) === true;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject names containing uppercase letters", () => {
    fc.assert(
      fc.property(invalidUppercaseArb, (name) => {
        return validatePluginName(name) === false;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject names starting with number or hyphen", () => {
    fc.assert(
      fc.property(invalidStartArb, (name) => {
        return validatePluginName(name) === false;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject names ending with hyphen", () => {
    fc.assert(
      fc.property(invalidEndArb, (name) => {
        return validatePluginName(name) === false;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject names with consecutive hyphens", () => {
    fc.assert(
      fc.property(consecutiveHyphensArb, (name) => {
        return validatePluginName(name) === false;
      }),
      { numRuns: 100 },
    );
  });

  it("should reject empty strings", () => {
    expect(validatePluginName("")).toBe(false);
  });

  it("should reject single character names", () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
          minLength: 1,
          maxLength: 1,
        }),
        (name) => {
          return validatePluginName(name) === false;
        },
      ),
      { numRuns: 26 },
    );
  });
});
