// plan 트리 스캔 + 라이프사이클 불변식 — **테스트 밖에서 부를 수 있는** 순수 함수들.
//
// ## 왜 별 모듈인가
//
// 이 로직은 원래 `plan-frontmatter.test.ts` 안에 인라인으로 있었다. 그러면 fixture 로
// negative-path 를 증명할 수 없고, 실제로 리뷰가 실측했다 — 158 tests 전량 GREEN 인데
// 위반 수집 분기(`wrong.push`)는 **한 번도 실행되지 않았다.** "위반 0건" 은 검사가
// 작동한다는 증거가 아니다(ai-review WARNING).
//
// 자매 검사인 링크 무결성은 이미 `spec-links.ts` 로 추출돼 fixture 로 탐지를 증명하고
// 있었는데, 같은 파일의 status 검사만 그 교훈을 못 받고 있었다. 둘을 같은 자리로 맞춘다.
//
// ## 스캔 소스가 하나여야 하는 이유
//
// `plan/` 트리를 손으로 순회하는 walker 가 저장소에 네 벌 있었고, 서로 `0-`/`_` 접두
// 처리가 달랐다. 그 차이는 데이터가 그 형태를 갖는 순간에만 드러나므로 **조용히** 어긋난다.
//
// **그 네 벌이 이 구현 하나로 모였다** — live/complete 수집기가 `walkPlanMarkdown` 에서
// 파생되고, Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 도
// `collectCompletePlanMarkdown` 위임 3줄로 축소됐다. 종전에는 필터 값이 **우연히** 같았을
// 뿐 그것을 강제하는 것이 없었다.
//
// **2026-08-11 후속**: 여기서 "별 문제" 로 미뤄 뒀던 `spec-links.ts` 쪽 walker 둘까지
// 포함해, 저장소의 손수 짠 DFS 는 **여섯 벌**이었다(당시엔 넷으로 셌다 — spec/codebase
// 트리를 보는 것들을 세는 범위 밖에 뒀기 때문이다). 여섯이 `tree-walk.ts` 의 `walkTree`
// 하나로 모였고 `walkPlanMarkdown` 도 그 위의 얇은 호출부가 됐다. 세는 범위를 좁게 잡으면
// 자매 사이의 차이가 안 보인다 — 실제로 이 파일과 `impl-anchor-parse.ts` 가 `_` 접두를
// 서로 다른 대상(파일명 vs 디렉터리명)에 걸고 있었는데 그 사실이 어디에도 없었다.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { walkTree, type MdFileRef } from "./tree-walk";

/**
 * plan 트리의 `.md` 한 건. 구조는 `MdFileRef` 와 같고 **이름만 도메인에 붙였다** —
 * `spec-links.ts` 가 spec 도 codebase 도 한 타입(`SpecMdFile`)으로 받아 혼동을 낳았던
 * 것과 달리, 이쪽은 처음부터 plan 전용으로 읽히길 원한다.
 */
export type PlanMdFile = MdFileRef;

/**
 * `0-`/`_` 접두는 인덱스 **파일**이라 라이프사이클 plan 이 아니다.
 *
 * **디렉터리 이름에는 적용하지 않는다** — `plan/complete/0-batch/child.md` 는 수집된다
 * (fixture 로 고정). 면제 근거가 "인덱스 문서는 작업 plan 이 아니다" 라서 파일 단위로만
 * 성립하고, 디렉터리까지 넓히면 그 안의 진짜 plan 들이 통째로 가드 밖으로 빠진다.
 * 현재 저장소에 그런 디렉터리는 없어 동작 차이는 없다(실측) — 그래서 데이터로는 의도와
 * 사고가 안 갈리고, fixture 가 그 선택을 대신 고정한다.
 *
 * Gate C(`collectCompletePlans`)와 `plan-frontmatter.test.ts` 의 frontmatter 검사가 이미
 * 쓰던 규칙을 여기로 모았다. **다만 완료-plan status 검사는 이번에 처음 이 면제를 갖는다**
 * — 그 검사 자체가 신설이라 "예전부터" 가 아니다(ai-review INFO). 규칙을 맞춘 이유는 한
 * 트리를 보는 검사들이 서로 다른 집합을 보면 "이 파일은 어느 가드가 지키는가" 가 사람마다
 * 달라지기 때문이고, 현재 데이터에는 해당 파일이 없어 동작 차이는 없다(fixture 로 고정).
 */
