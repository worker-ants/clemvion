import fs from "node:fs";
import path from "node:path";

import { walkTree, type MdFileRef } from "./tree-walk";
import { SPEC_KEY_RE, isUnmirroredArea } from "./spec-keys";

// codebase 의 텍스트 파일에서 **링크가 아닌 언급**을 줄 단위로 센다. 세 가드가 함께 쓴다
// (NERV 정본 전환 단계 4g, NERV Task `CLE-T-M7K35H`).
//
// - `legacy-path-ratchet.test.ts`: 옛 스펙 트리 경로 · 지운 `plan/` 경로가 늘지 않게 막는다.
// - `review-citation-form.test.ts`: 리뷰 인용 규약(`CLE-ENG-REVIEWCITE`) 규칙 9 · 10 이 금지한
//   형태(줄인 발견 ID, 로컬 `.review/**` 경로)가 없게 한다.
// - `spec-key-mentions.test.ts`: 링크로 감싸지 않은 스펙 키(`CLE-…`)가 미러에 있게 한다.
//
// 마크다운 키 링크(`[글](CLE-KEY#앵커)`)와 `spec/**.md` 경로 링크는 `spec-link-integrity`
// 범위 2 가 본다. 이 모듈은 그 가드가 보지 않는 나머지(주석 속 경로 문자열, 링크 없는 키)를
// 맡는다. 기준은 `CLE-ENG-SPECEVIDENCE` 「빌드 가드 — 스펙 문서 저장소 무결성」 이다.

/** 훑는 루트(저장소 루트 기준). */
export const MENTION_ROOTS: readonly string[] = ["codebase"];

/**
 * 건너뛰는 디렉터리. 빌드 · 테스트 산출물과 의존성이다. 점으로 시작하는 디렉터리(`.next` 등)도
 * 건너뛴다. 2026-10-03 실측으로 codebase 안의 점 디렉터리는 모두 산출물이었다.
 */
const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
  "test-results",
  "playwright-report",
]);

/**
 * 읽는 텍스트 파일. 확장자로 고른다. 이진 파일을 문자열로 읽어 우연히 맞는 일을 막고,
 * 마이그레이션 SQL · 셸 · Dockerfile 처럼 주석이 사람에게 읽히는 파일은 넣는다.
 */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".sh",
  ".md",
  ".mdx",
  ".sql",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".svg",
  ".html",
  ".txt",
  ".toml",
]);
const TEXT_BASENAMES: ReadonlySet<string> = new Set(["Dockerfile"]);

/**
 * 이 가드 가족 자신의 파일(저장소 루트 기준). 판정을 시험하는 합성 입력(옛 경로 · 줄인 발견
 * ID · 없는 키)을 담고 있어 세지 않는다. 래칫 기준값 파일도 여기 있다.
 */
export const GUARD_SELF_FILES: ReadonlySet<string> = new Set(
  [
    "codebase-mentions.ts",
    "legacy-path-ratchet.test.ts",
    "legacy-path-ratchet.baseline.json",
    "review-citation-form.test.ts",
    "spec-key-mentions.test.ts",
  ].map((f) => `codebase/frontend/src/lib/docs/__tests__/${f}`),
);

/**
 * `MENTION_ROOTS` 아래 텍스트 파일 전부(`GUARD_SELF_FILES` 제외). `relPath` 는 저장소 루트
 * 기준이고 정렬돼 있다.
 */
export function collectMentionFiles(root: string): MdFileRef[] {
  return walkTree(root, MENTION_ROOTS, {
    skipDir: (name) => SKIP_DIRS.has(name) || name.startsWith("."),
    includeFile: (name, relPath) =>
      (TEXT_BASENAMES.has(name) || TEXT_EXTENSIONS.has(path.extname(name))) &&
      !GUARD_SELF_FILES.has(relPath),
  });
}

/**
 * 옛 스펙 트리의 `.md` 경로. NERV 미러(`spec/CLE-…`, `spec/README.md`)는 세지 않는다.
 *
 * 앞에 경로 문자(`\w` · `.` · `-`)가 붙으면 다른 낱말의 일부다(`e2e-spec/…`). `/` 는 허용한다.
 * 상대 경로(`../../spec/…md`)도 같은 옛 트리를 가리키기 때문이다. 글로브(`spec/4-nodes/**.md`)는
 * `*` 에서 끊겨 세지 않는다. 문서 하나가 아니라 범위를 말하는 표기다.
 */
export const OLD_SPEC_PATH = /(?<![\w.-])spec\/(?!CLE-|README\.md)[\w./-]*?\.md\b/;

/** 전환 단계 3 에서 지운 `plan/` 트리의 경로. */
export const REMOVED_PLAN_PATH = /(?<![\w.-])plan\/(?:in-progress|complete|research)\//;

/**
 * 리뷰 오케스트레이터의 로컬 산출물 경로(`CLE-ENG-REVIEWCITE` 규칙 10 이 금지).
 * 커밋하지 않는 경로라 다른 체크아웃에는 없다. 옛 커밋 산출물 `review/<종류>/…` 는 규칙 1 이
 * 유지하는 인용이라 세지 않는다(앞의 `.` 로 가른다).
 */
