# Koring Launcher 中文 Release 发布说明生成器
#
# 用法（GitHub Actions 中调用）：
#   ./scripts/release-notes.ps1 -BaseVersion "1.2.6" -FullVersion "1.2.6-33.beta" -Mode "beta" -OutputPath release-notes.md
#
# 输出（Markdown，UTF-8）：
#   # Koring Launcher Releases {BaseVersion}
#   ## 版本信息
#   当前版本 {FullVersion}
#   编译状态：BETA / RUN
#   ## 更新了什么内容
#   <details><summary>·Commit 1cf906d</summary>提交说明…</details>（默认折叠）

param(
  [Parameter(Mandatory = $true)][string] $BaseVersion,
  [Parameter(Mandatory = $true)][string] $FullVersion,
  [Parameter(Mandatory = $true)][string] $Mode,
  [string] $SigningStatus = "已签名",
  [string] $Commit = "",
  [string] $OutputPath = "release-notes.md"
)

# git 输出为 UTF-8；必须显式告知控制台，否则 Windows PowerShell 按 OEM 代码页解码，
# 中文乱码且 0x1f/0x1e 分隔符可能被吞，导致 commit 解析丢块（已验证：56 → 35）。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$status = if ($Mode -eq 'beta') { 'BETA' } else { 'RUN' }
$commitShort = if ($Commit) { $Commit.Substring(0, [Math]::Min(7, $Commit.Length)) } else { '' }

$rec = [char]0x1e   # 记录分隔符（每个 commit 一条）
$sep = [char]0x1f   # 字段分隔符（hash / subject / body）
$format = "%x1f%H%x1f%s%x1f%b%x1e"

# 提交范围（base tag）：解析 tag 名取"上一个 release"（结构化版本序，不依赖 creatordate）。
#   tag 结构（新）：v{base}-{N} 正式版 / v{base}-{N}.beta 测试版（N = GITHUB_RUN_NUMBER，全局递增）
#   兼容旧格式：    v{base}-beta.{N} 旧测试版 / v{base} 无构建号
#   run（正式版）→ 上一个【正式版】tag：把上一个正式版之后所有 beta 的提交也写进正式版更新内容
#   beta         → 上一个 release tag（任意通道）
# 按 (base版本, 构建号) 降序排序：creatordate 在同 commit 多 tag / tag 重建时不可靠。
$tagInfos = @()
foreach ($tag in (git for-each-ref --format '%(refname:short)' refs/tags 2>$null)) {
  if ($tag -notmatch '^v') { continue }
  if ($tag -match '^v(\d+)\.(\d+)\.(\d+)-(\d+)(\.beta)?$') {
    $tagInfos += [pscustomobject]@{ Tag = $tag; Base = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"; Build = [int64]$Matches[4]; IsBeta = [bool]$Matches[5] }
  } elseif ($tag -match '^v(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$') {
    $tagInfos += [pscustomobject]@{ Tag = $tag; Base = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"; Build = [int64]$Matches[4]; IsBeta = $true }
  } elseif ($tag -match '^v(\d+)\.(\d+)\.(\d+)$') {
    $tagInfos += [pscustomobject]@{ Tag = $tag; Base = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"; Build = [int64]0; IsBeta = $false }
  }
}
$sortedNewestFirst = $tagInfos |
  Sort-Object -Property @{ Expression = { $_.Base }; Descending = $true }, @{ Expression = { $_.Build }; Descending = $true }
$baseTag = if ($Mode -eq 'run') {
  ($sortedNewestFirst | Where-Object { -not $_.IsBeta } | Select-Object -First 1).Tag
} else {
  ($sortedNewestFirst | Select-Object -First 1).Tag
}
$noTagReason = if ($tagInfos.Count -eq 0) { 'No release tags found' } else { 'No stable (run) tag found' }

if ($baseTag) {
  Write-Host "Commits since tag: $baseTag (mode=$Mode)"
  $raw = git log --format=$format "$baseTag..HEAD"
} else {
  Write-Host "$noTagReason, listing all commits"
  $raw = git log --format=$format "HEAD"
}

$blocks = @()
# git 输出被 PowerShell 收成「按行数组」；多行 commit body 必须先 join 再按记录符切分，
# 否则逐元素 split 会把每条记录的第一行当整条、丢掉 body 后续行（实测 56 条只解析出 35 条）。
foreach ($record in (($raw -join "`n") -split [regex]::Escape($rec))) {
  if (-not $record) { continue }
  $parts = $record -split [regex]::Escape($sep)
  if ($parts.Length -lt 4) { continue }
  $hash = $parts[1].Trim()
  $subject = $parts[2].Trim()
  $body = $parts[3].Trim()
  if (-not $hash) { continue }
  if (-not ($hash -match '^[0-9a-f]{7,40}$')) { continue }  # 防御：仅接受 hex hash

  $short = $hash.Substring(0, [Math]::Min(7, $hash.Length))
  $inner = $subject
  if ($body) { $inner += "`n`n$body" }

  $blocks += @"
<details>
<summary>·Commit $short</summary>

$inner

</details>
"@
}

$commitsSection = if ($blocks.Count -gt 0) { $blocks -join "`n`n" } else { '· 无提交记录' }

$content = @"
# Koring Launcher Releases $BaseVersion

## 版本信息
当前版本 $FullVersion
编译状态：$status
签名状态：$SigningStatus
$(if ($commitShort) { "构建来源：commit $commitShort" })

## 更新了什么内容
$commitsSection
"@

[System.IO.File]::WriteAllText($OutputPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Release notes written to $OutputPath ($($blocks.Count) commits)"
