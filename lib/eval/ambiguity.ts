/**
 * How often a coding agent said the prompt left it guessing.
 *
 * This is a prose signal, so it is counted over prose only. The agent is being
 * asked about a TypeScript/Next.js project and answers with code, and code is
 * full of words that look like hedging without being it: a `missingFields`
 * property, a `TBD` placeholder in a sample, an `unspecified` union member.
 * Counting those conflates "the agent wrote about ambiguity" with "the agent
 * wrote an identifier", and `ambiguityCount` is a number eval/README.md tells
 * you to act on by rewriting the distillation prompt.
 */
const AMBIGUITY_PATTERN =
  /\b(unclear|ambiguous|unspecified|missing|tbd|(?:need|require)(?:s|ed|d)?(?: to)? clarif)/g;

/**
 * Remove fenced code blocks and inline code spans.
 *
 * The unterminated-fence case is deliberate, not defensive padding: the agent
 * probe caps the response at 2048 tokens, so a reply that ends mid-example is
 * an ordinary outcome, and without this the whole truncated tail would be
 * scored as prose.
 */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // paired fences
    .replace(/```[\s\S]*$/, " ") // a fence left open by truncation
    .replace(/`[^`\n]*`/g, " "); // inline spans
}

export function countAmbiguitySignals(text: string): number {
  return (stripCode(text).toLowerCase().match(AMBIGUITY_PATTERN) ?? []).length;
}
