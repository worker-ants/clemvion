# Rationale 연속성 검토 — spec/data-flow/8-notifications.md (impl-done)

## 발견사항

- **[WARNING] `ExecutionEngineService` 순환 DI 해법이 `forwardRef` 원칙에서 벗어났으나 그 이탈이 어느 spec Rationale 에도 기록되지 않음**
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `execution_failed` 행 (및 근거 코드 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 신규 `getNotificationsService()`/`ModuleRef` 주입)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 "**순환 의존 처리** — `ExecutionEngineService ↔ WebsocketService` 의 순환은 NestJS 표준 패턴인 `forwardRef(() => WebsocketService)` 로 해결. 이는 Nest 권장 패턴이며 회피해야 할 안티패턴이 아니다" 및 동 spec 1574행 "engine→Retry 순환 DI 제거" 항목(엔진의 순환 의존은 일관되게 `forwardRef` 지연 해석 또는 재배선으로 처리해 온 이력).
  - 상세: 기존 spec은 엔진의 순환 의존(WebsocketService, RetryTurnService, ExecutionEventEmitter 등 다수 사례)을 전부 `forwardRef` 기반으로 해결해 왔고, 이를 "Nest 표준·권장 패턴"이라는 합의 원칙으로 명문화했다. 이번 diff는 `ExecutionEngineService ↔ NotificationsService` 순환에 대해 **다른 메커니즘** — 생성자 `@Optional` 주입을 유지하되 `ModuleRef.get(NotificationsService, {strict:false})` 로 런타임에 지연 해석하고 결과를 캐시하는 방식 — 을 신규 도입했다. 코드 주석은 이를 "notifications.service.ts 가 WebsocketService 를 푸는 것과 동일 패턴"이라고 정당화하지만, `NotificationsService.getWebsocket()` 의 `ModuleRef` 사용 자체도 어느 spec 문서에도 기록된 적이 없는 미문서화 선례다 (grep 결과 `spec/data-flow/8-notifications.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md` 어디에도 `ModuleRef` 언급 없음). 즉 "기존 정합 패턴 재사용"이 아니라, **문서화되지 않은 코드 관행이 다시 한 번 문서화 없이 확장**된 것이다. `plan/in-progress/notif-hardening-followups.md` 는 이를 "[아키텍처 부채] DI 순환 인스턴스화 순서 ... 이번엔 ModuleRef 지연해석으로 우회" 로 스스로 인정하고 있어, 임시방편(workaround) 성격임을 developer 자신도 자각하고 있다.
  - 왜 WARNING 수준인가: `forwardRef` 대신 `ModuleRef`를 쓴 것 자체가 기능적으로 틀린 것은 아니고(둘 다 NestJS 표준 DI 순환 해결 기법), 실제로 이번 케이스는 인스턴스화 순서 문제(`forwardRef` 순환 유지 상태에서 `@Optional` 주입이 undefined 로 굳는 문제)를 해결하기 위한 것으로 코드 주석 근거는 합리적이다. 다만 spec 레벨에서 §4.4가 못박은 "엔진 순환 의존 = forwardRef" 라는 명시적 원칙에 대해, 이번 신규 사례가 그 원칙의 예외인지 아니면 원칙 자체가 갱신되어야 하는지에 대한 판단이 spec Rationale에 전혀 반영되지 않았다. 향후 엔진에 새 `@Optional` 순환 의존을 추가하는 사람이 spec만 읽으면 "`forwardRef`가 표준"이라고 오인하고 이번과 동일한 undefined 함정을 반복할 위험이 있다 — plan 문서에도 "신규 `@Optional` 의존성 추가 시 동일 함정 주의" 라고 스스로 경고하고 있다.
  - 제안: `spec/5-system/4-execution-engine.md §4.4` (또는 `spec/data-flow/8-notifications.md` Rationale)에 다음을 명시적으로 추가할 것을 권고: (1) `ExecutionEngineService ↔ NotificationsService` 순환은 `forwardRef` 대신 `ModuleRef(strict:false)` 지연 해석 + 캐시를 쓴다는 사실, (2) 그 이유(`@Optional` 생성자 주입이 인스턴스화 순서에 따라 undefined 로 고정되는 문제를 `forwardRef` 유지만으로는 해결할 수 없어 런타임 조회로 우회), (3) 언제 `forwardRef`를 쓰고 언제 `ModuleRef` 지연 해석을 쓰는지의 선택 기준(또는 "둘 다 유효하나 X 조건에서는 Y를 쓴다"는 가이드라인). 이는 이미 `plan/in-progress/notif-hardening-followups.md` 에 초안 형태로 존재하므로, 해당 plan 완료 이관 시 spec Rationale로 승격하는 것을 권장.

