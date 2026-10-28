/**
 * prettyMath — display-time prettifier for bank question text.
 *
 * The MCQ bank was authored as plain text, so maths arrived as
 * "cos(pi/3)", "sqrt(3)/2", "theta", "I^2Rt". Students read NCERT
 * symbols (π, √, θ, ²), so the test screen runs question text and
 * options through this function right before rendering.
 *
 * DISPLAY ONLY: it never changes stored values, selections, or
 * grading — comparisons still use the raw strings. It is deliberately
 * conservative: anything it does not recognise is left untouched, and
 * every rule below was checked against the actual bank text
 * (pi-mesons -> π-mesons is correct physics; "degrees of freedom" is
 * explicitly excluded from the degrees rule).
 */

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** sqrt(3)/2 -> √3/2; sqrt(2x+1) -> √(2x+1). Parens are balanced, so
 *  nested or malformed input is left alone rather than mangled. */
function replaceSqrt(text: string): string {
  let out = text;
  for (let pass = 0; pass < 10; pass++) {
    const at = out.search(/sqrt\s*\(/);
    if (at === -1) break;
    const open = out.indexOf("(", at);
    let depth = 0;
    let close = -1;
    for (let i = open; i < out.length; i++) {
      if (out[i] === "(") depth++;
      else if (out[i] === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) break; // Unbalanced: leave as-is.
    const inner = out.slice(open + 1, close);
    const simple = /^[0-9a-zA-Z.]+$/.test(inner);
    const replacement = simple ? `√${inner}` : `√(${inner})`;
    out = out.slice(0, at) + replacement + out.slice(close + 1);
  }
  // Bare "sqrt 3" (no parens) -> "√3".
  return out.replace(/sqrt\s+(\d+)/g, "√$1");
}

export function prettyMath(text: string): string {
  if (!text) return text;
  let out = text;
  out = replaceSqrt(out);
  out = out.replace(/(\d)pi\b/g, "$1π"); // 2pi -> 2π
  out = out.replace(/\bpi\b/g, "π"); // pi -> π
  out = out.replace(/\btheta\b/g, "θ").replace(/\bTheta\b/g, "Θ");
  out = out.replace(/\balpha\b/g, "α").replace(/\bAlpha\b/g, "Α");
  out = out.replace(/\bbeta\b/g, "β").replace(/\bBeta\b/g, "Β");
  out = out.replace(/\bgamma\b/g, "γ").replace(/\bGamma\b/g, "Γ");
  out = out.replace(/\binfinity\b/g, "∞");
  out = out.replace(/\^(\d)/g, (_, d: string) => SUPERSCRIPT[d] ?? d);
  out = out.replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠");
  // "r squared" -> "r²", "2 squared" -> "2²". Longer words ("the
  // squared term") are left alone — only single letters and numbers.
  out = out.replace(
    /\b([A-Za-z0-9]+) (squared|cubed)\b/g,
    (m, word: string, kind: string) => {
      if (word.length === 1 || /^\d+$/.test(word)) {
        return word + (kind === "squared" ? "²" : "³");
      }
      return m;
    },
  );
  // "60 degrees" -> "60°", but never "degrees of freedom".
  out = out.replace(/(\d+)\s+degrees?\b(?!\s+of freedom)/g, "$1°");
  return out;
}
