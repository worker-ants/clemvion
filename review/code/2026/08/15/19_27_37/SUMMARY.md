# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 실질 코드 결함도 없는 순수 리팩터지만, architecture reviewer 가 지적한 "순환의 두 핵심 노드 중 하나(`websocket.gateway.ts`)가 전환에서 빠졌다 — plan 의 '완료' 주장과 실제 코드 상태 불일치"가 오늘 당장 버그는 아니되 재발 위험을 열어 두는 유의미한 발견이라 MEDIUM 으로 판정. forced reviewer 7명 전원 결과 확보됨(누락·미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `websocket.gateway.ts` 가 순환의 두 핵심 노드 중 하나인데도 여전히 옛 경로(`./websocket.service`)에서 `ExecutionEventType` 을 import — plan/PR 이 주장하는 "13→0 stragglers 완료"와 실제 코드 상태가 불일치. 오늘은 함수 본문 내 지연 참조라 즉시 발현하는 버그는 아니지만, 이 파일이 향후 모듈 스코프 파생을 추가하면 `service.ts`/`gateway.ts` 두 파일에서 #1174 와 동일한 `undefined` 버그가 재발할 수 있음 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:23` (import), `:400` (`emitExecutionSnapshot` 사용부) | import 를 `./websocket-events.types` 로 전환. `plan/in-progress/ws-event-types-extract.md` 의 "12곳/9곳" 실측·체크리스트에 이 파일을 추가해 완료 주장 정정. 상대경로 형태(`from './websocket.service'` vs `'../websocket/websocket.service'`) 모두 포괄하는 grep 으로 재실측 |
| 2 | requirement, maintainability | `ExecutionEventEmitter` 클래스 JSDoc 이 새로 삽입된 `TERMINAL_SHAPE` JSDoc+상수 선언에 가로막혀 클래스 선언과 분리(orphan) — TypeScript LanguageService(hover/IntelliSense) 로 재현 확인, 클래스에는 문서가 뜨지 않고 원래 클래스 설명은 어디에도 attach 되지 않음. 같은 PR 계열 자매 파일(`websocket.service.ts`)이 이미 겪고 명시적으로 회피 패턴을 남긴 결함(`14_55_29` maintainability W4)의 재발 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:51-101` (클래스 JSDoc ~ `TERMINAL_SHAPE` JSDoc/선언 ~ 클래스 선언) | `TERMINAL_SHAPE`(및 그 JSDoc)를 클래스 선언 아래 또는 import 문 직후로 이동, 혹은 한쪽을 `//` 라인 주석으로 전환해 인접 오염 차단 |
| 3 | maintainability, documentation | `NotificationEventType` 위에 JSDoc 블록이 두 개 연속 배치되어(원 설명 + 신규 disambiguation 경고) 첫 블록(채널명·SoT spec 출처)이 tooling 에서 사라짐 — 동일 메커니즘을 LanguageService 로 재현 확인 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-220` | 두 블록을 하나의 JSDoc 으로 병합(원 설명 + disambiguation 을 한 블록 안 문단으로), 또는 앞 블록을 `//` 라인 주석으로 전환 |
| 4 | documentation, security, maintainability | WARN #10(credential 마스킹) JSDoc 블록이 실제 구현이 없는 신규 타입 전용 파일에 `/** */` 블록 그대로 남아 선언 없이 떠 있고, 바로 아래 `KbEventType` 의 문서로 오인식됨 — `websocket.service.ts:121-127` 에 "정확히 이 패턴을 이미 고쳤다"는 자기-지시적 주석이 있는데도 새 파일에서 재발 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:239-246` | 블록 삭제(동일 내용이 `websocket.service.ts:66-76`/`121-127` 에 이미 존재) 또는 `//` 라인 주석으로 전환 |
| 5 | testing | "의존성-프리 모듈(`websocket-events.types.ts`)이 ES-module 순환에 재편입되지 않는다"는 불변식(#1174 재발 방지의 핵심 전제)을 직접 겨냥한 회귀 테스트/정적 가드(circular-import lint, import-0줄 스모크 테스트)가 없음 — 현재 보호는 기존 테스트가 `TERMINAL_SHAPE` 를 우연히 건드리는 부수효과와 소스 주석 서술뿐 | `codebase/backend/src/modules/websocket/websocket-events.types.ts` (헤더 주석), `.../execution-event-emitter.service.ts:68-84`, `execution-event-emitter.service.spec.ts` | (최소) 캐너리 역할을 하는 스펙 파일 상단에 "#1174 캐너리" 주석 추가. (권장) `websocket-events.types.ts` 단독 최소 스모크 테스트 추가(`^import ` 0줄 정적 단언 또는 `jest.isolateModules` 로 모든 export non-undefined 단언) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/5-system/10-graph-rag.md:552` 가 `KbEventType` canonical 선언 위치를 여전히 `websocket.service.ts` 로 서술 — re-export 덕에 문장 자체는 참이나 실제 canonical 위치는 `websocket-events.types.ts` 로 이동. consistency-check 가 이미 동일 항목을 INFO 로 자체 식별 | `spec/5-system/10-graph-rag.md:552` | 별도 project-planner turn 에서 canonical 위치 서술 갱신 검토(이번 PR 범위 밖) |
| 2 | security | `emitTerminalExecution` 이 `payload.error` 를 그대로 wire 에 실음 — `sanitizeErrorMessage` 미경유 시 스택트레이스 노출 가능성(기존 설계, 이번 diff 로 새로 생긴 결함 아님. `sanitizePayloadForWs`+`stripExternalOnlyFields` 후처리로 credential 키는 마스킹됨) | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:145-151` | 별도 turn 에서 `TerminalErrorPayload` 를 채우는 모든 호출부의 `sanitizeErrorMessage` 경유 여부 전수 확인 |
| 3 | maintainability | 동일 리팩터 내 타입 전용 import 문법 혼용(`import { type X }` inline modifier vs 대다수 파일의 `import type { X }`) | `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`, `.../graph/graph-extraction.service.ts` | 저장소 다수 스타일(`import type { X } from '...'`)로 통일, `@typescript-eslint/consistent-type-imports` 규칙 추가 고려 |
| 4 | dependency | 하위호환 re-export(`websocket.service.ts` 가 enum 값을 재-export)가 향후 실수로 다시 순환 경로에 값 import 를 태울 수 있는 잠재 회귀 표면 — `tsc` 로는 잡히지 않고 정적 가드(`no-restricted-imports`) 부재 | `codebase/backend/src/modules/websocket/websocket.service.ts:31-36` | 후속 작업에서 `websocket.service` 로부터의 enum 값 import 를 금지하는 eslint 규칙 고려 |
| 5 | maintainability | re-export facade 가 식별자 12개를 4곳(값 import/타입 import/값 export/타입 export)에 수동 나열 — 누락 시 `tsc` 가 즉시 잡아주지만(fail-closed) 수동 동기화 지점 | `codebase/backend/src/modules/websocket/websocket.service.ts:14-46` | 급하지 않음. "여기 추가 시 위 4블록 모두 갱신" 주석 고려 |
| 6 | scope | `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 복원은 순수 import 치환이 아닌 유일한 evaluation-timing 변경이나, plan 이 사전에 "성공 기준(역재현 검증)"으로 명시한 항목이라 scope creep 아님 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` | 조치 불필요(문서화·검증 완료) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 리팩터, 보안 통제(credential 마스킹/외부 fanout strip) 무변경 확인. JSDoc 배치 INFO 1건 |
| architecture | MEDIUM | `websocket.gateway.ts` 가 순환 노드임에도 전환 누락 — "완료" 주장과 실제 불일치(WARNING). JSDoc orphan INFO 2건 |
| requirement | LOW | 기능·emit 경로 바이트 단위 무변경 확인(171/171, 131 suites/3021 tests GREEN). 클래스 JSDoc orphan WARNING 1건 |
| scope | NONE | 38개 파일 전수 대조, 선언 범위 정확히 준수. `TERMINAL_SHAPE` 변경도 계획된 캐너리 |
| side_effect | LOW | export 표면·시그니처·emit 경로 전부 무변경 확인. `TERMINAL_SHAPE` 안전성 근거 문서화 확인 |
| maintainability | LOW | JSDoc orphan 패턴 2건(클래스/enum) WARNING, import 스타일 혼용 등 INFO 3건 |
| testing | LOW | 리팩터 자체는 안전 확인(lint/unit/e2e 전부 PASS). 순환 재편입 방지 불변식에 전용 회귀 테스트 부재 WARNING |
| documentation | LOW | 문서화 수준 전반 우수하나 신규 파일에서 JSDoc orphan 결함 2건 재발(WARNING) |
| dependency | NONE | 신규 외부 의존성/라이선스/버전 변경 없음. re-export 경로 정적 가드 부재는 INFO |

## 발견 없는 에이전트

해당 없음 — 9개 에이전트 전원 최소 INFO 이상 발견사항을 보고했다(대부분 "조치 불필요/확인용 기록" 성격의 확인 사항 포함).

## 권장 조치사항

1. `websocket.gateway.ts:23` 의 `ExecutionEventType` import 를 `./websocket-events.types` 로 전환하고, `plan/in-progress/ws-event-types-extract.md` 의 "전환 완료" 실측·체크리스트를 이 파일 반영해 정정 (architecture WARNING 1).
2. `execution-event-emitter.service.ts` 의 `ExecutionEventEmitter` 클래스 JSDoc 과 `TERMINAL_SHAPE` JSDoc 인접 오염을 해소 — 둘 중 하나를 재배치하거나 라인 주석으로 전환 (requirement/maintainability WARNING 2).
3. `websocket-events.types.ts` 의 `NotificationEventType` 위 JSDoc 두 블록을 병합하고, WARN #10 credential 마스킹 orphan 블록을 삭제(또는 `websocket.service.ts` 로 정리) — 같은 저장소가 이미 겪은 패턴의 재발이므로 이번 턴에 함께 정리 권장 (documentation/maintainability/security WARNING 3, 4).
4. `execution-event-emitter.service.spec.ts` 에 "#1174 캐너리" 주석을 추가하거나, `websocket-events.types.ts` 단독 스모크 테스트(import 0줄 정적 단언)를 추가해 순환 재편입 방지 불변식을 이름 있는 테스트로 고정 (testing WARNING 5).
5. (선택, 후속 turn) `spec/5-system/10-graph-rag.md` 의 `KbEventType` canonical 위치 서술 갱신, import-type 문법 스타일 통일, `no-restricted-imports` lint 규칙 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 5명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 순수 import 경로 치환이며 알고리즘/런타임 성능 특성 변경 없음 (개별 세부 사유는 라우팅 결정 파일에 미상세) |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성/락/트랜잭션 로직 변경 없음 (`TERMINAL_SHAPE` 는 모듈 평가 시점 변경이지 동시성 이슈 아님) |
  | api_contract | 라우터 판단 — 공개 API/엔드포인트 계약 변경 없음(내부 모듈 re-export 로 하위호환 보존) |
  | user_guide_sync | 라우터 판단 — 사용자 대면 문서/가이드 대상 변경 없음(내부 리팩터) |