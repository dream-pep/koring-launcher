# Koring Launcher 中文 Release 发布说明生成器
#
# 用法（GitHub Actions 中调用）：
#   ./scripts/release-notes.ps1 -BaseVersion "1.2.0" -FullVersion "1.2.0-2608280224" -Mode "beta" -OutputPath release-notes.md
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

$status = if ($Mode -eq 'beta') { 'BETA' } else { 'RUN' }
$commitShort = if ($Commit) { $Commit.Substring(0, [Math]::Min(7, $Commit.Length)) } else { '' }

$rec = [char]0x1e   # 记录分隔符（每个 commit 一条）
$sep = [char]0x1f   # 字段分隔符（hash / subject / body）
$format = "%x1f%H%x1f%s%x1f%b%x1e"

# 提交范围（base tag）：按 tag 创建时间从新到旧取"上一个 release"。
#   run（正式版）→ 上一个【正式版】tag：把上一个正式版之后所有 beta 的提交也写进正式版更新内容
#   beta         → 上一个 release tag（任意通道）
# 注意用 creatordate 而非 git 版本序：git 对 -beta.N / -N 混排不可靠（会把 beta.16 排到 -17 之前）。
$tagsNewestFirst = git for-each-ref --sort=-creatordate --format '%(refname:short)' refs/tags 2>$null |
  Where-Object { $_ -match '^v' }
$baseTag = if ($Mode -eq 'run') {
  ($tagsNewestFirst | Where-Object { $_ -notmatch '-beta\.' } | Select-Object -First 1)
} else {
  ($tagsNewestFirst | Select-Object -First 1)
}

if ($baseTag) {
  Write-Host "Commits since tag: $baseTag (mode=$Mode)"
  $raw = git log --format=$format "$baseTag..HEAD"
} else {
  Write-Host "No release tags found, listing all commits"
  $raw = git log --format=$format "HEAD"
}

$blocks = @()
foreach ($record in ($raw -split [regex]::Escape($rec))) {
  if (-not $record) { continue }
  $parts = $record -split [regex]::Escape($sep)
  if ($parts.Length -lt 4) { continue }
  $hash = $parts[1].Trim()
  $subject = $parts[2].Trim()
  $body = $parts[3].Trim()
  if (-not $hash) { continue }

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