export const LOCAL_REVIEW_PATH = /(?<![\w-])\.review\/(?:code|consistency|merge|spec-coverage)\//;

/**
 * `finding` 바로 뒤의 줄인 발견 ID(`CLE-ENG-REVIEWCITE` 규칙 9 가 금지). NERV 발견 ID 는
 * UUIDv7 이라 앞 8자가 같은 분에 생긴 발견끼리 겹친다. 전체 ID 는 8자 뒤에 `-` 가 이어지므로
 * 걸리지 않는다. `finding <ID> · <ID>` 나열의 둘째 이후 ID 는 보지 않는다.
 */
export const SHORT_FINDING_ID = /\bfinding\s+[0-9a-f]{8}(?![0-9a-f-])/;

/** 줄 단위로 `pattern` 에 맞는 줄 수. 한 줄에 여러 번 나와도 1 이다. */
export function countMatchingLines(text: string, pattern: RegExp): number {
  let n = 0;
  for (const line of text.split("\n")) if (pattern.test(line)) n += 1;
  return n;
}

/** 파일마다 `pattern` 에 맞는 줄 수. 0 인 파일은 담지 않는다. */
export function countByFile(
  files: readonly MdFileRef[],
  pattern: RegExp,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    const n = countMatchingLines(fs.readFileSync(f.absPath, "utf8"), pattern);
    if (n > 0) out[f.relPath] = n;
  }
  return out;
}

/** 파일마다 `pattern` 에 맞는 줄의 위치(`<파일>:<줄>`). 실패 메시지에 쓴다. */
export function findMatchingLines(
  files: readonly MdFileRef[],
  pattern: RegExp,
): string[] {
  const out: string[] = [];
  for (const f of files) {
    const lines = fs.readFileSync(f.absPath, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) out.push(`${f.relPath}:${i + 1}`);
    });
  }
  return out;
}

/** 래칫 기준값과 실측의 차이 한 건. */
export interface RatchetDelta {
  file: string;
  baseline: number;
  actual: number;
}

/**
 * 파일별 실측을 기준값과 견준다. 기준값에 없는 파일은 0 으로 본다.
 *
 * 늘어난 파일(`grown`)과 줄어든 파일(`shrunk`)을 따로 낸다. 줄어든 쪽도 실패로 다루는 것이
 * 이 저장소 래칫의 관례다(`scripts/_typecheck_ratchet.py`). 기준값을 낮추지 않으면 그 파일은
 * 줄어든 만큼 새 언급을 조용히 받아들인다.
 */
export function compareToBaseline(
  actual: Readonly<Record<string, number>>,
  baseline: Readonly<Record<string, number>>,
): { grown: RatchetDelta[]; shrunk: RatchetDelta[] } {
  const files = [...new Set([...Object.keys(actual), ...Object.keys(baseline)])].sort();
  const grown: RatchetDelta[] = [];
  const shrunk: RatchetDelta[] = [];
  for (const file of files) {
    const b = baseline[file] ?? 0;
    const a = actual[file] ?? 0;
    if (a > b) grown.push({ file, baseline: b, actual: a });
    if (a < b) shrunk.push({ file, baseline: b, actual: a });
  }
  return { grown, shrunk };
}

/** 정렬한 사본. 기준값 파일을 결정적으로 쓰려고 쓴다. */
export function sortedRecord(
  rec: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * 링크로 감싸지 않은 스펙 키 언급. `CLE-` 뒤에 대문자 · 숫자 토큰이 하이픈으로 이어진 낱말이다.
 *
 * 앞뒤에 영숫자나 `-` 가 붙으면 키가 아니다. 그래서 자리표시자(`CLE-T-…`, `CLE-ENG-…`)와
 * 글로브(`CLE-*`)는 걸리지 않는다. 경로 안의 키(`spec/CLE-API/CLE-API-ERRCODES.md`)는 영역 키와
 * 문서 키 둘로 센다.
 */
const KEY_MENTION = new RegExp(
  `(?<![A-Za-z0-9-])${SPEC_KEY_RE.source.slice(1, -1)}(?![A-Za-z0-9-])`,
  "g",
);

/** NERV Task 키(`CLE-T-` + 6자). 스펙 키가 아니라 건너뛴다. */
const TASK_KEY = /^CLE-T-[A-Z0-9]{6}$/;

/** 텍스트의 스펙 키 언급(Task 키 제외). 나온 순서대로, 중복 포함. */
export function extractSpecKeyMentions(text: string): string[] {
  return [...text.matchAll(KEY_MENTION)]
    .map((m) => m[0])
    .filter((k) => !TASK_KEY.test(k));
}

/**
 * 키 언급에 문제가 없으면 `null`, 있으면 그 이유.
 *
 * 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 미러로 확인할 수 없어 통과시킨다.
 * 키 링크와 달리 링크 없는 언급은 카탈로그를 가리켜도 된다(`CLE-ENG-SPECEVIDENCE` 규칙 18).
 */
export function specKeyMentionProblem(
  key: string,
  mirrorKeys: ReadonlySet<string>,
): string | null {
  if (mirrorKeys.has(key)) return null;
  if (isUnmirroredArea(key)) return null;
  return "미러에 없는 스펙 키다. NERV 에 있는 키면 python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…> --spec <KEY> 로 미러에 받는다";
}
