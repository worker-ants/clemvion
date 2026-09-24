# Plan 정합성 검토 — spec/5-system (--impl-prep)

## 발견사항

- **[WARNING]** 의도적으로 미룬 "`@nestjs/common` 동반 업그레이드" 후속 plan 이 아직 미등재 — 등록 시 반영해야 할 검증 항목이 checklist 에 구체화되어 있지 않음
  - target 위치: `spec/5-system/1-auth.md` `## Rationale` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증 (fail-closed, 2026-08-09)" (`RolesGuard`/`handlerConsumesWorkspaceId` 가 `@nestjs/common` 비공개 export `ROUTE_ARGS_METADATA` + 함수-identity 비교에 의존, "부분 파손(일부만 인식 실패)은 못 잡는다"는 알려진 한계가 명문화되어 있음)
  - 관련 plan: `plan/in-progress/jest-esm-native-load.md` §E "하지 않는 것" ("`@nestjs/*` 12 동반 업그레이드 — 별 PR. #1382 은 `common@12` 없이는 런타임에서 `ERR_MODULE_NOT_FOUND` 로 죽는다") 및 체크리스트 마지막 항목("plan `complete/` 로 + 후속(동반 업그레이드) 등재") · `plan/in-progress/auth-guard-reflection-hardening.md` §1 W1 ("`@nestjs/*` 는 caret(`^11.0.1`)이라 minor/patch 업그레이드에도 노출된다 → 업그레이드 PR 에서 이 경로 테스트가 깨지면 flaky 로 취급하지 말고 보안 회귀로 먼저 조사할 것", CHANGELOG 에도 같은 문구로 명문화됨)
  - 상세: `jest-esm-native-load.md` 는 이번 PR 스코프를 `@nestjs/typeorm`(#1339) 단독으로 명시적으로 좁혔고, 이는 `auth-guard-reflection-hardening.md`/CHANGELOG 가 이미 규정한 "`@nestjs/*` 업그레이드는 reflection 가드에 대한 보안 회귀 조사 대상" 원칙과 **충돌하지 않는다** — 오히려 그 원칙을 지켜 동반 업그레이드를 별 PR 로 분리한 것으로 읽힌다. 문제는 그 "별 PR"이 아직 `plan/in-progress/` 에 실체로 등재되어 있지 않다는 점이다. `#1382`(`@nestjs/platform-express`)는 이미 OPEN 상태인 dependabot PR 이라 언제든 재작업 대상이 될 수 있는데, 이번 plan 의 체크리스트는 "후속(동반 업그레이드) 등재"라고만 적었을 뿐 그 후속 plan 이 반드시 포함해야 할 **구체적 검증 항목**(부트 캐너리의 소비 라우트 수 회귀 확인·`@WorkspaceId()` 가드 unit 스위트 통과 확인 — 캐너리 자신이 "부분 파손은 못 잡는다"고 이미 한계를 인정한 지점)을 명시하지 않았다. 이 상태로 이 plan 이 `complete/` 로 이동하면, 다음에 `#1382`/`@nestjs/common` 상향을 다루는 세션이 이 문맥(왜 별도 검증이 필요한지)을 처음부터 다시 찾아야 한다.
  - 제안: (a) 지금 이 PR 을 닫기 전에 후속 plan 파일(가칭 `plan/in-progress/nestjs-common-v12-upgrade.md` 등)을 최소 스텁으로라도 등재하고, "업그레이드 후 부팅 로그의 `@WorkspaceId()` 소비 라우트 수(현재 기준값, 실측 필요)가 유지되는지 + `workspace.decorator.spec.ts`/`roles.guard.spec.ts` 가 여전히 통과하는지"를 명시적 완료 조건으로 적을 것, 또는 (b) 최소한 `jest-esm-native-load.md` 체크리스트의 "후속 등재" 항목 옆에 위 검증 조건을 한 줄로 못박아, 다음 세션이 CHANGELOG 문구만 보고 "숫자가 안 흔들리면 통과"로 안이하게 넘어가지 않게 할 것.

## 요약

이번 PR(`jest-esm-native-load.md`)이 실제로 손대는 범위(jest 모듈 로딩 방식 전환, `transformIgnorePatterns` 원복, `@nestjs/typeorm` 단독 상향 검증)는 `spec/5-system` 본문·Rationale 이 우려하는 지점(`1-auth.md` 의 reflection 기반 워크스페이스 가드)에 닿지 않으며 `spec_impact: none` 선언과 일치한다. `auth-guard-reflection-hardening.md` 가 이미 규정해 둔 "`@nestjs/*` 업그레이드는 별도 보안 회귀 조사 대상" 원칙과도 충돌 없이 정합하다 — 오히려 `#1382`(`@nestjs/common` 필요)를 별 PR 로 분리한 `jest-esm-native-load.md §E` 의 결정이 그 원칙을 지킨 것으로 보인다. 다만 그 "별 PR"이 아직 plan 으로 실체화되지 않았고, 실체화될 때 반드시 담아야 할 검증 조건(부트 캐너리 소비 라우트 수 회귀·가드 unit 스위트)이 현재 어느 문서에도 구체적으로 적혀 있지 않다 — 이는 지금 당장의 결정 충돌이 아니라 후속 plan 등재 시점에 반영해야 할 갱신 항목이다.

## 위험도
LOW