- **[INFO] `NotificationsService.getWebsocket()` 의 `ModuleRef` 선례 자체도 미문서화 — 이번 확장으로 누적**
  - target 위치: (target 문서 직접 관련은 아니나 이번 diff가 재인용한 선례) `codebase/backend/src/modules/notifications/notifications.service.ts` `getWebsocket()`
  - 과거 결정 출처: 해당 패턴을 정당화할 Rationale이 `spec/data-flow/8-notifications.md`에도 `spec/5-system/6-websocket-protocol.md`에도 없음.
  - 상세: 이번 PR이 이 미문서화 패턴을 참조 삼아 두 번째 사례(execution-engine)를 만들었다. 패턴이 한 곳에서만 쓰일 때는 code-comment로 충분할 수 있으나, 두 번째 사용처가 생긴 지금은 "왜 일부 순환은 forwardRef, 일부는 ModuleRef로 푸는가"에 대한 spec 차원 설명이 없으면 향후 세 번째 사용처에서 또 다른 임시 근거가 반복될 위험이 있다.
  - 제안: 위 WARNING 항목의 스펙 갱신에 `getWebsocket()` 선례도 함께 근거로 포함시켜 "이 프로젝트의 순환 DI 해법은 forwardRef 와 ModuleRef 지연 해석 두 가지이며 각각 어떤 경우에 적용하는지"를 한 곳(예: 5-system/4-execution-engine.md §4.4 또는 conventions 문서)에 정리.

- **[INFO] Rationale 자체 정합성은 우수 — 딥링크/attribution 분리 결정이 모범적으로 기록됨**
  - target 위치: `spec/data-flow/8-notifications.md` `## Rationale` "딥링크와 attribution 을 별도 컬럼으로 분리 (V107 — `background_run_id`)"
  - 상세: 이 항목은 오히려 Rationale 연속성의 모범 사례다. 종전 `resource_type='background_run'`/`resource_id=backgroundRunId` 설계를 "딥링크 클릭 시 404 를 유발하던 선존 결함"으로 명확히 재규정하고, 대안("href.ts 를 background_run 라우팅으로")을 구체적 이유(backgroundRunId 단독으로는 주소지정 불가, `_layout.md §3.1` 계약을 바꿔야 해 더 무거움)와 함께 명시적으로 기각했다. `_layout.md §3.1`, `1-data-model.md §2.19`, `4-nodes/1-logic/12-background.md §8.2` 등 관련 spec 전부가 일관되게 갱신되어 교차 문서 충돌이 없다. `execution_failed` 의 재개(rehydration) 세그먼트 dispatch 누락 수정도 §1.1 서술에 정확히 반영되어 있다. 별도 조치 불필요 — 참고용으로만 기록.

## 요약

target(`spec/data-flow/8-notifications.md`)이 다루는 알림 딥링크/attribution 분리(V107) 자체의 Rationale 연속성은 매우 견고하다 — 기각된 대안(href.ts 재라우팅)이 명시적 이유와 함께 기록되었고, 과거 결함(404 유발 설계)에 대한 재규정도 정확하며, 관련 spec 4개 문서가 서로 어긋남 없이 동기화되었다. 다만 이번 구현이 부수적으로 건드린 `ExecutionEngineService` 의 DI 순환 해법 변경(`forwardRef` 계열에서 `ModuleRef` 런타임 지연 해석으로) 은 `spec/5-system/4-execution-engine.md §4.4`가 "엔진 순환 의존 = forwardRef가 Nest 권장 표준"이라고 못박은 기존 합의 원칙과 다른 메커니즘을 새로 도입하면서도 그 이탈에 대한 spec Rationale 갱신을 동반하지 않았다 — 근거는 코드 주석과 in-progress plan 문서에만 흩어져 있다. 이는 명시적 기각 대안의 재도입이나 invariant 직접 위반은 아니지만, "결정 번복 시 새 Rationale 동반" 원칙에는 못 미치는 부분이라 WARNING으로 분류한다.

## 위험도

LOW
