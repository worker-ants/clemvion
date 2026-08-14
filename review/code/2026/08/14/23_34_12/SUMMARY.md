# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건은 모두 코드 동작에는 영향 없는 문서/테스트-커버리지 성격(plan 체크리스트 stale, 죽은 줄-번호 주석, 자식 cascade 필드 값 미검증). 11개 reviewer(강제 7 + router 선별 4) 전원이 결과를 남겼고 forced 화이트리스트 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `finalizeStalledExhausted` 의 자식 `NodeExecution` cascade `error` 값(`stalledError.code` 참조)이 어떤 테스트에서도 검증되지 않음 — 뮤테이션(`code: stalledError.code` → 임의 값)으로 448/448 테스트 GREEN 유지 실측 확인. 이 줄은 이 PR 자신이 "손으로 값 반복하면 갈린다"는 교훈을 재현한 자리라고 스스로 주석에 밝힌 지점이라 아이러니 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3299`, 테스트 `execution-engine.service.spec.ts:4769-4771`(status 만 단언, error 미단언) | `nodeQb.set` 단언에 `error: { code: 'WORKER_HEARTBEAT_TIMEOUT', message: '...' }` 를 objectContaining 에 추가 — 부모 UPDATE·emit 단언과 동일 패턴으로 확장 |
| 2 | Documentation | plan 체크리스트가 같은 커밋(`66baf81f0`)이 커밋 메시지로 스스로 보고한 완료 상태를 반영하지 않음 — `/consistency-check --impl-done`(`23_18_06`, BLOCK: NO 확보됨)이 여전히 미체크, 두 번째 `/ai-review`(`23_17_57`, WARNING 6건 → fix) 라운드 항목 자체가 체크리스트에 없음 | `plan/in-progress/eia-terminal-payload.md:229`(및 `:228` 인근 체크리스트) | `:229` 를 `[x]` 로 갱신하고 `23_18_06 BLOCK:NO` 기록. 두 번째 ai-review 라운드(`23_17_57`) 항목을 체크리스트에 신설 추가 |
| 3 | Requirement | `chat-channel.dispatcher.spec.ts` describe 블록 상단 JSDoc 이, 이 PR 이 형제 파일(`chat-channel.dispatcher.ts`)에서 정확히 걷어낸 것과 동일한 클래스의 죽은 줄-번호 참조·존재한 적 없는 plan 이름·낡은 "string 이 기본 경로" 전제를 그대로 남김. 개별 `it` 제목 3곳은 이번 diff 로 갱신됐으나 상위 JSDoc 은 미갱신 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:270-271`(describe JSDoc) — 참고: 이미 정정된 형제 문구는 `chat-channel.dispatcher.ts:538-545` | JSDoc 을 "레거시/배포-경계 재생 이벤트 전용 경로" 로 정정하고 죽은 줄-번호 인용 제거. `chat-channel.dispatcher.ts:538-545` 문구·근거 재사용 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `toTerminalErrorPayload` 의 `details` 필드가 값-패턴 시크릿 마스킹(`deepRedactSecrets`) 없이 그대로 통과 — 현재 DB 라이터 4곳 모두 `details` 를 채우지 않아 도달 불가능하나, 향후 라이터 추가 시 유출 경로가 될 수 있음. 이미 `spec-sync-external-interaction-api-gaps.md` 백로그 등재됨 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:78-80` | 조치 불요(등재 상태 유지). `message` 와 함께 `details` 도 같은 백로그 항목에 포함 권장 |
| 2 | Security | 종결 이벤트 `error.message` 가 값-패턴 마스킹(`deepRedactSecrets`) 없이 외부(webhook/SSE/chat-channel)로 나감 — 이번 diff 이전과 동일 노출 범위(문자열→객체 wrap 뿐), 이미 백로그(W2) 등재·이연 근거 있음 | emit 경로 4곳(`execution-engine.service.ts`, `retry-turn.service.ts`) | 조치 불요, 등재 상태 유지 |
| 3 | Architecture | 종결 `error` wire 형태가 `TerminalErrorPayload`(shared)와 `EiaFailedEvent.error`(chat-channel/types.ts) 두 곳에 독립 선언 — 컴파일러가 정합을 보장하지 않음. 이미 3중→2중으로 개선된 상태 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:36-41` vs `codebase/backend/src/modules/chat-channel/types.ts:399-409` | 지금 강제 불요. 신규 필드 추가 시 producer/consumer 동반 갱신 누락 위험을 인지할 것 |
| 4 | Architecture / Requirement / API Contract | `execution.cancelled` 의 `error` 는 이번 §6.4 정규화 대상에서 계속 제외 — code·spec·plan 3계층 모두 "다음 PR" 로 명시적으로 일관 서술, 은폐된 스코프 축소 아님 | `spec/5-system/14-external-interaction-api.md:572`, `emitCancellationEvent` 호출 5곳 | 조치 불요. 후속 PR 에서 `toTerminalErrorPayload` 로 통일 검토 |
| 5 | Requirement | dispatcher 의 object 정규화가 스칼라(`number`/`boolean`/`bigint`) 입력에서 이전(`'unknown error'` 고정)과 다른 `message` 값(스칼라 문자열화)을 생성 — 실제 emit 경로는 스칼라를 넣지 않아 영향 낮음, 테스트가 `message` 값을 단언하지 않아 의도 여부 판별 불가 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558`, `terminal-error-payload.ts:58-65` | 조치 불요(원하면 `message` 단언 테스트 추가로 의도 고정) |
| 6 | Testing | 프런트 `handleExecutionFailed` 의 "object 인데 message 없음"/"error 자체 null·부재" fallback 분기가 여전히 직접 테스트로 고정되지 않음 — 두 라운드째 의도적으로 비차단 판정 유지 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-271` | 이전 판단 유지, 여유 있으면 캐너리 1개 추가 |
| 7 | Scope / Maintainability | `toTerminalErrorPayload` 의 방어 범위(`number`/`boolean`/`bigint`/`symbol` 분기)가 실제 DB 값 종류보다 넓음 — `no-base-to-string` lint 대응 근거로 이미 두 라운드 전 조치불요 처리됨 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:58-66` | 조치 불요 |
| 8 | Maintainability | string-or-object 추출 관용구(`typeof x === "string" ? x : x?.message`)가 같은 파일에서 3번째 반복(`node.failed`/`node.cancelled`/신규 `execution.failed` 핸들러) — 의도적 일관성 유지이나 DRY 관점 경미 부채 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:268,863,970` | 4번째 반복 전에 공용 헬퍼 추출 검토 |
| 9 | Maintainability | `execution.failed` case 블록의 조사 경위 주석(9줄+7줄)이 실제 정규화 로직(6줄)보다 김 — 근거를 코드 옆에 남기는 관례 자체는 정당하나 가독성 경미 저하 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:537-546,559-566` | 조치 불요. 다음에 건드릴 때 요약 1~2줄로 축약 고려 |
| 10 | Documentation | dispatcher 주석의 대입값(`code: null`)과 다운스트림 값(`?? ''`) 표기가 혼용 — 팀이 이미 검토해 "차이를 설명 중" 이라는 근거로 유지 결정한 사안 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:559-565` | 조치 불요(기결정) |
| 11 | Side Effect | `chat-channel.dispatcher.ts` 의 string-wrap 경로 로그 필드 `code` 값이 `'INTERNAL_ERROR'` → `''`(null) 로 변경 — 분류 결과(`executionFailedInternal`)는 동일, 저장소 내부 소비자 없음(grep 확인), CHANGELOG 고지됨 | `codebase/backend/src/modules/chat-channel/execution-failure-classifier.ts:105,138` | 조치 불요. 외부 대시보드가 이 로그 값을 문자열 매칭한다면 배포 노트에 재고지 |
| 12 | Database | `finalizeStalledExhausted` 의 부모/자식 두 UPDATE 가 트랜잭션으로 묶이지 않음 — 이 PR 이전부터 존재하던 구조(값 표현만 변경), 함수 JSDoc 이 이미 "알려진 이론적 race(수용)" 로 문서화 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3264-3306` | 이번 PR 범위 밖. 원자성 원하면 별도 작업으로 `queryRunner.startTransaction()` 검토 |
| 13 | User Guide Sync | `execution-engine.service.ts` 등 변경이 `run-debug-flow-change` 매트릭스 trigger 와 표면상 유사해 `05-run-and-debug/*.mdx` 를 직접 대조 — 다른 객체(`NodeExecution.error`/error-port)를 문서화 중이라 무관, 최종 사용자 노출 문구 변경 없음 | `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx`, `run-results.mdx` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | details/error.message 미마스킹 (INFO, 백로그 등재됨). 프론트 캐스팅 CRITICAL 해소 확인 |
| architecture | LOW | 타입 2중 선언, cancelled 미통일 (모두 INFO, 이전 라운드 개선 재확인) |
| requirement | LOW | dispatcher.spec.ts JSDoc stale 참조 (WARNING). 핵심 요구사항 4계층 정합 재확인 |
| scope | LOW | 스코프 이탈 없음. 헬퍼 방어범위 다소 넓음(INFO, 기결정) |
| side_effect | LOW | breaking change CHANGELOG 완화 확인, 로그 code 값 변화 무해 확인 |
| maintainability | LOW | 직전 WARNING 해소 확인. 조사경위 주석 장문화·관용구 3중반복(INFO) |
| testing | LOW | finalizeStalledExhausted 자식 cascade error 미검증 (WARNING, 뮤테이션 실측) |
| documentation | LOW | plan 체크리스트 stale (WARNING). spec 자기모순 해소·CHANGELOG 적절성 확인 |
| database | NONE | 트랜잭션 미적용은 pre-existing, DB 스키마 변경 없음 |
| api_contract | LOW | breaking change 문서화 정합 확인, cancelled 스코프 경계 명시적 |
| user_guide_sync | NONE | 매칭 trigger 0건, 문서 갱신 불요 판정 |

