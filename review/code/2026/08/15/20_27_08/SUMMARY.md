# Code Review 통합 보고서

## 전체 위험도
**LOW** — `ws-event-types-extract` 리팩터(#1174 ES-module 순환 회귀 방지)의 3차 fresh review. CRITICAL 없음, WARNING 2건(둘 다 이 PR 자신이 도입한 신규 회귀 가드/원칙의 내부 일관성 미비 — 기능·컴파일 영향 없음). forced whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `import type` 통일 원칙(직전 라운드가 `ExecutionChannelEvent` 3곳에 적용)이 같은 diff 안의 타입 전용 인터페이스 4곳(`ExecutionRoutingContext`, `ChatChannelRoutingInfo`, `ToolCallStartedPayload`, `ToolCallCompletedPayload`)에는 미적용 — enum 값과 같은 import 문에 섞여 있음. `tsc`/`eslint` 모두 미검출(순수 스타일). | `execution-event-emitter.service.ts:5`, `execution-engine.service.ts:119`, `ai-turn-executor.ts:56-57` | 4곳을 `import type { … }` 또는 인라인 `type` 키워드로 통일. 기계적 1줄 수정, 리스크 없음. |
| 2 | testing | 신규 회귀 가드 `valueEdgeToWebsocketService`(named-import 분기)가 `WebsocketService` 예외 처리를 원 export 식별자가 아니라 **로컬(별칭) 바인딩 이름**으로 판정 — 양방향 실측 확인: (a) `import { WebsocketService as WS } from …` → 오탐(FP), (b) `import { ExecutionEventType as WebsocketService } from …` → **미검출(FN, #1174 재발 클래스 그 자체를 놓침)**. `export … from` 분기는 이 예외 자체가 없어 두 분기 판별 기준이 비대칭. 현재 저장소에 이 alias 패턴 실사용처는 없어 당장 프로덕션 위험은 아님. | `websocket-events.types.spec.ts` `valueEdgeToWebsocketService` 함수(named-import 분기, 원 export 식별자 대신 `el.name.text` 비교) | `(el.propertyName ?? el.name).text !== 'WebsocketService'` 로 교체하고 `export … from` 분기에도 동일 예외 추가. 뮤테이션 표에 alias 시나리오(FP/FN 양방향) 추가해 고정. |

## 참고 (INFO)

주요 항목만 통합(reviewer 전원이 "새 결함 아님, 확인용"으로 표기한 다수 항목은 생략):

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `emitTerminalExecution` 이 `payload.error` 를 가공 없이 `wire.error` 에 실음 — 이번 diff 범위 밖 기존 설계, 마스킹/새니타이징 전수 적용 여부는 별도 후속 확인 대상 | `execution-event-emitter.service.ts` `emitTerminalExecution` | 이번 PR 범위 밖 후속 작업으로 별도 turn 확인 |
| 2 | architecture | re-export facade(`websocket.service.ts`)가 3중 수동 동기화 지점(재-export 목록/실제 선언/`EXPECTED_EXPORTS`) — "새 선언 추가 시 재-export 누락"은 어떤 가드도 못 잡음 | `websocket.service.ts` re-export 블록 | 후속에서 `export * from './websocket-events.types'` barrel 형태로 단일화 고려 |
| 3 | architecture | 순환 재편입 가드가 lint/CI 계층이 아니라 단위 테스트(Jest spec) 계층에서 `src/` 전체를 TS 파서로 스캔 — 기능적으로는 견고(뮤테이션 검증) | `websocket-events.types.spec.ts` | 후속 PR 에서 `eslint-plugin-import` 류로 승격 검토 |
| 4 | side_effect | `TERMINAL_SHAPE` 가 함수-지역 리터럴 → 모듈 스코프 `as const` 상수로 승격 — 런타임 `Object.freeze` 는 아니라 이론상 타입 우회 시 프로세스 전역 오염 가능(현재 쓰기 경로 없음) | `execution-event-emitter.service.ts:71,143` | 조치 불요(현재 read-only). 향후 쓰기 접근 코드는 반드시 리젝트, 필요 시 `Object.freeze` |
| 5 | requirement | spec §4.4(`4-execution-engine.md`) Rationale 에 이번 추출 반영 후속 bullet 부재, `KbEventType` 정본 위치 서술이 spec 6곳에서 stale | spec 파일들 | developer 권한(`spec/` read-only) 밖 — `plan/in-progress/ws-event-types-extract.md` 후속 절에 이미 등재됨. planner 턴에서 처리 |
| 6 | scope | fix 커밋(`a6d764ac6`) 전체가 직전 라운드 지적사항에 1:1 대응, 새 스코프 확장 없음 | 다수 파일 | 없음 |
| 7 | documentation | 직전 3라운드 지적 문서화 결함(JSDoc orphan 2건, WARN #10 고아화, stale 주석, `import type` 3곳) 전부 반영 확인 | 다수 파일 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 리팩터, 하드코딩 시크릿 재스캔 0건, 기존 마스킹/strip 로직 보존 확인 |
| architecture | NONE | 직전 라운드 WARNING 전부 해소 재확인, 신규 CRITICAL/WARNING 없음 |
| requirement | NONE | 핵심 요구사항(순환 회피)이 코드+가드로 정확히 구현됨, 남은 항목은 spec 문서 갱신(planner 권한) |
| scope | NONE | fix 커밋 전체가 직전 지적사항 1:1 대응, 스코프 확장 없음 |
| side_effect | NONE | import 재배선뿐, 유일 로직 변경(`TERMINAL_SHAPE`)도 값/동작 동일 |
| maintainability | LOW | `import type` 통일 원칙이 4곳에 미적용 (WARNING 1건) |
| testing | LOW | 신규 회귀 가드의 alias 판별 결함, FP/FN 양방향 실측 확인 (WARNING 1건) |
| documentation | NONE | 직전 3라운드 문서화 지적사항 전부 해소 확인 |

## 발견 없는 에이전트

security, architecture, requirement, scope, side_effect, documentation (CRITICAL/WARNING 없음 — 전부 INFO 이하 또는 없음)

## 권장 조치사항
1. testing WARNING(alias 판별 결함) 수정 — `valueEdgeToWebsocketService` named-import 분기를 `(el.propertyName ?? el.name).text` 비교로 교체하고 `export … from` 분기에도 동일 예외 추가. 이 가드가 막으려는 결함 클래스(#1174 재발)를 정확히 놓치는 FN 경로이므로 우선순위 높음.
2. maintainability WARNING(`import type` 4곳 미통일) 정리 — 기계적 1줄 수정, 리스크 없음.
3. (선택, 이번 PR 비차단) `TerminalErrorPayload.error` 새니타이징 전수 적용 여부 별도 turn 확인.
4. (선택, planner 턴) spec §4.4 후속 bullet + `KbEventType` 정본 위치 stale 서술 6곳 — `plan/in-progress/ws-event-types-extract.md` 후속 절에 이미 정확히 등재되어 있으므로 그대로 진행.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **제외**: 표 (아래, 6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **forced 전원 결과 확보 완료, 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 (프롬프트에 사유 미상세) |
  | dependency | router 판단 (프롬프트에 사유 미상세) |
  | database | router 판단 (프롬프트에 사유 미상세) |
  | concurrency | router 판단 (프롬프트에 사유 미상세) |
  | api_contract | router 판단 (프롬프트에 사유 미상세) |
  | user_guide_sync | router 판단 (프롬프트에 사유 미상세) |