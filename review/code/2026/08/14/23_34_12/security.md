# Security Review — `execution.failed` error 객체화 (EIA §6.4)

## 발견사항

- **[INFO]** `toTerminalErrorPayload` 의 `details` 필드는 값-패턴 시크릿 마스킹(`deepRedactSecrets`)을 거치지 않고 그대로 wire 로 통과한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `toTerminalErrorPayload` (게이트 78~80줄, `if (src.details !== undefined) out.details = src.details;`)
  - 상세: 이 헬퍼는 `src`(unknown DB 값)에서 `code`/`message`/`nodeId`는 `typeof === 'string'` 타입가드를 거치지만, `details`는 존재 여부만 확인하고 값을 검증·마스킹 없이 그대로 실어 나른다. 현재 DB 라이터 4곳(`failFirstSegmentSetup` → `{message}`, `finalizeStalledExhausted` → `{code,message}`, `finalizeFailedExecution` → `{message, code?}`, `failRetryExecution`(retry-turn.service.ts) → `{message}`)을 직접 확인한 결과 어느 곳도 `details`를 채우지 않으므로 **현 시점에는 도달 불가능한 코드 경로**다. 다만 이 헬퍼가 "네 emit 지점이 전부 이 함수를 부른다"는 단일 진입점으로 의도된 만큼, 향후 어느 라이터가 `details`(예: 검증 실패 상세, 내부 원인 객체)를 채우기 시작하면 마스킹 없이 외부(webhook/SSE/chat-channel) 로 그대로 유출된다.
  - 제안: 새 결함은 아니므로 이번 PR을 막을 사유는 아니다. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(§"종결 `error.message` 가 값-패턴 마스킹을 안 거친다")에 후속 항목으로 등재돼 있음을 확인했다 — `message`뿐 아니라 `details`도 같은 항목에 포함시켜 두면 향후 라이터 추가 시 이 경로를 놓치지 않는다.

- **[INFO]** `error.message`(외부 webhook/SSE/chat-channel 로 나가는 종결 이벤트)는 키-이름 기반 sanitize(`sanitizePayloadForWs`)만 거치고 값-패턴 시크릿 마스킹(`deepRedactSecrets`, REST `getStatus` 에는 적용됨)을 거치지 않는다
  - 위치: 헬퍼 자체가 아니라 emit 경로 전반 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeFailedExecution`(게이트 4867~4874 `emitExecution` 호출) 등 4개 emit 지점
  - 상세: `message` 의 출처는 `error instanceof Error ? error.message : String(error)` — 임의 내부 예외 메시지 원문이다. **이번 diff 가 노출 범위를 넓히지 않는다** — 직접 확인 결과 종전에도 동일한 `errMessage` 문자열이 그대로 `error: errMessage` (bare string) 로 같은 WS fanout 을 탔다(diff 의 `-error: errMessage` / `-error: 'boom'` 등). 이번 변경은 그 문자열을 `{code, message, nodeId}` 객체로 감싼 것뿐이고 값 자체·마스킹 여부는 그대로다. `error.stack`(파일 경로·모듈명 노출)은 이미 의도적으로 DB/wire 양쪽에서 제외돼 있다(`execution-engine.service.ts` 의 기존 `WARN #7 (Security)` 주석, 이번 diff 로 손대지 않음).
  - 제안: 선존 갭이며 위와 같은 spec-sync 문서에 이미 W2 로 등재·이연 근거(측정 가능한 "노출이 넓어지지 않았다" 주장, 실측 확인됨)가 기록돼 있다. 별도 조치 불요, 등재 상태 유지로 충분.

- **[INFO]** (positive finding) `toTerminalErrorPayload` 는 `unknown` 입력을 스프레드하지 않고 명시적 필드만 뽑아 새 객체 리터럴을 구성한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 게이트 72~77줄
  - 상세: `src as Record<string, unknown>` 캐스팅 후에도 `code`/`message`/`nodeId` 각각에 `typeof` 타입가드를 걸고, `__proto__` 등 임의 키가 통과할 여지가 없다(스프레드 자체가 없음). Prototype pollution 벡터 없음.

- **[INFO]** (positive finding) 프런트엔드 `execution.failed` 핸들러의 캐스팅-only 취약점(직전 라운드 CRITICAL)이 이번 diff로 해소돼 있음을 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 게이트 264~276줄
  - 상세: 종전 `data as { error?: string }` 캐스팅은 백엔드가 object로 형태를 바꿔도 타입체커가 침묵하는 구조였고, 그대로 두면 `{item.error}` 가 JSX child로 렌더돼 React가 예외를 던지는 회귀였다(가용성 문제이지 인젝션은 아님). 이번 diff는 `typeof payload.error === "string" ? payload.error : payload.error?.message` 로 경계에서 정규화해 스토어에는 항상 string만 들어가게 한다. `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 에 회귀 캐너리(object 통과 시 실패)도 추가돼 있다.

## 요약

이번 diff는 `execution.failed` 의 `error`를 문자열에서 EIA §6.4 object 형태로 통일하는 리팩터로, 새로운 인젝션·인증/인가·시크릿 하드코딩·안전하지 않은 암호화 이슈는 발견되지 않았다. `toTerminalErrorPayload` 헬퍼는 `unknown` 입력에 대해 필드별 타입가드를 걸고 스프레드 없이 새 객체를 구성해 prototype pollution 벡터를 만들지 않으며, DB 라이터 4곳을 직접 대조한 결과 `details` 통과 경로는 현재 도달 불가능하다. 유일하게 주목할 가치가 있는 항목은 종결 이벤트 `error.message`(및 향후 채워질 수 있는 `details`)가 값-패턴 시크릿 마스킹을 거치지 않고 외부로 나간다는 정보노출 여지인데, 실측 결과 이 노출 범위는 이번 PR 이전과 동일하며(문자열이 객체로 형태만 바뀜) 이미 저장소 내부 후속 백로그(`spec-sync-external-interaction-api-gaps.md`)에 근거와 함께 등재·이연돼 있다. 직전 라운드에서 지적된 프런트엔드 캐스팅-only CRITICAL(객체가 JSX child로 렌더돼 크래시)은 이번 diff에서 경계 정규화 + 회귀 테스트로 해소된 상태다.

## 위험도

LOW