## 발견 없는 에이전트

없음(전 11개 reviewer 가 최소 INFO 이상 기록).

## 권장 조치사항
1. `execution-engine.service.spec.ts:4769-4771` 의 `finalizeStalledExhausted` 자식 cascade 단언에 `error` 필드 값(`{code: stalledError.code, message: ...}`)을 추가해 뮤테이션으로 실측된 커버리지 갭을 닫는다.
2. `plan/in-progress/eia-terminal-payload.md:229` 를 `[x]` 로 갱신하고 `23_18_06 BLOCK:NO` 기록 + 두 번째 `/ai-review 23_17_57` 라운드 항목을 체크리스트에 신설한다.
3. `chat-channel.dispatcher.spec.ts:270-271` describe JSDoc 의 죽은 줄-번호 참조·낡은 전제를 형제 파일(`chat-channel.dispatcher.ts:538-545`)의 정정 문구로 교체한다.
4. (저비용, 선택) `details`/`error.message` 값-패턴 마스킹 부재를 기존 백로그(`spec-sync-external-interaction-api-gaps.md`)에서 계속 추적한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(wire payload shape 정규화)와 무관 |
  | dependency | 신규/변경 외부 패키지 의존성 없음 |
  | concurrency | 신규 동시성 제어 로직 변경 없음(기존 finalizeStalledExhausted race 는 pre-existing, database reviewer 가 별도 커버) |