function isLifecyclePlan(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith("0-") && !name.startsWith("_");
}

/**
 * `plan/<bucket>/` 아래 `.md` 수집. `recurse: false` 면 top-level 만.
 * `archive/` 는 옛 memory/user_memo 보관소라 언제나 제외한다.
 */
function walkPlanMarkdown(
  root: string,
  bucket: string,
  options: { recurse: boolean },
): PlanMdFile[] {
  return walkTree(root, [path.join("plan", bucket)], {
    skipDir: (name) => name === "archive",
    includeFile: (name) => isLifecyclePlan(name),
    recurse: options.recurse,
  });
}

/** 살아있는 plan — top-level `plan/in-progress/*.md`. 하위 그룹 폴더는 부속 문서라 제외. */
export function collectLivePlanMarkdown(root: string): PlanMdFile[] {
  return walkPlanMarkdown(root, "in-progress", { recurse: false });
}

/** 완료된 plan — `plan/complete/**.md` (archive 제외). */
export function collectCompletePlanMarkdown(root: string): PlanMdFile[] {
  return walkPlanMarkdown(root, "complete", { recurse: true });
}

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  /** frontmatter **원문** 블록 — 파싱이 값을 바꾸는 필드(날짜)는 이쪽을 봐야 한다. */
  block: string;
}

/**
 * frontmatter 파싱 **단일 진입점**. 실패하면 `null`.
 *
 * `matter(raw, {})` 의 빈 옵션 객체가 핵심이다 — gray-matter 는 옵션이 없을 때 내용을 키로
 * 캐시하는데 캐시 등록이 파싱 **전에** 일어난다. 파싱이 throw 하면 부분 초기화 객체가 남아
 * **같은 내용의 두 번째 호출은 throw 없이 `data={}`** 를 돌려준다(실측: 1회차 THROW →
 * 2회차 NOTHROW → 옵션 전달 시 다시 THROW). 즉 깨진 frontmatter 가 **호출 순서에 따라**
 * 조용히 빈 값으로 보인다.
 *
 * 범위는 **한 테스트 파일 안**이다 — vitest 기본 `isolate: true` 라 파일마다 모듈
 * 레지스트리가 따로여서 파일을 넘는 오염은 없다(실측). 한 파일이 같은 내용을 두 번 파싱할
 * 때만 성립한다.
 *
 * **함수로 묶은 이유**: 종전에는 이 관용구가 네 호출부에 손으로 복제돼 있었고, 실제로 그중
 * 하나만 고쳤다가 리뷰에 잡혔다. 다섯 번째 파서 호출이 추가될 때 `{}` 를 빠뜨리면 조용히
 * 되살아나는 종류라 진입점을 하나로 둔다.
 */
export function parseFrontmatterSafe(raw: string): ParsedFrontmatter | null {
  try {
    return toParsed(matterNoCache(raw));
  } catch {
    return null;
  }
}

/**
 * gray-matter 호출의 **유일한 자리**. 캐시 우회 관용구(`{}`)가 여기에만 있다.
 *
 * 위 `parseFrontmatterSafe` 는 실패를 `null` 로 삼키는데, `spec-frontmatter-parse.ts` 는
 * 실패 **메시지**를 리포트에 실어야 해서 그 정책을 쓸 수 없다. 그래서 종전에는 그쪽이
 * 옵션 없는 `matter(raw)` 를 따로 부르고 있었다 — 오늘은 `spec/**` 만 읽어 plan 스캐너와
 * 내용이 겹치지 않아 무해하지만, **그 전제를 코드가 강제하지 않는다**. 한쪽이 언젠가 같은
 * 파일을 읽는 순간 조용히 되살아난다.
 *
 * 관용구를 여기 한 자리로 모으고 **에러 정책만 호출부가 고른다** — 삼킬 것인가(`null`),
 * 메시지를 남길 것인가. 그래야 "다섯 번째 호출부가 `{}` 를 빠뜨린다" 는 원래 위험이
 * 정책 선택과 무관하게 닫힌다.
 */
