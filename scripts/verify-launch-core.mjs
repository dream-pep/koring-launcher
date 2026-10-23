/**
 * 纯逻辑冒烟脚本：验证 electron/core 下的启动目标解析、目录识别、下载选项。
 * 这些模块不依赖 electron / @xmcl，因此可以直接在纯 node 下 require electron-dist 产物。
 *
 * 用法：node scripts/verify-launch-core.mjs
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name + (extra ? ` → ${extra}` : ''));
    console.log(`  FAIL ${name}${extra ? ` → ${extra}` : ''}`);
  }
}

function load() {
  const targets = [
    'core/version-scan.js',
    'core/launch-target.js',
    'core/game-folder.js',
    'core/download-options.js',
  ];
  const loaded = {};
  for (const target of targets) {
    const file = path.join(root, 'electron-dist', target);
    if (!fs.existsSync(file)) {
      console.error(`缺少编译产物：${file}\n请先运行：npx tsc -p tsconfig.electron.json`);
      process.exit(2);
    }
    loaded[path.basename(target, '.js')] = require(file);
  }
  return loaded;
}

const mods = load();
const versionScan = mods['version-scan'];
const launchTarget = mods['launch-target'];
const gameFolder = mods['game-folder'];
const downloadOptions = mods['download-options'];

// ==================== 夹具 ====================
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'koring-verify-'));
const gameRoot = path.join(tmpRoot, 'game');
const instancePath = path.join(gameRoot, 'instances', 'Demo');
const versionsDir = path.join(gameRoot, 'versions');

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function buildFixture() {
  write(path.join(gameRoot, 'Koring.yml'), 'game:\n  gameDir: .minecraft\n');
  write(path.join(instancePath, 'instance.json'), {
    name: 'Demo',
    runtime: { minecraft: '1.20.1', forge: '47.2.0' },
    creationDate: 0,
    lastAccessDate: 0,
    lastPlayedDate: 0,
    playtime: 0,
  });

  const baseJson = {
    id: '1.20.1',
    type: 'release',
    releaseTime: '2023-06-12T13:25:51+00:00',
    downloads: { client: { url: 'https://piston-data.mojang.com/x.jar' } },
    assetIndex: { id: '5' },
    libraries: [
      {
        name: 'com.example:lib:1.0',
        downloads: { artifact: { path: 'com/example/lib/1.0/lib-1.0.jar' } },
      },
      {
        name: 'org.lwjgl:lwjgl:3.3.1:natives-windows',
        rules: [{ action: 'allow', os: { name: 'windows' } }],
        downloads: { artifact: { path: 'org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-windows.jar' } },
      },
      {
        name: 'ca.weblite:java-objc-bridge:1.1',
        rules: [{ action: 'allow', os: { name: 'osx' } }],
        downloads: { artifact: { path: 'ca/weblite/java-objc-bridge/1.1/java-objc-bridge-1.1.jar' } },
      },
    ],
  };
  write(path.join(versionsDir, '1.20.1', '1.20.1.json'), baseJson);
  write(path.join(versionsDir, '1.20.1', '1.20.1.jar'), 'jar');

  write(path.join(versionsDir, '1.20.1-forge-47.2.0', '1.20.1-forge-47.2.0.json'), {
    id: '1.20.1-forge-47.2.0',
    inheritsFrom: '1.20.1',
    releaseTime: '2023-07-01T00:00:00+00:00',
    libraries: [{ name: 'net.minecraftforge:forge:1.20.1-47.2.0' }],
  });

  write(path.join(gameRoot, 'libraries', 'com', 'example', 'lib', '1.0', 'lib-1.0.jar'), 'lib');
  write(
    path.join(gameRoot, 'libraries', 'net', 'minecraftforge', 'forge', '1.20.1-47.2.0', 'forge-1.20.1-47.2.0.jar'),
    'forge'
  );
  write(
    path.join(gameRoot, 'libraries', 'org', 'lwjgl', 'lwjgl', '3.3.1', 'lwjgl-3.3.1-natives-windows.jar'),
    'native'
  );
  write(path.join(gameRoot, 'assets', 'indexes', '5.json'), { objects: {} });
}

console.log(`夹具目录：${tmpRoot}`);
buildFixture();

// ==================== version-scan ====================
console.log('\nversion-scan');
const chain = versionScan.readVersionChain(versionsDir, '1.20.1-forge-47.2.0');
check('继承链解析', chain.chain.join('>') === '1.20.1-forge-47.2.0>1.20.1', chain.chain.join('>'));
check('链根为原版 id', chain.rootId === '1.20.1', chain.rootId);
check('提取 Forge 版本', chain.loaders.forge === '1.20.1-47.2.0', String(chain.loaders.forge));
check('无告警', chain.warnings.length === 0, chain.warnings.join('；'));
check('循环继承被拦截', (() => {
  const edgeVersions = path.join(tmpRoot, 'edge', 'versions');
  write(path.join(edgeVersions, 'loop-a', 'loop-a.json'), { id: 'loop-a', inheritsFrom: 'loop-b' });
  write(path.join(edgeVersions, 'loop-b', 'loop-b.json'), { id: 'loop-b', inheritsFrom: 'loop-a' });
  const loop = versionScan.readVersionChain(edgeVersions, 'loop-a');
  return loop.warnings.some((w) => w.includes('循环'));
})());
check('id 与目录名不一致会告警', (() => {
  const edgeVersions = path.join(tmpRoot, 'edge', 'versions');
  write(path.join(edgeVersions, 'mismatch', 'mismatch.json'), { id: 'other', downloads: {} });
  return versionScan.readVersionChain(edgeVersions, 'mismatch').warnings.some((w) => w.includes('不一致'));
})());
check('版本 JSON 缺失会告警', (() => {
  const edgeVersions = path.join(tmpRoot, 'edge', 'versions');
  fs.mkdirSync(path.join(edgeVersions, 'broken'), { recursive: true });
  return versionScan.readVersionChain(edgeVersions, 'broken').warnings.some((w) => w.includes('缺失'));
})());
const scanned = versionScan.scanGameDirectories(gameRoot);
check('扫描到 2 个版本目录', scanned.length === 2, String(scanned.length));
check('Forge 版本被标记 loader', scanned.find((v) => v.id === '1.20.1-forge-47.2.0')?.loaders.includes('forge') === true);

// ==================== launch-target ====================
console.log('\nlaunch-target');
const rootsShared = launchTarget.resolveLaunchRoots({
  instancePath,
  runtime: { minecraft: '1.20.1', forge: '47.2.0' },
  sharedResourceDir: path.join(tmpRoot, 'shared'),
});
check('实例自带 versions 时使用实例目录', rootsShared.source === 'instance', rootsShared.source);

const bareInstance = path.join(tmpRoot, 'bare-instance');
fs.mkdirSync(bareInstance, { recursive: true });
const rootsFallback = launchTarget.resolveLaunchRoots({
  instancePath: bareInstance,
  runtime: { minecraft: '1.20.1' },
  sharedResourceDir: gameRoot,
});
check('实例缺 versions 时回退共享资源目录', rootsFallback.resourceRoot === path.resolve(gameRoot), rootsFallback.resourceRoot);

const rootsCustom = launchTarget.resolveLaunchRoots({
  instancePath: bareInstance,
  runtime: { minecraft: '1.20.1' },
  resourcePath: gameRoot,
});
check('实例自定义 resourcePath 生效', rootsCustom.source === 'instance-custom', rootsCustom.source);

const resolvedForge = launchTarget.resolveLaunchVersionId(versionsDir, { minecraft: '1.20.1', forge: '47.2.0' });
check('按加载器挑出 Forge 版本', resolvedForge.id === '1.20.1-forge-47.2.0', resolvedForge.id);
check('via=loader', resolvedForge.via === 'loader', resolvedForge.via);

const resolvedPreferred = launchTarget.resolveLaunchVersionId(
  versionsDir,
  { minecraft: '1.20.1', forge: '47.2.0' },
  '1.20.1-forge-47.2.0'
);
check('显式指定版本优先', resolvedPreferred.via === 'configured', resolvedPreferred.via);

const resolvedBase = launchTarget.resolveLaunchVersionId(versionsDir, { minecraft: '1.20.1' });
check('无加载器时用原版 id', resolvedBase.id === '1.20.1' && resolvedBase.via === 'base', `${resolvedBase.id}/${resolvedBase.via}`);

const resolvedWrongLoader = launchTarget.resolveLaunchVersionId(versionsDir, { minecraft: '1.20.1', forge: '99.0.0' });
check('加载器版本对不上时回退并告警', resolvedWrongLoader.id === '1.20.1' && resolvedWrongLoader.warnings.length > 0, resolvedWrongLoader.id);

let missingThrew = false;
try {
  launchTarget.resolveLaunchVersionId(versionsDir, { minecraft: '1.19.4' });
} catch (error) {
  missingThrew = error instanceof launchTarget.LaunchError && error.code === 'LAUNCH_VERSION_NOT_FOUND';
}
check('缺版本抛出 LAUNCH_VERSION_NOT_FOUND', missingThrew);

check('maven 坐标转路径', launchTarget.mavenRelativePath('net.minecraftforge:forge:1.20.1-47.2.0') === 'net/minecraftforge/forge/1.20.1-47.2.0/forge-1.20.1-47.2.0.jar', String(launchTarget.mavenRelativePath('net.minecraftforge:forge:1.20.1-47.2.0')));

const reportReady = launchTarget.checkDependencies(gameRoot, '1.20.1-forge-47.2.0');
check('依赖体检通过', reportReady.ready === true, JSON.stringify(reportReady));
check('仅检查当前平台可见的库', reportReady.missingLibraries.length === 0, reportReady.missingLibraries.join(','));

fs.rmSync(path.join(gameRoot, 'libraries', 'com', 'example', 'lib', '1.0', 'lib-1.0.jar'));
const reportMissing = launchTarget.checkDependencies(gameRoot, '1.20.1-forge-47.2.0');
check('缺库被检出', reportMissing.ready === false && reportMissing.missingLibraries.includes('com/example/lib/1.0/lib-1.0.jar'), JSON.stringify(reportMissing.missingLibraries));
check('缺库描述可读', launchTarget.describeDependencyReport(reportMissing).includes('依赖库'), launchTarget.describeDependencyReport(reportMissing));

fs.rmSync(path.join(versionsDir, '1.20.1', '1.20.1.jar'));
const reportNoJar = launchTarget.checkDependencies(gameRoot, '1.20.1-forge-47.2.0');
check('缺 JAR 被检出', reportNoJar.missingJar !== undefined, String(reportNoJar.missingJar));
// 还原夹具，供后续 game-folder 断言使用
write(path.join(versionsDir, '1.20.1', '1.20.1.jar'), 'jar');

// ==================== game-folder ====================
console.log('\ngame-folder');
const normalizedRoot = gameFolder.normalizeGameFolder(gameRoot);
check('根目录识别为 game-root', normalizedRoot.kind === 'game-root' && normalizedRoot.rootPath === path.resolve(gameRoot), normalizedRoot.kind);
const normalizedVersions = gameFolder.normalizeGameFolder(versionsDir);
check('选择 versions 目录时上溯到根', normalizedVersions.kind === 'versions-dir' && normalizedVersions.rootPath === path.resolve(gameRoot), normalizedVersions.rootPath);
const normalizedVersionDir = gameFolder.normalizeGameFolder(path.join(versionsDir, '1.20.1-forge-47.2.0'));
check('选择版本目录时上溯到根', normalizedVersionDir.kind === 'version-dir' && normalizedVersionDir.rootPath === path.resolve(gameRoot), normalizedVersionDir.rootPath);
const normalizedInstance = gameFolder.normalizeGameFolder(instancePath);
check('选择实例目录时上溯到根', normalizedInstance.kind === 'instance' && normalizedInstance.rootPath === path.resolve(gameRoot), normalizedInstance.rootPath);

const info = gameFolder.inspectGameFolder(gameRoot);
check('识别 Koring 启动器目录', info.launcher === 'koring', `${info.launcher}/${info.launcherHints.join(',')}`);
check('汇总版本数', info.versionCount === 2, String(info.versionCount));
check('汇总加载器统计', info.summary.loaders.forge === 1, JSON.stringify(info.summary.loaders));
check('健康/损坏版本统计', info.healthyCount === 1 && info.summary.broken === 1, JSON.stringify(info.summary));
check('具有 libraries/assets 标记', info.hasLibraries === true && info.hasAssets === true);

const pclRoot = path.join(tmpRoot, 'pcl');
write(path.join(pclRoot, 'PCL.ini'), 'x');
write(path.join(pclRoot, 'versions', '1.19.4', '1.19.4.json'), { id: '1.19.4', type: 'release' });
const pclInfo = gameFolder.inspectGameFolder(pclRoot);
check('识别 PCL2 目录', pclInfo.launcher === 'pcl', pclInfo.launcher);
check('缺 JAR 的版本计为不健康', pclInfo.healthyCount === 0 && pclInfo.summary.broken === 1, JSON.stringify(pclInfo.summary));

const officialRoot = path.join(tmpRoot, 'official');
write(path.join(officialRoot, 'launcher_profiles.json'), '{}');
check('识别官方启动器目录', gameFolder.inspectGameFolder(officialRoot).launcher === 'official');

const emptyRoot = path.join(tmpRoot, 'empty');
fs.mkdirSync(emptyRoot, { recursive: true });
check('空目录识别为 unknown', gameFolder.normalizeGameFolder(emptyRoot).kind === 'unknown');
check('不存在的目录给出告警', gameFolder.normalizeGameFolder(path.join(tmpRoot, 'nope')).warnings.length > 0);

const discovery = gameFolder.discoverGameFolders([gameRoot, pclRoot, emptyRoot]);
const discoveredPaths = discovery.candidates.map((c) => c.path);
check('自动发现包含夹具根目录', discoveredPaths.includes(path.resolve(gameRoot)), discoveredPaths.join(' | '));
check('自动发现包含 PCL 目录', discoveredPaths.includes(path.resolve(pclRoot)));
check('自动发现剔除空目录', !discoveredPaths.includes(path.resolve(emptyRoot)));
check('自动发现统计探测数', discovery.scanned >= 3, String(discovery.scanned));

// ==================== download-options ====================
console.log('\ndownload-options');
const bmcl = downloadOptions.resolveDownloadSource({ source: 'bmclapi' });
check('默认/BMCLAPI 源的 maven', bmcl.mavenHost === downloadOptions.BMCLAPI_MAVEN, String(bmcl.mavenHost));
check('BMCLAPI 源需要改写请求', bmcl.rewriteRequests === true);
const official = downloadOptions.resolveDownloadSource({ source: 'official' });
check('官方源不带 maven 覆盖', official.mavenHost === undefined && official.rewriteRequests === false);
const custom = downloadOptions.resolveDownloadSource({
  source: 'custom',
  customMavenHost: 'https://m.example.com/',
  customAssetsHost: 'https://a.example.com/',
  customVersionManifest: 'https://v.example.com/manifest.json',
});
check('自定义源透传', custom.mavenHost === 'https://m.example.com/' && custom.versionManifest === 'https://v.example.com/manifest.json');
check('未知来源回退 BMCLAPI', downloadOptions.resolveDownloadSource({ source: 'nope' }).kind === 'bmclapi');

const installOptions = downloadOptions.buildInstallOptions({ source: 'bmclapi', threads: 999 });
check('并发被夹到上限', installOptions.librariesDownloadConcurrency === 64, String(installOptions.librariesDownloadConcurrency));
check('并发同时作用于 assets', installOptions.assetsDownloadConcurrency === 64);
check('非法并发回退默认', downloadOptions.sanitizeThreads(0) === 8 && downloadOptions.sanitizeThreads('abc') === 8);
check('官方源不注入 mirror fetch', downloadOptions.buildInstallOptions({ source: 'official' }).fetch === undefined);
check('BMCLAPI 源注入 mirror fetch', typeof downloadOptions.buildInstallOptions({ source: 'bmclapi' }).fetch === 'function');
check(
  '镜像改写命中',
  downloadOptions.rewriteToMirror('https://launchermeta.mojang.com/mc/game/version_manifest.json') ===
    'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json',
  downloadOptions.rewriteToMirror('https://launchermeta.mojang.com/mc/game/version_manifest.json')
);
check(
  '资源 URL 改写带前缀',
  downloadOptions.rewriteToMirror('https://resources.download.minecraft.net/ab/abcdef') ===
    'https://bmclapi2.bangbang93.com/assets/ab/abcdef',
  downloadOptions.rewriteToMirror('https://resources.download.minecraft.net/ab/abcdef')
);
check('未命中规则原样返回', downloadOptions.rewriteToMirror('https://example.com/x') === 'https://example.com/x');
check(
  'versionListRequest 使用镜像清单',
  downloadOptions.versionListRequest({ source: 'bmclapi' }).remote === downloadOptions.BMCLAPI_VERSION_MANIFEST
);

// ==================== resolveLaunchPlan ====================
console.log('\nresolveLaunchPlan');
// 前面的依赖体检用例删掉过 lib-1.0.jar，这里先还原完整夹具
write(path.join(gameRoot, 'libraries', 'com', 'example', 'lib', '1.0', 'lib-1.0.jar'), 'lib');
const planOk = launchTarget.resolveLaunchPlan({
  instancePath,
  runtime: { minecraft: '1.20.1', forge: '47.2.0' },
  resourcePath: gameRoot,
});
check('方案选中 Forge 版本', planOk.resolved.id === '1.20.1-forge-47.2.0', planOk.resolved.id);
check('方案资源根指向引用目录', planOk.roots.resourceRoot === path.resolve(gameRoot), planOk.roots.resourceRoot);
check('方案来源标记为 instance-custom', planOk.roots.source === 'instance-custom', planOk.roots.source);
check('方案依赖就绪且无问题', planOk.dependencies.ready === true && planOk.issues.length === 0, planOk.issues.join('；'));

const planShared = launchTarget.resolveLaunchPlan({
  instancePath: bareInstance,
  runtime: { minecraft: '1.20.1' },
  sharedResourceDir: gameRoot,
});
check(
  '共享资源目录时游戏根仍为实例目录',
  planShared.roots.source === 'shared' &&
    planShared.roots.resourceRoot === path.resolve(gameRoot) &&
    planShared.roots.gameRoot === path.resolve(bareInstance),
  `${planShared.roots.source}/${planShared.roots.gameRoot}`
);

const planRef = launchTarget.resolveLaunchPlan({
  instancePath: bareInstance,
  runtime: { minecraft: '1.20.1' },
  resourcePath: gameRoot,
});
check(
  '引用式导入的资源根指向源目录',
  planRef.roots.source === 'instance-custom' && planRef.roots.resourceRoot === path.resolve(gameRoot),
  `${planRef.roots.source}/${planRef.roots.resourceRoot}`
);

const missingLibPath = path.join(gameRoot, 'libraries', 'com', 'example', 'lib', '1.0', 'lib-1.0.jar');
fs.rmSync(missingLibPath);
const planBroken = launchTarget.resolveLaunchPlan({
  instancePath,
  runtime: { minecraft: '1.20.1', forge: '47.2.0' },
  resourcePath: gameRoot,
});
check(
  '依赖缺失进入 issues',
  planBroken.dependencies.ready === false && planBroken.issues.some((issue) => issue.includes('依赖库')),
  planBroken.issues.join('；')
);
write(missingLibPath, 'lib');

// ==================== launch-options ====================
console.log('\nlaunch-options');
const launchOptionsMod = require(path.join(root, 'electron-dist', 'core', 'launch-options.js'));
check('1.21 需要 Java 21', launchOptionsMod.requiredJavaMajor('1.21.4') === 21, String(launchOptionsMod.requiredJavaMajor('1.21.4')));
check('1.20.5 起需要 Java 21', launchOptionsMod.requiredJavaMajor('1.20.5') === 21, String(launchOptionsMod.requiredJavaMajor('1.20.5')));
check('1.20.1 需要 Java 17', launchOptionsMod.requiredJavaMajor('1.20.1') === 17, String(launchOptionsMod.requiredJavaMajor('1.20.1')));
check('1.16.5 需要 Java 8', launchOptionsMod.requiredJavaMajor('1.16.5') === 8, String(launchOptionsMod.requiredJavaMajor('1.16.5')));
check('快照按最新版处理', launchOptionsMod.requiredJavaMajor('24w45a') === 21, String(launchOptionsMod.requiredJavaMajor('24w45a')));

const launchOptionPlan = launchOptionsMod.buildLaunchOptions(
  {
    java: { javaPath: '', autoJavaPath: true, memMode: 'custom', memGB: 8, gc: 'g1', jvmArgs: '-Dfoo=bar' },
    advanced: { afterLaunch: 'close', winMode: 'default', gameArgs: '--demo', debugMode: false },
  },
  {
    name: 'Demo',
    path: instancePath,
    config: { name: 'Demo', runtime: { minecraft: '1.20.1', forge: '47.2.0' }, minMemory: 1024, maxMemory: 2048 },
    modCount: 0,
    resourcePackCount: 0,
    screenshotCount: 0,
    saveCount: 0,
    healthy: true,
    issues: [],
    launch: planOk.roots && {
      versionId: planOk.resolved.id,
      via: planOk.resolved.via,
      resourceRoot: planOk.roots.resourceRoot,
      gameRoot: planOk.roots.gameRoot,
      rootSource: planOk.roots.source,
      loaderLabels: [],
      warnings: [],
    },
    dependency: { ready: true, missingLibraries: 0, missingVersions: [], missingJar: false, missingAssetIndex: false, checkedLibraries: 0 },
  },
  { username: 'Steve', uuid: 'uuid-steve' },
  'C:/java/bin/java.exe',
  undefined,
  planOk
);
check('LaunchOption 使用实际启动版本', launchOptionPlan.version === '1.20.1-forge-47.2.0', String(launchOptionPlan.version));
check('LaunchOption 传入 resourcePath', launchOptionPlan.resourcePath === planOk.roots.resourceRoot, String(launchOptionPlan.resourcePath));
check('LaunchOption 的 --gameDir 用游戏根', launchOptionPlan.gamePath === planOk.roots.gameRoot, String(launchOptionPlan.gamePath));
check('自定义内存映射', launchOptionPlan.maxMemory === 8192 && launchOptionPlan.minMemory === 2048, `${launchOptionPlan.minMemory}/${launchOptionPlan.maxMemory}`);
check('GC 与 JVM 参数映射', launchOptionPlan.extraJVMArgs.includes('-XX:+UseG1GC') && launchOptionPlan.extraJVMArgs.includes('-Dfoo=bar'), launchOptionPlan.extraJVMArgs.join(' '));
check('游戏参数映射', launchOptionPlan.extraMCArgs.includes('--demo'), launchOptionPlan.extraMCArgs.join(' '));

// ==================== 实例元数据与图标 ====================
// instance.js 间接依赖 electron（config/logger 在模块作用域读 app.isPackaged），
// 纯 node 下需要给 require 打一个最小 electron 桩，否则 require 阶段就抛错。
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: true,
        getPath: () => tmpRoot,
        getName: () => 'koring-launcher',
        getVersion: () => '0.0.0',
        on() {},
        once() {},
      },
      ipcMain: { handle() {} },
      shell: { openPath: async () => '' },
      dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const instanceMod = require(path.join(root, 'electron-dist', 'core', 'instance.js'));
Module._load = originalLoad;

// 1x1 透明 PNG（仅用于验证文件头嗅探与 data URL 生成）
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

const emptyIcon = instanceMod.readInstanceIcon('Demo', gameRoot);
check('无图标时返回空结果', emptyIcon.url === null && emptyIcon.source === null, JSON.stringify(emptyIcon));

fs.mkdirSync(instancePath, { recursive: true });
fs.writeFileSync(path.join(instancePath, 'logo.png'), PNG_1PX);
const pngIcon = instanceMod.readInstanceIcon('Demo', gameRoot);
check(
  'logo.png 被读成 data URL',
  typeof pngIcon.url === 'string' && pngIcon.url.startsWith('data:image/png;base64,') && pngIcon.source === 'logo.png',
  String(pngIcon.url && pngIcon.url.slice(0, 32))
);
check('图标记录原始字节数', pngIcon.bytes === PNG_1PX.length, String(pngIcon.bytes));

// 候选文件优先顺序：logo.png 存在时忽略 icon.png
fs.writeFileSync(path.join(instancePath, 'icon.png'), Buffer.from('not an image'));
check(
  'logo.png 优先于 icon.png',
  instanceMod.readInstanceIcon('Demo', gameRoot).source === 'logo.png',
  String(instanceMod.readInstanceIcon('Demo', gameRoot).source)
);

// 非图片内容给出 problem，而不是返回一个坏 data URL
fs.rmSync(path.join(instancePath, 'logo.png'), { force: true });
const badIcon = instanceMod.readInstanceIcon('Demo', gameRoot);
check(
  '非图片文件返回 problem 而非图标',
  badIcon.url === null && typeof badIcon.problem === 'string' && badIcon.problem.includes('图片'),
  String(badIcon.problem)
);

// 超大文件同样只给提示
fs.rmSync(path.join(instancePath, 'icon.png'), { force: true });
fs.writeFileSync(path.join(instancePath, 'logo.png'), Buffer.alloc(2 * 1024 * 1024 + 1, 0x41));
const bigIcon = instanceMod.readInstanceIcon('Demo', gameRoot);
check(
  '超过 2 MB 的图标被拒绝并提示',
  bigIcon.url === null && typeof bigIcon.problem === 'string' && bigIcon.problem.includes('过大'),
  String(bigIcon.problem)
);

// 从外部文件设置图标：写入 logo.png，并清掉其它候选文件
const externalIcon = path.join(tmpRoot, 'picked.png');
fs.writeFileSync(externalIcon, PNG_1PX);
// 先放一个 icon.png，验证 setInstanceIcon 会把它清掉
fs.writeFileSync(path.join(instancePath, 'icon.png'), PNG_1PX);
const setResult = instanceMod.setInstanceIcon('Demo', gameRoot, externalIcon);
check(
  'setInstanceIcon 写入 logo.png 并返回 data URL',
  setResult.source === 'logo.png' && String(setResult.url).startsWith('data:image/png;base64,'),
  JSON.stringify({ source: setResult.source, url: typeof setResult.url })
);
check('setInstanceIcon 清掉旧候选文件', !fs.existsSync(path.join(instancePath, 'icon.png')));
check('图标文件确实落盘', fs.existsSync(path.join(instancePath, 'logo.png')));

// 拒绝非图片与超限文件
function expectThrow(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}
const notImage = expectThrow(() => instanceMod.setInstanceIcon('Demo', gameRoot, path.join(instancePath, 'instance.json')));
check('setInstanceIcon 拒绝非图片文件', !!notImage && /不支持的文件类型/.test(notImage.message), notImage && notImage.message);
const tooBig = path.join(tmpRoot, 'big.png');
fs.writeFileSync(tooBig, Buffer.alloc(2 * 1024 * 1024 + 1, 0x41));
const bigError = expectThrow(() => instanceMod.setInstanceIcon('Demo', gameRoot, tooBig));
check('setInstanceIcon 拒绝超大文件', !!bigError && /过大/.test(bigError.message), bigError && bigError.message);

instanceMod.clearInstanceIcon('Demo', gameRoot);
check('clearInstanceIcon 删除图标文件', !fs.existsSync(path.join(instancePath, 'logo.png')));
check(
  '清除后回到无图标状态',
  instanceMod.readInstanceIcon('Demo', gameRoot).url === null,
  String(instanceMod.readInstanceIcon('Demo', gameRoot).url)
);

// 收藏 / 分类：写入 instance.json（updateInstance 合并补丁后落盘）
let metaError = null;
try {
  instanceMod.updateInstance('Demo', gameRoot, { favorite: true, category: '生存' });
} catch (error) {
  metaError = error;
}
const demoConfig = JSON.parse(fs.readFileSync(path.join(instancePath, 'instance.json'), 'utf8'));
check('收藏状态写入 instance.json', demoConfig.favorite === true, JSON.stringify(demoConfig.favorite));
check('分类写入 instance.json', demoConfig.category === '生存', JSON.stringify(demoConfig.category));
check(
  'updateInstance 未因元数据写入而失败',
  metaError === null,
  metaError && metaError.message
);

// ==================== 收尾 ====================
fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log(`\n${passed} 项通过，${failures.length} 项失败`);
if (failures.length) {
  for (const failure of failures) console.log(` - ${failure}`);
  process.exit(1);
}
