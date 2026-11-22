#!/usr/bin/env node
/**
 * .env の認証情報を、値そのものは表示せずに確認する。
 *   node scripts/check-env.mjs [store]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadEnv, resolveStores } from './lib/env.mjs';

const file = resolve(ROOT, '.env');
if (!existsSync(file)) {
  console.log('.env がありません。');
  process.exit(1);
}
const raw = readFileSync(file, 'utf8');
loadEnv(file);

const mask = (v) => (v ? `長さ ${v.length}文字・先頭「${v.slice(0, 6)}」` : '未設定');
const odd = (key) => {
  const line = raw.split(/\r?\n/).find((l) => l.replace(/^﻿/, '').trim().startsWith(`${key}=`));
  if (!line) return '';
  const value = line.slice(line.indexOf('=') + 1);
  const notes = [];
  if (/^\s|\s$/.test(value)) notes.push('前後に空白あり（自動で除去）');
  if (/["'“”‘’「」]/.test(value)) notes.push('引用符あり（前後のものは自動で除去）');
  if (/[^\x21-\x7e\s"'“”‘’「」]/.test(value)) notes.push('★英数字・記号以外の文字が含まれています（全角文字など）');
  return notes.length ? `  ← ${notes.join(' / ')}` : '';
};

for (const cfg of resolveStores(process.argv.slice(2))) {
  const p = cfg.key.toUpperCase();
  console.log(`■ ${cfg.key}`);
  console.log(`  ${p}_STORE         : ${cfg.store}`);
  console.log(`  ${p}_THEME_ID      : ${cfg.themeId || '未設定'}`);
  console.log(`  ${p}_ADMIN_TOKEN   : ${mask(cfg.adminToken)}${odd(`${p}_ADMIN_TOKEN`)}`);
  console.log(`  ${p}_CLIENT_ID     : ${mask(cfg.clientId)}${odd(`${p}_CLIENT_ID`)}`);
  console.log(`  ${p}_CLIENT_SECRET : ${mask(cfg.clientSecret)}${odd(`${p}_CLIENT_SECRET`)}`);
  if (cfg.clientId && cfg.clientSecret && cfg.clientId === cfg.clientSecret) {
    console.log('  ★ CLIENT_ID と CLIENT_SECRET が同じ値です。シークレットを貼り直してください。');
  }
  if (cfg.clientSecret && !cfg.clientSecret.startsWith('shpss_')) {
    console.log('  ※ クライアントシークレットは通常「shpss_」で始まります。IDと取り違えていないか確認してください。');
  }
}
