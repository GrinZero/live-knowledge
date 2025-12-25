#!/usr/bin/env node
/**
 * CLI entry point for the create-lk-plugin scaffold tool.
 * Uses commander to parse command line arguments and integrates
 * interactive prompts with the project generator.
 *
 * @module cli
 */

import { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import { collectConfig, createDefaultConfig } from "./prompts";
import { generateProject } from "./generator";
import { validatePluginName } from "./utils";
import { ScaffoldError, ScaffoldErrorCode, PluginType } from "./types";

// Package version (will be replaced during build or read from package.json)
const VERSION = "0.0.1";

/**
 * CLI options parsed from command line arguments.
 */
interface CLIOptions {
  /** Skip interactive prompts and use defaults */
  yes?: boolean;
  /** Plugin type template */
  template?: PluginType;
  /** Overwrite existing directory */
  force?: boolean;
}

/**
 * Displays success message with next steps.
 * @param pluginName - The name of the created plugin
 * @param targetDir - The target directory path
 */
function displaySuccessMessage(pluginName: string, targetDir: string): void {
  console.log();
  console.log(chalk.green("✔ 插件项目创建成功!"));
  console.log();
  console.log("后续步骤:");
  console.log();
  console.log(chalk.cyan(`  cd ${pluginName}`));
  console.log(chalk.cyan("  npm install"));
  console.log(chalk.cyan("  npm run build"));
  console.log();
  console.log("开发指南:");
  console.log(chalk.gray(`  - 编辑 src/index.ts 实现主进程逻辑`));
  console.log(chalk.gray(`  - 编辑 src/renderer.tsx 实现渲染进程 UI`));
  console.log(chalk.gray(`  - 运行 npm run pack 打包插件`));
  console.log();
  console.log(chalk.gray(`项目已创建在: ${path.resolve(targetDir)}`));
  console.log();
}

/**
 * Displays error message with appropriate formatting.
 * @param error - The error to display
 */
function displayError(error: unknown): void {
  console.log();

  if (error instanceof ScaffoldError) {
    switch (error.code) {
      case ScaffoldErrorCode.DIR_EXISTS:
        console.log(chalk.red("✖ 错误: 目标目录已存在"));
        console.log(chalk.gray("  使用 --force 选项覆盖已存在的目录"));
        break;
      case ScaffoldErrorCode.INVALID_NAME:
        console.log(chalk.red("✖ 错误: 无效的插件名称"));
        console.log(
          chalk.gray("  插件名称必须是 kebab-case 格式 (例如: my-plugin)"),
        );
        console.log(
          chalk.gray(
            "  只能包含小写字母、数字和连字符，且不能以连字符开头或结尾",
          ),
        );
        break;
      default:
        console.log(chalk.red(`✖ 错误: ${error.message}`));
    }
  } else if (error instanceof Error) {
    console.log(chalk.red(`✖ 错误: ${error.message}`));
  } else {
    console.log(chalk.red("✖ 发生未知错误"));
  }

  console.log();
}

/**
 * Main CLI entry function.
 * Parses arguments, collects configuration, and generates the project.
 *
 * @param args - Command line arguments (defaults to process.argv)
 */
export async function main(args: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("create-lk-plugin")
    .description("创建 Live Knowledge 插件项目")
    .version(VERSION)
    .argument("[plugin-name]", "插件名称 (kebab-case 格式)")
    .option("-y, --yes", "跳过交互式提示，使用默认值")
    .option(
      "-t, --template <type>",
      "插件类型: full, main-only, renderer-only",
      "full",
    )
    .option("-f, --force", "覆盖已存在的目录")
    .action(async (pluginName: string | undefined, options: CLIOptions) => {
      try {
        console.log();
        console.log(chalk.bold("🚀 Create Live Knowledge Plugin"));
        console.log();

        // Validate plugin name if provided
        if (pluginName && !validatePluginName(pluginName)) {
          throw new ScaffoldError(
            ScaffoldErrorCode.INVALID_NAME,
            `Invalid plugin name: "${pluginName}"`,
          );
        }

        // Validate template option
        const validTemplates: PluginType[] = [
          "full",
          "main-only",
          "renderer-only",
        ];
        if (options.template && !validTemplates.includes(options.template)) {
          console.log(
            chalk.yellow(
              `⚠ 无效的模板类型 "${options.template}"，使用默认值 "full"`,
            ),
          );
          options.template = "full";
        }

        let config;

        if (options.yes && pluginName) {
          // Non-interactive mode with --yes flag
          config = createDefaultConfig(pluginName, {
            type: options.template,
          });
          console.log(chalk.gray(`使用默认配置创建插件: ${pluginName}`));
        } else {
          // Interactive mode
          const defaults = {
            ...(pluginName ? { id: pluginName } : {}),
            ...(options.template ? { type: options.template } : {}),
          };
          config = await collectConfig(defaults);
        }

        // Determine target directory
        const targetDir = path.resolve(process.cwd(), config.id);

        // Generate the project
        console.log();
        console.log(chalk.gray("正在生成项目..."));

        await generateProject({
          targetDir,
          config,
          overwrite: options.force,
        });

        // Display success message
        displaySuccessMessage(config.id, targetDir);
      } catch (error) {
        displayError(error);
        process.exit(1);
      }
    });

  await program.parseAsync(args);
}

// Run CLI if this is the main module
if (require.main === module) {
  main().catch((error) => {
    displayError(error);
    process.exit(1);
  });
}
