// 版本发布说明（release-notes.md / GitHub Release body）解析器。
// 目标：不渲染原始 Markdown，把每条变更提取出来并按提交类型（conventional commit）分类。
//
// 受控格式约定（与 CI release 模板对齐）：
//   # Koring Launcher Releases x
//   ## 版本信息
//   当前版本 x
//   ...
//   ## 更新了什么内容
//   <details>
//   <summary>·Commit abc1234</summary>
//
//   fix(updater): 标题
//
//   详细说明…
//   </details>
//   或：· 无提交记录

export type ChangeType = "feat" | "fix" | "perf" | "refactor" | "docs" | "other";

export interface VersionChange {
  /** commit 短 hash（无则省略） */
  commit?: string;
  type: ChangeType;
  /** 去除 type(scope): 前缀后的标题 */
  title: string;
  /** 详细说明（纯文本，已剥离 md 记号） */
  description?: string;
}

export interface ParsedRelease {
  version: string;
  tag: string;
  /** notes 中含「无提交记录」 */
  noCommits: boolean;
  changes: VersionChange[];
}

/** conventional commit type → 业务分类（大小写不敏感） */
const TYPE_ALIAS: Record<string, ChangeType> = {
  feat: "feat",
  feature: "feat",
  add: "feat",
  fix: "fix",
  bugfix: "fix",
  perf: "perf",
  optimize: "perf",
  performance: "perf",
  improve: "perf",
  refactor: "refactor",
  docs: "docs",
  doc: "docs",
  chore: "other",
  ci: "other",
  build: "other",
  style: "other",
  test: "other",
  revert: "other",
};

/** 去掉行内的常见 markdown 记号，得到纯文本 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接 [t](url) → t
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // 图片 ![t](url) → t
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/[_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 解析 conventional commit 首行：type(scope): subject */
function parseCommitTitle(line: string): { type: ChangeType; title: string } {
  const m = line.trim().match(/^([a-zA-Z][\w-]*)(?:\(([^)]*)\))?!?:\s*(.*)$/);
  if (!m) {
    return { type: "other", title: stripInlineMarkdown(line) };
  }
  const rawType = m[1].toLowerCase();
  const subject = stripInlineMarkdown(m[3] || m[2] || line);
  return { type: TYPE_ALIAS[rawType] ?? "other", title: subject };
}

/** 提取一个 <details> 块中的 summary sha 与正文 */
function splitDetailsBlock(block: string): { commit?: string; content: string } {
  const summary = block.match(/<summary>\s*[·•-]?\s*Commit\s*([0-9a-fA-F]{4,40})?/i);
  const content = block
    .replace(/<summary>[\s\S]*?<\/summary>/i, "")
    .replace(/<\/?details>/gi, "")
    .trim();
  return { commit: summary?.[1]?.slice(0, 7), content };
}

/** 把一段文本按行解析为一条变更 */
function parseChangeLines(text: string): VersionChange {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const head = lines[0] || "";
  const { type, title } = parseCommitTitle(head);
  const rest = lines.slice(1);
  // 剩余行通常为换行后的说明；合并（保留相对短行），剥离剩余 md 记号
  const description = rest.length > 0 ? stripInlineMarkdown(rest.join(" ")) : undefined;
  return { type, title, description: description || undefined };
}

/**
 * 解析发布说明 notes 为结构化变更列表。
 * 优先切分 <details> 块（受控格式）；无 details 时按「更新了什么内容」节下的行兜底。
 */
export function parseReleaseNotes(notes: string, version: string, tag: string): ParsedRelease {
  const noCommits = /无提交记录|no commits?/i.test(notes);

  // 定位「更新了什么内容」节（找不到则用整篇）
  const sectionIdx = notes.search(/^##\s*更新了什么内容/m);
  const body = sectionIdx >= 0 ? notes.slice(sectionIdx) : notes;

  const changes: VersionChange[] = [];

  // 1) <details> 块切分（受控格式）
  const detailRe = /<details[^>]*>([\s\S]*?)<\/details>/gi;
  let match: RegExpExecArray | null;
  let detailsFound = false;
  while ((match = detailRe.exec(body)) !== null) {
    detailsFound = true;
    const { commit, content } = splitDetailsBlock(match[1]);
    if (!content) continue;
    const change = parseChangeLines(content);
    if (commit) change.commit = commit;
    changes.push(change);
  }

  // 2) 兜底：无 <details> 时按行扫描「· Commit / - 」开头的条目
  if (!detailsFound) {
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^#/.test(l));
    let current: VersionChange | null = null;
    for (const line of lines) {
      const entry = line.match(/^[·•\-]\s*(?:Commit\s*)?([0-9a-fA-F]{7,40})?\s*(.*)$/i);
      if (entry) {
        const { type, title } = parseCommitTitle(entry[2] || entry[1] || line);
        current = { type, title };
        if (entry[1]) current.commit = entry[1].slice(0, 7);
        changes.push(current);
      } else if (current) {
        // 说明行并入上一条
        const desc = stripInlineMarkdown(line);
        if (desc) current.description = current.description ? `${current.description} ${desc}` : desc;
      } else {
        // 游离正文行（版本信息等）跳过
      }
    }
  }

  return { version, tag, noCommits, changes };
}
