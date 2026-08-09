---
title: RolesGuard reflection 경화 — fail-open 위험 · 메모이제이션 · 비-UUID 헤더 400
worktree: auth-guard-reflection-hardening-9c31f2
started: 2026-08-08
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

[`auth-workspace-membership-guard`](../complete/auth-workspace-membership-guard.md) (P0 cross-tenant
fix)의 타겟 재리뷰(`review/code/2026/08/08/22_29_33`)에서 나온 WARNING 4건 중 3건 +
INFO 3건을 분리 등재한다. **그 PR 에서 미룬 이유는 각 항목에 적었고**, RESOLUTION 에도
같은 근거가 있다.

미룬 판단의 공통 근거: 그 라운드 발견이 **diff 안의 correctness 결함 0** 이고 전부 구조·성능·
선재 항목이라, 코드를 더 고치면 리뷰가 다시 stale 해져 P0 착지만 늦어진다(이 저장소가
7라운드까지 겪은 "fix→리뷰 stale 루프").

## 1. reflection fail-open 경화 (W1 — 가장 중요)

`handlerConsumesWorkspaceId`(`common/decorators/workspace.decorator.ts`)가 라우트의
`@WorkspaceId()` 소비 여부를 판별할 때 **`@nestjs/common` 비공개 export `ROUTE_ARGS_METADATA`**
+ **함수-identity 비교**에 의존한다. 이 가정이 깨지면 — Nest 내부 저장 포맷 변경, 핸들러를
wrap 하는 데코레이터 도입으로 `Function.name` 소실, 빌드 minify/mangle — `@WorkspaceId()` 를
실제로 쓰는 라우트에서도 **멤버십 검증이 조용히 skip** 된다.

**방향이 나쁘다**: 실패가 fail-**open** 이고, 그게 이 PR 이 통째로 닫은 결함 클래스다.
reviewer 5명(architecture·side_effect·performance·dependency·api_contract)이 각기 다른
각도로 같은 지점을 지적했다.

