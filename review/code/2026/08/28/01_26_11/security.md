# 보안(Security) 코드 리뷰

## 대상
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `plan/in-progress/system-error-banner-live-ws.md`

## 변경 요약
`execution.node.failed` WS 이벤트의 구조화 에러 payload 를 파싱하는 `extractNodeErrorPayload` 가
래퍼(`NodeHandlerOutput`)를 한 겹 더 통과하도록(`rawOutput.output.error`) 수정되었고,
`handleNodeFailed` 가 `undefined` 대신 실제 `payload.output` 을 헬퍼에 전달하도록 배선이
교정되었다. 그 결과 이전에는 절대 렌더되지 않던 `system_error` 배너가 라이브 WS 경로에서
처음으로 실제 렌더된다. 테스트 fixture 도 production shape(top-level `error` 는 문자열, 구조화
객체는 `output.output.error`)에 맞춰 갱신되었다.

## 발견사항

- **[INFO]** 죽어 있던 렌더 경로가 이번 수정으로 처음 실사용됨 — 렌더 싱크 안전성 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (함수 `handleNodeFailed` / `makeSystemErrorItem`, gate 840-937 / 113-138)
  - 상세: 종전 버그(`extractNodeErrorPayload(payload.error, undefined)` 가 항상 `null`)로 인해
    `system_error` 배너가 라이브 WS 경로에서 한 번도 렌더된 적이 없었다. 이번 수정으로 백엔드가
    보내는 `code`/`message`(및 `details.retryable`/`retryAfterSec`)가 처음으로 대화 타임라인에
    실제 표시된다. 이 문자열들은 궁극적으로 `ConversationItem.content` / `systemError.message`
    로 저장되며, 렌더 사이트(`codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx:45,68,95,98`)는
    전부 `{item.content}` / `{item.systemError?.code}` 형태의 JSX 텍스트 자식으로 출력하고
    `dangerouslySetInnerHTML` 은 사용하지 않는다 — React 가 자동 이스케이프하므로 백엔드가
    보내는 LLM 프로바이더 에러 메시지에 HTML/스크립트가 섞여 있어도 XSS 로 이어지지 않음을
    확인했다.
  - 제안: 조치 불필요 — 위 확인을 회귀 방지용 참고로 남긴다. 향후 이 렌더 경로에
    `dangerouslySetInnerHTML` 이나 마크다운 렌더러가 추가될 경우 이 흐름을 재검토할 것.

- **[INFO]** `details` 필드는 화이트리스트 방식으로만 소비됨 — 임의 객체 노출 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (함수 `extractNodeErrorPayload`, gate 96-100; 소비부 `handleNodeFailed` gate 912-921)
  - 상세: `source.details` 는 타입 검사 없이 `Record<string, unknown>` 으로 캐스팅되어
    `errorPayload.details` 에 실리지만, 실제로 UI/스토어에 전달되는 값은 `typeof === "boolean"` /
    `typeof === "number"` 로 명시 검증된 `retryable`, `retryAfterSec` 두 필드뿐이다
    (`makeSystemErrorItem` 호출부). `provider`, `statusCode` 등 나머지 `details` 하위 필드는
    버려진다 — 백엔드가 향후 `details` 에 민감/과도한 데이터를 실어도 그대로 클라이언트에
    노출되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** ID 필드는 여전히 UUID 화이트리스트로 새니타이즈됨 (기존 방어, 이번 diff 로 약화되지 않음)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (함수 `sanitizeUuid`, gate 47-49; 사용부 gate 888, 929 등)
  - 상세: `nodeExecutionId`/`parentNodeExecutionId` 는 `UUID_REGEX` 통과 값만 store 및 React key
    로 흘러간다. 이번 PR 은 이 방어를 건드리지 않았고 신규 데이터 흐름(`payload.output`)도 이
    새니타이즈 경로를 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (mock 블록, gate 30-32 `getAccessToken: () => "test-token"`)
  - 상세: `"test-token"` 은 vitest mock 반환값으로, 실제 자격증명이 아니다. diff 로 추가/변경된
    다른 곳에도 API 키·비밀번호·인증서류 문자열은 없다.
  - 제안: 조치 불필요.

## 요약
이번 변경은 WS `execution.node.failed` payload 파싱 로직을 프로덕션이 실제로 보내는 shape(문자열
`error` + 한 겹 더 깊은 `output.output.error`)에 맞춰 정정하고, 이에 맞춰 테스트 fixture 를
교정한 순수 프런트엔드 파싱/배선 수정이다. 인젝션·인증/인가·시크릿 하드코딩·안전하지 않은
암호화 등 전형적 취약점 패턴은 발견되지 않았다. 유일하게 검토가 필요했던 지점은 "종전에는
죽어 있던 렌더 경로가 이번 수정으로 처음 실행된다"는 사실이었으나, 렌더 싱크가 JSX 텍스트
자식(자동 이스케이프)만 사용하고 `dangerouslySetInnerHTML` 을 쓰지 않음을 직접 확인했으므로
XSS 위험은 없다. `details` 필드도 화이트리스트 방식으로만 소비되어 과도한 데이터 노출도 없다.

## 위험도
NONE
