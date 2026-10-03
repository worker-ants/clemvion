// 미러 스펙 문서의 `## 구현 위치` 절을 읽어 저장소 경로의 실재를 판정한다.
// `spec-impl-locations.test.ts` 가 쓴다. 규칙의 기준은 CLE-ENG-SPECEVIDENCE 규칙 19 · 20 이고
// 이유는 R-16 이다. 옛 트리 frontmatter `code:` 를 보던 `spec-code-paths` 의 대체다
// (전환 단계 5, NERV Task `CLE-T-7M4C4X`).

import fs from "node:fs";
import path from "node:path";
import { mirrorKeyPaths } from "./spec-keys";

/**
 * 코드 스팬을 저장소 경로로 읽는 루트. 이 넷으로 시작하는 스팬만 본다(규칙 20).
 *
 * 괄호 안 보충 설명(앞 경로 기준의 `README.md` · `Dockerfile`)이나 gitignore 대상
 * (`.review/`)을 경로로 읽으면 CI 체크아웃에서 거짓 통과 · 거짓 실패가 난다. 2026-10-03
 * 미러에 둘 다 있었다.
 *
 * `/spec-coverage` 감사기 프롬프트도 같은 루트를 적는다(`spec_coverage_orchestrator.py` 의
 * `IMPL_ROOTS`). `.claude/tests/test_spec_coverage_prompt.py` 가 이 목록과 대조한다.
 */
export const IMPL_LOCATION_ROOTS: readonly string[] = [
  "codebase/",
  ".claude/",
  ".github/",
  "scripts/",
];

const SECTION_HEADING = "## 구현 위치";
// 펜스는 같은 글자로 같은 길이 이상일 때만 닫힌다(CommonMark). 종류를 가리지 않고 토글하면
// 바깥 ``` 안의 `~~~` 줄에서 펜스가 닫혀 뒤의 진짜 절을 놓친다.
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const H2_RE = /^##\s/;
const CODE_SPAN_RE = /`([^`\n]+)`/g;
// 마지막 세그먼트가 마이그레이션 번호뿐인 경로(`…/migrations/V117`). 그 번호의 파일
// (`V117__*`)을 가리키는 약칭으로 읽는다.
const MIGRATION_SHORTHAND_RE = /^V\d+$/;

export interface ImplLocationSection {
  /** 헤딩 다음 줄부터 다음 2단계 헤딩 전까지. */
  body: string;
  /** `body` 첫 줄의 원문 줄 번호(1부터). */
  firstLine: number;
}

/** 줄마다 코드펜스(여는 줄 · 닫는 줄 포함) 안인지 알려 준다. */
function fenceMask(lines: readonly string[]): boolean[] {
  let open: string | null = null;
  return lines.map((line) => {
    const m = FENCE_RE.exec(line);
    if (open === null) {
      if (m) open = m[1];
      return m !== null;
    }
    if (m && m[1][0] === open[0] && m[1].length >= open.length && m[2].trim() === "") open = null;
    return true;
  });
}

/** `## 구현 위치` 절. 없으면 `null`. 코드펜스 안의 헤딩은 절로 보지 않는다. */
export function extractImplLocationSection(text: string): ImplLocationSection | null {
  const lines = text.split(/\r?\n/);
  const inFence = fenceMask(lines);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inFence[i]) continue;
    if (start === -1) {
      if (line.trim() === SECTION_HEADING) start = i + 1;
      continue;
    }
    if (H2_RE.test(line)) {
      return { body: lines.slice(start, i).join("\n"), firstLine: start + 1 };
    }
  }
  return start === -1 ? null : { body: lines.slice(start).join("\n"), firstLine: start + 1 };
}

export interface ImplLocationCandidate {
  path: string;
  /** 원문 줄 번호(1부터). */
  line: number;
}

/**
 * 절 본문에서 저장소 경로로 읽는 코드 스팬. 코드펜스 안은 읽지 않는다(규칙 20).
 * `firstLine` 은 본문 첫 줄의 원문 줄 번호다.
 */
export function implLocationCandidates(body: string, firstLine: number): ImplLocationCandidate[] {
  const out: ImplLocationCandidate[] = [];
  const lines = body.split("\n");
  const inFence = fenceMask(lines);
  lines.forEach((line, idx) => {
    if (inFence[idx]) return;
    for (const m of line.matchAll(CODE_SPAN_RE)) {
      const span = m[1].trim();
      if (IMPL_LOCATION_ROOTS.some((r) => span.startsWith(r))) {
        out.push({ path: span, line: firstLine + idx });
      }
    }
  });
  return out;
}

