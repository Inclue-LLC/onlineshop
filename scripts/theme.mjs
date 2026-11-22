#!/usr/bin/env node
/**
 * Shopify CLI のテーマコマンドを、.env のストア設定で実行するラッパー。
 *
 *   node scripts/theme.mjs dev [store]           # ローカル確認（shopify theme dev）
 *   node scripts/theme.mjs push [store...]       # 反映（管理画面の設定を上書きしない）
 *   node scripts/theme.mjs push-initial [store]  # 初回のみ：新しい非公開テーマとして全ファイルをアップロード
 *   node scripts/theme.mjs pull [store]          # 管理画面で変更した設定（JSON）を取得
 *   node scripts/theme.mjs list [store]          # ストアのテーマ一覧
 *
 * store を省略すると .env の STORES の先頭（dev/pull/list）または全ストア（push）。
 * 追加の引数は -- の後ろに書くと Shopify CLI にそのまま渡される。
 *   例: node scripts/theme.mjs push hanul -- --theme 123456789 --allow-live
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, loadEnv, resolveStores, storeKeys } from './lib/env.mjs';

loadEnv();

/** 反映時に除外するファイル（テーマエディタ・管理画面で編集される内容） */
export const PUSH_IGNORES = [
  'config/settings_data.json', // テーマ設定（色・ロゴ・フォントなど）
  'templates/*.json', // 各ページのセクション構成・設定
  'templates/customers/*.json',
  'sections/*-group.json', // ヘッダー・フッターのセクション構成・設定
];

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const own = sep >= 0 ? argv.slice(0, sep) : argv;
const passthrough = sep >= 0 ? argv.slice(sep + 1) : [];
const [command, ...storeArgs] = own;

const THEME_PATH = resolve(ROOT, 'theme');
const shopifyBin = resolve(ROOT, 'node_modules/.bin', process.platform === 'win32' ? 'shopify.cmd' : 'shopify');

function shopify(cfg, args) {
  const env = { ...process.env };
  if (cfg.themePassword) env.SHOPIFY_CLI_THEME_TOKEN = cfg.themePassword;
  const full = ['theme', ...args, '--path', THEME_PATH, '--store', cfg.store, ...passthrough];
  console.log(`\n■ ${cfg.key}: shopify ${full.join(' ')}`);
  const result = spawnSync(shopifyBin, full, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.error) {
    console.error('Shopify CLI を起動できませんでした。先に npm install を実行してください。', result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

const ignoreArgs = PUSH_IGNORES.flatMap((pattern) => ['--ignore', pattern]);
const themeArgs = (cfg) => (cfg.themeId && !passthrough.includes('--theme') ? ['--theme', cfg.themeId] : []);
const first = () => resolveStores(storeArgs.length ? storeArgs.slice(0, 1) : storeKeys().slice(0, 1))[0];

let status = 0;
try {
switch (command) {
  case 'dev': {
    const cfg = first();
    status = shopify(cfg, ['dev']);
    break;
  }
  case 'push': {
    for (const cfg of resolveStores(storeArgs)) {
      status ||= shopify(cfg, ['push', ...themeArgs(cfg), ...ignoreArgs]);
    }
    break;
  }
  case 'push-initial': {
    const cfg = first();
    status = shopify(cfg, ['push', '--unpublished', '--theme', `Character Shop ${new Date().toISOString().slice(0, 10)}`]);
    break;
  }
  case 'pull': {
    const cfg = first();
    status = shopify(cfg, ['pull', ...themeArgs(cfg), '--only', 'config/settings_data.json', '--only', 'templates/*.json', '--only', 'sections/*-group.json']);
    break;
  }
  case 'list': {
    const cfg = first();
    const env = { ...process.env };
    if (cfg.themePassword) env.SHOPIFY_CLI_THEME_TOKEN = cfg.themePassword;
    status = spawnSync(shopifyBin, ['theme', 'list', '--store', cfg.store, ...passthrough], { stdio: 'inherit', env, shell: process.platform === 'win32' }).status ?? 1;
    break;
  }
  default:
    console.log('使い方: node scripts/theme.mjs <dev|push|push-initial|pull|list> [store...] [-- Shopify CLI の追加引数]');
    status = command ? 1 : 0;
}
} catch (e) {
  console.error(e.message);
  status = 1;
}
process.exit(status);
