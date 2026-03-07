// ──────────────────────────────────────────────────────────────
// JSON Repair Utility — Bulletproof LLM output parsing
// LLMs return garbage JSON constantly. This module does
// aggressive extraction and repair before throwing.
// ──────────────────────────────────────────────────────────────

/**
 * Attempts to parse a string as JSON with increasingly aggressive
 * repair strategies. Returns the parsed result or throws.
 */
export function robustJsonParse<T = unknown>(raw: string): T {
  // Strategy 1: Direct parse (the dream)
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Strategy 2: Strip markdown code fences
  let cleaned = raw
    .replace(/^```(?:json)?\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Strategy 3: Extract the first [...] block (arrays)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ }
    // Strategy 3b: Try repairing the extracted array
    const repaired = repairJson(arrayMatch[0]);
    try { return JSON.parse(repaired); } catch { /* continue */ }
  }

  // Strategy 4: Extract the first {...} block (objects)
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
    const repaired = repairJson(objMatch[0]);
    try { return JSON.parse(repaired); } catch { /* continue */ }
  }

  // Strategy 5: Full repair on the original cleaned string
  const fullRepair = repairJson(cleaned);
  try { return JSON.parse(fullRepair); } catch { /* continue */ }

  // Strategy 6: Try to salvage partial – find all complete objects in an array
  const partialArray = extractPartialArray(cleaned);
  if (partialArray.length > 0) {
    return partialArray as T;
  }

  throw new Error(`JSON repair failed — all strategies exhausted. First 200 chars: ${raw.substring(0, 200)}`);
}

/**
 * Common JSON fixes for LLM output:
 * - Trailing commas
 * - Single quotes → double quotes  
 * - Unquoted keys
 * - Control characters
 * - Missing closing brackets
 */
function repairJson(str: string): string {
  let s = str;

  // Remove BOM and zero-width chars
  s = s.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');

  // Remove control characters except newline/tab
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Fix single-quoted strings → double quotes (naive but effective for LLM output)
  // Only do this if there are no double-quoted strings already
  if (!s.includes('"') && s.includes("'")) {
    s = s.replace(/'/g, '"');
  }

  // Fix unquoted keys: { key: "value" } → { "key": "value" }
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, '$1');

  // Balance brackets
  const opens = (s.match(/\[/g) || []).length;
  const closes = (s.match(/\]/g) || []).length;
  if (opens > closes) {
    s += ']'.repeat(opens - closes);
  }

  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    // Insert missing close braces before the last ]
    const lastBracket = s.lastIndexOf(']');
    if (lastBracket > 0) {
      s = s.substring(0, lastBracket) + '}'.repeat(openBraces - closeBraces) + s.substring(lastBracket);
    } else {
      s += '}'.repeat(openBraces - closeBraces);
    }
  }

  return s;
}

/**
 * Last resort: find all individually parseable {...} objects 
 * inside what looks like an array and return them.
 */
function extractPartialArray(text: string): unknown[] {
  const results: unknown[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = text.substring(start, i + 1);
        try {
          const obj = JSON.parse(candidate);
          results.push(obj);
        } catch {
          // Try repairing this single object
          try {
            const repaired = repairJson(candidate);
            const obj = JSON.parse(repaired);
            results.push(obj);
          } catch { /* skip this object */ }
        }
        start = -1;
      }
    }
  }

  return results;
}
