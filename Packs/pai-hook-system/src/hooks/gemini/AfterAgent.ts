#!/usr/bin/env bun
/**
 * Gemini AfterAgent Adapter
 *
 * PURPOSE:
 * Adapts PAI's Stop hooks (Voice, Capture, TabState, SystemIntegrity) for Gemini CLI.
 * - Parses Gemini's prompt_response to extract structured data (Voice, Summary, etc.)
 * - Calls PAI handlers directly (bypassing StopOrchestrator's transcript reading).
 *
 * TRIGGER: AfterAgent (Gemini)
 */

import { join } from 'path';
import { getPaiDir } from '../lib/paths';
import { handleVoice } from '../handlers/voice';
import { handleCapture } from '../handlers/capture';
import { handleTabState } from '../handlers/tab-state';
import { handleSystemIntegrity } from '../handlers/SystemIntegrity';

// Define types locally to avoid complex relative imports
// These MUST match what handlers expect
interface StructuredResponse {
  summary?: string;
  analysis?: string;
  actions?: string;
  results?: string;
  status?: string;
  next?: string;
  completed?: string;
  date?: string;
}

interface ParsedTranscript {
  plainCompletion: string;
  voiceCompletion: string;
  fullResponse: string;
  lastMessage: string;
  structured: StructuredResponse;
}

// Helper to parse the response text into structured fields
function parseStructured(text: string): StructuredResponse {
    const struct: StructuredResponse = {};

    // Helper to extract sections like "📋 SUMMARY: ..."
    // Regex matches: Start of line, optional emoji/chars, KEY:, content, until next KEY: or End
    const extract = (key: string) => {
        // Match KEY: ... until next newline followed by a KEY-like pattern or end of string
        const regex = new RegExp(`(?:^|\\n)(?:[^\\n]{0,5})\\s*${key}:\\s*(.*?)(?:\\n(?:[^\\n]{0,5})\\s*[A-Z]+:|$)`, 'is');
        const match = text.match(regex);
        return match ? match[1].trim() : undefined;
    };

    struct.summary = extract('SUMMARY');
    struct.analysis = extract('ANALYSIS');
    struct.actions = extract('ACTIONS');
    struct.results = extract('RESULTS');
    struct.status = extract('STATUS');
    struct.next = extract('NEXT');

    return struct;
}

async function main() {
    try {
        // 1. Read Gemini input
        // Bun.stdin.json() might hang if stdin is empty, but Gemini always sends JSON
        const input = await Bun.stdin.json();
        const { prompt_response, session_id, transcript_path } = input;

        if (!prompt_response) {
            // No response to process
            console.log(JSON.stringify({}));
            return;
        }

        // 2. Extract Voice Completion (🗣️ line)
        const voiceMatch = prompt_response.match(/🗣️\s*(.*?)(\n|$)/);
        const voiceCompletion = voiceMatch ? voiceMatch[1].trim() : "";

        // 3. Parse Structured Data
        const structured = parseStructured(prompt_response);

        // 4. Construct ParsedTranscript object
        const parsed: ParsedTranscript = {
            plainCompletion: prompt_response, // Use full text as plain completion
            voiceCompletion,
            fullResponse: prompt_response,
            lastMessage: prompt_response, // Used by capture handler
            structured
        };

        // 5. Run PAI Handlers in parallel
        // We use Promise.allSettled to ensure one failure doesn't stop others
        await Promise.allSettled([
            handleVoice(parsed, session_id),
            // Pass a placeholder or the Gemini transcript path.
            // Note: Observability might expect Claude format if it reads it,
            // but handleCapture mostly uses 'parsed'.
            handleCapture(parsed, {
                session_id,
                transcript_path: transcript_path || "GEMINI_TRANSCRIPT_PATH",
                hook_event_name: "AfterAgent"
            }),
            handleTabState(parsed),
            handleSystemIntegrity(parsed, {
                session_id,
                transcript_path: transcript_path || "GEMINI_TRANSCRIPT_PATH",
                hook_event_name: "AfterAgent"
            })
        ]);

        // 6. Success - Continue
        console.log(JSON.stringify({}));

    } catch (e) {
        console.error("Error in Gemini AfterAgent adapter:", e);
        // Fail open
        console.log(JSON.stringify({}));
    }
}

main();
