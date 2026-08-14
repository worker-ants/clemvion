# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(`execution.failed` error wire 계약 breaking change)은 CHANGELOG 로 이미 통지되고 6개 선행 라운드(`22_55_51`~`00_02_43`)에 걸쳐 반복 확인된 pre-existing 항목이며 이번 라운드에서 코드가 추가로 바뀐 부분은 없다. forced(router_safety) 화이트리스트 7개 reviewer 전원의 결과가 인라인·디스크 양쪽에서 확보되어 있음을 확인했다(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | `execution.failed` 종결 이벤트의 `error` wire 형태가 `string` → `{code, message, nodeId, details?}` object 로 바뀌는 실질 breaking change. 저장소가 URL 버전 세그먼트를 쓰지 않는 단일 버전 운영이라 dual-shape 과도기 등 하위호환 마이그레이션 경로가 코드상 없음. `notification-fanout.service.ts` 가 emit payload 를 가공 없이 그대로 webhook enqueue 에 실어 저장소 밖 제3자 구독자에게도 그대로 전파됨(side_effect 리뷰어도 동일 사실을 확인, INFO 로 기록) | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (emit 3곳), `retry-turn.service.ts`(`failRetryExecution`), `codebase/backend/src/shared/utils/terminal-error-payload.ts`, `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:128-136`, `CHANGELOG.md:9` | 이미 CHANGELOG 로 breaking 통지 완료(최소 요건 충족). 실제 활성 외부 webhook 구독자 존재 여부를 운영 측에서 확인하고, 있다면 릴리스 노트에도 동일 문구 반영. 코드 변경 자체를 막을 사유는 아님(조치 불요, 참고 기록) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement | `TerminalErrorPayload.details`(및 `message`)가 값-패턴 시크릿 마스킹 없이 wire 로 통과. 다만 현재 4개 producer 어느 곳도 `details` 를 채우지 않아 도달 불가 경로이고, `message` 노출 자체는 이 PR 이전부터 동일 fanout 을 타던 선존 갭 — 노출 범위 확장 없음. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 등재 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:78-80` | 조치 불요(범위 밖, 백로그 추적 중). `details` 가 실제로 채워지기 시작하기 전에 마스킹 항목 집행 |
| 2 | architecture / requirement / api_contract | `execution.cancelled` 의 `error` 는 이번 §6.4 object 일원화 대상에서 제외돼 `{code, message}`(non-nullable code, `nodeId`/`details` 없음) 로 `execution.failed` 와 형태가 다름. spec §6 표·plan·헬퍼 JSDoc 3계층이 일관되게 "후속 작업" 으로 명시 추적 — 은폐 아님 | `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCancelledEvent.error`), `execution-engine.service.ts`(`emitCancellationEvent`, diff 밖) | 조치 불요. 후속 PR 에서 `emitCancellationEvent` 도 같은 헬퍼(또는 부분집합)로 통일 검토 |
| 3 | architecture | 같은 §6.4 wire 형태가 `TerminalErrorPayload` 와 `EiaFailedEvent.error`(인라인 타입) 두 곳에 독립 선언 — 컴파일러가 정합을 보장하지 않음 | `terminal-error-payload.ts`(`TerminalErrorPayload`), `chat-channel/types.ts`(`EiaFailedEvent.error`) | 조치 불요(4라운드 연속 수용된 트레이드오프). §6.4 필드 추가 시 `Pick<TerminalErrorPayload, ...>` 재사용 고려 |
| 4 | architecture | 이벤트 emit 경계(`emitExecution`)가 `payload: unknown` 이라 producer 의 강타입이 전송 경계를 넘는 순간 소실 — 이번 PR 의 CRITICAL(캐스팅-only 렌더 크래시)의 근본 원인이 된 구조적 여지가 남음(이 diff 가 만든 구조는 아님) | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` | 이번 PR 범위 밖. discriminated payload union 으로 좁히는 안을 별도 개선 항목으로 등재 고려 |
| 5 | scope / maintainability | `toTerminalErrorPayload` 의 방어 범위(`number`/`boolean`/`bigint` 분기)가 실제 DB(jsonb) 호출부가 낼 수 있는 값의 종류보다 넓음 — `no-base-to-string` lint 대응 근거로 5라운드 전 조치 불요 확정된 항목의 재확인 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:58-65` | 조치 불요(팀 판단 완료) |
| 6 | scope | 코드 diff(14개 파일) 대비 함께 커밋된 review/consistency/plan 산출물(89개 파일) 비중이 큼 — CLAUDE.md 가 규정한 강제 리뷰 게이트 축적물로 확인, 무단 확장 아님 | `review/code/2026/08/14/**`, `review/consistency/2026/08/14/**`, `plan/**` | 조치 불요. 반복되면 코드/프로세스 diff 분리 커밋 고려(선택) |
| 7 | maintainability | `chat-channel.dispatcher.ts` `execution.failed` 케이스 블록의 조사 경위 주석(약 21줄)이 실제 정규화 로직(6줄)보다 김 | `chat-channel.dispatcher.ts` (538~566행) | 조치 불요. 다음 수정 시 조사 경위는 1~2줄로 축약 검토 |
| 8 | maintainability | string-or-object 추출 관용구(`typeof x === "string" ? x : x?.message`)가 `use-execution-events.ts` 한 파일에서 3번째로 반복(의도적 일관성, 스타일 이탈 아님) | `codebase/frontend/src/lib/websocket/use-execution-events.ts:268,863,970` | 4번째 반복 전에 공용 헬퍼 추출 검토 |
| 9 | side_effect | `chat-channel` unknown-fallback 구조화 warn 로그의 `code` 값이 `'INTERNAL_ERROR'`(지어낸 값) → `null`/`''` 로 변경. 내부 소비자 없음 확인, 외부 로그 대시보드 매칭 룰이 있다면 무효화될 수 있음(CHANGELOG 에 이미 언급) | `chat-channel.dispatcher.ts:552-558`, `execution-failure-classifier.ts:105,136-143` | 조치 불요. 참고용 기록 |
| 10 | testing | `chat-channel.dispatcher.ts` 통합 지점에서 배열/필드 없는 객체 같은 비정형 object 입력 회귀 테스트 없음(헬퍼 단위 테스트로는 커버됨, 실질 발생 가능성 낮음) | `chat-channel.dispatcher.ts:552-558`, `chat-channel.dispatcher.spec.ts:294-369` | 급하지 않음. `{code:'X'} as never` fixture 추가 고려 |
| 11 | testing | 프런트엔드 회귀 캐너리가 스토어 값 타입만 확인하고, 실제 크래시 재현 지점(`ToolDetail` JSX 렌더)까지는 내려가지 않음 | `use-execution-events.test.ts:1140-1159` | 조치 불요. `ToolDetail` 변경 시 렌더 스모크 테스트 추가 고려 |
| 12 | documentation | `chat-channel.dispatcher.spec.ts` 한 테스트 제목("undefined / 잘못된 타입")이 실제 fixture(undefined 하나뿐)보다 넓은 커버리지를 주장 — 옆 테스트들은 이미 이번 diff 로 같은 이유로 정정됐으나 이 항목은 누락 | `chat-channel.dispatcher.spec.ts:332` | 제목을 실제 범위로 좁히거나 "잘못된 타입" fixture(`{}`/배열) 추가 |
| 13 | user_guide_sync / documentation | `run-debug-flow-change` doc-sync trigger 와 표면 유사하나 wire 형태 정규화일 뿐 최종 사용자 노출 문구·UI 불변 확인(3회째 독립 재확인). `05-run-and-debug/*.mdx` 는 무관한 별개 객체(node-level error-port 데이터) 문서화 | `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` | 조치 불요 |
| 14 | (positive) 다수 | `toTerminalErrorPayload` 순수 함수(부작용 없음), 유령 필드(`finalNodeId`/`finalPort`) 제거·`code` nullable 완화 다운스트림 파손 없음, JSDoc 의 모든 실측 가능 주장이 소스와 정확히 일치, README/사용자 문서 갱신 불요 판단 확인, spec §6 표·§6.4 blockquote 자기모순 해소, doc-sync-matrix 21개 trigger 중 매칭 없음(스펙 프런트매터만 이미 충족) | 각 reviewer 보고서 참조 | 없음(정보성) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | error.message/details 무마스킹 노출(선존 갭, 도달 불가 경로) — INFO만 |
| architecture | LOW | 구조 변경 없음(3라운드째 소스 불변). 2중 타입 선언·cancelled 미통일·emit payload:unknown 경계 — 전량 INFO 이월 |
| requirement | NONE | 핵심 변경이 spec §6.4 와 line-level 정합. cancelled 미통일·details 마스킹만 INFO |
| scope | LOW | 코드 diff 14개 파일로 범위 안정적. 헬퍼 방어 범위·대량 문서 산출물만 INFO |
| side_effect | LOW | wire breaking change 는 CHANGELOG 로 이미 통지·6라운드 확인. 헬퍼 순수함수 확인(positive) |
| maintainability | LOW | 직전 라운드 CRITICAL/WARNING 실제 해소 재확인. 잔여는 주석 길이·관용구 반복 등 INFO |
| testing | LOW | producer/consumer 값-단위 단언 촘촘. 비정형 object 입력·컴포넌트 레벨 캐너리 미흡만 INFO |
| documentation | LOW | JSDoc 실측 정확성 우수. 테스트 제목 1건이 커버리지 과장(INFO) |
| api_contract | LOW | WARNING 1건(wire breaking change, 완화 요인 다수로 LOW 유지) |
| user_guide_sync | NONE | doc-sync-matrix 21 trigger 전수 대조, 매칭 없음(spec-major-change 만 매칭, 이미 충족) |

