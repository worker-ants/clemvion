# 보안(Security) 코드 리뷰

## 리뷰 범위

`execution.failed` 종결 이벤트의 `error` 를 EIA §6.4 wire 형태(`{code, message, nodeId, details?}`)로
정규화하는 신규 헬퍼 `toTerminalErrorPayload` 도입 + 4개 emit 지점(`execution-engine.service.ts`
3곳, `retry-turn.service.ts` 1곳) consolidation + `chat-channel.dispatcher.ts` 의 위조 에러코드
`'INTERNAL_ERROR'` → `null` 정리 + 프런트엔드 `use-execution-events.ts` 소비 측 타입 캐스팅 하드닝.
`plan/`·`spec/`·`review/` 산출물(파일 13~39)은 이전 두 리뷰 라운드(`22_55_51` ai-review,
`22_29_16` consistency-check)의 결과물이 이번 diff 에 커밋된 것으로, 실행 코드가 아니라 별도
보안 판단 대상이 아니다(내용 확인 결과 신규 시크릿·자격증명 없음).

## 발견사항

- **[WARNING]** `toTerminalErrorPayload` 가 만드는 `message`/`details` 에 값-패턴 시크릿 마스킹
  (`redactSecrets`/`deepRedactSecrets`)이 적용되지 않은 채 내부 에디터 WS 채널 →
  `SseAdapter` 를 거쳐 **외부 SSE 스트림**까지 그대로 나간다. REST `getStatus` 는 별도로
  `stripAndRedact`(=`deepRedactSecrets` + `stripExternalOnlyFields`)를 거치므로 이 경로만 비대칭이다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:74-76`
    (`message: typeof src.message === 'string' ? src.message : ''` — 값 그대로 통과),
    소비처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`,
    `:3314`(`finalizeStalledExhausted`), `:4872`(`finalizeFailedExecution`),
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`
  - 상세: `error.message` 의 실제 출처는 각 서비스의
    `errMessage = error instanceof Error ? error.message : String(error)` — **임의의 내부 예외
    메시지 원문**이다(Bearer 토큰·DB 커넥션 문자열·내부 경로가 echo 될 수 있는 클래스, 이
    저장소가 `sanitize-error-message.ts` 로 이미 문서화한 위험). WS 경로는 키-이름 기반
    `sanitizePayloadForWs`(`codebase/backend/src/modules/websocket/websocket.service.ts:250`)
    만 거치고 `deepRedactSecrets` 호출은 0건임을 직접 확인했다 — 문자열 값이면 그대로
    통과시키므로 자유 텍스트 안에 박힌 토큰은 걸러지지 않는다.
    다만 **이 노출 자체는 이번 diff 가 새로 만든 것이 아니다** — `git show f9d31041d
    execution-engine.service.ts` 로 직접 확인하니 diff 이전에도 `error: errMessage` 로 같은
    원문 문자열이 같은 fanout 경로(WS/SSE)를 그대로 탔다. 이번 diff 는 그 필드를 "EIA §6.4
    wire 형태"로 **공식화·단일 choke point 화**했을 뿐이라 노출 범위는 넓어지지 않았다.
  - **처분 확인**: 이 갭은 이미 같은 브랜치에서 실측 후 등재됐다 —
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:129-142`
    ("종결 `error.message` 가 값-패턴 마스킹을 안 거친다", `22_55_51` security W2) 와
    `review/code/2026/08/14/22_55_51/RESOLUTION.md` W2 절이 "노출이 이 PR 로 넓어지지
    않는다"는 실측 근거와 함께 이번 PR 미적용을 명시적으로 기록했다. 유예 근거가 검증
    가능한 주장(pre-diff 상태 대조)으로 뒷받침되므로 이번 라운드에서 새로 차단할 사유는
    아니지만, 살아있는 갭이므로 다시 등재한다 — 백로그 항목이 유실되지 않았는지 확인 목적.
  - 제안: 백로그 항목대로 `toTerminalErrorPayload` 내부(또는 fanout 경계)에서
    `message`/`details` 에 `deepRedactSecrets` 를 적용해 REST `getStatus` 와 대칭을 맞출 것.

- **[INFO]** 위조 에러 코드(`'INTERNAL_ERROR'`) 제거는 보안·조사 정확성 관점에서 개선이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-554`
  - 상세: 존재하지 않는 코드를 지어내던 이전 동작은 조사자가 실재하지 않는 코드의 출처를
    찾아 헤매게 하는 부작용이 있었다. `code: null` → classifier 의 `?? ''` 로 안전하게
    unknown-fallback(`CCH-ERR-04`)에 떨어짐을 확인했다(`execution-failure-classifier.ts`
    직접 대조). fail-closed 유지, 회귀 아님.

- **[INFO]** `toTerminalErrorPayload` 는 타입가드를 거쳐 신규 리터럴 객체에 named 필드로만
  대입하고 임의 키 스프레드/머지가 없다 — `__proto__` 등 prototype pollution 벡터 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:72-81`

- **[INFO]** 이전 라운드(`22_55_51` side_effect CRITICAL)가 지적한 "wire 를 바꾸면서 내부
  에디터 WS 소비자(`use-execution-events.ts`)를 안 세어 `{item.error}` 가 JSX child 로
  렌더되며 React 크래시" 결함이 이번 diff 에서 실제로 닫혔다. 확인 결과 XSS 벡터는 아니었다
  (React 는 `{}` child 를 항상 텍스트로 이스케이프 렌더 — 문제는 크래시였지 스크립트 실행이
  아니었다)는 점을 재확인했고, 수정도 안전하게 적용됐다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-276`
    (`payload.error` 를 `string | { message?: string } | null` 로 좁히고 `.message` 만
    추출 — object 를 그대로 하류(`failExecution`/`flushPendingToolItemsAsError`)에 넘기지
    않는다)
  - 상세: SQL/커맨드/경로 인젝션·인증 우회·신규 하드코딩 시크릿은 diff 전체에서 발견되지
    않았다. DB 쓰기는 전부 TypeORM `.set()`/파라미터 바인딩(`'id = :id'`)이라 SQL 인젝션
    벡터 없음. warn 로그(`execution-failure-classifier.ts` 의 `JSON.stringify(...)`)는
    구조화 직렬화라 로그 인젝션 벡터 없음.

## 요약

이번 diff 는 `execution.failed` 종결 이벤트의 `error` 를 문자열 → typed object, 위조 코드
`'INTERNAL_ERROR'` → 명시적 `null` 로 정규화하는 리팩터다. 인젝션·인증/인가·하드코딩 시크릿·
암호화 관련 신규 취약점은 없고, 위조 에러 코드 제거와 prototype-pollution 안전 설계는 긍정적
관찰이다. 유일한 실질 이슈는 신규 공용 헬퍼 `toTerminalErrorPayload` 가 만드는
`message`/`details` 가 REST `getStatus` 와 달리 값-패턴 시크릿 마스킹을 거치지 않는다는
점인데, 직접 대조 확인 결과 이 노출은 diff 이전부터 존재했고(범위 확장 아님) 같은 브랜치에서
이미 실측 근거와 함께 백로그(`spec-sync-external-interaction-api-gaps.md`)에 등재돼 있다 —
새로 발견된 회귀는 아니므로 차단 사유로 올리지 않되, 트래킹이 유지되고 있는지 확인 차 다시
기록한다. 이전 라운드가 지적한 프런트엔드 렌더 크래시(React child 타입 불일치) CRITICAL 은
이번 diff 에서 안전하게 닫혔음을 직접 코드 대조로 확인했다.

## 위험도

LOW
