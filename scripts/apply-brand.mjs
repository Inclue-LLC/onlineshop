#!/usr/bin/env node
/**
 * ブランドの配色など（brands/<store>/settings.json）を、ストアのテーマ設定に反映する。
 *
 *   node scripts/apply-brand.mjs hanul             # 反映
 *   node scripts/apply-brand.mjs hanul --dry-run   # 変更内容の確認のみ
 *
 * 1. ストアのテーマ（<KEY>_THEME_ID）から config/settings_data.json を取得
 * 2. brands/<store>/settings.json の "settings" に書かれた項目だけを書き換える
 *    （ロゴ・テーマエディタで設定したその他の項目はそのまま残す）
 * 3. config/settings_data.json だけをテーマに送る
 *
 * 公開中のテーマには送らない（Shopify CLI が確認を求める）。対象テーマは .env の <KEY>_THEME_ID。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, loadEnv, resolveStores } from './lib/env.mjs';

loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const storeArgs = args.filter((a) => !a.startsWith('--'));
const shopifyBin = resolve(ROOT, 'node_modules/.bin', process.platform === 'win32' ? 'shopify.cmd' : 'shopify');

function shopify(cfg, cliArgs) {
  const env = { ...process.env };
  if (cfg.themePassword) env.SHOPIFY_CLI_THEME_TOKEN = cfg.themePassword;
  const result = spawnSync(shopifyBin, ['theme', ...cliArgs, '--store', cfg.store], {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.error) throw new Error(`Shopify CLI を起動できませんでした: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`shopify theme ${cliArgs[0]} が失敗しました（終了コード ${result.status}）`);
}

/** Shopify が settings_data.json の先頭に付けるコメントを除いて JSON として読む */
function parseSettingsData(text) {
  return JSON.parse(text.replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

function describe(value) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

async function run(cfg) {
  const brandFile = resolve(ROOT, 'brands', cfg.key, 'settings.json');
  if (!existsSync(brandFile)) throw new Error(`${brandFile} がありません`);
  const brand = JSON.parse(readFileSync(brandFile, 'utf8')).settings || {};
  if (!cfg.themeId) throw new Error(`.env に ${cfg.key.toUpperCase()}_THEME_ID を設定してください（反映先のテーマID）`);

  console.log(`\n■ ${cfg.key}（${cfg.store} / テーマ #${cfg.themeId}）${dryRun ? ' [dry-run]' : ''}`);

  const work = mkdtempSync(join(tmpdir(), 'brand-'));
  try {
    mkdirSync(join(work, 'config'), { recursive: true });
    shopify(cfg, ['pull', '--path', work, '--theme', cfg.themeId, '--only', 'config/settings_data.json', '--nodelete']);
    const file = join(work, 'config', 'settings_data.json');
    if (!existsSync(file)) throw new Error('テーマから config/settings_data.json を取得できませんでした');
    const data = parseSettingsData(readFileSync(file, 'utf8'));

    // current がプリセット名（文字列）のときは、そのプリセットの値を元に設定を作る
    if (typeof data.current === 'string') {
      data.current = JSON.parse(JSON.stringify(data.presets?.[data.current] || {}));
    }
    const current = data.current;
    const changes = [];

    for (const [key, value] of Object.entries(brand)) {
      if (key === 'color_schemes') {
        current.color_schemes ||= {};
        for (const [id, scheme] of Object.entries(value)) {
          const before = current.color_schemes[id]?.settings || {};
          const after = { ...before, ...scheme.settings };
          for (const [k, v] of Object.entries(scheme.settings)) {
            if (before[k] !== v) changes.push(`配色 ${id}.${k}: ${before[k] ?? '（未設定）'} → ${v}`);
          }
          current.color_schemes[id] = { ...(current.color_schemes[id] || {}), settings: after };
        }
      } else if (describe(current[key]) !== describe(value)) {
        changes.push(`${key}: ${current[key] ?? '（未設定）'} → ${describe(value)}`);
        current[key] = value;
      }
    }

    if (!changes.length) {
      console.log('  = 変更はありません');
      return;
    }
    changes.forEach((c) => console.log(`  ~ ${c}`));
    if (dryRun) return;

    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    shopify(cfg, ['push', '--path', work, '--theme', cfg.themeId, '--only', 'config/settings_data.json', '--nodelete']);
    console.log(`  ✔ ${changes.length} 項目を反映しました`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

let failed = false;
try {
  for (const cfg of resolveStores(storeArgs)) {
    try {
      await run(cfg);
    } catch (e) {
      failed = true;
      console.error(`  × ${e.message}`);
    }
  }
} catch (e) {
  console.error(e.message);
  failed = true;
}
process.exit(failed ? 1 : 0);
