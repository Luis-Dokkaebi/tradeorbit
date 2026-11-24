// Sensor NFR-05 / principle 5: no API keys, private keys or wallet secrets in client code or built assets.
import { join } from 'node:path';
import { ROOT, read, rel, report, walk } from './lib.mjs';

const PATTERNS = [
  [/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/, 'clave tipo sk-'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'llave privada PEM'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT embebido'],
  [/service_role/i, 'referencia a service_role de Supabase'],
  [/ghp_[A-Za-z0-9]{36}/, 'token de GitHub'],
  [/\b(?:mnemonic|seed phrase|private_key|privateKey)\b\s*[:=]/i, 'secreto de wallet'],
  [/\b0x[a-fA-F0-9]{64}\b/, 'posible llave privada hexadecimal'],
];

const targets = [
  ...walk(join(ROOT, 'src'), /\.(ts|tsx|json|css)$/),
  ...walk(join(ROOT, 'dist'), /\.(js|html|css)$/),
  ...walk(join(ROOT, 'supabase'), /\.sql$/).filter((f) => !f.endsWith('.sql') || !f.includes('tests')),
  join(ROOT, 'index.html'),
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
