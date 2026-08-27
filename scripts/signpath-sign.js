/**
 * SignPath 远程代码签名模块（electron-builder 自定义签名）
 *
 * 挂载方式：electron-builder.yml -> win.sign: scripts/signpath-sign.js
 *
 * electron-builder 在构建 Windows 产物时会对每个待签名文件调用本模块，
 * 本模块把文件提交到 SignPath 签名后，下载签名产物并原位覆盖。
 *
 * 实现与 SignPath 官方 PowerShell 模块（Submit-SigningRequest）对齐：
 *   POST {base}/v1/{orgId}/SigningRequests          multipart/form-data，响应 Location 头 = 请求 URL
 *   GET  {base}/v1/{orgId}/SigningRequests/{id}     轮询 status / isFinalStatus，完成后返回 signedArtifactLink
 *   GET  signedArtifactLink                         下载签名产物
 * 认证：Authorization: Bearer <API token>
 *
 * 环境变量（CI 中由 GitHub Secrets 注入；本地构建未设置时自动跳过签名）：
 *   SIGNPATH_API_TOKEN              必填（API Token）
 *   SIGNPATH_ORG_ID                 必填（SignPath 组织 ID）
 *   SIGNPATH_PROJECT_SLUG           可选，默认 Koring_Launcher
 *   SIGNPATH_SIGNING_POLICY_SLUG    签名策略 slug（必填，如 Koring_Launcher_Dev_builder）
 *   SIGNPATH_ARTIFACT_CONFIG_SLUG   产物配置 slug；项目只有一个配置时可省略
 *   SIGNPATH_API_BASE               可选，默认 https://app.signpath.io/api
 *
 * 说明：
 *  - 无 SIGNPATH_API_TOKEN / SIGNPATH_ORG_ID 时直接返回（不签名），
 *    因此本地 `pnpm dist:dev/beta/run` 行为与之前完全一致。
 *  - 签名发生在 electron-builder 生成 blockmap 与 latest.yml 之前，
 *    所以清单中的 sha512 自动对应签名后的安装包。
 *  - 参考文档：https://docs.signpath.io/build-system-integration
 */

'use strict';

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.SIGNPATH_API_BASE || 'https://app.signpath.io/api';
const PROJECT_SLUG = process.env.SIGNPATH_PROJECT_SLUG || 'Koring_Launcher';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 单文件签名最长等待 15 分钟

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function failWithDetail(res, ctx) {
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(`[signpath-sign] ${ctx} failed (${res.status}): ${detail}`);
}

async function signWithSignPath(filePath) {
  const token = process.env.SIGNPATH_API_TOKEN;
  const orgId = process.env.SIGNPATH_ORG_ID;
  const policySlug = process.env.SIGNPATH_SIGNING_POLICY_SLUG;
  const artifactSlug = process.env.SIGNPATH_ARTIFACT_CONFIG_SLUG;

  if (!policySlug) {
    throw new Error('[signpath-sign] SIGNPATH_SIGNING_POLICY_SLUG is required when signing is enabled');
  }

  const headers = { Authorization: `Bearer ${token}` };

  // 1. 提交签名请求（multipart/form-data，与官方 PowerShell 模块一致）
  const fileBuf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('ProjectSlug', PROJECT_SLUG);
  form.append('SigningPolicySlug', policySlug);
  if (artifactSlug) {
    form.append('ArtifactConfigurationSlug', artifactSlug);
  }
  form.append('Description', `electron-builder auto-sign: ${path.basename(filePath)}`);
  form.append('Artifact', new Blob([fileBuf]), path.basename(filePath));

  console.log(
    `[signpath-sign] submitting signing request: ${path.basename(filePath)} (${(fileBuf.length / 1024 / 1024).toFixed(1)} MB)`
  );
  const submitRes = await fetch(`${API_BASE}/v1/${orgId}/SigningRequests`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!submitRes.ok) {
    await failWithDetail(submitRes, 'submit');
  }
  const requestUrl = submitRes.headers.get('location');
  if (!requestUrl) {
    throw new Error('[signpath-sign] submit response has no Location header');
  }
  console.log(`[signpath-sign] request created: ${requestUrl}`);

  // 2. 轮询直到最终状态（isFinalStatus），要求 Completed
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let data = null;
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(requestUrl, { headers });
    if (!pollRes.ok) {
      await failWithDetail(pollRes, 'status query');
    }
    data = await pollRes.json();
    console.log(`[signpath-sign] status: ${data.status}${data.workflowStatus ? ` / ${data.workflowStatus}` : ''}`);
    if (data.isFinalStatus) break;
    if (Date.now() > deadline) {
      throw new Error('[signpath-sign] signing timed out');
    }
  }
  if (data.status !== 'Completed') {
    throw new Error(`[signpath-sign] request ${data.status}${data.workflowStatus ? ` / ${data.workflowStatus}` : ''}`);
  }

  // 3. 通过 signedArtifactLink 下载签名产物并原位覆盖（网络错误重试）
  const downloadUrl = data.signedArtifactLink;
  if (!downloadUrl) {
    throw new Error('[signpath-sign] completed request has no signedArtifactLink');
  }
  const signedBuf = await downloadWithRetry(downloadUrl, headers);
  const tmpPath = `${filePath}.signing.tmp`;
  fs.writeFileSync(tmpPath, signedBuf);
  fs.renameSync(tmpPath, filePath);
  console.log(`[signpath-sign] signed OK (${(signedBuf.length / 1024 / 1024).toFixed(1)} MB)`);
}

const DOWNLOAD_MAX_ATTEMPTS = 3;

async function downloadWithRetry(downloadUrl, headers) {
  let lastError = null;
  for (let attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      const dlRes = await fetch(downloadUrl, { headers });
      if (!dlRes.ok) {
        await failWithDetail(dlRes, 'download signed artifact');
      }
      return Buffer.from(await dlRes.arrayBuffer());
    } catch (err) {
      lastError = err;
      console.warn(`[signpath-sign] download attempt ${attempt}/${DOWNLOAD_MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < DOWNLOAD_MAX_ATTEMPTS) {
        await sleep(3000 * attempt);
      }
    }
  }
  throw lastError;
}

/**
 * electron-builder 自定义签名入口。
 * configuration.path 为待签名文件绝对路径；无 token 时跳过（本地开发构建）。
 */
module.exports = async function signPathSign(configuration) {
  if (!process.env.SIGNPATH_API_TOKEN || !process.env.SIGNPATH_ORG_ID) {
    console.log(`[signpath-sign] no SignPath credentials, skip signing: ${configuration.name}`);
    return;
  }
  await signWithSignPath(configuration.path);
};
