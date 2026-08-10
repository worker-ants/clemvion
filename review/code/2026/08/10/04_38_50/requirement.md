# 요구사항(Requirement) Review

## 발견사항

- **[WARNING]** Gate C 의 `started` 컷오프 판정이 `isIsoDate`(원문 라운드트립 검증)을 재사용하지 않아, 형태만 맞고 달력상 무효인 `started` 값이 조용히 "미강제(grandfathered)"로 빠질 수 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:27`-`34` (`startedDate`), `39`-`41` (`isGateCEnforced`)
  - 상세: `plan-scan.ts` 는 바로 이 파일 안에서 "js-yaml 이 잘못된 날짜를 조용히 굴려 유효한 `Date` 로 만든다"는 문제를 발견하고(`isIsoDate`, `plan-scan.ts:202-224`), 원문 스칼라 + 라운드트립 비교로 정교하게 고쳤다. 그런데 정작 Gate C 자신의 `startedDate()`는 이 교훈을 재사용하지 않고 옛 방식(자리수 정규식 `/^\d{4}-\d{2}-\d{2}$/` + `new Date()`)을 그대로 쓴다. 실측(`node` 로 직접 재현):
    - `started: "2026-13-32"` (quoted, 형태만 통과) → `new Date(...)` 가 `Invalid Date` 를 반환 → `d.getTime()` = `NaN` → `NaN >= cutoff` = `false` → **미강제로 조용히 통과**(빈 문자열/누락과 구분 없이 "판정 불가"로 처리되지만 실제로는 "파싱 자체가 깨진" 경우다).
    - `started: 2026-00-10` (unquoted) → js-yaml 이 `2025-12-10T00:00:00.000Z` 로 **연도까지 굴려버림** → cutoff(2026-06-04) 이전으로 판정되어 **강제 대상에서 빠진다**(fail-open 방향 — 원래 강제돼야 할 완료 plan 이 `spec_impact` 선언 없이 통과할 수 있다).
    이는 `plan/complete/**` 만 대상이라 `checkPlanFrontmatter`(in-progress 전용, `isIsoDate` 사용)의 보호를 받지 못하는 영역이다 — 즉 이 파일 하나가 유일한 방어선인데 정작 자신이 만든 하드닝을 안 쓴다.
  - 제안: `startedDate()`를 `parseFrontmatterSafe` 가 돌려주는 raw `block` + `rawScalar(block, "started")` + `isIsoDate()` 조합으로 바꾸거나, 최소한 `isGateCEnforced` 진입 전에 `isIsoDate` 검증을 거쳐 "판정 불가"와 "형태는 맞지만 달력상 무효"를 구분해 후자는 위반으로 표면화할 것. (영향 범위는 좁다 — 정상적으로 작성된 `started` 값에는 영향 없음. 다만 이 파일이 정확히 이 버그 클래스를 고치려고 만들어졌다는 점에서 자기 모순적이다.)

- **[INFO]** `isGateCEnforced` 위 docstring이 현재 저장소 상태와 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:36`-`38`
  - 상세: "unit-tested below so the gate is provably live even while every real plan is still grandfathered (enforced set empty)" 라고 적혀 있으나, 실측 결과 현재 `plan/complete/**` 375건 중 263건이 실제로 `enforced` 집합에 들어간다(컷오프 2026-06-04 이후 시작 plan 다수). per-plan `describe` 루프는 이미 vacuous 하지 않고 실동작 중이다. 주석이 "게이트 신설 직후"의 상태를 그대로 남긴 것으로 보인다.
  - 제안: 코드 동작에는 영향 없음(합성 fixture 테스트는 여전히 유효한 이유로 존재). 주석만 "enforced set 이 비어 있어도 증명 가능"으로 일반화하거나 현재 수치를 반영해 정정 권장.

## Spec Fidelity 점검 결과 (참고)

관련 spec: `.claude/docs/plan-lifecycle.md` §4/§5, `spec/conventions/spec-impl-evidence.md` §4.2 (특히 R-8). line-level 대조 결과 전부 일치:
- `GATE_C_CUTOFF = 2026-06-04T00:00:00Z`, `d.getTime() >= cutoff` ↔ "`started` 가 2026-06-04 이후인 plan 만" / "started ≥ cutoff" 일치.
- `NONE_VALUES = {"none","없음","n/a","na"}` ↔ spec-impl-evidence.md R-8 "no-op sentinel(`none`/`없음`/`n/a`/`na`)" 일치(대소문자·공백 처리 포함).
- `hasValidSpecImpact` 의 `ok = (string && 비어있지않음) || (array && length>0)` 논리 ↔ plan-lifecycle.md:131 "흔한 실패형" 서술과 일치(bare string 거부, 빈 배열 거부).
- `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}` (in-progress 미포함) ↔ plan-lifecycle.md:83-86 및 spec-impl-evidence.md §2.2 서술과 정확히 일치.
- `WORKTREE_SENTINEL = "(unstarted)"`, 필수 3필드(worktree/started/owner) ↔ plan-lifecycle.md §4 그대로.
- `0-`/`_` 파일명 면제(디렉터리는 비면제)는 spec-impl-evidence.md §4.2 표(`plan-frontmatter.test.ts` 행: "subfolder 클러스터, `0-`/`_` index 면제")와 `fixture` 로 명시 고정된 코드 동작이 일치.
- `danglingSpecImpact` 가 비-문자열 원소를 위반으로 잡는 것(최근 커밋 `22b437873`) ↔ 코드 주석이 스스로 명시한 fail-open 수정 의도와 실제 필터 로직(`typeof p !== "string" || !exists`)이 정확히 일치.
- 커밋 이력(`#1108`, `#1117`)에 대한 코드/문서 인용은 `git log`로 실제 확인됨 — 근거 없는 서사 아님.
- 실측: `pnpm vitest run` 으로 3개 대상 테스트 스위트(spec-plan-completion / plan-scan / plan-frontmatter) 975 tests 전부 GREEN. 별도 스크립트로 `plan/complete/**` 375건을 재파싱해 263건이 enforced 집합에 들어감을 확인 — 합성 fixture 뿐 아니라 실저장소 데이터로도 게이트가 vacuous 하지 않음을 재확인.
- TODO/FIXME/HACK/XXX 주석: 3개 파일 전체에서 미검출.

## 요약

Gate C(`spec_impact` 강제)와 plan 라이프사이클 status/frontmatter 가드는 관련 spec 문서(`plan-lifecycle.md` §4/§5, `spec-impl-evidence.md` §4.2/R-8) 와 필드명·기본값·컷오프·no-op sentinel·허용 status 어휘까지 line-level 로 정확히 일치하며, 위반 분기를 합성 fixture(`plan-scan.test.ts`)와 순수 함수 단위 테스트(`Gate C enforcement logic`)로 양성 커버해 "위반 0건이라 검사가 죽어 있다"는 이 저장소가 반복해 겪은 실패 패턴을 스스로 방어하고 있다. 실저장소 데이터(263건 enforced, 375건 complete)로도 non-vacuous 함을 재확인했다. 유일한 실질 결함은 Gate C 자신의 `startedDate()` 가 같은 파일 안에서 고친 `isIsoDate` 하드닝을 재사용하지 않아, 형태만 맞고 달력상 무효인(특히 quoted) `started` 값이 조용히 미강제로 빠질 수 있는 좁은 fail-open 경로다 — 정상 데이터에는 영향 없으나 이 파일이 정확히 그 버그 클래스를 막으려고 만들어졌다는 점에서 지적할 가치가 있다.

## 위험도

LOW