export function matterNoCache(raw: string): matter.GrayMatterFile<string> {
  return matter(raw, {});
}

function toParsed(parsed: matter.GrayMatterFile<string>): ParsedFrontmatter {
  return { data: parsed.data ?? {}, block: parsed.matter ?? "" };
}

/**
 * `plan/complete/**` 에서 허용되는 `status` 값.
 *
 * `in-progress` 는 **디렉터리와 정면으로 모순**이라 여기 없다 — 그것이 이 저장소가 두 번
 * 겪은 실패다(`#1108`·`#1117`). 나머지 셋은 실측으로 발견된 기존 어휘로, 눕히지 않고
 * 보존한다: 특히 `superseded` 는 "대체됨" 이라 완료가 아니고 일괄 `complete` 로 바꿨다면
 * 그 의미가 사라진다.
 */
export const TERMINAL_PLAN_STATUSES: ReadonlySet<string> = new Set([
  "complete",
  "implemented",
  "applied",
  "superseded",
]);

export interface NonTerminalPlan {
  relPath: string;
  status: string;
}

/**
 * `plan/complete/**` 에 있으면서 종료 상태가 아닌 `status` 를 선언한 plan.
 *
 * `status` 는 **선택 필드**다(`plan-lifecycle.md §4` — 필수는 worktree/started/owner 셋).
 * 선언하지 않은 문서는 위반이 아니며, 선언했는데 디렉터리와 모순되는 것만 잡는다.
 * frontmatter 파싱 실패는 이 검사의 관심사가 아니라 건너뛴다 —
 * `spec-plan-completion.test.ts` 의 "every completed plan has parseable frontmatter"
 * 가 그 자리다. **그 캐너리가 생기기 전에는 아무도 안 봤다**(파싱 실패한 완료 plan 은
 * 이 검사도 Gate C 도 조용히 통과했다).
 */
export function findNonTerminalCompletedPlans(root: string): NonTerminalPlan[] {
  const out: NonTerminalPlan[] = [];
  for (const f of collectCompletePlanMarkdown(root)) {
    // 파싱 실패는 건너뛴다 — 위 JSDoc 참조(전담 캐너리가 따로 있다).
    const parsed = parseFrontmatterSafe(fs.readFileSync(f.absPath, "utf8"));
    if (parsed === null) continue;
    const status = parsed.data.status;
    if (typeof status !== "string") continue;
    if (!TERMINAL_PLAN_STATUSES.has(status)) {
      out.push({ relPath: f.relPath, status });
    }
  }
  return out;
}

/**
 * frontmatter 파싱이 **실패하는** 완료 plan.
 *
 * 파싱 실패는 `findNonTerminalCompletedPlans` 도 Gate C 도 조용히 건너뛴다 — 완료 시점에
 * `spec_impact`/`status` 를 손으로 넣다가 YAML 을 깨뜨리면 그 plan 이 **모든 게이트를
 * 우회**한다. 실제로 이 함수를 만들자마자 실저장소에서 2건이 나왔다(`title:`/`worktree:`
 * 값 안의 콜론+공백이 중첩 매핑으로 해석돼 파싱 실패 — 그 두 plan 의 `status: complete`
 * 도 `spec_impact` 도 그때까지 아무도 안 보고 있었다).
 */
export function findUnparseablePlans(root: string): string[] {
  return collectCompletePlanMarkdown(root)
    .filter((f) => parseFrontmatterSafe(fs.readFileSync(f.absPath, "utf8")) === null)
    .map((f) => f.relPath);
}

/** `worktree` 가 아직 없을 때 쓰는 명시 sentinel. placeholder 와 달리 허용된다. */
export const WORKTREE_SENTINEL = "(unstarted)";

/**
 * 레거시 placeholder — "값이 없음" 을 표현하려면 `WORKTREE_SENTINEL` 을 쓴다.
 *
 * 거부하는 이유는 이 필드의 **현재** 소비처 둘이다(`plan-lifecycle.md §4`):
 * `plan-stale-audit.sh` 가 이 값으로 worktree 실재 여부를 확인하고, plan 게이트의 연결
 * 판정이 이 값을 현재 worktree/branch 와 매칭한다. placeholder 는 앞에서는 죽은 worktree
 * 로 보이고 뒤에서는 **어떤 worktree 와도 매칭되지 않아** plan 이 게이트에서 사라진다.
 *
 * (종전 주석은 `plan_coherence` 의 cross-worktree 충돌 검출을 근거로 들었는데 그 기능은
 * `3da85dc3b`(#576)에서 제거됐다 — 병렬 작업이 다른 머신·세션이면 로컬에 안 보여
 * 신뢰할 수 없었기 때문이다. SoT 본문에도 같은 낡은 근거가 남아 있어 함께 정정했다.)
 */
