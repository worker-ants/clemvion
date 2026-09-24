# Plan 정합성 검토 — spec/5-system (--impl-prep)

## 발견사항

- **[WARNING]** `@nestjs/common` 동반 업그레이드가 이미 문서화된 fail-open 위험의 트리거 이벤트인데 현재 plan 이 이를 반영하지 않음
  - target 위치: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증"(라인 ~794–828, `RolesGuard`/`handlerConsumesWorkspaceId` 가 `@nestjs/common` **비공개 export** `ROUTE_ARGS_METADATA` + 함수-identity 비교에 의존)
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` §1 (거의 전 항목 `[x]` 완료) — "`@nestjs/*` 는 caret(`^11.0.1`)이라 minor/patch 업그레이드에도 노출된다 → 업그레이드 PR 에서 이 경로 테스트가 깨지면 flaky 로 취급하지 말고 보안 회귀로 먼저 조사할 것" (동일 문구가 `CHANGELOG.md` L2864–2867 에도 팀 관례로 박혀 있음, 이미 커밋된 live 상태 확인). 그리고 오늘 이 세션이 새로 쓴 `plan/in-progress/jest-esm-native-load.md` (§E "하지 않는 것": "`@nestjs/*` 12 동반 업그레이드 — 별 PR. #1382 은 `common@12` 없이는 런타임에서 `ERR_MODULE_NOT_FOUND` 로 죽는다(실측)")
  - 상세: 사용자가 이번 턴에서 제안한 "1339, 1382 를 한 PR 로 합쳐서 진행" 은 `@nestjs/platform-express`(#1382)를 살리기 위해 `@nestjs/common` 을 11→12 로 올리는 것을 함의한다(`jest-esm-native-load.md` 자신이 실측으로 확인한 전제). 이는 `auth-guard-reflection-hardening.md`/`CHANGELOG.md` 가 이미 명시적으로 경고한 "`@nestjs/*` 업그레이드가 `ROUTE_ARGS_METADATA` 비공개 포맷을 깰 수 있다" 시나리오의 **정확한 트리거**다. 부트 캐너리는 "소비 라우트 0건" 같은 **전체 파손**만 잡고, spec 본문이 스스로 "부분 파손(일부만 인식 실패)은 못 잡는다" 고 적어 둔 한계가 있다. 그런데 `jest-esm-native-load.md` 에는 이 캐너리·가드 회귀 스위트를 `@nestjs/common@12` 대상으로 별도 검증하라는 항목이 전혀 없다 — "unit/e2e 숫자가 그대로면 통과" 로만 서술되어 있어(§C), 정확히 이 경로가 조용히 깨져도 일반 테스트 그린으로 덮일 위험이 있다.
  - 제안: `#1382`/`@nestjs/common` 동반 업그레이드를 이번 PR 스코프에 넣기로 결정한다면, `jest-esm-native-load.md`(또는 그 후속으로 새로 등재할 plan)에 **명시적으로** "업그레이드 후 `workspace-reflection-canary` 부팅 로그의 소비 라우트 수(현재 기준값)가 그대로인지, `@WorkspaceId()` 가드 unit 스위트가 여전히 의도한 경로를 태우는지"를 별도 확인 스텝으로 추가할 것. 단순 "unit/e2e 통과" 로 퉁치지 말 것 — CHANGELOG 관례가 요구하는 것은 "이 경로가 깨지면 flaky 취급 금지, 능동 조사" 이지 수동적 그린 확인이 아니다.

- **[WARNING]** "PR 통합" 이 실제로는 프레임워크 전체 메이저 마이그레이션이라는 스코프 크기가 어느 plan 에도 등재되어 있지 않음
  - target 위치: 없음 (target 은 spec/5-system 본문 자체는 무관 — 이 발견은 구현 스코프 대 plan 등재 여부에 관한 것)
  - 관련 plan: `plan/in-progress/jest-esm-native-load.md` (§E "하지 않는 것" — 동반 업그레이드를 "별 PR" 로 명시적으로 배제한 결정)
  - 상세: `codebase/backend/package.json` 에는 `@nestjs/*` 계열 13개 패키지가 전부 `^11.x` 로 고정되어 있다(`core`·`common`·`bullmq`·`config`·`jwt`·`passport`·`platform-express`·`platform-socket.io`·`swagger`·`throttler`·`typeorm`·`websockets`·`cli`/`schematics`/`testing`). `jest-esm-native-load.md` 자신이 "#1382 은 `common@12` 없이는 죽는다(실측)" 라고 확인했으므로, `platform-express` 하나만 올려도 `common`(및 사실상 `core` 와 peer 관계인 나머지 패키지들)의 호환 버전 동반 상향이 필요할 가능성이 높다. 즉 사용자가 말한 "지금 말한 작업을 한번에" 가 문자 그대로 #1339+#1382 두 패키지만 올리는 게 아니라 사실상 **NestJS v11→v12 전체 마이그레이션**일 수 있는데, 이 규모·영향범위·롤백 전략을 다루는 plan 문서가 없다. 기존 `jest-esm-native-load.md` 는 오히려 정반대로 "이 PR 은 앞의 하나(#1339)만 푼다" 는 결정을 이미 명시적으로 내려둔 상태다.
  - 제안: 스코프를 확장하기로 결정하면 (a) `jest-esm-native-load.md` 의 Overview 표·§B·§E·체크리스트를 갱신해 확장된 스코프를 반영하거나, (b) 동반 업그레이드를 위한 별도 plan (`spec_impact` 명시, 영향받는 `@nestjs/*` 패키지 전수 나열, 위 항목의 가드 회귀 검증 포함)을 새로 세울 것. 둘 중 하나 없이 진행하면 완료 후 `complete/` 로 이동되는 plan 이 실제로 한 작업보다 좁게 서술된 채로 남는다(메모: "plan 서술은 철회로 거짓이 될 수 있다").

## 요약

Target(spec/5-system, 특히 1-auth.md 의 RBAC/reflection 캐너리 서술)과 오늘 새로 등재된 plan(`jest-esm-native-load.md`)은 그 자체로는 정합하다 — 현재 plan 이 실제로 손대는 범위(jest 로더 방식 전환 + `@nestjs/typeorm` 단독 상향)는 spec 이 우려하는 `@nestjs/common` reflection 포맷에 닿지 않는다. 문제는 이번 턴에서 제안된 확장(#1339+#1382 통합 후 두 dependabot PR 종료)이 채택될 경우다 — 그 경로는 `@nestjs/common` 동반 상향을 요구하고, 이는 같은 저장소가 이미 `auth-guard-reflection-hardening.md`/`CHANGELOG.md` 에 명문화해 둔 "`@nestjs/*` 업그레이드 = 워크스페이스 가드 reflection 보안 회귀 우선조사 대상" 규칙의 정확한 트리거인데, 현재 어느 plan 에도 그 검증 스텝이나 확장된 스코프가 등재되어 있지 않다. 결정 자체를 막을 사안은 아니지만(사용자가 지금 그 결정을 묻고 있는 단계), 통합을 채택한다면 구현 착수 전에 plan 문서 갱신 + 명시적 reflection 회귀 검증 스텝 추가가 필요하다.

## 위험도
MEDIUM
