import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Only add missing settings. Never overwrite the user's database credentials.
const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const path = new URL('../.env', import.meta.url);
let contents = existsSync(path) ? readFileSync(path, 'utf8') : '';
for (const line of template.split(/\r?\n/)) {
  if (!/^[A-Z_]+=/.test(line)) continue;
  const [key, ...parts] = line.split('=');
  const expression = new RegExp(`^${key}=(.*)$`, 'm');
  const previous = contents.match(expression);
  if (previous?.[1].trim()) continue;
  const value = ['INTERNAL_TOKEN', 'JWT_SECRET'].includes(key) ? randomBytes(32).toString('hex') : parts.join('=');
  if (previous) contents = contents.replace(expression, `${key}=${value}`);
  else contents += `\n${key}=${value}\n`;
}
writeFileSync(path, contents);
console.log('Local .env is ready. Existing values preserved; secrets are not printed.');
