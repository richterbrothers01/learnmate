/*
  cleanAiMathText — rewrites LaTeX-style maths in Doubt Clearer answers
  into plain, readable text.

  The AI sometimes answers maths questions in LaTeX ($x^2$, \frac{1}{2},
  \sqrt{3}), which the chat renders as raw text full of dollar signs and
  backslashes. This converts that notation to the symbols students expect
  (x², 1/2, √3) and strips the $ delimiters.

  Safety rails:
  - Fenced code blocks and `inline code` are left untouched.
  - A $...$ pair is only treated as maths when its content looks like
    maths, so currency in normal sentences ("costs $5 and $10") survives.
*/

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "n": "ⁿ", "x": "ˣ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
};

const SYMBOLS: Array<[string, string]> = [
  ["\\times", "×"], ["\\div", "÷"], ["\\pi", "π"], ["\\theta", "θ"],
  ["\\alpha", "α"], ["\\beta", "β"], ["\\gamma", "γ"], ["\\delta", "δ"],
  ["\\lambda", "λ"], ["\\infty", "∞"], ["\\leq", "≤"], ["\\geq", "≥"],
  ["\\neq", "≠"], ["\\approx", "≈"], ["\\pm", "±"], ["\\cdot", "·"],
  ["\\degree", "°"], ["\\rightarrow", "→"], ["\\leftarrow", "←"],
  ["\\Rightarrow", "⇒"], ["\\%", "%"],
];

function sups(s: string): string {
  return [...s].map((c) => SUPERSCRIPT[c] ?? c).join("");
}

function subs(s: string): string {
  return [...s].map((c) => SUBSCRIPT[c] ?? c).join("");
}

function wrapSide(s: string): string {
  return /[\s+\-*/=<>]/.test(s) || s.length > 3 ? `(${s})` : s;
}

/* Parse a balanced {...} group starting at index i (t[i] must be "{").
   Returns [innerContent, indexAfterGroup] or null when unbalanced. */
function parseGroup(t: string, i: number): [string, number] | null {
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === "{") depth++;
    else if (t[j] === "}") {
      depth--;
      if (depth === 0) return [t.slice(i + 1, j), j + 1];
    }
  }
  return null;
}

/* Handles \frac{a}{b} and \sqrt{a} with balanced braces; the group
   contents are cleaned recursively so nested commands resolve. */
function parseCommands(t: string): string {
  let out = "";
  let i = 0;
  while (i < t.length) {
    const rest = t.slice(i);
    const frac = rest.match(/^\\[dt]?frac\s*/);
    const sqrt = rest.match(/^\\sqrt\s*/);
    const cmdLen = frac ? frac[0].length : sqrt ? sqrt[0].length : 0;
    if (cmdLen > 0 && t[i + cmdLen] === "{") {
      const g1 = parseGroup(t, i + cmdLen);
      if (g1) {
        if (frac) {
          let j = g1[1];
          while (t[j] === " ") j++;
          if (t[j] === "{") {
            const g2 = parseGroup(t, j);
            if (g2) {
              out += `${wrapSide(cleanMathSegment(g1[0]))}/${wrapSide(cleanMathSegment(g2[0]))}`;
              i = g2[1];
              continue;
            }
          }
        } else {
          const inner = cleanMathSegment(g1[0]).trim();
          out += /^[a-zA-Z0-9.]+$/.test(inner) ? `√${inner}` : `√(${inner})`;
          i = g1[1];
          continue;
        }
      }
    }
    out += t[i];
    i++;
  }
  return out;
}

function cleanMathSegment(text: string): string {
  let t = text;

  // Display / inline LaTeX delimiters \[ \] \( \)
  t = t.replace(/\\\[/g, "").replace(/\\\]/g, "")
       .replace(/\\\(/g, "").replace(/\\\)/g, "");

  // $$...$$ display blocks
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, "$1");

  // $...$ pairs — only stripped when the content looks like maths,
  // so currency amounts in ordinary sentences are preserved.
  t = t.replace(/\$([^$\n]+?)\$/g, (m, inner: string) => {
    const s = inner.trim();
    const mathy =
      /\\|[\^_{}]/.test(inner) ||
      (/[a-zA-Z]/.test(inner) && /[+\-=×<>]/.test(inner)) ||
      /^\s*-?[\d.]+\s*$/.test(inner) ||
      /^[a-zA-Z]$/.test(s) ||
      /^[\d.]+[a-zA-Z]$/.test(s) ||
      /^\s*-?[\d.]+(\s*[+\-*/=]\s*-?[\d.]+)+\s*$/.test(inner);
    return mathy ? inner : m;
  });
  t = t.replace(/\$\$/g, "");

  // \frac / \sqrt with balanced braces
  t = parseCommands(t);
  t = t.replace(/\\sqrt\s+([a-zA-Z0-9])/g, "√$1");

  // \text{...} and friends keep just the words
  t = t.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, "$1");

  // Symbol commands
  for (const [cmd, sym] of SYMBOLS) t = t.split(cmd).join(sym);

  // Degrees
  t = t.replace(/\^\\circ\{\}/g, "°").replace(/\^\\circ/g, "°");

  // Superscripts: x^{10} -> x¹⁰, x^2 -> x², other ^{...} -> ^(...)
  t = t.replace(/\^\{([0-9+\-nx]+)\}/g, (_m, inner: string) => sups(inner));
  t = t.replace(/\^([0-9])/g, (_m, d: string) => SUPERSCRIPT[d]);
  t = t.replace(/\^\{([^{}]+)\}/g, "^($1)");

  // Subscripts: H_{2}O -> H₂O
  t = t.replace(/_\{([0-9]+)\}/g, (_m, inner: string) => subs(inner));
  t = t.replace(/_([0-9])/g, (_m, d: string) => SUBSCRIPT[d]);
  t = t.replace(/_\{([^{}]+)\}/g, "$1");

  // Leftover LaTeX spacing / sizing commands
  t = t.replace(/\\(?:left|right|big|Big|bigg|Bigg)\b/g, "");
  t = t.replace(/\\[,;:!]/g, "");
  t = t.replace(/\\\\/g, " ");

  // Any remaining \word commands keep just the word (\sin -> sin)
  t = t.replace(/\\([a-zA-Z]+)/g, "$1");

  // Stray braces
  t = t.replace(/[{}]/g, "");

  // Collapse repeated spaces (edges are left alone)
  t = t.replace(/[ \t]{2,}/g, " ");

  return t;
}

const FENCE = /^\s*```/;

export function cleanAiMathText(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let inFence = false;

  return lines
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      // Protect `inline code` spans; clean only the text around them.
      const parts = line.split(/(`[^`]*`)/g);
      return parts
        .map((part, idx) => (idx % 2 === 1 ? part : cleanMathSegment(part)))
        .join("");
    })
    .join("\n");
}
