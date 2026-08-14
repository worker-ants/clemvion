STATUS=success security review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[INFO]** `error.message`/`error.details` 가 마스킹 없이 webhook·SSE·chat-channel 구독자에게 그대로 전달된다 (신규 노출 아님, 기존 갭)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` (함수 `toTerminalErrorPayload`, 파일 전체 신규) — 소비 지점 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`(`error: toTerminalErrorPayload(row.error)`), `:3314`(`toTerminalErrorPayload(stalledError)`), `:4872`(`toTerminalErrorPayload(savedExecution.error)`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`
  - 상세: `error.message` 는 임의 `Error.message`(third-party HTTP 응답 본문 일부, LLM 프로바이더 오류 문구 등)를 가공 없이 담아 external interaction API(webhook/SSE) 와 chat-channel 로 나간다. `EiaFailedEvent.error.details`(`codebase/backend/src/modules/chat-channel/types.ts`)도 wire 계약에 이미 존재하는 optional 필드다. 다만 실측 결과 이 PR 이 노출면을 넓히지는 않는다 — (1) 이번에 바뀐 4개 producer(`finalizeStalledExhausted`/`finalizeFailedExecution`/`failFirstSegmentSetup`/`retry-turn.service.ts`) 중 어느 곳도 `Execution.error.details` 를 채우지 않는다(리터럴 전수 `error = {...}`/`error:{...}` 확인 — `message`, 조건부 `code` 뿐), 따라서 `toTerminalErrorPayload` 의 `details` 통과 분기는 현재 dead path 다. (2) `error.message` 노출 자체는 이 PR 이전에도 `error: errMessage` 문자열로 동일 fanout 을 이미 타고 있었다 — 형태(string→object)만 바뀌었지 내용·경로는 그대로다. (3) stack trace 는 별도로 이미 방어돼 있다 — `execution-engine.service.ts` `finalizeFailedExecution` 인근 주석("WARN #7 (Security) — error.stack … DB 에 저장하지 않는다")이 확인된다. 이 항목은 직전 리뷰 라운드(`review/code/2026/08/14/22_55_51/RESOLUTION.md` W2)에서 이미 동일하게 실측·검토돼 "이번 PR 미적용, 근거 기록" 으로 의도적으로 미루고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재된 상태다. 재실측으로도 그 판단(선존 갭·비확장)이 유지된다.
  - 제안: 조치 불요(이번 changeset 범위 밖). 마스킹은 별도 PR 로 트래킹된 상태(`spec-sync-external-interaction-api-gaps.md`)를 유지.

### 요약
이번 diff 는 `execution.failed` 의 `error` 필드를 문자열에서 EIA §6.4 object 로 통일하는 리팩터링이며, 신규 헬퍼 `toTerminalErrorPayload` 는 `unknown` 입력에 대해 `typeof` 가드만으로 필드를 안전하게 채워 넣어(스프레드·`Object.assign` 없음) prototype pollution 경로가 없고, 분류기(`classifyExecutionFailure`)도 `Set.has()` 기반 조회라 `code: null` 을 키로 써도 객체 인젝션 위험이 없다. dispatcher 의 `errorRaw as typeof error` 캐스팅 우회는 이번 diff 로 제거되고 검증된 헬퍼 호출로 대체됐으며, 프런트엔드도 `{item.error}` 를 JSX 텍스트 노드로만 렌더해 객체가 들어가도 XSS 가 아니라 런타임 에러(별도 회귀로 이미 고정됨)로 그친다. 유일한 관찰 사항인 `error.message`/`details` 무마스킹 외부 노출은 이번 PR 이 만든 것이 아니라 기존부터 있던 gap 이며 실측상 확장되지 않았고 별도 백로그로 트래킹되고 있어 INFO 로만 기록한다. 하드코딩 시크릿, 인증/인가 변경, SQL/커맨드 인젝션, 안전하지 않은 암호화 사용은 발견되지 않았다.

### 위험도
LOW
