# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음. 변경 파일 전체가 매트릭스의 어떤 trigger 에도 매칭되지 않는다.

## 분석 근거

### 변경 파일 목록 (13개 소스 파일)

모두 `codebase/backend/src/modules/execution-engine/` 및 `codebase/backend/src/modules/websocket/` 하위의 TypeScript 파일이다:

- `ai-turn-orchestrator.service.ts` — `EngineDriver` → `AiTurnEngineDriver` 타입 교체
- `button-interaction.service.ts` — `EngineDriver` → `InteractionEngineDriver` 타입 교체
- `form-interaction.service.ts` — `EngineDriver` → `InteractionEngineDriver` 타입 교체
- `continuation/continuation-execution.processor.ts` — `RetryTurnService` 직접 주입 (engine delegator 제거)
- `continuation/continuation-execution.processor.spec.ts` — 위 변경 대응 단위 테스트
- `engine-driver.interface.ts` — 단일 `EngineDriver` 를 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` / `EngineDriver` 로 ISP 분해
- `events/execution-event-emitter.service.ts` — `forwardRef` 주입 추가 (ES 모듈 순환 강화)
- `execution-engine.module.ts` — `RetryTurnService` exports 추가, engine→Retry 역방향 주입 제거
- `execution-engine.service.ts` — thin delegator(`retryLastTurn`, `applyRetryLastTurn`) 제거
- `execution-engine.service.spec.ts` — `retryTurnService` 직접 호출로 교체
- `websocket.gateway.ts`, `websocket.gateway.spec.ts` — 관련 외부 진입점 변경

### 매트릭스 trigger 매칭 결과 (18개 rows)

| 매트릭스 행 (id) | trigger | 매칭 여부 | 사유 |
|---|---|---|---|
| new-node | codebase/backend/src/nodes/** | 불일치 | 변경 파일이 src/nodes/ 하위 없음 |
| node-schema-change | codebase/backend/src/nodes/** | 불일치 | 동일 |
| new-ui-string | TSX 신규 한국어 리터럴 (semantic) | 불일치 | .tsx 파일 없음 |
| integration-provider-change | semantic | 불일치 | 통합/제공자 변경 없음 |
| new-userguide-section-dir | codebase/frontend/src/content/docs/*/ | 불일치 | frontend 파일 없음 |
| backend-api-change | *.controller.ts, **/dto/** | 불일치 | controller·DTO 없음 |
| new-warning-code | semantic (warningRules) | 불일치 | warningRules 변경 없음 |
| new-error-code | codebase/backend/src/nodes/core/error-codes.ts | 불일치 | 해당 파일 없음 |
| new-cross-cutting-enum | semantic | 불일치 | 신규 enum 값 없음 |
| new-backend-ui-zod-value | semantic (ui.label/hint/group) | 불일치 | zod UI 값 변경 없음 |
| new-handler-output-field | semantic | 불일치 | output field 변경 없음 |
| auth-session-flow-change | codebase/backend/src/modules/auth/** (semantic) | 불일치 | auth 파일 없음 |
| auth-config-type-enum-change | semantic | 불일치 | AuthConfig enum 변경 없음 |
| expression-language-change | codebase/packages/expression-engine/** | 불일치 | 해당 패키지 없음 |
| run-debug-flow-change | semantic (실행·디버깅 흐름) | 검토 후 불일치 | 아래 상세 참조 |
| env-runtime-change | semantic | 불일치 | 환경변수 변경 없음 |
| spec-major-change | spec/** | 불일치 | spec 파일 없음 |
| userguide-gui-flow-section | semantic/glob (docs MDX) | 불일치 | docs MDX 없음 |

#### run-debug-flow-change 상세 판정

본 변경은 컴파일 타임 전용 ISP(Interface Segregation Principle) 리팩토링이다:

- `EngineDriver` 단일 인터페이스를 소비자별 부분 인터페이스로 분해 (타입 가시성 축소, 런타임 바인딩·동작 불변)
- `engine→RetryTurnService` 역방향 순환 DI 제거 (단방향 `Retry→engine` 정리)
- `retryLastTurn`/`applyRetryLastTurn` thin delegator 제거 후 호출 사이트를 `RetryTurnService` 직접 호출로 이전

사용자에게 노출되는 실행 흐름, 디버그 로깅 형식, run 패널 동작에는 변화가 없다. 매트릭스의 `run-debug-flow-change` 는 "backend 실행 엔진·디버그 로깅 변경이 05-run-and-debug/ 갱신 누락"을 guard 하는 것으로, 내부 타입 시스템 구조 변경은 해당하지 않는다.

## 요약

매트릭스 총 18개 trigger 모두 검토. 변경 13개 파일은 execution-engine 모듈 내부의 DI 인터페이스 ISP 분해 및 순환 DI 정리 리팩토링으로, 매칭되는 trigger 0건, 누락된 동반 갱신 0건이다. 유저 가이드·i18n dict·backend-labels 동반 갱신이 필요한 변경 없음.

## 위험도

NONE
