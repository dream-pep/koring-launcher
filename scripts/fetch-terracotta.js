//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

/**
 * fetch-terracotta.js - 构建期预取「陶瓦联机 Terracotta」二进制
 *
 * 背景：陶瓦联机采用「打包未修改二进制 + 仅通过官方 HTTP API 通信」的集成方式
 * （AGPLv3 + 例外条款允许）。二进制按上游发行版原样打包，不重编译、不打补丁。
 * 本脚本在构建前把上游 release 的 tar.gz 解包到 build/terracotta/，
 * 再由 electron-builder 的 extraResources 复制到 <resources>/terracotta。
 *
 * 用法：
 *   node scripts/fetch-terracotta.js [--force]
 *   环境变量：
 *     TERRACOTTA_VERSION  覆盖默认版本（默认 v0.4.2，可写 0.4.2 或 v0.4.2）
 *     TERRACOTTA_STRICT=1 下载/解包失败时退出码 1（默认只警告、退出 0，运行时仍可下载）
 *
 * 约定（见 plans/terracotta-integration.md 第 5、10 节）：
 *   - 版本经 GitHub API releases/tags/{tag} 解析 assets[].browser_download_url，
 *     不硬编码完整下载地址；
 *   - 资产命名 terracotta-{version}-{platform}-{arch}-pkg.tar.gz，平台映射见 ASSET_PLATFORM；
 *   - tar 解析用 Node 内置 zlib + 手写 512 字节头（不引入新依赖），
 *     跳过 pax / GNU 长名扩展头与目录项，拒绝 `..` 与绝对路径（防路径穿越）；
 *   - Windows 包内 VCRUNTIME140.DLL 必须与 exe 一起保留（缺 DLL 无法启动）；
 *   - 无论成功失败都创建 build/terracotta/（缺失会让 electron-builder 的
 *     extraResources 直接报错），失败时写 NOTICE.txt 说明；
 *   - 同时下载上游 LICENSE 到 build/terracotta/LICENSE（AGPL 再分发合规），
 *     已存在则不覆盖。
 *
 * ⚠️ build/ 已在 .gitignore 中，二进制与 LICENSE 都不入库。
 */
const https = require('https');
const zlib = require('zlib');
const { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } = require('fs');
const { join, dirname, resolve, sep } = require('path');

/** 默认版本（升级上游时改这里，并与 electron/core/terracotta.ts 的默认值保持一致） */
const DEFAULT_VERSION = 'v0.4.2';
const REPO = 'burningtnt/Terracotta';
/** 有效 exe 的最小体积（1MB）：小于它视为下载/解包不完整 */
const MIN_EXE_BYTES = 1024 * 1024;

/** Node platform/arch → 上游资产 platform-arch（契约第 5 节表格） */
const ASSET_PLATFORM = {
  'win32-x64': 'windows-x86_64',
  'win32-arm64': 'windows-arm64',
  'darwin-x64': 'macos-x86_64',
  'darwin-arm64': 'macos-arm64',
  'linux-x64': 'linux-x86_64',
  'linux-arm64': 'linux-arm64',
  'linux-loong64': 'linux-loongarch64',
  'linux-riscv64': 'linux-riscv64',
};

const root = join(__dirname, '..');
const outDir = join(root, 'build', 'terracotta');
const noticeFile = join(outDir, 'NOTICE.txt');
const licenseFile = join(outDir, 'LICENSE');
/** 默认失败不中断构建；CI 可开启严格模式 */
const STRICT = process.env.TERRACOTTA_STRICT === '1';
const force = process.argv.includes('--force');

const versionRaw = (process.env.TERRACOTTA_VERSION || DEFAULT_VERSION).trim();
/** GitHub tag：统一带 v 前缀（v0.4.2） */
const tag = /^v/i.test(versionRaw) ? versionRaw : `v${versionRaw}`;
/** 资产文件名里的版本号：不带 v（0.4.2） */
const assetVersion = tag.replace(/^v/i, '');

function log(message) {
  console.log(`[terracotta] ${message}`);
}

function warn(message) {
  console.warn(`[terracotta] ⚠️  ${message}`);
}

/** 失败路径：目录必须存在；写 NOTICE 供打包现场与用户排查（默认不中断构建） */
function fail(message) {
  warn(message);
  try {
    mkdirSync(outDir, { recursive: true });
    writeNotice(message);
  } catch (err) {
    warn(`写入 ${noticeFile} 失败：${err.message}`);
  }
  if (STRICT) {
    warn('TERRACOTTA_STRICT=1：以退出码 1 结束构建');
    process.exit(1);
  }
  log('已跳过陶瓦二进制预取，继续构建（运行时仍可在设置中下载安装）');
  process.exit(0);
}

