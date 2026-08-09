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
- [ ] `--impl-done` (spec-linked 코드 변경 있음)
- [ ] push + PR

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

- [ ] backend `README.md` §배포 주의 에 **부팅 캐너리가 기동을 멈출 수 있다**는 사실 추가
      (ai-review INFO 18). 이 PR 은 CHANGELOG·JSDoc·plan 세 곳에 적었으나 배포 담당자가
      먼저 보는 곳은 README 다. 그 절이 별도 구조 정리를 필요로 해 여기서 손대지 않았다.
- [ ] 워크스페이스 UUID 픽스처가 3개 spec 파일에 다른 이름으로 중복 선언 (INFO 13·14) —
      공용 fixture 모듈 승격. 지금 옮기면 이 PR diff 가 세 파일 더 는다.
- [ ] 메모이제이션(§2)은 **실측 트리거가 생기면** 되살린다.

## Rationale

**왜 P2 인가.** 현재 활성 결함이 아니다. W1 은 "가정이 깨지면" 이고 그 가정은
`workspace.decorator.spec.ts`·`roles.guard.spec.ts` 가 주요 실패 케이스를 고정하고 있다.
W3 는 성능, W4 는 선재 에러매핑이다. 다만 W1 은 **fail-open 방향**이라 방치 기간이 길어지면
안 된다 — Nest 업그레이드가 트리거이므로 다음 `@nestjs/*` bump 전에 캐너리를 넣는 것이 목표다.

**왜 별 plan 인가.** `review/**` 는 시점 기록이지 SoT 가 아니다. RESOLUTION 에만 두면 P0 PR 이
머지되는 순간 이 항목들이 사라진다 — 이 저장소가 "미룬 항목 5건을 잃을 뻔" 한 뒤 세운 규칙이다.
