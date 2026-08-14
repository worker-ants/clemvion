# Security Review — `execution.failed` error 객체화 (EIA §6.4, 최종 diff)

## 리뷰 범위 메모

실제 실행 코드 변경은 파일 1~12(9개 소스/테스트: `terminal-error-payload.ts` 신규 헬퍼+테스트,
`execution-engine.service.ts`/`retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 4곳 통일,
`chat-channel.dispatcher.ts`/`types.ts` 정리, `use-execution-events.ts` 프런트 동반 수정)뿐이고,
나머지(13~78)는 이전 3개 ai-review 라운드(`22_55_51`/`23_17_57`/`23_34_12`)의 리뷰·consistency
세션 산출물과 plan/spec 문서 갱신이다. 이 라운드는 그 세 라운드가 이미 각각 security 리뷰를
수행(모두 위험도 LOW)한 뒤의 최종 누적 diff이므로, 이미 보고된 내용을 그대로 베끼지 않고
핵심 주장(외부 webhook 마스킹 갭·prototype pollution 없음)을 직접 `Read`/`Grep` 으로 재검증했다.

## 발견사항

- **[INFO]** (재검증·pre-existing) 종결 이벤트 `error.message`(및 신설된 `details`)가 값-패턴
  시크릿 마스킹(`deepRedactSecrets`)을 거치지 않고 외부 webhook 구독자에게 그대로 전달된다 —
  이번 PR 로 새로 생긴 노출은 아니며, 노출 폭도 넓어지지 않았다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:80`
    (`if (src.details !== undefined) out.details = src.details;` — 값 검증·마스킹 없이 그대로
    통과), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`
    (`error: toTerminalErrorPayload(row.error)`) 및 `:4872`
    (`error: toTerminalErrorPayload(savedExecution.error)`), `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`
    (`payload: event.payload,` — 직접 Read 로 확인: 이 지점은 이번 diff 밖이며 `event.payload`
    를 어떤 가공도 없이 webhook enqueue body 에 그대로 싣는다)
  - 상세: `error.message` 의 출처는 `error instanceof Error ? error.message : String(error)`
    (`execution-engine.service.ts:629`, `:4826` 부근 — 직접 Read 로 확인)로, 임의 내부 예외
    메시지 원문이다. 저장소에는 정확히 이런 종류의 값(예: Cafe24 토큰 엔드포인트가 에러 응답에
    시크릿을 echo 하는 사례)을 마스킹하기 위한 `deepRedactSecrets`/`SECRET_LEAK_PATTERNS`
    (`codebase/backend/src/shared/utils/sanitize-error-message.ts`)가 이미 존재하지만, 이
    `Execution.error.message` 저장·emit 경로는 그걸 거치지 않는다. WS fanout 쪽에 적용되는
    `sanitizePayloadForWs` 는 **키 이름 패턴**만 걸러내고(`sanitize-error-message.ts` 주석이
    스스로 "키 패턴만" 이라 명시) **값 내용**은 검사하지 않으므로, 메시지 문자열 안에 우연히
    끼어든 토큰/자격증명이 있어도 걸러지지 않는다. 다만 **직접 대조 결과 이번 diff 는 이 갭을
    넓히지 않는다** — 종전에도 같은 `errMessage` 문자열이 bare string(`error: errMessage`)으로
    같은 WS/webhook fanout 을 그대로 탔다(각 파일 diff 의 `-error: errMessage` / `-error:
    'boom'` 삭제 줄 참조). 이번 변경은 그 문자열을 `{code, message, nodeId, details?}` 객체로
    감싼 것뿐이며, `details` 필드는 현재 4개 emit 지점(`failFirstSegmentSetup`→`{message}`,
    `finalizeStalledExhausted`→`{code,message}`, `finalizeFailedExecution`→`{message,
    code?}`, `retry-turn.service.ts` `failRetryExecution`→`{message}`) 어디도 채우지 않아
    현재는 도달 불가능한 경로다. `error.stack`(파일 경로·모듈명 노출)은 이미 의도적으로
    DB/wire 양쪽에서 제외돼 있다(`finalizeFailedExecution` 상단 "WARN #7 (Security)" 주석,
    이번 diff 로 손대지 않음). `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 이미 후속 항목(W2, "종결 error.message 가 값-패턴 마스킹을 안 거친다")으로 등재돼 있고
    RESOLUTION(`23_17_57`)이 "노출이 이 PR 로 넓어지지 않는다" 는 근거로 이번 PR 미적용을
    명시적으로 기록했다 — 직접 재검증한 결과 그 근거는 정확하다.
  - 제안: 이번 PR 을 막을 사유는 아니다(측정 결과 노출 범위 불변, 이미 백로그 등재·근거 기록).
    후속 PR 에서 `deepRedactSecrets` 를 `Execution.error.message` 저장 시점 또는
    `toTerminalErrorPayload` 안에 적용하는 것을 고려할 것 — 특히 `details` 필드가 향후
    실제로 채워지기 시작하면(예: 검증 실패 상세, 내부 원인 객체) 마스킹 없이 그대로
    나가므로 그 시점 전에 반드시 적용돼야 한다.

- **[INFO]** (positive finding, 직접 재검증) `toTerminalErrorPayload` 는 `unknown` 입력을
  스프레드하지 않고 필드별 화이트리스트 방식으로 새 객체를 구성한다 — prototype pollution
  벡터 없음.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:72-80`
  - 상세: `err as Record<string, unknown>` 캐스팅 이후에도 `code`/`message`/`nodeId` 각각에
    `typeof === 'string'` 타입가드를 걸어 값을 새 리터럴 객체에 명시적으로 복사하고, 원본
    객체를 스프레드하지 않는다. `__proto__`/`constructor`/`prototype` 등 임의 키가 결과
    객체로 흘러들 여지가 없다. 자체 회귀 테스트(`terminal-error-payload.spec.ts` "입력을
    변형하지 않는다")도 입력 비-변형을 고정한다.

- **[INFO]** (positive finding, 직접 재검증) `chat-channel.dispatcher.ts` 의 무검증 캐스팅
  (`errorRaw as typeof error`) 제거가 실제로는 이번 diff 중 가장 보안-인접한 개선이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558`
    (`const error: EiaFailedEvent['error'] = toTerminalErrorPayload(errorRaw) ?? {...}`)
  - 상세: 종전 코드는 `errorRaw && typeof errorRaw === 'object'` 분기에서
    `errorRaw as typeof error` 로 필드별 타입가드를 통째로 우회했다 — DB/큐에 남아 있던
    레거시 페이로드가 `message`/`code` 에 예상 밖 타입(숫자·중첩 객체 등)을 담고 있어도
    그대로 wire 로 흘렀다. 신규 코드는 producer 와 동일한 `toTerminalErrorPayload` 를 호출해
    같은 필드별 타입가드(`typeof === 'string'` 등)를 컨슈머 경로에도 적용한다 — 검증 로직의
    SoT 가 하나로 수렴했다.

- **[INFO]** (positive finding, 직접 재검증) DB 쓰기는 파라미터화 쿼리를 그대로 유지한다 —
  SQL 인젝션 관련 회귀 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `finalizeStalledExhausted` (게이트 3272~3280, `.where('id = :id', { id: executionId })`)
  - 상세: 이번 diff 는 두 `UPDATE` 호출의 **에러 값**(`stalledError` 변수 공유)만 리팩터링했고,
    쿼리 빌더의 파라미터 바인딩 구조는 손대지 않았다.

- **[INFO]** (positive finding) 프런트엔드 `execution.failed` 핸들러가 캐스팅-only 에서
  경계 정규화로 바뀌어, 백엔드 wire 형태 변경에 타입체커가 침묵하던 구조가 해소됐다
  (직전 라운드 CRITICAL 의 해소를 재확인).
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-276`
  - 상세: `data as { error?: string }` 무검증 캐스팅이 `typeof payload.error === "string" ?
    payload.error : payload.error?.message` 로 경계에서 narrowing 되도록 바뀌어, 스토어에는
    항상 `string`(또는 `undefined`)만 들어간다. 렌더 경로에 `dangerouslySetInnerHTML` 사용은
    없음을 확인(grep 0건) — 원래 문제는 가용성(React가 object child에 대해 throw)이었지 XSS는
    아니었고, 그 취약점 클래스가 실제로 닫혔다. 회귀 캐너리(`use-execution-events.test.ts`,
    object 통과 시 실패)도 함께 추가됐다.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음, 안전하지 않은 해시/암호화 알고리즘 도입 없음,
  신규 인증/인가 로직 없음(이번 diff 는 기존 emit/wire 계층 리팩터로 endpoint·인증 경로 변경
  없음), 신규 의존성 추가 없음 — 전체 diff(9개 코드 파일 + spec/plan 문서) 확인.

## 요약

이번 diff 는 `execution.failed` 종결 이벤트의 `error` 를 문자열에서 EIA §6.4 object 형태로
통일하는 wire 계층 리팩터로, 새로운 인젝션(SQL/XSS/커맨드)·인증/인가 우회·하드코딩 시크릿·
안전하지 않은 암호화 이슈는 발견되지 않았다. 신설 헬퍼 `toTerminalErrorPayload` 는 `unknown`
DB 값에 필드별 타입가드를 걸고 스프레드 없이 새 객체를 구성해 prototype pollution 벡터를
만들지 않으며, `chat-channel.dispatcher.ts` 의 컨슈머 쪽 무검증 캐스팅(`as typeof error`)을
제거하고 같은 헬퍼로 통일한 것은 오히려 보안 관점에서 개선이다. 직접 코드를 열어 재검증한
결과, `error.message`(및 향후 채워질 수 있는 `details`)가 값-패턴 시크릿 마스킹 없이 외부
webhook(`notification-fanout.service.ts:134`)까지 그대로 전달되는 정보노출 경로가 실재하지만,
이는 **이번 PR 이전부터 있던 동일 노출**(바뀐 것은 string→object 포장뿐)이며, 이미
`spec-sync-external-interaction-api-gaps.md` 에 근거와 함께 후속 백로그로 등재돼 있어 이번
PR 을 차단할 사유는 아니다. 프런트엔드의 캐스팅-only 취약점(직전 라운드 CRITICAL, 가용성
문제 — React가 object child에 throw)은 경계 정규화 + 회귀 테스트로 해소가 확인됐다.

## 위험도

LOW
