#!/usr/bin/env bun
/**
 * Gemini SessionStart Adapter
 *
 * PURPOSE:
 * Adapts PAI's SessionStart hooks (LoadContext, StartupGreeting) for Gemini CLI.
 * - Captures LoadContext output -> hookSpecificOutput.additionalContext
 * - Captures StartupGreeting output -> systemMessage
 *
 * TRIGGER: SessionStart (Gemini)
 */

import { join } from 'path';
import { getHooksDir } from '../lib/paths';

async function runHook(scriptName: string): Promise<string> {
  const hooksDir = getHooksDir();
  const scriptPath = join(hooksDir, scriptName);

  try {
    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      stdout: 'pipe',
      stderr: 'inherit', // Let logs pass through to stderr (Gemini ignores stderr for JSON parsing)
      env: {
          ...process.env,
          // Ensure hooks know where to look if PAI_DIR is not set
          // PAI_DIR is handled by getPaiDir() in paths.ts, but good to be explicit if possible
      }
    });

    const output = await new Response(proc.stdout).text();
    return output;
  } catch (error) {
    console.error(`Failed to run hook ${scriptName}:`, error);
    return '';
  }
}

async function main() {
  try {
    // 1. Run LoadContext to get the system prompt/context
    // This outputs <system-reminder>...
    const contextOutput = await runHook('LoadContext.hook.ts');

    // 2. Run StartupGreeting to get the banner
    // This outputs the banner text
    const greetingOutput = await runHook('StartupGreeting.hook.ts');

    // 3. Construct Gemini JSON Output
    const output = {
      // Show the banner to the user
      systemMessage: greetingOutput.trim(),

      // Inject the context into the session
      hookSpecificOutput: {
        additionalContext: contextOutput.trim()
      }
    };

    // 4. Print JSON to stdout
    console.log(JSON.stringify(output));

  } catch (error) {
    console.error('Error in Gemini SessionStart adapter:', error);
    // Fail safe - output empty JSON so Gemini continues
    console.log(JSON.stringify({}));
  }
}

main();