const WORKTREE_PLACEHOLDER = /\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * frontmatter **원문**에서 스칼라 한 줄을 뽑는다(양쪽 따옴표 제거).
 *
 * `started` 를 파싱 결과로 보면 안 되기 때문에 필요하다 — 아래 `isIsoDate` 주석 참조.
 */
export function rawScalar(block: string, key: string): string | null {
  // **들여쓰기 0 만 매치한다.** 종전에는 `^[ \t]*` 를 허용해, 앞선 필드의 multi-line
  // block scalar(`|`/`>`) 안에 `started:` 로 시작하는 줄이 있으면 그것을 먼저 잡았다 —
  // 그 값이 `isIsoDate`/`isGateCEnforced` 로 그대로 흘러가 Gate C 판정을 오염시킨다.
  // frontmatter 최상위 키는 항상 0열이므로 좁혀도 잃는 것이 없다(ai-review WARNING).
  // `key` 는 정규식으로 들어가므로 이스케이프한다 — 지금 호출부는 리터럴 하나뿐이라
  // 즉시 위험은 없지만 export 된 범용 유틸이라 메타문자가 오면 **조용히** 틀어진다.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^${escaped}:[ \\t]*(.*)$`, "m").exec(block);
  if (!m) return null;
  return m[1].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}

/**
 * `started` 가 실재하는 날짜인가. **원문 문자열**을 받는다.
 *
 * 파싱 결과를 보면 안 된다 — js-yaml 이 잘못된 날짜를 **조용히 굴려 유효한 `Date` 로**
 * 만들기 때문이다(실측): `2026-13-32` → `Date(2027-02-01)`, `2027-02-29` → `2027-03-01`,
 * `2026-02-30` → `2026-03-02`. 즉 `value instanceof Date && !isNaN` 검사는 **전부 통과**시킨다.
 *
 * 자리수만 보는 것도 부족하다(종전 검사가 `/^\d{4}-\d{2}-\d{2}$/` 뿐이라 `2026-13-32` 통과).
 * 그래서 원문을 형태로 거른 뒤 파싱 결과를 입력과 **라운드트립 비교**한다.
 */
export function isIsoDate(text: string | null): boolean {
  if (text === null) return false;
  const m = ISO_DATE.exec(text);
  if (!m) return false;
  const [, y, mo, d] = m;
  const parsed = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // 라운드트립 비교는 **"일" 하나면 충분하다**(실측). 월이 범위를 벗어나면
  // (`2026-13-01`·`2026-00-01`) ISO 파싱이 NaN 을 주고, 일이 넘치면(`2026-02-30` → 3/2)
  // 월과 일이 **항상 함께** 틀어진다. 연은 4자리 정규식을 통과한 이상 어긋날 수 없다.
  // 연·월 비교를 함께 두면 그 둘은 어떤 입력으로도 관측되지 않는 죽은 분기가 된다
  // (뮤테이션으로 발각: 각각을 지워도 나머지가 막아 스위트가 초록이었다).
  return parsed.getUTCDate() === Number(d);
}

export type FrontmatterViolationKind =
  | "missing-block"
  | "unparseable"
  | "worktree-missing"
  | "worktree-placeholder"
  | "started-invalid"
  | "owner-missing";

export interface FrontmatterViolation {
  relPath: string;
  kind: FrontmatterViolationKind;
  detail: string;
}

/**
 * 살아있는 plan 한 건의 frontmatter 필수 3필드 판정. **문자열 입력**이라 fixture 가
 * 파일시스템 없이 각 분기를 직접 겨눌 수 있다.
 *
 * 필수는 `worktree`/`started`/`owner` 셋이다(`plan-lifecycle.md §4`). 파싱 자체가
 * 실패하면 필드 판정은 의미가 없어 거기서 멈춘다.
 */
