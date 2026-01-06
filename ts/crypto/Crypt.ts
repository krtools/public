import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const MAGIC = Buffer.from('ENC1');

export function encryptFile(
  inPath: string,
  outPath: string,
  password: string
) {
  const salt = randomBytes(16);
  const iv = randomBytes(12); // GCM recommended
  const key = scryptSync(password, salt, 32);

  const data = readFileSync(inPath);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  writeFileSync(outPath, Buffer.concat([MAGIC, salt, iv, enc, tag]));
}

export function decryptFile(
  inPath: string,
  outPath: string,
  password: string
) {
  const buf = readFileSync(inPath);

  let off = 0;
  if (!buf.slice(0, 4).equals(MAGIC)) throw new Error('bad magic');
  off += 4;

  const salt = buf.slice(off, off += 16);
  const iv = buf.slice(off, off += 12);
  const tag = buf.slice(buf.length - 16);
  const data = buf.slice(off, buf.length - 16);

  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  writeFileSync(outPath, dec);
}
