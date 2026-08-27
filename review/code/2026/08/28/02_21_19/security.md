# 보안(Security) 코드 리뷰

## 대상 (실제 변경분, `git diff origin/main...HEAD` 기준)
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `plan/in-progress/system-error-banner-live-ws.md` (문서)
- `CHANGELOG.md` (문서)
- `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18}/**` — 이전 3개 리뷰 라운드의 산출물이 이번 diff 에 신규 포함(커밋)된 것. 코드가 아니라 리뷰 메타데이터/보고서이므로 보안 관점 대상 아님.

이번 라운드(`02_21_19`)는 동일 PR 의 4번째 리뷰다. 핵심 프로덕션 코드(`use-execution-events.ts`)는 `01_26_11`→`01_44_22`→`02_02_18` 라운드를 거치며 이미 3회 보안 검토(전부 NONE)를 받았고, 이번 라운드에서 `use-execution-events.ts`/`extractNodeErrorPayload` 자체에 대한 추가 diff 는 없다(테스트 파일만 `02_02_18` 이후 소폭 갱신 — `wrapNodeHandlerOutput` 헬퍼 도입, 가드 캐너리 추가). 아래는 이전 라운드 판정을 재활용하지 않고 현재 `HEAD` 소스를 직접 읽어 독립 재검증한 결과다.

## 변경 요약
`execution.node.failed`/`node.completed` WS 이벤트에서 구조화 에러(`{code, message, details?}`)를
추출하는 `extractNodeErrorPayload`가 `rawOutput.output.error`(래퍼 2단 언래핑)를 읽도록 수정되고,
`handleNodeFailed`가 `payload.output`을 실제로 전달하도록 배선이 교정되었다. 그 결과 이전에는
`null`만 반환해 죽어 있던 `system_error` 인라인 배너(대화 타임라인 + 인스펙터)가 라이브 WS 경로에서
처음으로 실제 렌더된다.

## 발견사항

- **[INFO]** 신규 실사용 렌더 경로 — XSS 안전 확인 (직접 재확인)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`extractNodeErrorPayload` — 함수, gate 84-100 / `makeSystemErrorItem` — 함수, gate 112-137) → 렌더 싱크 `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx` (gate 95, 98) 및 `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`(`SystemErrorRow` 함수, gate 806-811)
  - 상세: `source.code`/`source.message`는 `typeof === "string"` 가드를 통과한 값만 채택된다(gate 92-94). 그 문자열은 `ConversationItem.content`/`systemError.code`/`systemError.message`로 저장되고, 렌더 싱크 3곳 모두 `{item.content}`, `{item.systemError?.code}`, `{se.message}`처럼 JSX 텍스트 자식 또는 `title={se.message}` 속성으로만 소비된다. `dangerouslySetInnerHTML`은 이 파일들에 존재하지 않음을 직접 grep 으로 확인했다(같은 디렉터리의 `presentation-renderers.tsx:434,444`에만 존재하며, 이는 `sanitizeHtml`을 거치는 별도 콘텐츠 타입이고 이번 데이터 흐름과 무관). React 의 기본 이스케이프가 그대로 적용되므로, 백엔드/LLM 프로바이더가 반환하는 에러 메시지에 HTML/스크립트가 섞여도 XSS 로 이어지지 않는다.
  - 제안: 조치 불필요. 향후 이 렌더 경로에 마크다운 렌더러나 `dangerouslySetInnerHTML`이 추가되는 경우 재검토할 것.

