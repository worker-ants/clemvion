import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./spec-frontmatter-parse";
import { extractLinks, findBrokenPlanLinks } from "./spec-links";
import {
  checkPlanFrontmatter,
  collectCompletePlanMarkdown,
  collectLivePlanMarkdown,
  findNonTerminalCompletedPlans,
  type FrontmatterViolationKind,
} from "./plan-scan";

// Guard: plan 라이프사이클 불변식 3종.
//
//   (1) top-level `plan/in-progress/*.md` 의 `worktree`/`started`/`owner` frontmatter.
//       plan-coherence 충돌 검출과 stale-audit 이 실데이터 위에서 돌게 하는 전제다.
//   (2) `plan/complete/**` 가 `status` 를 선언했다면 종료 상태여야 한다.
//   (3) top-level 살아있는 plan 의 상대링크가 실재 파일을 가리켜야 한다.
//
// SoT 는 `.claude/docs/plan-lifecycle.md §4`. 이 파일은 **호출부일 뿐**이고 판정 로직은
// 전부 밖에 있다 — `plan-scan.ts`(수집·frontmatter·status), `spec-links.ts`(링크).
// 세 검사 모두 `plan-scan.test.ts`/`spec-links.test.ts` 의 합성 fixture 가 "위반을 실제로
// 잡는다" 를 양성으로 증명한다. 판정을 여기 인라인으로 두면 실저장소가 정상인 한 위반
// 분기가 영원히 실행되지 않는다(`spec-links.ts` 는 `collectLivePlanMarkdown` 도 export
// 하지만 그건 하위호환 re-export 다).
//
// 스코프: (1)(3) 은 top-level `plan/in-progress/*.md` 만. 하위 그룹 폴더는 클러스터 index
// 아래 부속 문서라, `0-`/`_` 접두 index 파일과 함께 면제된다. 그 면제 규칙의 단일 구현은
// `plan-scan.ts` 의 `collectLivePlanMarkdown` 이고 이 파일의 두 검사가 함께 그것을 쓴다.
// (2) 는 `plan/complete/**` 를 본다 — 위반이 거기서만 성립한다.
//
// `worktree` 는 실제 `<task>-<slug>` 이름 또는 명시 sentinel `(unstarted)` 를 받는다.
// 레거시 placeholder(TBD, "assigned at impl-start", "미정", …)는 거부한다 — 살아있지만
// 죽은 worktree 처럼 보여 충돌 검출을 오염시킨다.
//
// (2)(3) 이 왜 필요한가·`plan/complete/**` 를 링크 검사에서 왜 빼는가는 SoT §3/§4 에 있다.
// 이 가드가 잡는 실패의 이력은 커밋 메시지와 `plan/complete/` 산출물을 볼 것 — 코드 주석은
// **현재 규칙**만 담는다(ai-review 가 회고 서사 누적을 지적).

// 스캔 소스는 `collectLivePlanMarkdown` **하나**다. 종전에는 여기서 같은 순회를 손으로
// 재구현했는데, 그 사본이 `0-`/`_` 접두 필터에서 조용히 어긋나 있었다 — 이 파일 상단이
// 경고하는 "두 곳이 조용히 틀어진다" 를 이 파일 자신이 재현한 셈이다(ai-review WARNING #1).
// 접두 면제 규칙은 이제 그 함수가 갖고, 여기서는 절대경로만 뽑는다.
function collectTopLevelPlans(root: string): string[] {
  return collectLivePlanMarkdown(root).map((f) => f.absPath);
}

