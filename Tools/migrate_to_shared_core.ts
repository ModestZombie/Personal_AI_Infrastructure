#!/usr/bin/env bun
/**
 * PAI Migration Tool: Move to Shared Core (~/.pai)
 *
 * PURPOSE:
 * Migrates PAI installation from ~/.claude (legacy) to ~/.pai (shared core).
 * Sets up configuration for both Claude Code and Gemini CLI to use the shared core.
 *
 * STEPS:
 * 1. Back up ~/.claude
 * 2. Create ~/.pai directory structure
 * 3. Copy PAI components (skills, hooks, MEMORY, USER) to ~/.pai
 * 4. Upgrade hooks with new code (including updated paths.ts and Gemini adapters)
 * 5. Update ~/.claude/settings.json to point to ~/.pai
 * 6. Create/Update ~/.gemini/settings.json with Gemini-specific hooks
 */

import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const PAI_DIR = join(HOME, '.pai');
const GEMINI_DIR = join(HOME, '.gemini');
// REPO_ROOT: If running from Tools/migrate..., assume repo root is one level up
const REPO_ROOT = join(import.meta.dir, '..');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(msg: string, color: string = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function main() {
  log('\n🚀 PAI Migration: Moving to Shared Core (~/.pai)\n', colors.bold + colors.blue);

  // 1. Check Pre-requisites
  if (!existsSync(CLAUDE_DIR)) {
    log(`❌ No existing PAI installation found in ${CLAUDE_DIR}`, colors.red);
    process.exit(1);
  }

  // 2. Backup
  const backupPath = join(HOME, `.claude-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  log(`📦 Backing up ${CLAUDE_DIR} to ${backupPath}...`, colors.yellow);
  spawnSync('cp', ['-r', CLAUDE_DIR, backupPath]);

  // 3. Create ~/.pai Structure
  log(`📂 Creating ~/.pai directory structure...`, colors.green);
  mkdirSync(PAI_DIR, { recursive: true });
  mkdirSync(join(PAI_DIR, 'hooks'), { recursive: true });
  mkdirSync(join(PAI_DIR, 'skills'), { recursive: true });
  mkdirSync(join(PAI_DIR, 'MEMORY'), { recursive: true });

  // 4. Copy Components (Old Data)
  const components = ['skills', 'hooks', 'MEMORY', 'USER'];

  for (const component of components) {
    const src = join(CLAUDE_DIR, component);
    const dest = join(PAI_DIR, component);

    if (existsSync(src)) {
      log(`   Moving ${component}...`);
      mkdirSync(dest, { recursive: true });
      // Copy contents using trailing slash/dot to avoid nesting
      // e.g. cp -R ~/.claude/skills/. ~/.pai/skills/
      spawnSync('cp', ['-R', `${src}/.`, dest]);
    }
  }

  // Copy .env separately (file)
  if (existsSync(join(CLAUDE_DIR, '.env'))) {
      copyFileSync(join(CLAUDE_DIR, '.env'), join(PAI_DIR, '.env'));
  }

  // 5. Install New Core Hooks (Including Gemini Adapters & Updated paths.ts)
  log(`🔌 Installing/Upgrading Core Hooks...`, colors.green);
  // Source hooks from the repo (where this script lives)
  const hooksSrc = join(REPO_ROOT, 'Packs', 'pai-hook-system', 'src', 'hooks');
  const hooksDest = join(PAI_DIR, 'hooks');

  if (existsSync(hooksSrc)) {
    // Copy new hooks over old ones (updates paths.ts, adds Gemini adapters)
    spawnSync('cp', ['-R', `${hooksSrc}/.`, hooksDest]);
  } else {
    log(`⚠️ Could not find hooks in repo at ${hooksSrc}`, colors.yellow);
    log(`   Ensure you are running this script from the PAI repository.`);
  }

  // 6. Update Claude Configuration
  log(`📝 Updating Claude Code configuration...`, colors.green);
  const claudeSettingsPath = join(CLAUDE_DIR, 'settings.json');
  if (existsSync(claudeSettingsPath)) {
    try {
      const content = readFileSync(claudeSettingsPath, 'utf-8');
      const settings = JSON.parse(content);

      if (settings.hooks) {
        // Recursively replace paths in hooks
        const updateHooks = (obj: any) => {
          for (const key in obj) {
            if (typeof obj[key] === 'string') {
               // Replace ~/.claude with ~/.pai
               obj[key] = obj[key].replace(/\.claude/g, '.pai');
               // Replace $PAI_DIR with ~/.pai explicitly if desired, or assume PAI_DIR env var will change
            } else if (typeof obj[key] === 'object') {
              updateHooks(obj[key]);
            }
          }
        };
        updateHooks(settings.hooks);

        writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2));
        log(`   Updated ${claudeSettingsPath}`);
      }
    } catch (e) {
      log(`   Failed to update Claude settings: ${e}`, colors.red);
    }
  }

  // 7. Create/Update Gemini Configuration
  log(`📝 Configuring Gemini CLI...`, colors.green);
  if (!existsSync(GEMINI_DIR)) mkdirSync(GEMINI_DIR, { recursive: true });
  const geminiSettingsPath = join(GEMINI_DIR, 'settings.json');

  let geminiSettings: any = {};
  if (existsSync(geminiSettingsPath)) {
    try {
      geminiSettings = JSON.parse(readFileSync(geminiSettingsPath, 'utf-8'));
    } catch (e) {
      log(`   Warning: existing Gemini settings invalid, creating new.`, colors.yellow);
    }
  }

  // Define Gemini Hooks
  const geminiHooks = {
    "SessionStart": [
      {
        "hooks": [
          {"type": "command", "command": "bun run ~/.pai/hooks/gemini/SessionStart.ts"}
        ]
      }
    ],
    "BeforeTool": [
      {
        "matcher": "Bash",
        "hooks": [
          {"type": "command", "command": "bun run ~/.pai/hooks/gemini/BeforeTool.ts"}
        ]
      }
    ],
    "BeforeAgent": [
       {
         "hooks": [
           {"type": "command", "command": "bun run ~/.pai/hooks/gemini/BeforeAgent.ts"}
         ]
       }
    ],
    "AfterAgent": [
      {
        "hooks": [
          {"type": "command", "command": "bun run ~/.pai/hooks/gemini/AfterAgent.ts"}
        ]
      }
    ]
  };

  // Merge hooks
  geminiSettings.hooks = { ...geminiSettings.hooks, ...geminiHooks };
  writeFileSync(geminiSettingsPath, JSON.stringify(geminiSettings, null, 2));
  log(`   Updated ${geminiSettingsPath}`);

  // 8. Update Environment
  log(`\n✅ Migration Complete!`, colors.bold + colors.green);
  log(`\nNext Steps:`, colors.bold);
  log(`1. Verify ~/.pai contains your skills and memory.`);
  log(`2. If you set PAI_DIR in your shell profile (.zshrc/.bashrc), update it to:`);
  log(`   export PAI_DIR="$HOME/.pai"`, colors.blue);
  log(`3. Restart your terminals.`);
  log(`4. Run 'claude' to verify PAI still works.`);
  log(`5. Run 'gemini' to verify PAI works there too.`);
  log(`\n(Old data remains in ~/.claude/ for safety. You can delete skills/hooks/MEMORY there once verified.)`);
}

main();