## 발견 없는 에이전트

없음 — 10개 reviewer 전원이 최소 1건 이상의 INFO 를 보고했다(대부분 이월/재확인성 관찰이며 신규 결함 아님).

## 권장 조치사항

1. (운영 항목, 코드 조치 아님) 실제 활성 외부 webhook 구독자 존재 여부를 운영 측에서 확인하고, 있다면 릴리스 노트에도 `execution.failed` `error` breaking change 문구를 반영해 배포 전 통지할 것.
2. `chat-channel.dispatcher.spec.ts:332` 테스트 제목을 실제 fixture 범위("undefined" 만)로 좁히거나 "잘못된 타입"(빈 객체/배열) fixture 를 `it.each` 로 추가.
3. 급하지 않음: `chat-channel.dispatcher.ts` 통합 레벨에 비정형 object(배열, message 없는 `{}`) 입력 fixture 추가, `ToolDetail` 컴포넌트를 다음에 건드릴 때 렌더 스모크 테스트 추가.
4. 후속 PR(이미 plan 등재됨): `execution.cancelled` 계열도 `toTerminalErrorPayload` 헬퍼로 통일하고, `details` 가 실제로 채워지기 시작하기 전에 값-패턴 마스킹을 적용.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 범위(wire payload 형태 정규화)와 성능 표면 무관 |
  | dependency | router 판단 — 신규/변경 의존성 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음(기존 jsonb 컬럼 write 패턴 유지) |
  | concurrency | router 판단 — 동시성 제어 로직 변경 없음 |