- [x] **부트타임 캐너리** — `common/decorators/workspace-reflection-canary.ts` 신설,
      `main.ts` 에서 `assertProductionConfig` 와 **별도 단계**로 호출(`--impl-prep` INFO #2).
      > **라우트 목록을 하드코딩하지 않았다.** 특정 라우트를 적으면 그것이 정당하게 사라질 때
      > 오탐으로 깨지고, 결국 목록을 지우는 압력이 된다. 대신 `DiscoveryService` 로 등록된
      > **전 컨트롤러를 훑어 소비 라우트 수를 세고 0 이면 throw** 한다. 판별은
      > `handlerConsumesWorkspaceId` 를 **그대로 호출**한다 — reflection 을 다시 구현하면
      > 캐너리가 자기 복제본을 검사하게 되어 정작 막으려던 파손을 통과시킨다.
      > **알려진 한계**: 부분 파손(일부만 인식 실패)은 못 잡는다 → 개수를 부팅 로그에 남겨
      > 급락이 눈에 띄게 했다. 숨기지 않고 코드 주석·본 항목에 적어 둔다.
- [x] ~~**또는 공식 확장점 전환**~~ — **채택 안 함(근거 확보).** `--impl-prep`
      rationale_continuity WARNING #2 가 지적: `SetMetadata` + `Reflector` 는
      `@WorkspaceId()` 사용처마다 마커를 달아야 하는데, 그것이
      [`spec/data-flow/12-workspace.md`](../../spec/data-flow/12-workspace.md) §Rationale 이
      **명시적으로 기각한** "라우트별 opt-in 마커" 패턴이다(이 저장소가 이미 2회 누락).
      캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다.
- [x] `@nestjs/*` 는 caret(`^11.0.1`)이라 minor/patch 업그레이드에도 노출된다 →
      **CHANGELOG Unreleased 에 팀 관례로 명문화**: 업그레이드 PR 에서 이 경로 테스트가
      깨지면 flaky 로 취급하지 말고 보안 회귀로 우선 조사 (dependency reviewer INFO 4)

## 2. reflection 메모이제이션 (W3)

`(controllerClass, methodName)` 조합에 대해 서버 기동 후 **불변**인데 전역 `APP_GUARD`
핫패스에서 요청마다 재계산된다.

- [x] ~~착수 전 실측 선행~~ — **이번 PR 에서 하지 않는다(항목 자체는 유지).** plan 이 세워둔
      기준을 그대로 적용했다: performance reviewer 위험도 LOW, 캐시는 그 자체가 새 표면
      (무효화 시점·`WeakMap` 키 수명)이라 **롤아웃 후 프로파일에서 상위 소비자로 나타날 때**
      넣는다. "느릴 것 같다" 는 착수 사유가 아니고, 지금 넣으면 근거 없는 표면만 는다.
      실측 트리거가 생기면 이 항목을 되살린다.

## 3. 비-UUID 워크스페이스 헤더 → 400 (W4)

`X-Workspace-Id` 에 비-UUID 문자열이 오면 `getMemberRole` 이 TypeORM `QueryFailedError`
(`invalid input syntax for type uuid`)를 던지고, `GlobalExceptionFilter` 의 어떤 매칭에도
안 걸려 **500 INTERNAL_ERROR 로 마스킹**된다. 클라이언트 입력 오류인데 서버 오류로 보인다.

> **선재다 — P0 PR 이 만든 것이 아니다.** 개정 전 가드도 `@Roles()` 라우트에서 header-first
> 값을 그대로 `getMemberRole` 에 넘겨 같은 500 이 났다. 그 PR 은 표면을 `@WorkspaceId()`
> 라우트로 **넓혔을 뿐**이다.

- [x] `resolveRequestWorkspaceContext` 단에서 형식 검증 → **400 `VALIDATION_ERROR`** 로
      조기 거부. 두 소비처(가드·데코레이터)의 기존 테스트 재검증 동반.
      > **에러 코드는 `VALIDATION_ERROR` 로 확정했다** (`--impl-prep` WARNING #1).
      > `WORKSPACE_ID_REQUIRED` 재사용은 그 코드의 정의("헤더·클레임 **둘 다 없음**")와
      > 실제 트리거(present-but-malformed)가 어긋나고, 신규 코드 신설은
      > `3-error-handling.md` 갱신을 요구해 `spec_impact: none` 과 모순된다.
      > `VALIDATION_ERROR` 는 `2-api-convention.md §5.3` 이 정한 **400 기본값**이라
      > spec 변경 없이 정합한다 — `spec_impact: none` 이 참으로 유지된다.
      > **던지는 위치는 공용 헬퍼 1곳**이다. 반환 플래그로 두면 두 소비처가 각자 거부를
      > 기억해야 하고, 한쪽이 잊으면 응답이 갈라진다 — 이 헬퍼가 추출된 이유가 그 drift 다.
      > **토큰 클레임은 검증하지 않는다** — 서버가 서명한 값이라 거기서 400 을 내면
      > 서버 버그를 클라이언트 오류로 보고하게 된다.
- [x] **술어를 `isValidUuid` 로 쓰지 않았다 — 실측으로 갈렸다.** 그쪽은 RFC v1–v5 + variant
      까지 보므로 **nil UUID(`00000000-…`)·v7 을 거부**한다. 그런데 Postgres 는 그 값들을
      정상 파싱하므로, 거부하면 "그 워크스페이스의 멤버가 아니다"(403)여야 할 응답이
      "요청이 잘못됐다"(400)로 **뒤바뀐다**. 실제로 `system-status.e2e-spec.ts` 가 nil UUID 를
      타 워크스페이스 프로브로 쓴다. → `isUuidShaped`(canonical 8-4-4-4-12 hex, 버전·variant
      무시)를 `uuid.ts` 에 신설하고 두 술어의 경계를 테스트로 고정.

## 4. 값싼 정리 (INFO)

- [x] 헤더는 있고 토큰 클레임이 없는 조합 → `membershipUnverified === true` 단언 추가
- [x] `normalizeWorkspaceHeader([])` → `undefined` 단언 추가
- [x] `CHANGELOG.md` Unreleased 에 전역 API 403 오탐 회귀 fix + 공용 헬퍼 추출 + 캐너리 +
      400 정정 기록

## 부수 — 픽스처가 프로덕션에서 존재할 수 없는 값이었다

헤더 형식 검증을 붙이자 기존 단위 테스트 16건이 RED 가 됐다. 원인은 구현이 아니라
**픽스처**였다 — `'ws1'`·`'victim-ws'`·`'header-id'` 같은 임의 문자열은 `X-Workspace-Id` 가
Postgres `uuid` 컬럼으로 흘러가는 이상 프로덕션에서 존재할 수 없는 값이다. 이름의 의미
(`OWN`=토큰이 확정한 내 워크스페이스, `VICTIM`=헤더로 노리는 남의 워크스페이스)는 상수로
그대로 옮기고 값만 UUID 형태로 바꿨다.

## 체크리스트

- [x] 사전 일관성 검토 `/consistency-check --impl-prep spec/5-system/` — **BLOCK: NO**
      (`review/consistency/2026/08/09/14_01_15`, 5/5 checker). WARNING #1·#2 를 위 두
      결정에 반영. 번들에 `1-auth.md` 가 실제로 실렸는지 확인하고 진행(26회 등장).
- [x] TDD — 새 계약 먼저 RED(6건) 확인 후 구현
- [x] TEST WORKFLOW — lint PASS(49s) · unit PASS(79s) · build PASS(140s) ·
      **e2e PASS(276s)**. 커버리지는 로그 전수 확인: backend jest 46 suites/**261** ·
      **playwright 51** (`tests=261` 은 jest 만 세는 wrapper 요약이다).
      > **캐너리가 실제 앱에서 돌았다는 증거는 e2e 통과 자체다.** `main.ts` 는
      > `void bootstrap()` 이라 throw 를 삼키지 않으므로, 캐너리가 던졌다면 `app.listen`
      > 에 도달하지 못해 261건이 **전부** 연결 실패했을 것이다. 통과했다는 것은 그 단계가
      > 실행됐고 인식 라우트가 0이 아니라는 뜻이다. 인식 **개수 자체**는 컨테이너가
      > 정리돼 사후 확인하지 못했다 — 부팅 로그에만 남는다(의도한 관측 지점).
- [x] 링크·Gate C 회귀 — `spec-link-integrity` 13건 · `spec-plan-completion` 776건 통과
      (아래 plan 이동 때문에 별도 확인)
- [x] `/ai-review` — **Critical 0 · WARNING 6 → 6건 전부 수정 · INFO 18**
      (`review/code/2026/08/09/14_36_39`, reviewer 9/9). 값 있던 둘은 **내 테스트가 정작
      중요한 지점을 비워 뒀다**는 지적이다:
      W5 400 을 프로덕션에서 **가장 먼저 통과하는 지점이 전역 `APP_GUARD`** 인데 가드
      레벨 테스트가 전무 → 3건 추가(403 이 아니라 400 임 + DB 미도달 단언) ·
      W6 "전역 라우트는 헤더와 무관하게 통과" 가 nil UUID(형식 유효)를 써서 **vacuous**
      → 형식이 깨진 값으로 두 갈래를 가르는 테스트 추가.
      **뮤테이션으로 실증**: 검증 제거 → 10 RED · 단축을 헤더 파싱 뒤로 이동 →
      **정확히 새 테스트 1건만 RED**(기존 nil UUID 테스트는 전부 GREEN — W6 의 지적이
      이 대비로 증명된다).
      W1·W2·W3 은 문서·plan 위생이고, **W3 은 내가 처음 쓴 오버라이드 근거가 틀려서
      `git worktree list` 로 확인해 정정**했다.
- [x] TEST WORKFLOW 재수행 (fix 후) — lint PASS(51s) · unit PASS(77s) · build PASS(144s) ·
      **e2e PASS(283s, jest 261 + playwright 51)** · common/ 345 tests OK
- [x] `/consistency-check --impl-done spec/5-system/` — **BLOCK: NO** (5/5 checker,
      `review/consistency/2026/08/09/15_09_04`). WARNING 2건은 **spec 쓰기 항목**이라
      §후속 planner 턴으로 넘겼다(코드가 spec 을 어긴 게 아니라 spec 이 새 케이스를
      아직 안 적은 incompleteness).
      > **첫 세션은 폐기했다** — `spec/5-system/` 번들이 1.2MB 라 기본 예산(262144)에서
      > **diff 가 통째로 잘려 나갔다**(프롬프트에서 신규 코드 grep **0건**, 실측). 그대로
      > 돌렸으면 "코드를 안 본 채 BLOCK:NO" 라는 거짓 통과였다. `CONSISTENCY_MAX_CONTEXT_SIZE=2600000`
      > 으로 재생성해 diff 23회·`1-auth.md` 54회 등장을 확인하고 실행했다. 빈 세션
      > 디렉토리가 게이트를 거짓 통과시키는 것도 알려진 함정이라 폐기 세션은 지웠다.
- [x] `/ai-review` 3차 (fix 후 fresh, `review/code/2026/08/09/15_20_33`) —
      **Critical 0 · WARNING 1 → 수정 · INFO 18**. 2차 fix 로 원 리뷰가 stale 해져
      push 게이트가 정확히 그것을 지적해 돌린 라운드다. **수렴 신호가 뚜렷하다** —
      발견 성격이 동작 → 테스트 공백 → **테스트 패턴 자기모순 1건**으로 좁혀졌고
      INFO 다수가 "이미 추적 중" 재확인이다.
      W1 은 내가 2차에서 두 파일에 세운 표준(캡처-재던지기)을 **세 번째 파일에서 되살린
      이중 호출**이었다. 수정 후 뮤테이션(`code` 값 변경) **2 RED** 로 code 단언이 여전히
      살아있음을 확인. INFO 18(옮긴 plan 의 `status:` 미갱신)도 1줄이라 함께 정정.
- [x] TEST WORKFLOW 3차 재수행 — lint PASS(53s) · unit PASS(73s) · build PASS(144s) ·
      **e2e PASS(305s, jest 261 + playwright 51)**
- [x] `/ai-review` 4차 (타겟 `requirement,maintainability,testing`,
      `review/code/2026/08/09/15_46_17`) — **Critical 0 · WARNING 1 → 수정**.
      **수렴 확정**: 이 라운드 changeset 에 **애플리케이션 코드가 없다**(3차 fix 가 이미
      검토된 코드라 diff 가 consistency 산출물만 담았다 — reviewer 자신이 그렇게 적었다).
      발견이 코드를 완전히 떠나 **생성 산출물의 형식**으로 옮겨 갔다.
      W1 은 checker 리포트 1건에 sub-agent 반환 스캐폴딩(`STATUS=…` 헤더)이 남은 것 —
      정정. INFO 3 은 `cross_spec` 이 스스로 단 "미검증" 캐버트라 **직접 열어 확인**했다:
      `system-status.e2e-spec.ts:147` 이 실제로 nil UUID 를 프로브로 쓴다 → ~~`isValidUuid`
      를 썼다면 그 e2e 가 깨졌을 것이라는 근거가 실측으로 선다.~~
      > **정정 (2026-08-09, `spec-sync-auth-invariants` planner 턴 실측).** 뒷문장이 틀렸다.
      > 확인한 것은 "그 e2e 가 nil UUID 를 쓴다" 까지이고, **"그래서 깨진다" 는 확인하지
      > 않은 채 이어 붙였다.** `system-status.controller.ts` 에는 `@Roles()` 도
      > `@WorkspaceId()` 도 없어 `RolesGuard` 가 `resolveRequestWorkspaceContext` 호출
      > **이전에** `return true` 한다(`handlerConsumesWorkspaceId` 단축) — 술어를
      > `isValidUuid` 로 조여도 그 e2e 는 그대로 200 이다. 그 테스트가 고정하는 것은
      > **"워크스페이스-무관 전역 라우트는 헤더를 무시한다"** 는 별개 불변식이다.
      > **진짜 캐너리는 두 단위 테스트다** — `common/utils/uuid.spec.ts` 의 두 술어 경계
      > 테스트, `common/utils/workspace-context.util.spec.ts` 의 nil UUID 통과 테스트.
      > 결정(비대칭은 의도)·근거(403→400 뒤바뀜)는 영향 없다.
- [x] `--impl-done` 재수행 (3차 fix 가 spec-linked 파일을 건드려 게이트가 재요구) —
      **BLOCK: NO** (`review/consistency/2026/08/09/15_56_48`, 5/5). WARNING 2건은 전부
      **spec 쓰기**라 §후속 planner 턴 등재. INFO 2(캐너리 주석 "73건" 수치)도 §후속.
- [x] push + PR — [#1108](https://github.com/worker-ants/clemvion/pull/1108)

## 부수 — plan 위생 1건 (`--impl-prep` plan_coherence INFO #6)

[`spec-draft-workspace-header-membership-invariant.md`](../complete/spec-draft-workspace-header-membership-invariant.md)
를 `complete/` 로 옮겼다. 변경안 5곳이 전부 `#1103` 에 반영돼 있는데 그 PR 이 이동을
빠뜨렸다(실측으로 확인 후 이동). 부수 효과로 **깨져 있던 링크 하나가 고쳐진다** —
`auth-workspace-membership-guard.md` 가 이 문서를 `complete/` 기준 상대경로로 링크하고
있었다. 같은 checker 가 지목한 `spec-fix-swagger-forbidden-response.md` 는 **옮기지
않았다** — 미완 체크박스 2건이 남아 있다(실측).

> **checker 권고를 오버라이드했다 — 근거를 남긴다** (ai-review 2차 scope WARNING #3).
> `plan_coherence` 는 "소유 worktree(`auth-workspace-membership-guard-2b94db`) 쪽 조치
> 필요 — 본 worktree 권한 밖" 이라고 판정했다. 그 worktree 는 디스크에 **아직 있지만**
> (`git worktree list` 실측 — 처음엔 회수됐다고 적었다가 확인해 정정했다) 그쪽 작업은
> **끝났다**: PR `#1103` 이 2026-08-08 에 머지됐고 그 plan 은 이미 `complete/` 에 있다.
> 즉 그 worktree 는 더 이상 PR 을 내지 않으므로, 권고를 그대로 따르면 **아무도 옮기지
> 않는다** — `#1103` 이 이미 한 번 빠뜨렸고 그 결과가 지금의 깨진 링크다. 이동만 담은
> 별 PR 은 `plan-lifecycle.md §3` 이 금지하므로 인접 PR 에 싣는 것이 정본 경로다.

## 후속 (이 PR 밖)

**planner 턴 필요 — `spec/` 쓰기** (`--impl-done` 2회 WARNING, BLOCK:NO 지만 반영 대상):

- [x] **헤더 vs 경로 파라미터의 UUID 검증 강도 비대칭을 명문화** (2차 impl-done W1 —
      가장 값 있는 항목). **완료 (2026-08-09, planner 턴)** —
      [`data-flow/12-workspace.md`](../../spec/data-flow/12-workspace.md) `## Rationale` 에
      신설 subsection "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭",
      [`1-auth.md §3.3`](../../spec/5-system/1-auth.md) 에 포인터 1줄.
      `X-Workspace-Id` 헤더는 느슨한 `isUuidShaped`, 워크스페이스 `:id` 경로 파라미터는 엄격한
      `ParseUUIDPipe`(같은 컨트롤러 `@Param('id')` 14곳, `memberId`·`invitationId` 포함 총
      18곳 — 실측) 다.
      > **캐너리 지목을 정정해 기록했다.** 이 항목이 원래 적었던
      > "~~회귀가 오면 nil-UUID e2e 프로브(`system-status.e2e-spec.ts:147`)가 깨진다~~" 는
      > **틀렸다** — 위 4차 ai-review 항목의 정정 각주 참조. 진짜 캐너리인 두 단위 테스트
      > (`uuid.spec.ts` 경계 · `workspace-context.util.spec.ts` nil UUID)를 spec 에 적었다.
- [x] **부트 캐너리 설계 근거를 spec Rationale 에** (2차 impl-done W2). **완료 (2026-08-09,
      planner 턴)** — [`1-auth.md ## Rationale`](../../spec/5-system/1-auth.md) 에 신설
      subsection "부트 캐너리 — `@WorkspaceId()` reflection 자가검증 (fail-closed)".
      (a) reflection 자가검증 이유 (b) opt-in 마커 대안 **재**기각 이유 (c)
      `assertProductionConfig` 와 별도 단계로 둔 이유 셋 다 기록.
      [`12-workspace.md`](../../spec/data-flow/12-workspace.md) §"멤버십 검증은 가드
      1곳에서" 에 역참조 1건.
      > **위치 근거를 좁혔다** (consistency INFO): "이 저장소는 유사 부트 가드마다
      > `1-auth.md` 에 기록해 왔다" 는 과잉 일반화였다 — EIA terminal-revoke 스케줄러 등록
      > fail-fast 는 `14-external-interaction-api.md`(자기 도메인)에 있다. spec 에는
      > "auth 크로스커팅 부트 가드는 `1-auth.md`, 도메인 고유는 각 도메인 spec" 으로 적었다.
- [x] `spec/5-system/3-error-handling.md §1.3` 에 행 추가 — "`X-Workspace-Id` 헤더가
      **있으나 UUID 형태가 아님** → `VALIDATION_ERROR`(400)". **완료 (2026-08-09, planner 턴)**.
      기존 `WORKSPACE_ID_REQUIRED`(둘 다 **부재**)와 구분되는 제3의 케이스이고, 표 아래에
      3분기 노트(부재 400 / 형식 파손 400 / 비멤버 403)와 적용 범위(전역 라우트는 헤더 무시)를
      함께 적었다. `15-chat-channel.md §5.4` 파급도 처리 — 그 라우트는 `@Roles('editor')` +
      `@WorkspaceId()` 둘 다 있어(실측) 대상이므로 형제 행 추가.
      > **코드 컬럼은 순수 코드값으로 뒀다** (consistency WARNING): 처음엔 `` `VALIDATION_ERROR`
      > (`X-Workspace-Id` 형식) `` 처럼 한정자를 코드 셀에 박았는데,
      > [`error-codes.md`](../../spec/conventions/error-codes.md) 의 "클라이언트는 코드의
      > 의미로 분기하며 이름 토큰을 파싱하지 않는다" 와 어긋나고 §5.4 표기와도 갈렸다.
      > 한정자는 설명 셀 prose 로 옮겼다(`RESERVED_VARIABLE_NAME` 행도 한정자를 코드 셀이
      > 아닌 HTTP 셀에 둔다).
- [x] `spec/5-system/1-auth.md` frontmatter `code:` 글로브에 이번에 경화한 표면 추가 —
      `common/decorators/*.ts`(데코레이터 + 신설 캐너리) · `common/utils/workspace-context.util.ts` ·
      `common/utils/uuid.ts`. **완료 (2026-08-09, planner 턴)**. 현재 `common/guards/*.ts` 만
      있어 **evidence 사슬이 비어 있었다** — CI 가 못 잡는 이유를 실측으로 확정: `spec-code-paths.test.ts`
      의 단언이 `codes.some((c) => globMatchesAny(c, root))` 라 **글로브 하나만 매치하면 통과**한다
      (`spec-impl-evidence.md §3` 이 정한 "≥1 매치 의무" 이며 전수 매치 의무가 아니다).
      부수 효과로 세 경로가 `review_guard` 의 **spec-linked** 판정에 들어간다(`_spec_linked_changes`)
      — 앞으로 그 파일 변경은 push 전 fresh `--impl-done` 을 요구받으며, 사슬을 잇는 목적이
      바로 그것이라 의도한 강화다.

> 넷 다 developer 권한 밖이라 그 PR 에서 하지 않았다. 코드가 spec 을 어긴 것이 아니라
> **spec 이 새 케이스를 아직 안 적은 것**(incompleteness)이라 BLOCK 이 아니었다.
> 후속 planner 턴 산출: [`spec-draft-auth-invariants-sync.md`](spec-draft-auth-invariants-sync.md).

**developer 범위:**

- [x] backend `README.md` §배포 주의 에 **부팅 캐너리가 기동을 멈출 수 있다**는 사실 추가
      (ai-review INFO 18). 이 PR 은 CHANGELOG·JSDoc·plan 세 곳에 적었으나 배포 담당자가
      먼저 보는 곳은 README 다. 그 절이 별도 구조 정리를 필요로 해 여기서 손대지 않았다.
      > **처리 (2026-08-09, `backend-hygiene-followups`).** 예고된 "구조 정리" 가 이것이다 —
      > 그 절은 `## 환경 변수` 안의 인용문이었는데 캐너리는 환경변수 축이 아니라 절 자체를
      > `## 배포 주의 — 기동을 멈추는 검사` 로 승격하고 두 검사를 소절로 갈랐다.
      > **이질성 표기**: `assertProductionConfig` 소절 제목에 `NODE_ENV=production 전용`,
      > 캐너리 소절에 `환경 무관` 을 박고, 별도 인용문으로 "dev·CI 에서도 같은 조건으로
      > 멈춘다" 를 적었다. 다만 "dev 에서 떴으니 production 도 뜬다" 로는 쓰지 않았다 —
      > 파손 계기 중 하나가 빌드 minify/mangle 이라 산출물이 다르면 결과가 갈린다.
- [x] 워크스페이스 UUID 픽스처가 3개 spec 파일에 다른 이름으로 중복 선언 (INFO 13·14) —
      공용 fixture 모듈 승격. 지금 옮기면 이 PR diff 가 세 파일 더 는다.
      > **처리 (2026-08-09).** `common/__test-utils__/workspace-id-fixtures.ts` 신설
      > (`modules/integrations/__test-utils__` 관례 — build tsc 가 컴파일하므로 jest 타입 비의존).
      > **중복은 값이 아니라 어휘였다**: 세 파일의 값 letter-scheme 은 겹치는데 같은 값에
      > 다른 이름(`cccc` = util 의 `OTHER_WS` = roles.guard 의 `VICTIM_WS`), 같은 이름에
      > 다른 값(`DECOY_WS`)이 섞여 있었다. 값당 이름이 하나여야 하므로 `OWN_WS`(17곳)를
      > `TOKEN_WS` 로 통일했다 — 헤더 vs 토큰이 이 결함 클래스의 축이라 `HEADER_WS`/`TOKEN_WS`
      > 쌍이 어휘로 일관된다. **`WS1` 은 새 이름을 만들지 않고 용법대로 해소**했다:
      > 헤더==토큰인 4곳은 기존 `SAME_WS`, 미인증 헤더-only 1곳은 `HEADER_WS`.
      > 픽스처가 vacuous 하지 않음을 뮤테이션으로 확인 — `OTHER_WS` 를 `TOKEN_WS` 와 같은
      > 값으로 바꾸자 **2 suite / 3 test RED**(값의 상호 구별이 로드베어링).
- [ ] 메모이제이션(§2)은 **실측 트리거가 생기면** 되살린다.
- [ ] 공용 픽스처 모듈에 **값 유일성 단언**(`new Set([...]).size === 7`) 1줄 추가
      (`backend-hygiene-followups` ai-review INFO 3). 지금은 3개 소비 스위트가 간접적으로만
      유일성을 검증한다 — 뮤테이션으로 로드베어링임은 실증했지만(값 충돌 시 3 RED) 모듈
      자체에는 가드가 없다. **이번에 넣지 않은 이유**: 그 라운드가 Critical 0·Warning 0 으로
      수렴했는데 `codebase/**` 를 한 줄이라도 더 만지면 리뷰가 stale 해져 9분짜리 리뷰 +
      TEST WORKFLOW 를 다시 돈다. INFO 등급 개선에 비례하지 않는다 — 이 파일을 다음에
      만질 때 함께 넣는다.
- [ ] `__test-utils__` 류 디렉터리가 **3곳째** 생기면 `tsconfig.build.json` 의 `exclude` 에
      `**/__test-utils__/**` 추가 검토 (동 ai-review INFO 4). 현재 2곳
      (`modules/integrations/__test-utils__` · 신설 `common/__test-utils__`)이고 둘 다
      런타임 import 가 없어 `dist/` 에 실려도 실질 위험은 없다. **트리거를 개수로 못박는
      이유**: 지금 exclude 를 넣으면 그 디렉터리들이 타입체크 대상에서 빠져 `__test-utils__`
      의 타입 오류를 아무도 못 보게 된다(이 저장소가 이미 겪은 "테스트 코드는 어떤 게이트도
      타입체크하지 않는다" 와 같은 클래스).
- [x] 캐너리 주석의 "73건" 수치를 정정 (2차 impl-done INFO 2). 그 수는 **`@Roles()` 미부착
      서브셋**인데 캐너리가 세는 것은 `@WorkspaceId()` 소비 라우트 **전체**라 상위집합이다 —
      전체 수치를 실측해 넣거나 서브셋임을 명시할 것. **이 PR 에서 고치지 않는 이유**:
      주석 한 줄이어도 `codebase/**` 변경이라 리뷰·`--impl-done` 두 게이트가 다시
      stale 해진다. INFO 등급 정확도 개선에 25분 사이클을 다시 도는 것은 비례하지 않는다.
      > **처리 (2026-08-09) — 추정치가 아니라 캐너리 자신이 센 값을 넣었다: 142건.**
      > `make e2e-up` 으로 backend 를 실제 기동해 부팅 로그를 읽었다:
      > `[WorkspaceIdReflection] @WorkspaceId() 소비 라우트 142건 인식`. 정적 grep
      > (`*.controller.ts` 의 `@WorkspaceId()` 145회)은 한 핸들러의 다중 사용·미등록
      > 컨트롤러를 구분하지 못해 교차검증용으로만 썼다 — 캐너리가 세는 것은 `DiscoveryService`
      > 에 등록된 라우트라 그 로그가 정본이다. 주석에 **두 수의 포함관계**도 못박았다
      > (222 라우트 ⊇ 142 소비 ⊇ 73 `@Roles()` 미부착).
      > **나머지 3곳의 "73건" 은 건드리지 않았다** — `roles.guard.ts:48`("222건 중 73건") ·
      > `roles.guard.spec.ts:66` · `repo-guards/__tests__/workspace-roles-attachment.spec.ts:18`
      > 은 전부 서브셋 의미로 정확하다(전수 grep 후 판정). 오염은 캐너리 주석 한 곳뿐이었다.

## Rationale

**왜 P2 인가.** 현재 활성 결함이 아니다. W1 은 "가정이 깨지면" 이고 그 가정은
`workspace.decorator.spec.ts`·`roles.guard.spec.ts` 가 주요 실패 케이스를 고정하고 있다.
W3 는 성능, W4 는 선재 에러매핑이다. 다만 W1 은 **fail-open 방향**이라 방치 기간이 길어지면
안 된다 — Nest 업그레이드가 트리거이므로 다음 `@nestjs/*` bump 전에 캐너리를 넣는 것이 목표다.

**왜 별 plan 인가.** `review/**` 는 시점 기록이지 SoT 가 아니다. RESOLUTION 에만 두면 P0 PR 이
머지되는 순간 이 항목들이 사라진다 — 이 저장소가 "미룬 항목 5건을 잃을 뻔" 한 뒤 세운 규칙이다.
