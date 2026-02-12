# Claude Code + Gemini CLI Dual-Runtime PAI Architecture Plan

## Goal

Run PAI as two **separate runtime installs** (Claude Code + Gemini CLI) while both share one common core infrastructure (skills, memory, workflows, observability schema, pack code).

---

## Current State (from repository)

PAI messaging says the system is platform-agnostic, but installation and pack docs still assume a Claude-centered default path (`~/.claude`) and Claude-specific flow.

### Evidence

- README says PAI is not Claude-only and can work across other systems.  
- INSTALL flow defaults to Claude Code and `~/.claude`, including quick-start commands that copy `.claude` and restart Claude Code.
- Many pack docs and verify scripts reference `~/.claude` directly.

---

## Gemini CLI Capability Assumptions to Design Around

This plan assumes Gemini CLI now supports hook-style automation, tool execution, and config-driven startup behavior similar to Claude Code's programmable workflow model.

Because network access to upstream Gemini CLI docs was blocked in this environment, treat the Gemini adapter details below as the implementation target to validate against your exact installed Gemini version.

---

## Target Design

## 1) Split PAI into **Core + Runtime Adapters**

Create a first-class structure:

- `~/.pai/` (shared core)
  - `core/skills/`
  - `core/MEMORY/`
  - `core/hooks/` (canonical hook logic, runtime-neutral)
  - `core/commands/`
  - `core/settings/`
- `~/.claude/` (Claude runtime adapter)
  - runtime-specific settings + hook registration only
  - symlinks or mounted references into `~/.pai/core/*`
- `~/.gemini/` (Gemini runtime adapter)
  - runtime-specific settings + hook registration only
  - symlinks or mounted references into `~/.pai/core/*`

This gives you separate operational installs while preserving one shared source of truth.

## 2) Introduce Runtime Profile Configuration

Add a profile schema in repo (example path: `Tools/runtime-profiles/`):

- `claude-code.json`
- `gemini-cli.json`

Each profile declares:

- config directory
- hook registration format
- startup command behavior
- environment variable injection
- supported event names and payload shape

Installer picks one or both profiles and renders runtime-specific config files from one canonical template.

## 3) Replace Hardcoded `~/.claude` Paths With Variables

Systematically refactor docs/scripts/packs:

- From: `~/.claude/...`
- To: `$PAI_RUNTIME_DIR/...` for runtime-local files
- And: `$PAI_CORE_DIR/...` for shared assets

Defaults:

- Claude: `PAI_RUNTIME_DIR=~/.claude`
- Gemini: `PAI_RUNTIME_DIR=~/.gemini`
- Shared: `PAI_CORE_DIR=~/.pai/core`

This is the most important repository-wide change to unlock dual-runtime support.

## 4) Hook Contract Layer (Canonical Events)

Define a canonical hook interface once (runtime-neutral):

- `SessionStart`
- `PreToolUse`
- `PostToolUse`
- `UserPromptSubmit`
- `AssistantResponse`
- `SessionEnd`

Then build adapters:

- Claude adapter: maps Claude event payloads to canonical events.
- Gemini adapter: maps Gemini hook/event payloads to canonical events.

All existing PAI hook logic should run against canonical events, not provider-native payloads.

## 5) Runtime-Specific Settings Generators

Add generator scripts to produce:

- Claude runtime config from templates
- Gemini runtime config from templates

Keep only these runtime deltas in adapter output:

- model defaults
- permissions model
- event wiring syntax
- tool allow/deny flags specific to runtime

Everything else remains shared in core.

## 6) Identity and Memory Isolation Strategy

Decide between two modes and expose as installer option:

- **Shared brain mode**: Claude and Gemini share same memory/history/learning state.
- **Split brain mode**: separate memory trees with optional sync.

Recommended default for your vision: shared brain mode, but tag entries with `runtime: claude|gemini` so observability can filter attribution.

## 7) Observability Normalization

Update observability ingest schema to include:

- `runtime` (claude/gemini)
- `provider_event_name`
- `canonical_event_name`
- `agent_id`
- `session_id`

Dashboard can then show side-by-side behavior differences while still using one pipeline.

## 8) Verification Matrix Expansion

Every pack verify should support:

- Claude runtime only
- Gemini runtime only
- Dual runtime with shared core

Add an end-to-end validation script that checks:

1. Both runtimes can load shared skills.
2. Both runtimes can trigger hooks.
3. Both runtimes can write/read shared memory.
4. Runtime-specific configs remain isolated.

## 9) Installer UX Changes

In root `INSTALL.md` and installer scripts, add explicit flow:

- "Install for Claude, Gemini, or both?"
- "Use shared core at `~/.pai/core`?"
- "Memory mode: shared vs split?"
- "Generate runtime adapter links/copies now?"

The installer should be idempotent and safe to re-run after adding the second runtime later.

---

## Concrete Repository Modifications Required

1. **Root docs** (`README.md`, `INSTALL.md`)  
   - Add dual-runtime architecture and new environment-variable path conventions.

2. **Pack docs and verify scripts** (all packs)  
   - Remove direct `~/.claude` assumptions; parameterize all paths.

3. **Bundle installer** (`Bundles/Official/install.ts`)  
   - Add runtime selection and adapter generation.

4. **Template tooling** (`Tools/*Template*`, validators)  
   - Add runtime-profile-aware template rendering and checks.

5. **Hook system packs**  
   - Introduce canonical event interface and runtime adapters.

6. **Observability pack**  
   - Add runtime attribution fields and adapter-aware ingestion.

7. **New runtime adapter directory** (new)  
   - Add Claude and Gemini adapter templates, examples, and tests.

---

## Suggested Implementation Order

1. Path abstraction (`PAI_CORE_DIR`, `PAI_RUNTIME_DIR`) everywhere.
2. Runtime profile schema + installer changes.
3. Canonical hook contract + Claude adapter refactor.
4. Gemini adapter implementation.
5. Observability schema update.
6. Pack verify/test matrix update.
7. Documentation cleanup and migration guide.

---

## Migration Plan for Existing Claude Users

1. Move shared assets from `~/.claude` to `~/.pai/core`.
2. Replace originals with symlinks from `~/.claude` to `~/.pai/core`.
3. Generate Gemini adapter at `~/.gemini` pointing to same core.
4. Run dual-runtime verify script.
5. Roll back by removing adapters and restoring backup if needed.

---

## Risks / Edge Cases

- Different hook timing semantics between runtimes can cause duplicate or missed events.
- Tool permission models may differ, requiring per-runtime policy translation.
- Shared-memory mode can create race conditions if both runtimes write simultaneously.
- Some packs may implicitly depend on Claude-only assumptions in undocumented scripts.

Mitigations:

- Add file locking or append-only journaling for shared writes.
- Preserve `provider_event_name` in logs for debugging adapter behavior.
- Keep adapter integration tests lightweight and mandatory in CI.

---

## Practical Bottom Line

To achieve your ideal state, PAI needs to evolve from "Claude-default install with platform-agnostic packs" into a formal **multi-runtime architecture**:

- one shared PAI core,
- one adapter per CLI runtime,
- one canonical hook contract,
- one observability pipeline with runtime attribution.

That will let Claude Code and Gemini feel like independent installs while still operating from the same infrastructure brain.
