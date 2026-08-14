STATUS=success security review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[INFO]** `error.message`/`error.details` 가 값-패턴 시크릿 마스킹 없이 webhook·SSE·chat-channel 구독자에게 그대로 전달된다 (신규 노출 아님, 선존 갭)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `toTerminalErrorPayload` (78~80행, `if (src.details !== undefined) out.details = src.details;`) — 소비 지점 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`(`error: toTerminalErrorPayload(row.error)`), `:3314`(`toTerminalErrorPayload(stalledError)`), `:4872`(`toTerminalErrorPayload(savedExecution.error)`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`
  - 상세: `code`/`message`/`nodeId`는 `typeof === 'string'` 타입가드를 거치지만 `details`는 존재 여부만 확인하고 값을 검증·마스킹 없이 그대로 실어 나른다. `error.message`도 임의 `Error.message`(third-party HTTP 응답 본문, LLM 프로바이더 오류 문구 등) 원문이며 값-패턴 마스킹(`deepRedactSecrets`)을 거치지 않는다(키-이름 sanitize 만 통과). 직접 코드를 대조한 결과 이 변경이 노출면을 넓히지는 않는다 — (1) 현재 emit 4개 지점(`failFirstSegmentSetup`→`{message}`, `finalizeStalledExhausted`→`{code,message}`, `finalizeFailedExecution`→`{message, code?}`, `failRetryExecution`→`{message}`) 중 어느 곳도 `details`를 채우지 않아 그 경로는 현재 도달 불가(dead path)다. (2) `error.message` 노출 자체는 이 변경 이전에도 `error: errMessage` 문자열로 동일 fanout(webhook/SSE/chat-channel)을 타고 있었다 — 형태(string→object)만 바뀌었을 뿐 값과 경로는 동일하다. (3) stack trace는 `finalizeFailedExecution` 인근 기존 주석("WARN #7 (Security) — error.stack … DB 에 저장하지 않는다", `execution-engine.service.ts:4827`)이 확인하듯 이미 별도로 방어돼 있고 이번 diff가 손대지 않았다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 후속 항목으로 이미 등재돼 있음을 확인했다.
  - 제안: 이번 changeset 범위 밖 — 조치 불요. `details`가 실제로 채워지기 시작할 때 이 마스킹 갭이 활성화되므로, 그 시점 이전에 별도 트래킹 항목(등재됨)을 집행할 것.

### 요약

이번 diff의 핵심(프로덕션 코드 변경)은 `execution.failed` 종결 이벤트의 `error`를 문자열에서 EIA §6.4 object(`{code, message, nodeId, details?}`)로 통일하는 리팩터다. 신규 헬퍼 `toTerminalErrorPayload`(`codebase/backend/src/shared/utils/terminal-error-payload.ts`)를 직접 읽어 확인한 결과 `unknown` 입력을 스프레드 없이 필드별 `typeof` 가드로만 새 객체 리터럴에 담아 prototype pollution 벡터가 없고, 분류기(`execution-failure-classifier.ts`)도 `Set.has()` 기반 화이트리스트 비교라 `code` 값을 객체 키로 쓰지 않아 인젝션 여지가 없다. `chat-channel.dispatcher.ts`의 `errorRaw as typeof error` 무검증 캐스팅(검증 우회 안티패턴)은 이번 diff로 제거되고 동일 헬퍼 호출로 대체됐다. 프런트엔드(`use-execution-events.ts`)도 `data as { error?: string }` 캐스팅-only 처리 대신 `typeof` 가드로 경계에서 정규화하며, JSX는 텍스트 노드로만 렌더돼(직접 grep으로 `dangerouslySetInnerHTML` 미사용 확인) 객체가 실수로 통과해도 XSS가 아니라 런타임 예외로만 그친다(회귀 테스트로 고정됨). SQL 관점에서는 `.where('id = :id', { id: executionId })` 같은 파라미터화 쿼리 패턴이 그대로 유지되고 신규 원시 쿼리는 없다. 하드코딩된 시크릿, 인증/인가 로직 변경, 안전하지 않은 해시/암호화, 세션 관리 문제는 발견되지 않았다. 유일한 관찰(`error.message`/`details` 무마스킹 외부 노출)은 이 PR이 만든 것이 아니라 기존부터 있던 갭이며 실측 결과 노출 범위가 확장되지 않았고 별도 백로그에 이미 추적 중이므로 INFO로만 기록한다. 참고로 이 changeset에는 다수의 `review/**`·`plan/**` 프로세스 문서(과거 리뷰 라운드 산출물)도 함께 포함돼 있으나 이들은 코드가 아니며 보안 관점의 신규 표면을 만들지 않는다.

### 위험도
LOW
