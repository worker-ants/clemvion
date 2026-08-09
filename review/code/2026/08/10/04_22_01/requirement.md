# 요구사항(Requirement) 리뷰 — plan lifecycle gates (plan-scan.ts / spec-plan-completion.test.ts)

## 발견사항

- **[WARNING]** `plan-scan.ts` 모듈 상단 docstring 이 Gate C 의 `collectCompletePlans` 통합 상태를 **stale 하게** 서술한다 — 실제 구현과 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22`
  - 상세: 이 docstring 은 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 **아직 독립 구현으로 남아 있고**(면제 규칙 값은 현재 일치 — 실측), 그 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재했다" 라고 적는다. 그러나 실제 `spec-plan-completion.test.ts` 를 열어보면 (`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:62-64`) `collectCompletePlans` 는 이미 공유 구현 `collectCompletePlanMarkdown` 을 그대로 위임 호출하는 얇은 wrapper 다 — "독립 구현" 이 아니다. 같은 PR 이 인용하는 `plan/in-progress/docs-guard-walker-dedup.md` 문서 자체의 "2026-08-10 추가" 절(line 60-69)도 "Gate C 동등성 갭도 ... 그 PR 에서 해소했다(`collectCompletePlans` 를 공유 구현 위임으로 축소)" 라고 명시해, 통합이 **이미 완료**됐음을 스스로 인정한다. 즉 `plan-scan.ts` 의 docstring 은 그 완료 사실을 반영하지 못한 채 예전 초안 그대로 남아, 향후 독자가 "아직 미완 작업" 으로 오인하게 만든다. 같은 문서(`docs-guard-walker-dedup.md`) 의 "함께 볼 것" 절(line 51-58) 체크박스도 미체크 상태로 남아 있어 자기모순이다.
  - 제안: `plan-scan.ts` 의 해당 문단을 "Gate C 의 `collectCompletePlans` 도 이번 PR 에서 `collectCompletePlanMarkdown` 위임으로 전환 완료" 로 갱신하고, `docs-guard-walker-dedup.md` 의 해당 체크박스를 `[x]` 로 정리(또는 항목 제거)한다.

- **[WARNING]** `enforced` 필터가 export 된 `isGateCEnforced` 를 재사용하지 않고 동일 로직을 인라인 복제한다 — 이 PR 자신이 반복 경고하는 "판정 로직 이중화" 패턴 재발.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:71-79` (인라인 복제) vs `:38-41` (`isGateCEnforced` 정의)
  - 상세: `isGateCEnforced(data)` 는 정확히 `startedDate(data)` 를 구해 `d !== null && d.getTime() >= GATE_C_CUTOFF.getTime()` 를 반환하도록 "재사용 가능한 판정 predicate" 로 export 됐다(주석: "Pure enforcement predicates — unit-tested below so the gate is provably live"). 그런데 실제 `enforced` 필터(line 71-79)는 `isGateCEnforced(parsed.data)` 를 호출하지 않고 같은 두 줄(`startedDate` 호출 + cutoff 비교)을 손으로 다시 적었다. 현재는 동작이 100% 동일하지만, 이 파일 자신의 주석들이 반복해서 경고하는 실패 모드("한쪽만 고치면 조용히 갈린다" — line 59-61 근처)가 바로 이 자리에 재현돼 있다. cutoff 비교 로직이 나중에 바뀌면 이 두 자리 중 하나만 고쳐질 위험이 있다.
  - 제안: `enforced` 필터를 `isGateCEnforced(parsed.data)` 호출로 교체.