export function checkPlanFrontmatter(
  raw: string,
  relPath: string,
): FrontmatterViolation[] {
  const out: FrontmatterViolation[] = [];
  const add = (kind: FrontmatterViolationKind, detail: string): void => {
    out.push({ relPath, kind, detail });
  };

  if (!raw.startsWith("---")) {
    add("missing-block", "frontmatter 블록이 없다");
    return out;
  }
  const parsed = parseFrontmatterSafe(raw);
  if (parsed === null) {
    add("unparseable", "frontmatter 파싱 실패");
    return out;
  }
  const { data, block } = parsed;

  // `.trim()` 은 필수다 — 공백만 있는 값(`worktree: "   "`)은 길이가 0 이 아니라서
  // 종전 검사를 통과했다. 이 가드가 막으려는 것이 정확히 "살아있어 보이지만 죽은 값" 이다.
  const wt = data.worktree;
  if (typeof wt !== "string" || wt.trim().length === 0) {
    add("worktree-missing", `worktree=${JSON.stringify(wt)}`);
  } else if (wt !== WORKTREE_SENTINEL && WORKTREE_PLACEHOLDER.test(wt)) {
    add(
      "worktree-placeholder",
      `worktree "${wt}" 는 placeholder — 실제 이름이나 "${WORKTREE_SENTINEL}" 을 쓸 것`,
    );
  }

  const started = rawScalar(block, "started");
  if (!isIsoDate(started)) {
    add("started-invalid", `started=${JSON.stringify(started)}`);
  }

  const owner = data.owner;
  if (typeof owner !== "string" || owner.trim().length === 0) {
    add("owner-missing", `owner=${JSON.stringify(owner)}`);
  }

  return out;
}

