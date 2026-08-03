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
 * switch-icon.js - 构建前资源切换脚本
 *
 * 作用：
 *   1. 将 public/icons/<mode>/ 下的 icon.png / icon.ico 复制到 build/
 *   2. 将 public/installer-header.png（横向横幅）适配生成 164x314 的
 *      installerSidebar BMP（NSIS 欢迎页左侧大图，只支持 BMP）
 *   3. 将 public/installer-custom.nsh 复制到 build/
 *   4. 根据构建模式选择协议文件，写入带 UTF-8 BOM 的 license.txt
 *      （NSIS LicenseData 需要 BOM 才能正确显示中文）
 */
const { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { execFileSync } = require('child_process');
const { join } = require('path');

const mode = process.argv[2];
const validModes = ['dev', 'beta', 'run'];

if (!mode || !validModes.includes(mode)) {
  console.error(`Usage: node scripts/switch-icon.js <${validModes.join('|')}>`);
  process.exit(1);
}

const root = join(__dirname, '..');
const srcDir = join(root, 'public', 'icons', mode);
const buildDir = join(root, 'build');
const publicDir = join(root, 'public');

const png = join(srcDir, 'icon.png');
const ico = join(srcDir, 'icon.ico');
const installerHeader = join(publicDir, 'installer-header.png');
const nsisCustom = join(publicDir, 'installer-custom.nsh');
const licenseSrc = join(
  publicDir,
  mode === 'beta' ? 'protocol-beta.txt' : 'protocol-user.txt'
);

// 必选文件存在性检查
const requiredFiles = [
  { path: png, label: 'icon.png' },
  { path: ico, label: 'icon.ico' },
  { path: installerHeader, label: 'installer-header.png' },
  { path: nsisCustom, label: 'installer-custom.nsh' },
  { path: licenseSrc, label: 'license 协议文件' },
];
for (const file of requiredFiles) {
  if (!existsSync(file.path)) {
    console.error(`${file.label} not found: ${file.path}`);
    process.exit(1);
  }
}

/**
 * 将横向横幅 PNG 适配生成 NSIS 欢迎页左侧大图 BMP（164x314，24 位白底）。
 * 横幅等比缩放至宽度 164 并置于画布顶部居中，剩余区域填充白色。
 * 通过 PowerShell + System.Drawing 实现，无额外依赖。
 * @param {string} srcPng 源横幅 PNG 路径
 * @param {string} outBmp 输出 BMP 路径
 */
function createSidebarBmp(srcPng, outBmp) {
  // NSIS 欢迎/完成页左侧大图标准尺寸
  const SIDEBAR_W = 164;
  const SIDEBAR_H = 314;
  // 路径中的单引号需转义（PowerShell 单引号字符串内用两个单引号表示一个）
  const safeSrc = srcPng.replace(/'/g, "''");
  const safeOut = outBmp.replace(/'/g, "''");
  const script = `
    Add-Type -AssemblyName System.Drawing
    $src = [System.Drawing.Image]::FromFile('${safeSrc}')
    # 强制 24 位 RGB（NSIS 对 24 位 BMP 兼容性最好）
    $bmp = New-Object System.Drawing.Bitmap(${SIDEBAR_W}, ${SIDEBAR_H}, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    # 横幅等比缩放至画布宽度，置于顶部居中
    $scale = ${SIDEBAR_W} / $src.Width
    $drawH = [int][Math]::Round($src.Height * $scale)
    $drawW = ${SIDEBAR_W}
    $drawX = [int]((${SIDEBAR_W} - $drawW) / 2)
    $drawY = 0
    $g.DrawImage($src, $drawX, $drawY, $drawW, $drawH)
    $bmp.Save('${safeOut}', [System.Drawing.Imaging.ImageFormat]::Bmp)
    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()
  `;
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

/**
 * 读取协议文本并写入带 UTF-8 BOM 的 license.txt。
 * NSIS 的 LicenseData 只有带 BOM 才能按 UTF-8 解析，否则中文乱码。
 * @param {string} src 源协议文件
 * @param {string} out 输出 license.txt
 */
function writeLicenseWithBom(src, out) {
  let content = readFileSync(src, 'utf8');
  if (!content.startsWith('\uFEFF')) {
    content = '\uFEFF' + content;
  }
  writeFileSync(out, content, 'utf8');
}

mkdirSync(buildDir, { recursive: true });

// 1. 图标
cpSync(png, join(buildDir, 'icon.png'), { overwrite: true });
cpSync(ico, join(buildDir, 'icon.ico'), { overwrite: true });

// 2. 安装程序欢迎页左侧大图（installerSidebar，由横幅 PNG 适配生成）
createSidebarBmp(installerHeader, join(buildDir, 'installer-header.bmp'));

// 3. NSIS 自定义脚本
cpSync(nsisCustom, join(buildDir, 'installer-custom.nsh'), { overwrite: true });

// 4. 协议文件（带 UTF-8 BOM，防止中文乱码）
writeLicenseWithBom(licenseSrc, join(buildDir, 'license.txt'));

console.log(
  `[switch-icon] Mode: ${mode} → build/icon.png + build/icon.ico + build/installer-header.bmp (sidebar 164x314) + build/installer-custom.nsh + build/license.txt updated`
);