- **[WARNING]** `spec_impact` 배열의 비-문자열 원소가 "dangling 경로 검증" 을 조용히 우회한다 — `hasValidSpecImpact` 헬퍼가 구현한 더 엄격한 규칙이 실제 강제 경로(per-plan `it` 블록)에는 반영돼 있지 않다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:108-117` (`each spec_impact spec path exists` — 실제 강제) vs `:43-57` (`hasValidSpecImpact` — synthetic 전용, 실제 게이트에서 미사용)
  - 상세: 실 게이트에서 dangling 판정은 `impact.filter((p) => typeof p === "string" && !fs.existsSync(...))` 로, 문자열이 아닌 원소는 `typeof p === "string"` 조건에서 걸러져 dangling 목록에 아예 들어가지 않는다 — 즉 `spec_impact: [123]` 같은 배열은 "declares" 검사(비어있지 않은 배열)도 통과하고 "path exists" 검사(dangling=[])도 통과해 Gate C 전체를 통과한다. 반면 같은 파일에 정의된 `hasValidSpecImpact(impact, specExists)` 는 `impact.every((p) => typeof p === "string" && specExists(p))` 로 비-문자열 원소를 정확히 거부하도록 구현돼 있는데, 이 함수는 "Gate C enforcement logic" synthetic describe 블록에서만 unit-test 되고 실제 per-plan 강제 경로에는 쓰이지 않는다. 결과적으로 "리스트 항목은 실존 spec 파일이어야 한다"(`plan-lifecycle.md` §Gate C) 라는 불변식이 비-문자열 원소에 대해서는 실제로 강제되지 않는 gap 이 있다. 실사용상 사람이 손으로 쓰는 YAML 이라 발생 가능성은 낮지만, 어떤 현재 fixture 도 이 분기를 커버하지 않는다.
  - 제안: "each `spec_impact` spec path exists" `it` 블록에서 non-string 원소도 실패로 잡도록 `dangling` 계산을 `impact.filter((p) => typeof p !== "string" || !fs.existsSync(...))` 형태로 바꾸거나, 아예 두 곳 모두 `hasValidSpecImpact` 를 재사용해 판정을 단일화.

- **[INFO]** `startedDate()` 는 `started` 값의 달력 유효성을 검증하지 않는다 — 완료 plan 의 `started` 는 어디에서도 `isIsoDate` 급 라운드트립 검증을 받지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:27-34`
  - 상세: `plan-scan.ts` 의 `isIsoDate`(라이브 plan 전용, `checkPlanFrontmatter`→`findFrontmatterViolations`)는 `2026-02-30` 류의 "형태는 맞지만 굴러가는 날짜"를 라운드트립 비교로 정확히 거부하도록 공들여 구현돼 있다(주석에 실측 근거까지 남김). 반면 Gate C 의 `startedDate()` 는 형태 정규식(`/^\d{4}-\d{2}-\d{2}$/`)만 통과하면 `new Date(...)` 결과를 그대로(NaN 여부 무관) 반환한다 — day-rollover(`2026-06-31`→7/1 류)가 cutoff(`2026-06-04`) 경계를 넘나들며 enforcement 여부를 조용히 뒤집을 수 있는 이론적 여지가 있다. 또한 **완료 plan** 의 `started` 는 `plan-frontmatter.test.ts`/`findFrontmatterViolations` 스코프(라이브 plan 한정)를 벗어나 있어, 완료 시점에는 어디에서도 `started` 의 달력 유효성이 검증되지 않는다 — 형식이 깨진(혹은 파싱 불가한) `started` 를 가진 완료 plan 은 `isGateCEnforced` 가 "판정 불가 → 미강제" 로 처리해 Gate C 를 영구적으로 우회한다(테스트로 의도적으로 문서화됨: "missing/invalid `started` is not enforced (can't determine)"). spec 본문(`plan-lifecycle.md`)은 이 엣지케이스에 대해 침묵하므로 CRITICAL/WARNING 이 아니라 INFO로 남긴다 — 의도된 fail-open 설계로 보이나, 완료 plan 에서 `started` 를 의도적으로 훼손해 Gate C 를 회피할 수 있다는 점은 인지해 둘 가치가 있다.
  - 제안: (선택) `startedDate` 에 `Number.isNaN(d.getTime())` 체크를 추가해 명시적으로 null 반환하도록 정리하거나, 완료 plan 의 `started` 에도 `isIsoDate` 급 검증을 적용할지 여부를 `plan-lifecycle.md` 에 명문화.