/** 살아있는 top-level plan 전체의 frontmatter 위반. */
export function findFrontmatterViolations(root: string): FrontmatterViolation[] {
  const out: FrontmatterViolation[] = [];
  for (const f of collectLivePlanMarkdown(root)) {
    out.push(...checkPlanFrontmatter(fs.readFileSync(f.absPath, "utf8"), f.relPath));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gate C — 완료 plan 의 spec 정합 결정(`spec_impact`) 판정.
//
// **`spec-plan-completion.test.ts` 에서 옮겨왔다.** 그 파일이 `describe` 와 판정 함수를
// 함께 갖고 있어, 다른 스크립트(pre-commit hook 등)가 같은 판정을 쓰려면 **테스트 파일을
// import** 해야 했다 — 이 모듈이 존재하는 이유("테스트 밖에서 부를 수 있는 순수 함수들")의
// 정면 예외였고 리뷰가 세 번 짚었다.
//
// 게이트 자체(`describe`)는 그대로 그 파일에 있다 — SoT 표(`spec-impl-evidence.md §4.2`)와
// `code:` 등재가 가리키는 대상이 바뀌지 않는다.
// ---------------------------------------------------------------------------

export const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z");
export const NONE_VALUES = new Set(["none", "없음", "n/a", "na"]);

/**
 * `started` 를 **원문 스칼라**에서 읽어 컷오프 비교용 날짜로 만든다. 무효면 `null`.
 *
 * 원문을 보고 `isIsoDate` 로 거르는 것이 핵심이다 — 종전에는 파싱 결과를 그대로 받아
 * **망가진 날짜가 Gate C 를 통째로 면제받았다**(실측):
 *
 * | `started` | 종전 결과 | Gate C |
 * |---|---|---|
 * | `"2026-13-32"` | `Invalid Date` → `null` | **미강제** |
 * | `2026-00-10` | js-yaml 이 `2025-12-10` 으로 굴림 | **미강제**(컷오프 이전) |
 *
 * `plan/complete/**` 는 `checkPlanFrontmatter`(in-progress 전용)의 보호를 받지 못해 이
 * 파일이 유일한 방어선이다. 무효를 **조용히 넘기지 않도록** 아래 별도 `it` 이 표면화한다.
 */
function startedDate(block: string): Date | null {
  const raw = rawScalar(block, "started");
  if (!isIsoDate(raw)) return null;
  return new Date(`${raw}T00:00:00Z`);
}

/**
 * 이 완료 plan 이 Gate C 강제 대상인가. **frontmatter 원문 블록**을 받는다 — 파싱 결과를
 * 받던 종전 시그니처로는 위 표의 두 경로를 구분할 수 없었다.
 */
export function isGateCEnforced(block: string): boolean {
  const d = startedDate(block);
  return d !== null && d.getTime() >= GATE_C_CUTOFF.getTime();
}

/** `started` 를 선언했는데 그 값이 달력상 실재하지 않으면 위반이다(조용한 면제 차단). */
export function hasMalformedStarted(block: string): boolean {
  const raw = rawScalar(block, "started");
  return raw !== null && !isIsoDate(raw);
}

export function hasValidSpecImpact(
  impact: unknown,
  specExists: (p: string) => boolean,
): boolean {
  if (typeof impact === "string") {
    return NONE_VALUES.has(impact.trim().toLowerCase());
  }
  if (Array.isArray(impact)) {
    return (
      impact.length > 0 &&
      impact.every((p) => typeof p === "string" && specExists(p))
    );
  }
  return false;
}

/**
 * `spec_impact` 리스트에서 **게이트를 통과하면 안 되는** 원소들.
 *
 * 비-문자열 원소도 위반이다 — 종전 필터는 `typeof p === "string" && !exists(...)` 라
 * **문자열이 아닌 원소를 조용히 통과**시켰다(`spec_impact: [123]` 이 dangling 목록에서
 * 빠진다, fail-open). "선언은 있는데 무엇을 건드렸는지 아무도 모르는 상태" 를 막는
 * 게이트라 그 구멍이 곧 게이트의 부재다.
 *
 * **순수 함수로 뺀 이유**: 실제 강제 경로는 실저장소 데이터만 보는데 거기엔 비-문자열
 * `spec_impact` 가 없다 — 인라인으로 두면 이 판정을 되돌려도 스위트가 초록이다(뮤테이션
 * 실측: 되돌린 뮤턴트가 **생존**했다). 합성 fixture 로 겨눌 수 있어야 한다.
 */
export function findDanglingSpecImpact(
  impact: unknown[],
  specExists: (p: string) => boolean,
): unknown[] {
  return impact.filter((p) => typeof p !== "string" || !specExists(p));
}

/**
 * `spec_impact` 원소가 **실재하는 spec 파일**을 가리키는가.
 *
 * `fs.existsSync(path.join(root, p))` 만으로는 부족하다(실측):
 * `path.join(root, "")` 는 `root` 로 정규화되고 저장소 루트는 늘 존재하므로
 * **`spec_impact: [""]` 이 유효로 판정된다.** 디렉터리 경로(`"spec"`)도 마찬가지다.
 * 헤더 주석은 "리스트 원소는 실재 spec **파일**" 이라 못박는데 구현은 "무엇이든
 * 존재하면 OK" 였다 — 문서한 보장이 구현보다 넓은 형태.
 */
export function makeSpecExists(root: string): (p: string) => boolean {
  return (p) => {
    // **`spec/` 하위여야 한다.** 존재 여부만 보면 `spec_impact: ["CLAUDE.md"]` 나
    // `["codebase/frontend/package.json"]` 이 통과한다(실측) — 이 게이트의 존재 이유가
    // "**어느 spec 을** 건드렸는지 기록하게 한다" 인데 그걸 그대로 비껴간다.
    //
    // **문자열 접두 검사만으로는 부족하다** — `"spec/../CLAUDE.md"` 는
    // `startsWith("spec/")` 를 통과하고 `path.join` 이 루트 파일로 정규화한다(실측).
    // 경로에 대한 술어는 **정규화한 뒤에** 물어야 한다.
    const specRoot = path.join(root, "spec");
    const resolved = path.resolve(root, p);
    if (resolved !== specRoot && !resolved.startsWith(specRoot + path.sep)) {
      return false;
    }
    try {
      // `isFile()` 하나면 나머지가 다 걸린다 — 디렉터리도 없는 경로도 여기서 false 다
      // (별도 빈-문자열 검사를 뒀더니 뮤테이션에서 생존했다 = 도달 불가 분기였다).
      return fs.statSync(resolved).isFile();
    } catch {
      return false;
    }
  };
}
