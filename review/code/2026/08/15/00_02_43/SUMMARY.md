# Code Review 통합 보고서

## 전체 위험도
**LOW** — `execution.failed` `error` payload string→object 통일 리팩터(EIA §6.4). 이 changeset 은 동일 브랜치에서 이미 4라운드 ai-review(CRITICAL 1건 → 0건 수렴) + 2라운드 consistency-check 를 거쳤고, 이번 5차(누적 diff) 라운드는 그 결과를 9개 reviewer 전원이 소스 직접 Read/grep 으로 독립 재검증했다. 신규 CRITICAL 없음. WARNING 3건은 전부 "이미 조치 완료로 판단되거나(CHANGELOG 통지) 회귀 감지 사각지대(테스트 커버리지 갭)"이며 기능 결함이 아니다. **forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.**

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / side_effect | `execution.failed` 의 `error` wire 형태가 string → object 로 바뀌는 breaking change. 저장소가 URL 버전 세그먼트를 쓰지 않아 기계적 버전 신호가 없고, `notification-fanout.service.ts` 가 payload 를 가공 없이 webhook 큐에 그대로 실어 이 저장소 밖 webhook 구독자에게 예고 없이 shape 이 바뀐 채 전달됨 | `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:128-136`(pass-through 확인), `execution-engine.service.ts` emit 4곳, `retry-turn.service.ts`, `CHANGELOG.md:9` | 조치 완료로 판단(CHANGELOG 에 "수신자 영향 (breaking)" 명시 확인됨). 추가 조치 불요 — 후속으로 외부 webhook payload 에 스키마 버전 필드를 얹는 안을 백로그 고려 |
| 2 | testing | `chat-channel.dispatcher.spec.ts` 의 number 스칼라 흡수 테스트가 `code: null` 만 단언하고 실제 산출 `message` 값(`'42'`)을 검증하지 않음. 테스트 제목·주석이 여전히 "placeholder" 라 부르나 이제 진짜 placeholder 가 아니라 스칼라 문자열화 결과임 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (`payload.error 가 number → wrap (placeholder)` 블록, 실제 350~365행) | `expect(eia.error.message).toBe('42')` 추가 + 테스트 제목을 실제 동작에 맞게 갱신 |
| 3 | testing | 프런트엔드 `handleExecutionFailed` 의 신규 object 정규화 분기 중 "message 없는 object"(`{code:'X'}`)·"error 필드 자체 부재"(`data:{}`) 서브케이스가 미검증 — `??` 폴백 우변이 실수로 지워져도 GREEN 일 수 있음 | `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`handleExecutionFailed`, `errorMessage ?? "Execution failed before the tool completed"` 폴백 분기) | `{ error: {} }`(message 없음), `{}`(error 없음) fixture 로 폴백 문구·tool-flip 경로 각각 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `error.message`/`error.details` 가 마스킹 없이 webhook/SSE/chat-channel 구독자에게 그대로 전달됨 — 기존 갭이며 이 PR 이 확장하지 않음(producer 4곳 어디도 `details` 를 채우지 않아 통과 분기는 dead path). 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 별도 추적 중 | `codebase/backend/src/shared/utils/terminal-error-payload.ts`, 소비 지점 `execution-engine.service.ts`, `retry-turn.service.ts` | 조치 불요(범위 밖, 별도 PR 트래킹) |
| 2 | architecture | `TerminalErrorPayload`(`terminal-error-payload.ts`)와 `EiaFailedEvent.error`(`chat-channel/types.ts`)가 같은 §6.4 형태를 독립 선언 — import 연결 없어 정합을 사람이 매번 판단해야 함(3라운드 연속 동일 관찰) | `terminal-error-payload.ts:36-41`, `chat-channel/types.ts:399-408` | 조치 불요(현재 안정적). 필드 추가 시 `Pick<TerminalErrorPayload, ...>` 재사용 고려 |
| 3 | architecture / requirement / api_contract | `execution.cancelled` 의 `error` 는 이번 정규화 대상에서 제외돼 같은 이벤트 패밀리 안에 두 `error` shape(신규 nullable-object `failed` vs 기존 `{code, message}` `cancelled`)이 공존 — code·spec·plan 3계층에서 일관되게 "후속 비용 그룹"으로 명시 추적됨(은폐 아님) | `chat-channel/types.ts:422`(`EiaCancelledEvent.error`), `execution-engine.service.ts:1079-1103`(`emitCancellationEvent`, diff 밖) | 조치 불요(범위 밖, 명시 추적). 후속 PR 에서 같은 헬퍼로 통일 고려 |
| 4 | architecture | `emitExecution(payload: unknown)` 이벤트 emit 경계가 강타입을 소실시켜 각 consumer 가 `as` 캐스팅으로 재구성 — 이번 PR 이 만든 구조는 아니고, 이번 PR 이 고친 CRITICAL(프런트 캐스팅 미스매치)의 근본 원인이었던 경계 | `execution-event-emitter.service.ts:37` | 이번 PR 범위 밖. discriminated payload union 은 별도 개선 항목으로 고려 |
| 5 | scope | `EiaCompletedEvent.result` 유령 필드(`finalNodeId`/`finalPort`) 제거는 표면상 별개 관심사로 보이나 `plan/in-progress/eia-terminal-payload.md:177-182` 에 "동반 필수"로 사전 등재된 항목 — 무단 확장 아님 | `chat-channel/types.ts` (`EiaCompletedEvent`) | 조치 불요 |
| 6 | scope | 코드 diff(14파일, 431+/65-) 대비 함께 커밋된 `review/**`·`plan/**` 산출물(~77파일)이 크지만, CLAUDE.md 가 강제하는 forced-review 워크플로(ai-review 4라운드+consistency-check 2라운드)의 정상 필수 증적 | `review/code/2026/08/14/**`, `plan/**` | 조치 불요 |
| 7 | side_effect | `EiaCompletedEvent.result` 의 `finalNodeId?`/`finalPort?` 제거는 타입 축소지만 살아있는 소비자 0건(죽은 필드) | `chat-channel/types.ts` | 조치 불요 |
| 8 | side_effect | `EiaFailedEvent.error.code` 가 `string`→`string | null` 로 완화 — 다운스트림 비교부(classifier whitelist, telegram renderer optional chaining) 전수 확인, 영향 없음 | `chat-channel/types.ts` | 조치 불요 |
| 9 | maintainability | `toTerminalErrorPayload` 의 스칼라 방어 분기(number/boolean/bigint)가 실제 DB 호출부가 낼 수 있는 값보다 넓음(일반 유틸리티 방어, 테스트로 고정돼 결함 아님) | `terminal-error-payload.ts` (58~67행) | 조치 불요 |
| 10 | maintainability | `chat-channel.dispatcher.ts` 의 `execution.failed` 분기에 조사 경위 서술 주석이 실제 로직보다 김 | `chat-channel.dispatcher.ts` (537~546, 559~566행) | 조치 불요(차단 아님). 다음 수정 시 결론만 남기고 조사 경위는 plan 으로 이관 고려 |
| 11 | maintainability / testing | string-or-object 추출 관용구(`typeof payload.error === "string" ? ... : payload.error?.message`)가 `use-execution-events.ts` 에서 3번째 반복 — 의도적 일관성 유지, "4번째 반복 시 헬퍼 추출" 합의 상태 | `use-execution-events.ts:268-270` (기존 863-865, 970-972 와 동일) | 시급하지 않음. 4번째 반복 전 `extractErrorMessage` 헬퍼 검토 |
| 12 | maintainability | 소스 주석이 `review/code/**` 세션의 날짜 없는 bare 타임스탬프(`22_55_51` 등)를 근거로 인용 — 이 PR 신규 패턴 아니라 저장소 전역 기존 컨벤션 | 다수 소스/스펙 파일 | 조치 불요(기존 컨벤션 준수) |
| 13 | documentation | 이전 4라운드 지적 문서화 결함(죽은 plan 참조, spec §6/§6.4 자기모순 5곳, plan 체크리스트 지연) 전수 직접 재검증 결과 실제로 해소 확인 | spec §6/§6.4, `chat-channel-adapter.md`, `plan/in-progress/eia-terminal-payload.md:171-177` | 조치 불요 |
| 14 | documentation | `chat-channel.dispatcher.ts:565-566` 주석 마지막 문장이 대입값(`null`)이 아니라 classifier 내부 표현(`''`)을 근거로 인용 — 3라운드 연속 조치 불요로 기결정, 바로 위 줄이 정확한 변환을 짚어 실무 혼선 낮음 | `chat-channel.dispatcher.ts:565-566` | 조치 불요(기결정 유지) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | error.message/details 무마스킹 노출 — 기존 갭, 미확장, 별도 트래킹 (INFO) |
| architecture | LOW | 핵심 코드 4라운드 전 확정, 이번 라운드 변경 없음. 잔여 관찰 3건 모두 INFO |
| requirement | NONE | spec §6.4 정합 완전 재검증, 테스트 전량 GREEN, cancelled 미통일은 명시 추적된 범위 밖 |
| scope | LOW | 코드 diff 14파일로 좁고 무관 변경 없음. 유령필드 제거는 plan 사전 승인 |
| side_effect | LOW | breaking wire 계약 변경 1건(WARNING, 통지 완료), 그 외 저장소 내부 소비자 전원 갱신 확인 |
| maintainability | LOW | 함수 품질 양호, 잔여는 전부 INFO(방어 범위/주석 길이/DRY 부채/타임스탬프 인용 관례) |
| testing | LOW | 헬퍼 테스트는 견고(뮤테이션 실측). dispatcher 스칼라 값 미단언·프런트 서브케이스 미검증 WARNING 2건 |
| documentation | LOW | 이전 라운드 지적 전수 직접 재검증으로 해소 확인. 잔여 1건 INFO(3라운드 기결정) |
| api_contract | LOW | breaking change 1건(WARNING, CHANGELOG 통지 완료로 조치 완료 판단), cancelled 미통일은 INFO |

## 발견 없는 에이전트

(해당 없음 — 9개 reviewer 전원 최소 INFO 이상 발견사항 보고, Critical 발견은 없음)

## 권장 조치사항

1. `chat-channel.dispatcher.spec.ts` 의 number 스칼라 흡수 테스트에 `expect(eia.error.message).toBe('42')` 단언 추가 + 제목을 "placeholder"에서 실제 동작(스칼라 문자열화)으로 갱신.
2. `use-execution-events.ts` `handleExecutionFailed` 에 `{ error: {} }`(message 없음)·`{}`(error 없음) fixture 테스트 추가해 폴백 문구·tool-flip 경로 고정.
3. (긴급하지 않음) 외부 webhook payload 에 스키마 버전 필드를 얹는 안을 백로그로 남겨 breaking change 를 CHANGELOG 문서화 이상으로 강제할 수 있는 수단 검토.
4. (긴급하지 않음) 후속 PR 에서 `emitCancellationEvent` 를 `toTerminalErrorPayload` 헬퍼(또는 부분집합)로 통일해 `execution.cancelled`/`execution.failed` 의 `error` shape 을 일치시킬 것 — 이미 `spec-sync-external-interaction-api-gaps.md` 로 추적 중.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 표 (아래, 5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨, 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 diff 범위 밖(비-핫패스 payload 정규화 리팩터) |
  | dependency | router 판단상 diff 범위 밖(신규 의존성 없음) |
  | database | router 판단상 diff 범위 밖(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 diff 범위 밖(동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 diff 범위 밖(사용자 가이드 문서 대상 아님) |