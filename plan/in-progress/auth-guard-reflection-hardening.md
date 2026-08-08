---
title: RolesGuard reflection 경화 — fail-open 위험 · 메모이제이션 · 비-UUID 헤더 400
worktree: (unstarted)
started: 2026-08-08
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

[`auth-workspace-membership-guard`](auth-workspace-membership-guard.md) (P0 cross-tenant
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

- [ ] **부트타임 캐너리** — 알려진 `@WorkspaceId()` 라우트 몇 개에 대해 부팅 시
      `handlerConsumesWorkspaceId` 가 `true` 를 반환하는지 assert. 거짓이면 **부팅 실패**
      (fail-closed). 런타임에 조용히 새는 것보다 배포가 멈추는 편이 낫다
- [ ] **또는 공식 확장점 전환** — `SetMetadata` + `Reflector` 로 옮겨 비공개 API 의존 제거.
      다만 `@WorkspaceId()` 사용처 전부에 마커를 달아야 해 표면이 넓다 — 캐너리보다 비싸다
- [ ] `@nestjs/*` 는 caret(`^11.0.1`)이라 minor/patch 업그레이드에도 노출된다.
      **팀 관례로 고정**: 업그레이드 PR 에서 이 경로 테스트가 깨지면 **flaky 로 취급하지 말고
      보안 회귀로 우선 조사** (dependency reviewer INFO 4)

## 2. reflection 메모이제이션 (W3)

`(controllerClass, methodName)` 조합에 대해 서버 기동 후 **불변**인데 전역 `APP_GUARD`
핫패스에서 요청마다 재계산된다.

- [ ] **착수 전 실측 선행** — performance reviewer 위험도는 LOW 였다. 캐시는 그 자체가 새
      표면(무효화 시점·`WeakMap` 키 수명)이라, 롤아웃 후 프로파일에서 상위 소비자로 나타날
      때 넣는다. "느릴 것 같다" 로 넣지 않는다

## 3. 비-UUID 워크스페이스 헤더 → 400 (W4)

`X-Workspace-Id` 에 비-UUID 문자열이 오면 `getMemberRole` 이 TypeORM `QueryFailedError`
(`invalid input syntax for type uuid`)를 던지고, `GlobalExceptionFilter` 의 어떤 매칭에도
안 걸려 **500 INTERNAL_ERROR 로 마스킹**된다. 클라이언트 입력 오류인데 서버 오류로 보인다.

> **선재다 — P0 PR 이 만든 것이 아니다.** 개정 전 가드도 `@Roles()` 라우트에서 header-first
> 값을 그대로 `getMemberRole` 에 넘겨 같은 500 이 났다. 그 PR 은 표면을 `@WorkspaceId()`
> 라우트로 **넓혔을 뿐**이다.

- [ ] `extractWorkspaceId` / `resolveRequestWorkspaceContext` 단에서 UUID 형식 검증 →
      기존 `WORKSPACE_ID_REQUIRED` 와 같은 400 계열로 조기 거부. **계약 변경이므로**
      두 소비처(가드·데코레이터)의 기존 테스트 재검증 동반

## 4. 값싼 정리 (INFO)

- [ ] `resolveRequestWorkspaceContext({'x-workspace-id':'ws1'}, undefined)` →
      `membershipUnverified === true` 단언 추가 (헤더는 있고 토큰 클레임이 없는 조합 미고정)
- [ ] `normalizeWorkspaceHeader([])` → `undefined` 단언 추가
- [ ] `CHANGELOG.md` Unreleased 에 전역 API 403 오탐 회귀 fix + 공용 헬퍼 추출 한두 문장

## Rationale

**왜 P2 인가.** 현재 활성 결함이 아니다. W1 은 "가정이 깨지면" 이고 그 가정은
`workspace.decorator.spec.ts`·`roles.guard.spec.ts` 가 주요 실패 케이스를 고정하고 있다.
W3 는 성능, W4 는 선재 에러매핑이다. 다만 W1 은 **fail-open 방향**이라 방치 기간이 길어지면
안 된다 — Nest 업그레이드가 트리거이므로 다음 `@nestjs/*` bump 전에 캐너리를 넣는 것이 목표다.

**왜 별 plan 인가.** `review/**` 는 시점 기록이지 SoT 가 아니다. RESOLUTION 에만 두면 P0 PR 이
머지되는 순간 이 항목들이 사라진다 — 이 저장소가 "미룬 항목 5건을 잃을 뻔" 한 뒤 세운 규칙이다.