/** `{a,b}` 를 펼친다. 중괄호가 여럿이면 모두 펼친다. */
function expandBraces(p: string): string[] {
  const m = /\{([^{}]*)\}/.exec(p);
  if (!m) return [p];
  const head = p.slice(0, m.index);
  const tail = p.slice(m.index + m[0].length);
  return m[1].split(",").flatMap((alt) => expandBraces(head + alt + tail));
}

// `**/` 는 폴더 0개 이상, 끝의 `**` 는 그 아래 전부다. `*` · `?` 는 한 세그먼트 안에서만
// 맞는다. 대괄호 · 소괄호는 글자 그대로다 — Next.js 경로(`(main)/w/[slug]`)를 문자 클래스 ·
// 그룹으로 읽지 않는다.
function globToRegex(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      i += 2;
      if (glob[i] === "/") {
        // `.*` 로 옮기면 `a/**/b.ts` 가 `a/xb.ts` 에 맞는다. 폴더 경계를 지킨다.
        re += "(?:.*/)?";
        i += 1;
      } else {
        re += ".*";
      }
    } else if (c === "*") {
      re += "[^/]*";
      i += 1;
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if ("\\^$+.()|{}[]".includes(c)) {
      re += "\\" + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp("^" + re + "$");
}

/** 글로브가 파일 하나 이상에 맞는가. 글로브 앞의 글자 그대로인 디렉터리부터 훑는다. */
function globMatchesAny(root: string, pattern: string): boolean {
  const literalPrefix = pattern.slice(0, pattern.search(/[*?]/));
  let walkRoot = path.join(root, literalPrefix);
  while (walkRoot !== root && !fs.existsSync(walkRoot)) walkRoot = path.dirname(walkRoot);
  const re = globToRegex(pattern);
  const stack = [walkRoot];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && re.test(path.relative(root, full).split(path.sep).join("/"))) {
        return true;
      }
    }
  }
  return false;
}

function resolvesOne(root: string, p: string): boolean {
  const rel = p.replace(/\/+$/, "");
  // `..` 는 저장소 경로를 적는 데 쓸 일이 없고, 따라가면 루트 밖의 실재로 통과한다.
  if (rel.split("/").includes("..")) return false;
  if (/[*?]/.test(rel)) return globMatchesAny(root, rel);
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) return true;
  const seg = path.basename(rel);
  if (!MIGRATION_SHORTHAND_RE.test(seg)) return false;
  try {
    return fs.readdirSync(path.dirname(abs)).some((name) => name.startsWith(`${seg}__`));
  } catch {
    return false;
  }
}

/** 구현 위치 경로 하나가 저장소에 있는가(규칙 20). 중괄호는 펼친 경로가 모두 있어야 한다. */
export function resolvesInRepo(root: string, p: string): boolean {
  return expandBraces(p).every((alt) => resolvesOne(root, alt));
}

export interface ImplLocationDoc {
  /** 저장소 기준 상대 경로(`/` 구분). */
  doc: string;
  paths: ImplLocationCandidate[];
}

/** `## 구현 위치` 절이 있는 미러 문서(`spec/<KEY>.md` · `spec/<영역 키>/<KEY>.md`). 경로 순. */
export function collectImplLocationDocs(root: string): ImplLocationDoc[] {
  const docs: ImplLocationDoc[] = [];
  for (const abs of mirrorKeyPaths(path.join(root, "spec")).values()) {
    const section = extractImplLocationSection(fs.readFileSync(abs, "utf8"));
    if (!section) continue;
    docs.push({
      doc: path.relative(root, abs).split(path.sep).join("/"),
      paths: implLocationCandidates(section.body, section.firstLine),
    });
  }
  return docs.sort((a, b) => a.doc.localeCompare(b.doc));
}

export interface MissingImplLocation {
  doc: string;
  line: number;
  path: string;
}

/** 실재하지 않는 구현 위치. 비어 있으면 건강하다. */
export function findMissingImplLocations(root: string): MissingImplLocation[] {
  const missing: MissingImplLocation[] = [];
  for (const d of collectImplLocationDocs(root)) {
    for (const c of d.paths) {
      if (!resolvesInRepo(root, c.path)) missing.push({ doc: d.doc, line: c.line, path: c.path });
    }
  }
  return missing;
}