describe("plan lifecycle guards (frontmatter + live-plan links)", () => {
  const root = repoRoot();
  const plans = collectTopLevelPlans(root);

  it("finds top-level in-progress plans to validate", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass.
    expect(
      fs.existsSync(path.join(root, "plan", "in-progress")),
      `repoRoot missing plan/in-progress/: ${root}`,
    ).toBe(true);
    // 하한은 "discovery 가 살아있는가" 만 본다 — in-progress plan 수는 grooming 으로
    // 정상적으로 줄어드는 값이라 실제 개수에 가깝게 잡으면 plan 을 닫을 때마다 깨진다
    // (2026-07-17: 종전 `> 20` 이 grooming 후 정확히 20 이 되어 발화).
    expect(plans.length).toBeGreaterThan(5);
    // 특정 plan 파일명에 의존하지 않는다 — 그 파일이 complete/ 로 이동하면 테스트가
    // 깨지는 fragility 회피(ai-review WARNING#1). discovery 가 plan/in-progress 의
    // 실제 .md 만 반환하는지로 sanity (잘못된 디렉토리 스캔 → vacuous pass 방지).
    expect(
      plans.every(
        (p) =>
          p.endsWith(".md") &&
          p.includes(`${path.sep}plan${path.sep}in-progress${path.sep}`),
      ),
      "discovered plans must be .md files under plan/in-progress",
    ).toBe(true);
  });

  for (const abs of plans) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    describe(rel, () => {
      // 판정은 전부 `checkPlanFrontmatter` 소관이다. 여기서 하는 일은 그 결과를 필드별
      // `it` 로 갈라 실패 위치를 좁혀 주는 것뿐 — 종전에는 판정이 이 루프 안에 인라인이라
      // 합성 fixture 로 **위반 분기를 한 번도 실행해 보지 못했다**(ai-review WARNING).
      const violations = checkPlanFrontmatter(fs.readFileSync(abs, "utf8"), rel);
      const detailsOf = (...kinds: FrontmatterViolationKind[]): string[] =>
        violations.filter((v) => kinds.includes(v.kind)).map((v) => v.detail);

      it("has a parseable frontmatter block", () => {
        expect(detailsOf("missing-block", "unparseable")).toEqual([]);
      });

      it("`worktree` is set and not a legacy placeholder", () => {
        expect(detailsOf("worktree-missing", "worktree-placeholder")).toEqual([]);
      });

      it("`started` is an ISO date", () => {
        expect(detailsOf("started-invalid")).toEqual([]);
      });

      it("`owner` is set", () => {
        expect(detailsOf("owner-missing")).toEqual([]);
      });
    });
  }

  // ── (b) 살아있는 plan 의 상대링크 무결성 ────────────────────────────────
  //
  // 스캐너는 `spec-links.ts` 의 공유 구현(`findBrokenPlanLinks`)을 쓴다. 초판은 여기에
  // 정규식을 새로 짰는데 그것은 **코드펜스 안의 링크도 실제 링크로 취급**했다 — plan 문서가
  // 예시 스니펫에 없는 경로를 적는 순간 거짓 양성으로 push 가 막힌다(ai-review WARNING #1).
  // 같은 저장소에 펜스 제외·링크 타이틀 처리가 이미 된 스캐너가 있는데 더 약한 사본을 만든
  // 셈이라, 그쪽에 세 번째 진입점을 추가하고 여기서는 부른다.
  it("top-level in-progress plans have no broken relative links", () => {
    const violations = findBrokenPlanLinks(root);
    const rendered = violations.map((v) => `${v.source}:${v.line} → ${v.target}`);
    expect(
      rendered,
      `깨진 상대링크 ${rendered.length}건:\n  ${rendered.join("\n  ")}\n` +
        "plan 을 complete/ 로 옮기면 형제 plan 을 가리키던 상대경로가 그대로 남는다 — " +
        "`../complete/<name>` 로 정정할 것.",
    ).toEqual([]);
  });

  it("the plan link scanner actually sees links (non-vacuity)", () => {
    // 위 단언은 "위반 0건" 을 기대하므로, 스캐너가 조용히 빈 집합을 돌려줘도 영원히 초록이다.
    //
    // **파일 수만 세면 그 캐너리가 이름값을 못 한다** — `extractLinks` 가 항상 `[]` 를
    // 반환해도 파일은 발견되기 때문이다(ai-review testing WARNING). 그래서 discovery 가
    // 아니라 **추출 단계**를 센다: 살아있는 plan 들에서 실제로 뽑힌 링크 수.
    const links = collectLivePlanMarkdown(root).reduce(
      (n, f) => n + extractLinks(f.absPath).length,
      0,
    );
    expect(links, "no links extracted from live plans — the extractor is dead").toBeGreaterThan(50);
  });
});

// ── (a) 완료 plan 의 status 가 디렉터리와 모순되지 않는가 ────────────────────
describe("completed plans declare a terminal status", () => {
  const root = repoRoot();

  it("finds completed plans to validate (discovery only)", () => {
    // **이 단언이 증명하는 것은 discovery 뿐이다** — 이름에 그렇게 적어 둔다. status 판정
    // 로직이 실제로 위반을 잡는다는 것은 `plan-scan.test.ts` 가 합성 fixture 로 증명한다
    // (위반 3건을 심고 정확히 그 3건만 잡히는지까지 단언).
    //
    // 하한은 낮게 잡는다 — 실제 개수에 가깝게 잡으면 grooming 으로 정상적으로 줄어들 때마다
    // 깨진다(in-progress 쪽이 정확히 그렇게 발화한 전례가 있다).
    expect(collectCompletePlanMarkdown(root).length).toBeGreaterThan(5);
  });

  it("no completed plan declares a non-terminal status", () => {
    // 판정 로직은 `plan-scan.ts` 에 있고 `plan-scan.test.ts` 가 합성 fixture 로 **실제
    // 탐지**를 증명한다. 여기(실저장소)는 positive-only 라 그것만으로는 검사가 작동한다는
    // 증거가 되지 못한다 — 자매 검사(링크)와 같은 구조로 맞췄다(ai-review WARNING).
    const wrong = findNonTerminalCompletedPlans(root).map(
      (v) => `${v.relPath}: status: ${v.status}`,
    );
    expect(
      wrong,
      `complete/ 에 있으면서 종료 상태가 아닌 plan ${wrong.length}건:\n  ${wrong.join("\n  ")}\n` +
        "이동 시 `status:` 를 함께 갱신하거나, 새 종료 어휘라면 plan-scan.ts 의 " +
        "TERMINAL_PLAN_STATUSES 에 등재할 것.",
    ).toEqual([]);
  });
});
