# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 3건(전부 문서/문서화 정확성 성격 — 코드 로직 결함 없음). forced(router_safety) 화이트리스트 7명 전원 결과 확보, 누락 없음.

이 diff 는 이미 3라운드(`09_51_00`→`10_19_30`→`10_41_55`)를 거친 동일 변경 계열의 4번째 검토다. 핵심 코드 변경(`redactTerminalError` egress 마스킹, `toTerminalErrorPayload` 4개 반환 경로 배선)은 7개 reviewer 전원이 독립적으로 소스를 재대조해 우회 경로 없음·mutation 없음·시그니처 불변을 재확인했다. 신규로 발견된 WARNING 은 모두 (1) docstring 서술이 구현보다 근소하게 넓은 문제, (2) spec 이 신규 마스킹을 아직 반영하지 못한 SPEC-DRIFT(이미 plan 에 tracked), (3) 이 PR 자신의 plan 체크리스트가 완료된 라운드를 미체크로 남긴 문제 — 셋 다 코드 안전성에 영향 없는 문서 정확성 항목이다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `sanitize-error-message.ts`(execution-engine) docstring 이 "호출부 3곳 전부 알림 조립 지점"이라 적지만, 그중 `background-execution.processor.ts` 는 sanitize 결과를 알림뿐 아니라 격리된 `background:run:<id>` WS 채널의 `errorMessage` 에도 무조건 싣는다. 이 채널은 SSE/webhook 으로 안 나가 EIA 종결 3종 안전성 결함은 아니나, docstring 범위 서술 자체가 구현보다 근소하게 넓다 | `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:1-6` (docstring), 실제 호출: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:70-77` | docstring 을 "알림뿐 아니라 격리된 `background:run:<id>` WS 채널(`errorMessage`)에도 사용됨 — 종결 3종 이벤트가 아니라 내부 전용 채널" 로 정정. 차단 사유 아님 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` spec §6.4 `execution.failed` 필드 표와 R17 "표면 제약(보안)" 마스킹 카탈로그가 이번 PR 이 도입한 `toTerminalErrorPayload` egress 값-패턴 마스킹을 아직 문서화하지 않는다. 코드가 §R17 의 기존 egress-only masking 원칙을 `error` 필드에 동형 확장한 의도적 개선이며, spec 이 낡은 경우다 — developer 가 이미 인지해 planner 후속으로 등재해 둔 상태 | `spec/5-system/14-external-interaction-api.md:770-802` (§6.4), `:1414-1430` (R17 카탈로그) | planner 턴에서 §6.4 안내문에 마스킹 캐비엇 추가 + R17 카탈로그에 5번째 항목("terminal `execution.failed` error.message/details — WS/SSE/webhook 종결 emit") 추가. 이미 `plan/in-progress/eia-terminal-error-sanitize.md:151-159` 에 등재됨 — 신규 액션 아니라 확인 차원 |
| 3 | Documentation | plan 체크리스트의 "fresh `/ai-review` (fix 이후)" 항목이, 그 항목을 충족한 `10_41_55` 라운드(RESOLUTION: "3라운드 수렴, codebase 편집 종료")가 커밋된 뒤에도 `- [ ]` 미체크로 남아 있다. 이 저장소가 이미 2회 별도 기록한 "plan 체크박스 = 실제 상태" 교훈이 같은 PR 안에서 3번째로 재발 — stale 체크박스가 이번 라운드가 코드 델타 없이 동일 56개 파일을 다시 리뷰하게 만든 정황과도 맞아떨어진다 | `plan/in-progress/eia-terminal-error-sanitize.md:170` (인접 `:168-169`,`:171` 은 `[x]`) | `:170` 을 `[x]` 로 갱신하고 `review/code/2026/08/16/10_41_55/RESOLUTION.md` 를 근거로 링크. `10_19_30`·`10_41_55` 라운드 반영 요약도 plan 본문(`:110` 절 제목)에 짧게 미러링 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 자격증명이 없는 연결 문자열(`postgres://host:5432/db`)·내부 호스트명·사설 IP·스택 프래그먼트는 `SECRET_LEAK_PATTERNS` 에 매칭되지 않아 여전히 마스킹되지 않는다(기존 갭, 이번 diff 가 악화시키지 않음) | `codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115` (`redactTerminalError`) | 별도 후속 PR 에서 `CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN` 류를 shared SoT 로 승격 시 blast radius 검토. 차단 사유 아님 |
| 2 | Security | `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이/크기 상한이 없다(마스킹은 걸리나 payload 크기 증폭 가능) | `codebase/backend/src/shared/utils/terminal-error-payload.ts:122-161` | 후속 항목으로 길이 상한 검토 권장. 조치 불요 |
| 3 | Security | `execution.cancelled` 경로(5곳, `emitCancellationEvent`)는 `toTerminalErrorPayload`/`redactTerminalError` 를 거치지 않는 별도 조립 경로다. 현재는 전부 정적 상수 문자열이라 안전하나 타입/테스트로 강제되지 않는 구조적 비보장 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`emitCancellationEvent` 5개 호출부, 예: 1146-1147행, 2872-2873행) | "raw 예외 메시지를 여기 넣지 말 것 — 넣으려면 `deepRedactSecrets` 를 거칠 것" 캐너리 주석 권고. 코드 변경 불요 |
| 4 | Security | 테스트 픽스처의 secret 형 리터럴은 합성 값이며 실제 자격증명이 아님(정상 관행, 명시적으로 확인·기록) | `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:140,147,154,166-167` | 조치 불요 |
| 5 | Side Effect | 종결 이벤트 `error.message`/`error.details` 의 wire 바이트가 바뀐다 — 의도된 변경이며 CHANGELOG 에 "수신자 영향"으로 이미 문서화됨 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:107,130,139,148,160` | 조치 불요 |
| 6 | Side Effect | `deepRedactSecrets` 의 module-level `WeakMap` 캐시(`DEEP_REDACT_CACHE`)에 `details` 가 새 소비자로 추가되나, 신규 전역 상태 도입은 아니고 기존 안전 설계(identity 캐시)를 재사용할 뿐 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:107` (기존), 신규 호출: `codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115` | 조치 불요. 향후 `Execution.error` 객체가 in-place mutation 후 재전달되면 stale 캐시 위험 유의 |
| 7 | Maintainability | `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 타입 단언 — 3라운드 연속 검토·기결정 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:110` | 조치 불요(기결정 유지) |
| 8 | Maintainability | 동일 함수 내 "optional 키 생략" 관용구가 명령형 `if` 와 조건부 spread 로 혼재 — 이미 명시적으로 무조치 확정 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:159` vs `:111-113` | 조치 불요(기결정 유지) |
| 9 | Testing | 5개 실제 호출부에서 emit 되는 이벤트/webhook payload 가 실제로 마스킹되는지 검증하는 통합 회귀 테스트가 없다(순수 함수 단위 테스트만 존재) | `execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`, `chat-channel.dispatcher.ts:551` | 저비용으로 한 곳에 `Bearer sk-…` 포함 에러 실패 시나리오 + emit 된 WS payload 마스킹 확인 단언 추가 권장(우선순위 낮음) |
| 10 | Testing | `chat-channel.dispatcher.ts:551` 의 이중 `toTerminalErrorPayload` 재적용이 fixed-point(idempotent)임을 고정하는 캐너리 테스트가 없다 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115`, `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551` | `toTerminalErrorPayload(toTerminalErrorPayload(secretPayload))` 결과 고정 테스트 1개 추가 권장(우선순위 낮음, 강제 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 자격증명 없는 연결 문자열 등 잔여 마스킹 갭(INFO), 길이 상한 부재(INFO), cancelled 경로 구조적 비보장(INFO) — Critical/Warning 0 |
| requirement | LOW | `sanitize-error-message.ts` docstring 범위 서술 오차(WARNING), §6.4/R17 SPEC-DRIFT(WARNING, 이미 tracked) — 나머지 전 항목 실측 일치 |
| scope | NONE | 발견 없음. 핵심 코드 변경 4개 파일로 3라운드 내내 일관, 신규 scope 위반 없음 |
| side_effect | LOW | wire 바이트 변경(INFO, 의도됨), WeakMap 캐시 신규 소비자(INFO) — mutation/DB write/네트워크 부작용 없음 |
| maintainability | LOW | 타입 단언·optional-key 관용구 혼재(INFO 2건, 전부 기결정) — 중복 단언 비대칭·JSDoc 궤도 이탈 등 이전 WARNING 해소 확인 |
| testing | NONE | 26/26 PASS 재확인. 통합 테스트/idempotence 캐너리 부재(INFO 2건) — Critical/Warning 0 |
| documentation | LOW | plan 체크리스트 stale(WARNING, 3번째 재발) — §3.1 인용·JSDoc 귀속 등 이전 지적 해소는 재확인 |

## 발견 없는 에이전트

- scope

## 권장 조치사항

1. `plan/in-progress/eia-terminal-error-sanitize.md:170` 의 "fresh `/ai-review` (fix 이후)" 체크박스를 `[x]` 로 갱신하고 `10_41_55` RESOLUTION 을 근거로 링크 — 이 라운드 자체가 stale 체크박스로 인한 불필요한 재검토였을 가능성을 차단.
2. `sanitize-error-message.ts`(execution-engine) docstring 을 "호출부 3곳: 알림 조립 2곳 + 알림/내부 WS 조립 1곳"으로 정정(`background-execution.processor.ts` 의 WS emit 겸용 명시).
3. `project-planner` 후속 턴에서 spec §6.4 안내문 + R17 카탈로그에 신규 egress 마스킹 캐비엇/5번째 항목 추가([SPEC-DRIFT] 항목, 이미 plan 에 등재됨 — 신규 액션 아님).
4. (낮은 우선순위, 선택) 5개 호출부 중 한 곳에 마스킹이 실제 emit payload 까지 반영되는지 확인하는 통합 테스트 1개, `chat-channel.dispatcher` 이중 재적용 idempotence 캐너리 테스트 1개 추가 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 실행된 전원과 동일 — 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(egress 마스킹 유틸)와 낮은 관련도(개별 상세 사유는 prompt 에 미제공) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |