#!/usr/bin/env bun
/**
 * Gemini BeforeTool Adapter
 *
 * PURPOSE:
 * Adapts PAI's SecurityValidator hook for Gemini CLI.
 * - Pipes input directly (schemas match).
 * - Handles exit codes:
 *   - Exit 2 (Block): Propagates exit 2 to Gemini.
 *   - Exit 0 (Success): Transforms output:
 *     - "ask" -> "deny" (with explanation)
 *     - "continue" -> {} (allow)
 *
 * TRIGGER: BeforeTool (Gemini)
 */

import { join } from 'path';
import { getHooksDir } from '../lib/paths';

async function main() {
  try {
    // 1. Read stdin (Gemini input)
    const input = await Bun.stdin.text();

    // 2. Spawn SecurityValidator
    const hooksDir = getHooksDir();
    const validatorPath = join(hooksDir, 'SecurityValidator.hook.ts');

    const proc = Bun.spawn(['bun', 'run', validatorPath], {
      stdin: 'pipe',   // We will write to it
      stdout: 'pipe',
      stderr: 'inherit', // Let logs pass through (Gemini captures stderr for blocks)
      env: process.env
    });

    // Write input to validator
    const writer = proc.stdin.getWriter();
    writer.write(input);
    writer.close();

    // Wait for completion
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    // 3. Handle Exit Codes
    if (exitCode === 2) {
      // Hard block (exit 2) -> Propagate to Gemini
      // SecurityValidator writes reason to stderr, which we inherited
      process.exit(2);
    }

    // 4. Handle JSON Output (Exit 0)
    try {
      const result = JSON.parse(stdout);

      if (result.decision === 'ask') {
        // Translate "ask" to "deny" because Gemini hooks are non-interactive
        const reason = `[PAI Security] Interactive confirmation required but not supported.\n${result.message}\n\nAction blocked for safety.`;

        console.log(JSON.stringify({
          decision: 'deny',
          reason: reason
        }));
      } else {
        // "continue: true" or other success -> Allow
        // Empty JSON tells Gemini to proceed
        console.log(JSON.stringify({}));
      }
    } catch (e) {
      // Failed to parse validator output - fail open (allow)
      // Log error to stderr for debugging
      console.error('Failed to parse SecurityValidator output:', e);
      console.log(JSON.stringify({}));
    }

  } catch (error) {
    console.error('Error in Gemini BeforeTool adapter:', error);
    // Fail open on adapter error
    console.log(JSON.stringify({}));
  }
}

main();