- **[INFO]** `details` 필드는 타입 화이트리스트로만 소비됨 — 임의 객체 유출 없음
  - 위치: `use-execution-events.ts` `extractNodeErrorPayload`(gate 95-98)의 반환값을 소비하는 두 호출부(gate ~815-822, ~908-921 부근, `handleNodeCompleted`/`handleNodeFailed` 내부)
  - 상세: `source.details`는 `typeof === "object"`만 확인하고 캐스팅되지만, 실제로 UI/store 로 전달되는 값은 `typeof errorPayload.details?.retryable === "boolean"` / `typeof errorPayload.details?.retryAfterSec === "number"`로 개별 타입 검증된 두 필드뿐이다. `provider`, `statusCode` 등 나머지 `details` 하위 필드는 버려진다 — 백엔드가 향후 `details`에 과도하거나 민감한 데이터를 실어도 클라이언트에 그대로 노출되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** ID 새니타이즈 방어는 이번 diff 로 약화되지 않음
  - 위치: `use-execution-events.ts` `sanitizeUuid`(gate 47-49), 사용부(gate ~890, ~929 부근)
  - 상세: `nodeExecutionId`/`parentNodeExecutionId`는 여전히 `UUID_REGEX` 통과 값만 store·React key·retry 버튼(`onRetry(nodeExecutionId)`)로 흘러간다. 신규 데이터 흐름(`payload.output`)도 이 새니타이즈 경로를 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (mock, `getAccessToken: () => "test-token"` 등 기존 mock 블록 — 이번 diff 는 이 부분을 변경하지 않았고, 신규 diff hunk 는 `wrapNodeHandlerOutput` fixture 빌더와 `error`/`output` 페이로드 형태 조정뿐)
  - 상세: diff 전체(변경분 3개 코드/문서 파일)를 직접 확인한 결과 API 키·비밀번호·토큰·인증서류 문자열 추가 없음. `"test-token"`은 vitest mock 반환값으로 실제 자격증명이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** (참고, 이번 PR 스코프 밖) 백엔드 프로바이더 원문 에러 메시지가 사용자에게 그대로 노출됨
  - 위치: `use-execution-events.ts` `makeSystemErrorItem`(gate 112-137) — 소비되는 `errorPayload.message` 자체는 백엔드가 결정하는 값(예: 테스트 fixture 상 `"Anthropic API returned 429 (Too Many Requests)"`)
  - 상세: 이 배너가 "처음으로" 실제 발동하면서(CHANGELOG 명시), 백엔드/LLM 프로바이더가 만든 원문 에러 문자열(프로바이더명 등 내부 구현 세부사항 포함 가능)이 최초로 대화 타임라인에 사용자 대상으로 노출된다. 이는 spec §4.1-a/§9.7 이 이미 규정한 계약이고 이번 diff 가 그 payload 내용 자체를 만들거나 바꾸지 않으므로(프런트 파싱만 정정) 이번 PR 의 결함은 아니다. 다만 "정보 노출 최소화" 관점에서 백엔드가 사용자 대면 `message`에 내부 프로바이더명/원문 API 에러를 그대로 실어도 되는지는 이번 코드 리뷰 범위(백엔드 emit 로직) 밖의 별건 검토 대상으로 남긴다.
  - 제안: 조치 불필요(이번 diff 범위 밖). 필요 시 백엔드 쪽에서 사용자 대면 `message`와 내부 로그용 원문을 분리하는 것을 별도 검토.

## 요약
이번 diff 는 WS `execution.node.failed`/`node.completed` payload 의 구조화 에러 파싱 깊이를 프로덕션 실제 shape(문자열 top-level `error` + 래퍼 한 겹 아래 `output.output.error`)에 맞춰 정정하고, 테스트 fixture 를 그에 맞춰 보강한 순수 프런트엔드 파싱/배선 수정이다. 소스를 직접 읽어 독립 검증한 결과, 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 취약 의존성 등 전형적 OWASP Top 10 패턴은 발견되지 않았다. 새로 실행되기 시작하는 렌더 경로(`system_error` 배너)는 JSX 텍스트 자식만 사용하고 `dangerouslySetInnerHTML`이 없어 XSS 로 이어지지 않으며, `details` 필드도 타입 화이트리스트로만 소비된다. `code`/`message`가 필수 문자열 타입 검사(`!code || !message` 가드)를 통과해야만 배너가 뜨도록 방어돼 있어 `undefined` 노출도 없다. 유일하게 주목할 점은 (이번 PR 범위 밖) 백엔드가 결정하는 프로바이더 원문 에러 메시지가 사용자에게 처음 그대로 노출된다는 사실인데, 이는 이미 spec 이 승인한 설계이고 코드 자체의 결함이 아니다.

## 위험도
NONE
