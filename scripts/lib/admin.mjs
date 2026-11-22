// Shopify Admin GraphQL API の最小クライアント（依存パッケージなし。Node 20 以上の fetch を使用）。
export const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-10';

/**
 * アクセストークンを取得する。
 *  - <KEY>_ADMIN_TOKEN があればそれを使う（管理画面で作成したカスタムアプリの shpat_ トークン）
 *  - なければ <KEY>_CLIENT_ID / <KEY>_CLIENT_SECRET でクライアントクレデンシャル方式で取得する
 *    （Dev Dashboard で作成し、ストアにインストールしたアプリ）
 */
export async function getAccessToken(cfg) {
  if (cfg.adminToken) return cfg.adminToken;
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error(`[${cfg.key}] ${cfg.key.toUpperCase()}_ADMIN_TOKEN または _CLIENT_ID / _CLIENT_SECRET を .env に設定してください。`);
  }
  const res = await fetch(`https://${cfg.store}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let hint = '';
    if (/client secret/i.test(text)) {
      hint = '\n    → クライアントシークレットが正しくありません。Dev Dashboard のアプリ設定から再度コピーしてください（ID と取り違えていないか、前後に空白や引用符が入っていないか）。';
    } else if (/client_id|client id/i.test(text)) {
      hint = '\n    → クライアントIDが正しくありません。';
    } else if (res.status === 400 || res.status === 401) {
      hint = '\n    → アプリがこのストアにインストールされているか、アプリとストアが同じ組織のものか確認してください。';
    }
    throw new Error(`[${cfg.key}] トークン取得に失敗しました（HTTP ${res.status}）: ${text.slice(0, 300)}${hint}`);
  }
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error(`[${cfg.key}] トークン取得の応答に access_token がありません: ${text.slice(0, 300)}`);
  return json.access_token;
}

export function createClient(cfg, token) {
  const endpoint = `https://${cfg.store}/admin/api/${API_VERSION}/graphql.json`;
  return async function graphql(query, variables = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 5) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`[${cfg.key}] Admin API HTTP ${res.status}: ${text.slice(0, 500)}`);
      const json = JSON.parse(text);
      const throttled = json.errors?.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && attempt < 5) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (json.errors?.length) {
        throw new Error(`[${cfg.key}] GraphQL エラー: ${JSON.stringify(json.errors, null, 2)}`);
      }
      return json.data;
    }
  };
}