## Spec fidelity 요약

핵심 규칙(각각 line-level 대조 완료)은 모두 spec 과 정확히 일치한다:
- `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}` — `.claude/docs/plan-lifecycle.md §4`, `spec/conventions/spec-impl-evidence.md §2.2` 와 정확히 일치.
- `WORKTREE_SENTINEL = "(unstarted)"` + 레거시 placeholder 거부 — `plan-lifecycle.md §4` 와 일치.
- `GATE_C_CUTOFF = 2026-06-04`, `NONE_VALUES = {none, 없음, n/a, na}` — `plan-lifecycle.md` §Gate C, `spec-impl-evidence.md` R-8 과 3곳 모두 일치(요구된 "3곳 동기" 실측 충족).
- "declares"/"dangling"/"no-op assertion" 3분기 판정 로직이 `plan-lifecycle.md` §Gate C 의 "흔한 실패형" 서술(`ok = (string && 비어있지 않음) || (배열 && length>0)`, bare-string fail, 빈 배열 fail)과 정확히 일치.
- `isLifecyclePlan`(0-/_ 접두 파일 단위 면제, 디렉터리 단위는 비면제)과 `archive/` 재귀 제외가 `plan-lifecycle.md §1`·`spec-impl-evidence.md §4.2` 서술과 일치하며, `plan-scan.test.ts` 의 합성 fixture(`0-batch/child.md`, `_wip/child.md` 는 수집됨을 명시적으로 검증)로 negative-path 까지 실측 증명됨.
- `isIsoDate` 의 라운드트립 검증(월-초과 NaN vs 일-초과 rollover 구분)은 node 로 직접 재현해 주석의 실측 주장(`2026-02-30`→3/2, `2026-13-01`→NaN 등)이 정확함을 확인.

관련 spec 문서(`plan-lifecycle.md`, `spec/conventions/spec-impl-evidence.md`)는 모두 존재하며 이번 변경 범위를 정확히 커버한다 — spec 누락(INFO) 사례 없음. spec 자체의 결함은 발견되지 않았고(코드가 spec 을 정확히 구현), 위 발견사항은 전부 **코드/코드 주석 내부**의 정합성 문제(spec 이 아니라 구현·문서 자기모순)이므로 SPEC-DRIFT 태그는 해당 없음.

## 요약

두 파일은 `.claude/docs/plan-lifecycle.md` §4/§Gate C 및 `spec/conventions/spec-impl-evidence.md` §3/§4.2/R-8 이 규정하는 규칙(TERMINAL_PLAN_STATUSES, WORKTREE_SENTINEL, Gate C cutoff, NONE_VALUES, 0-/_ 면제, archive 제외)을 line-level 로 정확히 구현하며, 과거 "위반 분기가 한 번도 실행되지 않았다"는 결함(158 tests all-green vacuous)을 `plan-scan.test.ts`/`spec-plan-completion.test.ts` 의 합성 fixture 로 실제로 해소했다는 주장도 코드로 확인된다. 다만 (1) `plan-scan.ts` 모듈 docstring 이 같은 PR 안에서 이미 끝난 `collectCompletePlans` 통합을 "아직 미완" 으로 잘못 서술하는 stale comment, (2) `enforced` 필터가 `isGateCEnforced` 를 재사용하지 않고 판정 로직을 인라인 중복한 DRY 위반, (3) `spec_impact` 배열의 비-문자열 원소가 dangling 검증을 조용히 우회하는 edge-case gap 이 발견됐다. 셋 다 기능 자체를 당장 깨뜨리지는 않지만, 이 PR 이 스스로 여러 차례 경고한 "판정 로직 이중화가 조용히 갈린다" 실패 클래스를 새로 재현한다는 점에서 WARNING 으로 분류한다.

## 위험도
LOW
