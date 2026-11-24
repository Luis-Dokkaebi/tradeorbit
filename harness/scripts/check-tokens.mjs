// Sensor D-02: the UI uses no style value outside design/tokens.css.
import { join } from 'node:path';
import { ROOT, read, rel, report, walk } from './lib.mjs';

const RULES = [
  [/#[0-9a-fA-F]{3,8}\b(?![^'"]*%3E)/, 'color hexadecimal literal'],
  [/\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/, 'función de color literal'],
  [/font-family:\s*(?![\s]|var\()/, 'font-family fuera de tokens'],
  [/\b(?:bg|text|border|fill|stroke|from|to|via|ring|outline|shadow)-\[(?!var\()/, 'valor arbitrario de color en Tailwind'],
  [/style=\{\{/, 'estilo en línea (usar clases con tokens)'],
  [/\bshadow-(?:sm|md|lg|xl|2xl)\b|box-shadow:/, 'sombra (la dirección usa filetes)'],
  [/linear-gradient|radial-gradient|conic-gradient/, 'degradado (prohibido)'],
  [/font-style:\s*italic|\bitalic\b/, 'cursiva (prohibida en títulos)'],
];

const files = [...walk(join(ROOT, 'src'), /\.(tsx|css)$/)].filter((f) => !f.endsWith('.test.tsx'));
const problems = [];
for (const file of files) {
  read(file)
    .split('\n')
    .forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const [re, label] of RULES) if (re.test(line)) problems.push(`${rel(file)}:${i + 1}: ${label}`);
    });
}
report('check-tokens (D-02)', problems);
