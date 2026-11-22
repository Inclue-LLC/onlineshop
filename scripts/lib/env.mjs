// .env を読み込み、ストアごとの設定を返す（依存パッケージなし）。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadEnv(file = resolve(ROOT, '.env')) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).replace(/^\ufeff/, '').trim();
    // 前後の空白（全角スペース・改行・ゼロ幅文字を含む）と、引用符（" ' “ ” ‘ ’ 「 」）を取り除く
    let value = line
      .slice(eq + 1)
      .replace(/^[\s\u3000\u200b\ufeff]+|[\s\u3000\u200b\ufeff]+$/g, '')
      .replace(/^["'“”‘’「]+|["'“”‘’」]+$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** .env の STORES（例: hanul,funyu,mongmong）に並んだストアキー */
export function storeKeys() {
  return (process.env.STORES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ストアキー（hanul など）から設定を取得。変数名は <KEY大文字>_STORE など。 */
export function storeConfig(key) {
  const p = key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const store = process.env[`${p}_STORE`];
  if (!store) {
    throw new Error(`.env に ${p}_STORE がありません（例: ${p}_STORE=xxxx.myshopify.com）`);
  }
  return {
    key,
    store: store.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    adminToken: process.env[`${p}_ADMIN_TOKEN`] || '',
    clientId: process.env[`${p}_CLIENT_ID`] || '',
    clientSecret: process.env[`${p}_CLIENT_SECRET`] || '',
    themePassword: process.env[`${p}_THEME_PASSWORD`] || '',
    themeId: process.env[`${p}_THEME_ID`] || '',
  };
}

export function resolveStores(argKeys) {
  const keys = argKeys.length ? argKeys : storeKeys();
  if (!keys.length) throw new Error('対象ストアがありません。.env の STORES を設定するか、ストアキーを指定してください。');
  return keys.map(storeConfig);
}
