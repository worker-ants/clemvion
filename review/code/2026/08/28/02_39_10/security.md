# 보안(Security) 코드 리뷰

## 대상 (실제 코드/문서 변경분, `git diff origin/main...HEAD` 기준)
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `plan/in-progress/system-error-banner-live-ws.md` (신규 plan 문서)
- `CHANGELOG.md`
- `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19}/**` — 동일 PR 의 이전 리뷰 라운드 산출물(SUMMARY/RESOLUTION/meta.json/각 관점 리뷰 `.md`)이 이번 diff 에 커밋된 것. 리뷰 메타데이터/보고서일 뿐 실행 코드가 아니므로 보안 관점 대상 아님(별도 발견사항 없음).

이번 라운드(`02_39_10`)는 동일 PR 의 5번째 리뷰다. 프로덕션 코드(`use-execution-events.ts`)와 테스트는
`01_26_11`→`01_44_22`→`02_02_18`→`02_21_19` 라운드를 거치며 이미 4회 보안 검토(전부 NONE)를 받았고,
`git diff origin/main...HEAD` 로 직접 재확인한 결과 `use-execution-events.ts` 는 이전 라운드(`02_21_19`)
검토 시점과 동일하다. 아래는 이전 판정을 재사용하지 않고 현재 `HEAD` 소스를 다시 읽어 독립 재검증한 결과다.

## 변경 요약
`execution.node.failed`/`node.completed` WS 이벤트에서 구조화 에러(`{code, message, details?}`)를
추출하는 `extractNodeErrorPayload`가 `rawOutput.output.error`(래퍼 2단 언래핑, `asRecord` 헬퍼 도입)를
읽도록 수정되고, `handleNodeFailed`가 `payload.output`을 실제로 전달하도록 배선이 교정되었다. 그 결과
이전에는 `null`만 반환해 죽어 있던 `system_error` 인라인 배너(대화 타임라인)가 라이브 WS 경로에서
처음으로 실제 렌더된다. 테스트는 production shape(top-level `error`=문자열, 구조화 객체는
`output.output.error`)에 fixture 를 맞추고 `wrapNodeHandlerOutput` 빌더·캐너리·가드 테스트를 추가했다.

## 발견사항

- **[INFO]** 신규 실사용 렌더 경로 — XSS 안전 (직접 재확인)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`extractNodeErrorPayload` 함수, gate 84-100 / `makeSystemErrorItem` 함수, gate 112-137) → 렌더 싱크 `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx`(gate 95 부근 `{item.systemError?.code ?? "ERROR"}`)
  - 상세: `source.code`/`source.message`는 `typeof === "string"` 가드(gate 92-94)를 통과한 값만 채택되고, `ConversationItem.content`/`systemError.code`/`systemError.message`로 저장된 뒤 렌더 싱크에서 JSX 텍스트 자식으로만 소비된다. 해당 컴포넌트에 `dangerouslySetInnerHTML`은 존재하지 않는다(grep 확인). React 기본 이스케이프가 적용되므로 백엔드/LLM 프로바이더 에러 메시지에 HTML/스크립트가 섞여도 XSS 로 이어지지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `details` 필드는 타입 화이트리스트로만 소비됨 — 임의 객체 유출 없음
  - 위치: `use-execution-events.ts` `extractNodeErrorPayload`(gate 95-98) 반환값 소비부 (`handleNodeCompleted`/`handleNodeFailed` 내부, gate 815-822 및 908-921 부근)
  - 상세: `source.details`는 `typeof === "object"`만 확인 후 캐스팅되지만, 실제로 UI/store 로 전달되는 값은 `typeof errorPayload.details?.retryable === "boolean"` / `typeof errorPayload.details?.retryAfterSec === "number"`로 개별 타입 검증된 두 필드뿐이다. `provider`, `statusCode` 등 나머지 하위 필드는 버려진다.
  - 제안: 조치 불필요.

- **[INFO]** ID 새니타이즈 방어는 이번 diff 로 약화되지 않음
  - 위치: `use-execution-events.ts` `sanitizeUuid`(gate 47-49)
  - 상세: `nodeExecutionId`/`parentNodeExecutionId`는 여전히 `UUID_REGEX` 통과 값만 store·React key·retry 버튼(`onRetry(nodeExecutionId)`)로 흘러간다. 신규 데이터 흐름(`payload.output`)도 이 경로를 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff (`use-execution-events.ts`, `use-execution-events.test.ts`, `CHANGELOG.md`, `plan/in-progress/system-error-banner-live-ws.md`, `review/**` 산출물)
  - 상세: API 키·비밀번호·토큰·인증서류 문자열 추가 없음. 테스트 fixture 는 `nodeExecutionId` UUID·에러 메시지 문자열(`"Anthropic API returned 429..."` 등)뿐이며 자격증명이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** (참고, 이번 PR 스코프 밖) 백엔드 프로바이더 원문 에러 메시지가 사용자에게 처음 노출됨
  - 위치: `use-execution-events.ts` `makeSystemErrorItem`(gate 112-137) — 소비되는 `errorPayload.message` 자체는 백엔드가 결정
  - 상세: 이 배너가 라이브 WS 경로에서 "처음" 실제 발동하면서(CHANGELOG 명시), 백엔드/LLM 프로바이더가 만든 원문 에러 문자열(프로바이더명 등 포함 가능)이 최초로 대화 타임라인에 사용자 대상으로 노출된다. spec §4.1-a/§9.7 이 이미 규정한 계약이고 이번 diff 는 payload 내용 자체를 만들거나 바꾸지 않으므로(프런트 파싱만 정정) 이번 PR 의 결함은 아니다.
  - 제안: 조치 불필요(범위 밖). 필요 시 백엔드에서 사용자 대면 `message`와 내부 로그용 원문 분리를 별건 검토.

- **[INFO]** 인증/세션/암호화/의존성 변경 없음
  - 상세: diff 는 프런트엔드 이벤트 파싱 로직과 테스트 fixture 에 한정되며, 인증 토큰 처리(`ensureFreshAccessToken`/`getAccessToken` import 는 기존 그대로), 세션 관리, 해시/암호화 알고리즘, package.json/의존성 변경이 전혀 없다.
  - 제안: 조치 불필요.

## 요약
diff 는 WS `execution.node.failed`/`node.completed` payload 의 구조화 에러 파싱 깊이를 프로덕션 실제 shape(문자열 top-level `error` + 래퍼 한 겹 아래 `output.output.error`)에 맞춰 정정한 순수 프런트엔드 파싱/배선 버그 수정이며, 이전 4개 리뷰 라운드에서도 동일 코드가 보안 NONE 판정을 받았다. 소스를 직접 재확인한 결과 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 취약 의존성 등 전형적 OWASP Top 10 패턴은 발견되지 않는다. 새로 실사용되기 시작한 렌더 경로(`system_error` 배너)는 JSX 텍스트 자식만 사용해 XSS 로 이어지지 않으며, `details` 필드도 타입 화이트리스트로만 소비된다. 유일하게 주목할 점(범위 밖)은 백엔드가 결정하는 프로바이더 원문 에러 메시지가 이 배포 이후 사용자에게 처음 노출된다는 사실인데, 이는 spec 이 이미 승인한 설계이고 이번 코드의 결함이 아니다.

## 위험도
NONE
