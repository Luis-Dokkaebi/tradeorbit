// Sensor NFR-05 / principle 5: no API keys, private keys or wallet secrets in client code or built assets.
import { join } from 'node:path';
import { ROOT, read, rel, report, walk } from './lib.mjs';

const PATTERNS = [
  [/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/, 'clave tipo sk-'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'llave privada PEM'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT embebido'],
  [/service_role/i, 'referencia a service_role de Supabase'],
  [/gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}/, 'token de GitHub'],
  [/AIza[0-9A-Za-z_-]{35}/, 'clave de Google'],
  [/xox[abpr]-[A-Za-z0-9-]{10,}/, 'token de Slack'],
  [/sk_live_[0-9a-zA-Z]{20,}/, 'clave de Stripe'],
  [/\b(?:mnemonic|seed phrase|private_key|privateKey)\b\s*[:=]/i, 'secreto de wallet'],
  [/\b0x[a-fA-F0-9]{64}\b/, 'posible llave privada hexadecimal'],
];

const targets = [
  ...['src', 'e2e', 'harness', 'specs', 'design', 'supabase', 'public', '.githooks'].flatMap((d) => walk(join(ROOT, d), /\.(ts|tsx|js|mjs|json|css|sql|md|sh|html)$|^pre-commit$/)),
  ...walk(join(ROOT, 'dist'), /\.(js|html|css)$/),
  ...['index.html', 'package.json', 'vite.config.ts', 'playwright.config.ts', 'tailwind.config.ts', 'init.sh', 'CLAUDE.md', 'feature_list.json'].map((f) => join(ROOT, f)),
];

const problems = [];
for (const file of targets) {
  let text = '';
  try {
    text = read(file);
  } catch {
    continue;
  }
  if (file.endsWith('check-secrets.mjs')) continue;
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) problems.push(`${rel(file)}: ${label}`);
  }
}
report('check-secrets (NFR-05)', problems);
