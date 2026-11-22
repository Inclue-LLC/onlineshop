#!/usr/bin/env node
/**
 * メタオブジェクト定義（POP UP／店舗／キャラクター）を各ストアに作成する。
 *
 *   node scripts/setup-metaobjects.mjs              # .env の STORES 全部
 *   node scripts/setup-metaobjects.mjs hanul        # 指定ストアのみ
 *   node scripts/setup-metaobjects.mjs --dry-run    # 変更内容の確認のみ
 *
 * - 定義は scripts/metaobject-definitions.json（3ストア共通）
 * - 既に定義がある場合は、足りないフィールドだけを追加する（既存フィールド・データは変更しない）
 * - ストアフロント（テーマ）から読めるよう access.storefront = PUBLIC_READ、
 *   下書き／公開を切り替えられるよう publishable を有効にする
 * - 必要な権限（アプリのスコープ）: read_metaobject_definitions, write_metaobject_definitions,
 *   read_metaobjects, write_metaobjects
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadEnv, resolveStores } from './lib/env.mjs';
import { API_VERSION, createClient, getAccessToken } from './lib/admin.mjs';

loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const storeArgs = args.filter((a) => !a.startsWith('--'));

const { definitions } = JSON.parse(readFileSync(resolve(ROOT, 'scripts/metaobject-definitions.json'), 'utf8'));

const Q_BY_TYPE = `#graphql
  query DefinitionByType($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      name
      access { storefront }
      capabilities { publishable { enabled } }
      fieldDefinitions { key name type { name } }
    }
  }`;

const M_CREATE = `#graphql
  mutation CreateDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }`;

const M_UPDATE = `#graphql
  mutation UpdateDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }`;

/** JSON の定義から API に渡すフィールド定義を作る（fallbackType を使う場合は useFallback=true） */
function toFieldInput(field, useFallback = false) {
  const input = {
    key: field.key,
    name: field.name,
    type: useFallback && field.fallbackType ? field.fallbackType : field.type,
  };
  if (field.description) input.description = field.description;
  if (field.required) input.required = true;
  if (field.validations?.length) input.validations = field.validations;
  return input;
}

const hasFallback = (fields) => fields.some((f) => f.fallbackType);
const isTypeError = (errors) => errors.some((e) => /type/i.test(e.message) || /type/i.test((e.field || []).join('.')));

async function createDefinition(gql, def, log) {
  const build = (useFallback) => ({
    type: def.type,
    name: def.name,
    description: def.description,
    displayNameKey: def.displayNameKey,
    access: { storefront: 'PUBLIC_READ' },
    capabilities: { publishable: { enabled: true } },
    fieldDefinitions: def.fieldDefinitions.map((f) => toFieldInput(f, useFallback)),
  });

  let data = await gql(M_CREATE, { definition: build(false) });
  let errors = data.metaobjectDefinitionCreate.userErrors;
  if (errors.length && hasFallback(def.fieldDefinitions) && isTypeError(errors)) {
    log(`  ! 一部のフィールド型が使えないため代替型で再試行します: ${errors.map((e) => e.message).join(' / ')}`);
    data = await gql(M_CREATE, { definition: build(true) });
    errors = data.metaobjectDefinitionCreate.userErrors;
  }
  if (errors.length) throw new Error(`${def.type} の作成に失敗: ${JSON.stringify(errors)}`);
  log(`  + 作成しました: ${def.type}（${def.fieldDefinitions.length} フィールド）`);
}

async function updateDefinition(gql, def, existing, log) {
  const existingKeys = new Set(existing.fieldDefinitions.map((f) => f.key));
  const missing = def.fieldDefinitions.filter((f) => !existingKeys.has(f.key));
  const needsAccess = existing.access?.storefront !== 'PUBLIC_READ';
  const needsPublishable = !existing.capabilities?.publishable?.enabled;

  // 型の違いは自動では直さない（データが壊れるため）。警告のみ。
  for (const f of def.fieldDefinitions) {
    const cur = existing.fieldDefinitions.find((e) => e.key === f.key);
    if (cur && cur.type.name !== f.type && cur.type.name !== f.fallbackType) {
      log(`  ! ${def.type}.${f.key} の型が異なります（ストア: ${cur.type.name} / 定義: ${f.type}）。管理画面で確認してください。`);
    }
  }

  if (!missing.length && !needsAccess && !needsPublishable) {
    log(`  = 変更なし: ${def.type}`);
    return;
  }
  const describe = [
    missing.length ? `フィールド追加: ${missing.map((f) => f.key).join(', ')}` : '',
    needsAccess ? 'ストアフロント読み取りを有効化' : '',
    needsPublishable ? '公開ステータスを有効化' : '',
  ].filter(Boolean);
  if (dryRun) {
    log(`  ~ 更新予定: ${def.type}（${describe.join(' / ')}）`);
    return;
  }

  const build = (useFallback) => {
    const definition = { fieldDefinitions: missing.map((f) => ({ create: toFieldInput(f, useFallback) })) };
    if (needsAccess) definition.access = { storefront: 'PUBLIC_READ' };
    if (needsPublishable) definition.capabilities = { publishable: { enabled: true } };
    return definition;
  };

  let data = await gql(M_UPDATE, { id: existing.id, definition: build(false) });
  let errors = data.metaobjectDefinitionUpdate.userErrors;
  if (errors.length && hasFallback(missing) && isTypeError(errors)) {
    log(`  ! 一部のフィールド型が使えないため代替型で再試行します: ${errors.map((e) => e.message).join(' / ')}`);
    data = await gql(M_UPDATE, { id: existing.id, definition: build(true) });
    errors = data.metaobjectDefinitionUpdate.userErrors;
  }
  if (errors.length) throw new Error(`${def.type} の更新に失敗: ${JSON.stringify(errors)}`);
  log(`  ~ 更新しました: ${def.type}（${describe.join(' / ')}）`);
}

async function run(cfg) {
  const log = (msg) => console.log(msg);
  log(`\n■ ${cfg.key}（${cfg.store} / API ${API_VERSION}）${dryRun ? ' [dry-run]' : ''}`);
  const token = await getAccessToken(cfg);
  const gql = createClient(cfg, token);

  for (const def of definitions) {
    const data = await gql(Q_BY_TYPE, { type: def.type });
    const existing = data.metaobjectDefinitionByType;
    if (!existing) {
      if (dryRun) log(`  + 作成予定: ${def.type}（${def.fieldDefinitions.length} フィールド）`);
      else await createDefinition(gql, def, log);
    } else {
      await updateDefinition(gql, def, existing, log);
    }
  }
}

let failed = false;
let stores = [];
try {
  stores = resolveStores(storeArgs);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
for (const cfg of stores) {
  try {
    await run(cfg);
  } catch (e) {
    failed = true;
    console.error(`  × ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
