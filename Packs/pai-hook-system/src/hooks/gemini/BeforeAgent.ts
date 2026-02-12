#!/usr/bin/env bun
/**
 * Gemini BeforeAgent Adapter
 *
 * PURPOSE:
 * Adapts PAI's BeforeAgent hooks (FormatEnforcer, UpdateTabTitle) for Gemini CLI.
 * - Runs FormatEnforcer -> hookSpecificOutput.additionalContext
 * - Runs UpdateTabTitle (fire-and-forget side effect)
 *
 * TRIGGER: BeforeAgent (Gemini)
 */

import { join } from 'path';
import { getHooksDir } from '../lib/paths';

async function runFormatEnforcer(): Promise<string> {
  const hooksDir = getHooksDir();
  const scriptPath = join(hooksDir, 'FormatEnforcer.hook.ts');

  try {
    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      stdout: 'pipe',
      stderr: 'inherit',
      env: process.env
    });

    return await new Response(proc.stdout).text();
  } catch (error) {
    console.error(`Failed to run FormatEnforcer:`, error);
    return '';
  }
}

async function runUpdateTabTitle(inputJson: string): Promise<void> {
  const hooksDir = getHooksDir();
  const scriptPath = join(hooksDir, 'UpdateTabTitle.hook.ts');

  try {
    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      stdin: new Response(inputJson),
      stdout: 'ignore',
      stderr: 'inherit',
      env: process.env
    });

    // Wait for completion to ensure title updates before hook exits
    // (Bun kills child processes on exit)
    await proc.exited;
  } catch (error) {
    console.error(`Failed to run UpdateTabTitle:`, error);
  }
}

async function main() {
  try {
    // 1. Read input for passing to UpdateTabTitle
    const input = await Bun.stdin.text();

    // 2. Run hooks in parallel
    const [_, contextOutput] = await Promise.all([
      runUpdateTabTitle(input),
      runFormatEnforcer()
    ]);

    // 3. Return Output
    console.log(JSON.stringify({
      hookSpecificOutput: {
        additionalContext: contextOutput.trim()
      }
    }));

  } catch (error) {
    console.error('Error in Gemini BeforeAgent adapter:', error);
    // Fail open
    console.log(JSON.stringify({}));
  }
}

main();