function writeNotice(reason) {
  const lines = [
    '陶瓦联机（Terracotta）二进制未被预置到本次构建产物中。',
    '',
    `原因：${reason}`,
    '',
    '影响：安装包内不含 <resources>/terracotta，首次使用联机页时需在应用内下载',
    '（设置 → 陶瓦联机 → 下载并安装，或联机页「下载并安装」）。',
    '',
    '手动重试：',
    `  node scripts/fetch-terracotta.js --force`,
    `  pnpm fetch:terracotta`,
    '',
    `上游项目：https://github.com/${REPO}`,
    `授权协议：AGPLv3（上游允许打包未修改二进制）`,
    '',
  ];
  writeFileSync(noticeFile, lines.join('\n'), 'utf8');
}

function isSafeEntry(name) {
  if (!name) return false;
  // 反斜杠统一按分隔符处理（跨平台构建）
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return false; // 绝对路径
  if (/^[A-Za-z]:/.test(normalized)) return false; // Windows 盘符
  const parts = normalized.split('/').filter((p) => p !== '' && p !== '.');
  return parts.length > 0 && !parts.some((p) => p === '..');
}

/** 目录项 / pax / GNU 长名扩展头等非普通文件的 typeflag */
const TYPE_REGULAR = new Set(['0', '\0', '7']);
const TYPE_PAX = new Set(['x', 'g']);
const TYPE_LONG_NAME = new Set(['L']);
const TYPE_LONG_LINK = new Set(['K']);

function readString(buffer, offset, length) {
  const slice = buffer.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return (end === -1 ? slice : slice.subarray(0, end)).toString('utf8');
}

function readOctal(buffer, offset, length) {
  const text = readString(buffer, offset, length).trim();
  if (!text) return 0;
  const value = parseInt(text, 8);
  return Number.isFinite(value) ? value : 0;
}

