# 요구사항(Requirement) 리뷰 — uuid-canary-docstring-fix

## 검토 범위 요약

이 변경은 커밋 `43d3b79e5` (`docs(backend): 캐너리 docstring 2건 정정`) 전체다. **코드 동작
변경 0줄** — `codebase/**` 에서 바뀐 파일은 두 곳뿐이고 diff 는 전부 JSDoc 블록 주석
(`* ` 로 시작하는 줄)이다:

1. `codebase/backend/src/common/utils/uuid.ts` — `isUuidShaped` docstring 에서 근거로 들던
   `system-status.e2e-spec.ts` 인용을 제거하고, 실제 캐너리인 두 단위 테스트로 교체.
2. `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — "실측 73건"
   수치를 "정적 실측 142건(상위집합) + 73건은 서브셋" 으로 정정.

나머지는 plan 위생(`plan/complete/spec-draft-auth-invariants-sync.md` 로 이동,
`plan/in-progress/auth-guard-reflection-hardening.md` 체크박스 갱신)과 직전
`/consistency-check --impl-prep` 세션 산출물(`review/consistency/2026/08/09/20_34_07/**`)
이다.

## 발견사항

검증 결과, CRITICAL/WARNING 급 발견사항 없음. 아래는 실측으로 확인한 항목들(모두 정상 —
문제가 아니라 검증 근거로 기록):

- **[INFO] docstring 수치 "142건" 실측 검증 — 정확함**
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (전체 파일
    컨텍스트 게이트 29줄, "정적 실측 142건")
  - 상세: `grep -rn "@WorkspaceId(" codebase/backend/src --include="*.controller.ts"` 결과
    145건이며, 그중 3건은 주석 줄(`executions.controller.ts:83`,
    `background-runs.controller.ts:53`, `agent-memory.controller.ts:46` — 전부 `//` 또는
    `*` JSDoc 인용)이라 실제 파라미터 데코레이터 사용처는 정확히 142건. 커밋 메시지가 적은
    "145건 중 주석 3건 제외" 산식과 일치. 수치가 조작이나 어림값이 아니라 실측 그대로임을
    확인.
  - 제안: 없음 (정상).

- **[INFO] `uuid.ts` docstring 이 인용하는 테스트 3건 — 전부 실존·문구 일치**
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (게이트 27-31줄)
  - 상세: `uuid.spec.ts:55` 의 `accepts UUID-shaped values that isValidUuid rejects (nil / v6+ /
    비-RFC variant)`, `workspace-context.util.spec.ts:134` 의 `Postgres 가 파싱할 수 있는 값은
    통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)`, `roles.guard.spec.ts:337` 의
    `형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이 헤더 파싱보다 먼저다` —
    세 테스트 모두 실제 파일에 정확한 문구로 존재함을 `grep`/`Read` 로 확인. docstring 이
    인용한 테스트가 실제로 주장하는 계약(경계 고정·403→400 비뒤바뀜·단축 우선순위)과도 일치.
  - 제안: 없음 (정상).

- **[INFO] "그 e2e 는 이 술어에 닿지 않는다" 는 정정 주장 자체를 코드로 재검증 — 정확함**
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:110-119` (`if (!needsRoleCheck &&
    !handlerConsumesWorkspaceId(...)) return true;` 가 `resolveRequestWorkspaceContext` 호출
    (119번째 줄 이후)보다 앞섬), `codebase/backend/src/modules/system-status/system-status.controller.ts:19-23`
    (`@Roles()`/`@WorkspaceId()` 데코레이터 없음, `@Controller`/`@Get` 뿐)
  - 상세: docstring 이 새로 주장하는 "system-status 는 RolesGuard 단축을 타 헤더 파싱 이전에
    통과한다" 를 가드 소스로 직접 재현·확인. 이전 docstring 의 "e2e 하나가 nil UUID 를
    회귀 캐너리로 쓴다" 주장이 실제로 틀렸고(그 e2e 는 단축 통과 지점을 절대 넘지 않음),
    이번 수정이 그 오류를 바로잡은 것도 확인.
  - 제안: 없음 (정상 — 정정이 사실에 부합).

- **[INFO] spec fidelity — `spec/data-flow/12-workspace.md` §Rationale "UUID 검증 강도
  비대칭" (§#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09) 과
  `uuid.ts` docstring 이 line-level 로 정합**
  - 위치: `spec/data-flow/12-workspace.md:375-413` vs `codebase/backend/src/common/utils/uuid.ts`
    전체 파일 컨텍스트 게이트 16-49줄
  - 상세: spec 이 이미 "캐너리 지목 정정 (2026-08-09)" 각주로 같은 내용(e2e 는 이 술어에
    닿지 않음, 진짜 캐너리는 두 단위 테스트)을 적어 두고 있었고, 코드 docstring 이 그 문구를
    거의 그대로 반영해 두 SoT 가 이제 일치한다. `spec/5-system/1-auth.md:773`(부트 캐너리
    Rationale)도 `workspace-reflection-canary.ts` docstring 과 동일 논리(reflection 자가검증
    fail-open 방지, opt-in 마커 재기각, `assertProductionConfig` 와 분리)로 정합.
  - 제안: 없음 (정상 — SPEC-DRIFT 아님. 오히려 이번 커밋이 코드→spec drift 를 해소).

- **[INFO] plan 위생 — 두 plan 파일의 체크박스·이동이 실제 diff 와 정합**
  - 위치: `plan/complete/spec-draft-auth-invariants-sync.md` §후속 (게이트 388-401줄),
    `plan/in-progress/auth-guard-reflection-hardening.md` §후속 developer 범위 (게이트
    260-274줄)
  - 상세: `review/consistency/2026/08/09/20_34_07/SUMMARY.md` 가 지적한 WARNING 1건(완료된
    plan 이 `in-progress/` 에 남아 있음)은 이번 커밋에서 `plan/complete/` 로 옮기고(파일 3/5
    diff 확인) 남은 체크박스 2건을 `[x]` 처리해 해소됐다. 두 plan 파일 모두 "73건 정정"·
    "uuid.ts 캐너리 지목 정정" 항목을 동일하게 완료 표시하고 서로 다른 문구로 어긋나지 않음.
  - 제안: 없음 (정상).

- **[INFO] TODO/FIXME/HACK/XXX 미존재**
  - 위치: 변경된 두 소스 파일 전체
  - 상세: `grep -n "TODO\|FIXME\|HACK\|XXX"` 결과 매치 없음.
  - 제안: 없음.

## 요약

이번 diff 는 이미 spec 에 반영된 정정 문구를 코드 JSDoc 에 뒤늦게 동기화하는 순수 문서화
커밋이며 코드 동작 변경이 없다. 검증한 모든 사실 주장(라우트 카운트 142/73, 인용된 테스트
3건의 실존·문구, `RolesGuard` 단축 통과 지점의 코드 위치, spec 본문과의 line-level 일치)이
전부 실측으로 확인됐고 하나도 반증되지 않았다. TODO/FIXME 등 미완성 표식 없음, 에러
시나리오·반환값·비즈니스 로직 등은 코드가 변경되지 않았으므로 기존 상태(이미 별도 PR
`#1108`/`#1112` 에서 검증됨) 그대로 유지된다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE
