'use strict';

function credentialDiagnostics(env) {
  return Object.fromEntries(['R2_ACCESS_KEY', 'R2_SECRET_KEY'].map(name => {
    const value = env[name] || '';
    return [name, { present: Boolean(value), whitespace: /\s/.test(value),
      nonAscii: /[^\x00-\x7f]/.test(value), controlCharacters: /[\x00-\x1f\x7f]/.test(value),
      validFormat: new RegExp(`^[a-fA-F0-9]{${name === 'R2_ACCESS_KEY' ? 32 : 64}}$`).test(value) }];
  }));
}

function r2Config(env) {
  const diagnostics = credentialDiagnostics(env);
  for (const [name, diagnostic] of Object.entries(diagnostics)) {
    if (!diagnostic.validFormat) throw new Error(`${name} 格式无效；请填写 R2 S3 凭据原值，不要包含说明文字、引号或空白。`);
  }
  for (const name of ['R2_ENDPOINT', 'R2_PUBLIC_URL']) {
    let url;
    try { url = new URL(env[name]); } catch { throw new Error(`${name} 必须是完整 HTTPS 地址`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || env[name] !== env[name].trim()) throw new Error(`${name} 必须是无凭据、查询参数和空白的 HTTPS 地址`);
  }
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(env.R2_BUCKET || '')) throw new Error('R2_BUCKET 格式无效');
  return { endpoint: env.R2_ENDPOINT.replace(/\/+$/, ''), bucket: env.R2_BUCKET,
    publicUrl: env.R2_PUBLIC_URL.replace(/\/+$/, ''),
    credentials: { accessKeyId: env.R2_ACCESS_KEY, secretAccessKey: env.R2_SECRET_KEY } };
}

module.exports = { credentialDiagnostics, r2Config };