/** 解析 pax 扩展头内容（形如 `30 path=xxx\n`），仅关心 path */
function parsePaxPath(buffer) {
  const fields = {};
  let offset = 0;
  while (offset < buffer.length) {
    const space = buffer.indexOf(0x20, offset);
    if (space === -1) break;
    const length = parseInt(buffer.subarray(offset, space).toString('ascii'), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const end = offset + length;
    if (end > buffer.length) break;
    const record = buffer.subarray(space + 1, end - 1).toString('utf8'); // 去掉末尾换行
    const eq = record.indexOf('=');
    if (eq > 0) fields[record.slice(0, eq)] = record.slice(eq + 1);
    offset = end;
  }
  return fields;
}

/**
 * 手写 tar 解析：只落普通文件，跳过目录项与 pax / GNU 长名扩展头。
 * 支持 ustar 前缀（prefix 字段）与 GNU 长名（typeflag L）、pax path。
 */
function extractTar(tarBuffer) {
  const files = [];
  let offset = 0;
  let pendingPath = null;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    // 全零块 = 归档结束标记
    if (header.every((byte) => byte === 0)) break;

    let name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    const data = tarBuffer.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (prefix) name = `${prefix}/${name}`;
    if (pendingPath) {
      name = pendingPath;
      pendingPath = null;
    }

    if (TYPE_PAX.has(typeflag)) {
      const pax = parsePaxPath(data);
      if (pax.path) pendingPath = pax.path;
      continue;
    }
    if (TYPE_LONG_NAME.has(typeflag)) {
      pendingPath = readString(data, 0, data.length);
      continue;
    }
    if (TYPE_LONG_LINK.has(typeflag)) continue;
    // 目录项 / 链接 / 设备节点等一律跳过（仅普通文件需要落盘）
    if (!TYPE_REGULAR.has(typeflag)) continue;

    if (!isSafeEntry(name)) {
      throw new Error(`tar 条目路径非法（含 .. 或绝对路径），已拒绝：${JSON.stringify(name)}`);
    }
    const segments = name.replace(/\\/g, '/').split('/').filter((p) => p !== '' && p !== '.');
    const dest = join(outDir, ...segments);
    // 二次校验：解析后的绝对路径必须仍在 build/terracotta/ 内
    if (!resolve(dest).startsWith(resolve(outDir) + sep)) {
      throw new Error(`tar 条目落盘路径越界，已拒绝：${JSON.stringify(name)}`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    files.push({ name, size: data.length });
  }

  if (files.length === 0) {
    throw new Error('tar 包中未解析到任何普通文件（格式可能已变更）');
  }
  return files;
}

/** 发起 GET，自动跟随重定向（GitHub release 下载会 302 到 objects.githubusercontent.com） */
function request(url, options = {}, redirects = 5) {
  const headers = Object.assign(
    {
      // GitHub API 要求带 User-Agent
      'User-Agent': 'koring-launcher-fetch-terracotta',
      Accept: 'application/vnd.github+json',
    },
    options.headers || {}
  );
  return new Promise((resolvePromise, rejectPromise) => {
    const req = https.get(url, { headers }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) {
          rejectPromise(new Error(`重定向次数过多：${url}`));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        resolvePromise(request(nextUrl, options, redirects - 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        rejectPromise(new Error(`HTTP ${status}：${url}`));
        return;
      }
      resolvePromise(res);
    });
    req.setTimeout(60000, () => req.destroy(new Error(`请求超时：${url}`)));
    req.on('error', rejectPromise);
  });
}

/** 读取响应体为字符串（JSON / 纯文本） */
async function fetchText(url, options) {
  const res = await request(url, options);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/** 下载到内存并打印进度百分比 */
async function downloadBuffer(url, label) {
  const res = await request(url, { headers: { Accept: '*/*' } });
  const total = Number(res.headers['content-length'] || 0);
  const chunks = [];
  let received = 0;
  let lastPercent = -1;
  for await (const chunk of res) {
    chunks.push(chunk);
    received += chunk.length;
    if (total > 0) {
      const percent = Math.min(100, Math.floor((received / total) * 100));
      // 每 5% 输出一次，避免刷屏；最后 100% 一定输出
      if (percent >= lastPercent + 5 || percent === 100) {
        lastPercent = percent;
        const receivedMb = (received / 1024 / 1024).toFixed(1);
        const totalMb = (total / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r[terracotta] ${label}：${percent}% (${receivedMb} MB / ${totalMb} MB)`);
      }
    }
  }
  if (total > 0) process.stdout.write('\n');
  return Buffer.concat(chunks);
}

/** 通过 GitHub API 解析当前平台对应的 tar.gz 资产地址 */
async function resolveAsset(platformArch) {
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/tags/${tag}`;
  log(`解析 release：${tag}（${apiUrl}）`);
  let release;
  try {
    release = JSON.parse(await fetchText(apiUrl));
  } catch (err) {
    throw new Error(`获取 GitHub release 失败（${tag}）：${err.message}`);
  }
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (assets.length === 0) throw new Error(`release ${tag} 中没有资产`);
  const names = assets.map((asset) => asset.name);
  if (release.message && names.length === 0) throw new Error(`release ${tag} 不可用：${release.message}`);

  const expected = `terracotta-${assetVersion}-${platformArch}-pkg.tar.gz`;
  const exact = assets.find((asset) => asset.name === expected);
  if (exact && exact.browser_download_url) return { asset: exact, expected };
  // 兜底：上游命名若微调（例如平台串变化），仍按前缀/后缀匹配，避免构建直接炸掉
  const fuzzy = assets.find(
    (asset) =>
      typeof asset.name === 'string' &&
      asset.name.endsWith('-pkg.tar.gz') &&
      asset.name.includes(`-${platformArch}-`)
  );
  if (fuzzy && fuzzy.browser_download_url) {
    warn(`未找到资产 ${expected}，改用 ${fuzzy.name}`);
    return { asset: fuzzy, expected };
  }
  throw new Error(
    `release ${tag} 中未找到 ${expected}；可用资产：${names.filter((n) => n.endsWith('.tar.gz')).join(', ') || '无'}`
  );
}

/** LICENSE：优先取 tag 对应的源文件，失败再退回默认分支；已存在不覆盖 */
async function ensureLicense() {
  if (existsSync(licenseFile) && statSync(licenseFile).size > 0) {
    log(`LICENSE 已存在，跳过：${licenseFile}`);
    return;
  }
  const candidates = [
    `https://raw.githubusercontent.com/${REPO}/${tag}/LICENSE`,
    `https://raw.githubusercontent.com/${REPO}/master/LICENSE`,
  ];
  let lastError = null;
  for (const url of candidates) {
    try {
      const text = await fetchText(url, { headers: { Accept: 'text/plain' } });
      if (!text || text.trim().length === 0) throw new Error('内容为空');
      writeFileSync(licenseFile, text, 'utf8');
      log(`LICENSE 已写入：${licenseFile}（来源 ${url}）`);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  // LICENSE 缺失不阻断构建（但会在 NOTICE 中提示）
  warn(`下载上游 LICENSE 失败：${lastError ? lastError.message : '未知错误'}；已有文件不被覆盖`);
}

/** 清理旧版本二进制（保留 LICENSE / NOTICE），避免升级后新旧 exe 混放 */
function cleanupOldBinaries() {
  if (!existsSync(outDir)) return;
  for (const name of readdirSync(outDir)) {
    if (/^terracotta-/i.test(name)) {
      rmSync(join(outDir, name), { force: true, recursive: true });
    }
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function listOutputs() {
  if (!existsSync(outDir)) return;
  const names = readdirSync(outDir).sort();
  log(`产物目录 ${outDir}：`);
  for (const name of names) {
    const stat = statSync(join(outDir, name));
    log(`  - ${name} (${formatBytes(stat.size)})`);
  }
}

async function main() {
  // 铁律：无论后续成功与否，目录都必须先存在（extraResources 找不到目录会直接报错）
  mkdirSync(outDir, { recursive: true });

  const platformArch = ASSET_PLATFORM[`${process.platform}-${process.arch}`];
  if (!platformArch) {
    // 不支持的平台：警告 + NOTICE + 退出 0（契约第 5 节）
    limitNoticeUnsupported();
    return;
  }

  const exeName =
    process.platform === 'win32'
      ? `terracotta-${assetVersion}-${platformArch}.exe`
      : `terracotta-${assetVersion}-${platformArch}`;
  const exePath = join(outDir, exeName);

  // 幂等：目标 exe 已存在且体积有效，未加 --force 直接跳过
  if (!force && existsSync(exePath) && statSync(exePath).size > MIN_EXE_BYTES) {
    log(`已存在有效二进制，跳过下载：${exePath}（${formatBytes(statSync(exePath).size)}）`);
    log('如需强制重新下载，追加 --force');
    await ensureLicense();
    listOutputs();
    return;
  }

  const { asset } = await resolveAsset(platformArch);
  const sizeText = typeof asset.size === 'number' ? `（${formatBytes(asset.size)}）` : '';
  log(`目标平台 ${process.platform}-${process.arch} → ${platformArch}`);
  log(`下载 ${asset.name}${sizeText}`);

  const startedAt = Date.now();
  const archive = await downloadBuffer(asset.browser_download_url, '下载中');
  if (archive.length === 0) throw new Error('下载内容为空');
  log(`下载完成：${formatBytes(archive.length)}，耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  cleanupOldBinaries();
  log('解包 tar.gz…');
  const files = extractTar(zlib.gunzipSync(archive));
  log(`解包完成，共 ${files.length} 个文件`);

  // 校验：主程序必须存在且 > 1MB（防止 302 到错误页面 / 解包不完整）
  if (!existsSync(exePath)) {
    const names = files.map((file) => file.name).join(', ');
    throw new Error(`解包后未找到期望的可执行文件 ${exeName}；已解出：${names}`);
  }
  const exeSize = statSync(exePath).size;
  if (exeSize <= MIN_EXE_BYTES) {
    throw new Error(`可执行文件体积异常（${formatBytes(exeSize)} ≤ 1MB）：${exePath}`);
  }
  // Windows 依赖 VCRUNTIME140.DLL，缺失则无法启动
  if (process.platform === 'win32' && !existsSync(join(outDir, 'VCRUNTIME140.DLL'))) {
    throw new Error('Windows 包缺少 VCRUNTIME140.DLL（上游包结构可能已变更）');
  }

  await ensureLicense();
  // 成功时移除上次失败留下的 NOTICE，避免误导打包现场
  rmSync(noticeFile, { force: true });

  log(`完成：${exeName}（${formatBytes(exeSize)}），耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  listOutputs();
}

/** 不支持的平台：写 NOTICE 并退出 0（契约要求，严格模式也不改） */
function limitNoticeUnsupported() {
  const key = `${process.platform}-${process.arch}`;
  warn(`不支持的平台 ${key}：上游未提供对应 Terracotta 构建，跳过预取（运行时仍可手动指定二进制）`);
  writeNotice(`当前构建平台 ${key} 不受支持（上游未发布该平台资产）`);
  process.exit(0);
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
