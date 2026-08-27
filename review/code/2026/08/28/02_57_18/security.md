# 보안(Security) 코드 리뷰

## 대상
- `CHANGELOG.md`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `plan/in-progress/system-error-banner-live-ws.md`
- `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19,02_39_10}/**` (직전 5개 리뷰 라운드 산출물 — 코드 아님)

## 컨텍스트
이 프롬프트는 같은 PR 에 대한 6번째 리뷰 라운드다. 실제 애플리케이션 코드 변경은
`use-execution-events.ts`/`use-execution-events.test.ts` 두 파일뿐이며(`git diff
origin/main...HEAD -- codebase/` 로 직접 확인, 391 insertions / 64 deletions, 다른
codebase 파일 변경 없음), 나머지는 `CHANGELOG.md` 항목, 신규 plan 문서, 그리고 직전
5개 라운드(`01_26_11`→`02_39_10`)의 리뷰 산출물(RESOLUTION/SUMMARY/meta.json 등)이다.
직전 5개 라운드 모두 security reviewer 가 CRITICAL/WARNING 없이 NONE 판정을 냈고, 이번
라운드까지 프로덕션 코드의 핵심 로직(`extractNodeErrorPayload`, `handleNodeFailed`,
`handleNodeCompleted`)에 그 판정을 바꿀 변경은 없음을 `git diff`·`Read` 로 직접 재확인했다.

## 변경 요약
`execution.node.failed`/`execution.node.completed` WS 이벤트에서 구조화 에러 payload 를
꺼내는 `extractNodeErrorPayload` 가 `NodeHandlerOutput` 래퍼를 한 겹 더 통과(`rawOutput.output.error`)
하도록 수정되었고, 객체 형태 `error` 를 직접 파싱하던 `direct` 분기(커버리지 0, 결함을
낳은 계약을 그대로 인코딩)는 제거되었다. `handleNodeFailed`/`handleNodeCompleted` 양쪽
호출부가 `payload.output` 을 헬퍼에 전달하도록 배선이 교정되어, 종전에 항상 `null` 로
죽어 있던 `system_error` 재시도 배너 렌더 경로가 처음으로 실사용된다. 테스트 fixture 는
production shape(top-level `error`=문자열, 구조화 객체는 `output.output.error`)에
맞춰 `wrapNodeHandlerOutput` 빌더로 통합 갱신되었다.

## 발견사항

- **[INFO]** 종전에 한 번도 실행된 적 없던 렌더 경로가 이번 수정으로 처음 실사용됨 — 렌더 싱크 안전성 재확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수 `handleNodeFailed`/`handleNodeCompleted`(gate 805-931) 및 `makeSystemErrorItem`(gate 112-135)
  - 상세: 백엔드가 보내는 `code`/`message`(그리고 `details.retryable`/`retryAfterSec`)가 처음으로 대화 타임라인에 표시된다. 렌더 사이트(`codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx:45,68,95,98`)를 직접 열어 확인한 결과 전부 `{item.content}` / `{item.systemError?.code}` 형태의 JSX 텍스트 자식으로 출력되며, 해당 파일 전체에 `dangerouslySetInnerHTML` 사용이 없다(`grep` 결과 0건). React 는 텍스트 자식을 자동 이스케이프하므로 백엔드가 보내는 LLM 프로바이더 에러 메시지에 HTML/스크립트 문자열이 섞여 있어도 XSS 로 이어지지 않는다.
  - 제안: 조치 불필요 — 회귀 방지 참고용. 향후 이 렌더 경로에 `dangerouslySetInnerHTML` 이나 마크다운 렌더러가 추가될 경우 재검토할 것.

- **[INFO]** `source`(구조화 에러 객체)는 필드별 화이트리스트 방식으로만 소비됨 — 임의 객체 노출 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수 `extractNodeErrorPayload`(gate 84-101), 소비부 `handleNodeFailed`/`handleNodeCompleted`(gate 815-828, 911-924)
  - 상세: `code`/`message` 는 `typeof === "string"` 검증을 통과해야만 값을 갖고, 둘 중 하나라도 없으면 `null` 을 반환해 배너 자체가 뜨지 않는다(gate 94, `!code || !message` 가드 — 뮤테이션 테스트로 커버리지 확인됨, 직전 라운드 `01_44_22` RESOLUTION W2). `details` 는 통째로 `Record<string, unknown>` 으로 캐스팅돼 `errorPayload.details` 에 실리지만, 실제로 store/UI 에 전달되는 값은 `typeof === "boolean"`/`typeof === "number"` 로 각각 명시 검증된 `retryable`, `retryAfterSec` 두 필드뿐이다. `provider`, `statusCode` 등 나머지 `details` 하위 필드는 소비되지 않고 버려진다.
  - 제안: 조치 불필요.

- **[INFO]** ID 필드는 여전히 UUID 화이트리스트로 새니타이즈됨 (이번 diff 로 약화되지 않음)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수 `sanitizeUuid`(gate 40-46), 사용부 다수
  - 상세: `nodeExecutionId`/`parentNodeExecutionId` 는 `UUID_REGEX` 통과 값만 store 및 React key 로 흘러간다. 이번 diff 는 이 함수 자체를 변경하지 않았고(diff 범위 밖), 신규 데이터 흐름(`payload.output` 배선 교정)도 이 새니타이즈 경로를 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 인증/네트워크/암호화 표면 변경 없음
  - 상세: `ensureFreshAccessToken`/`getAccessToken` 등 인증 관련 import·호출부는 이번 diff 에서 변경되지 않았다. WS 클라이언트 연결·재인증 로직도 diff 밖이다. 신규 fetch/axios/WS emit·저장소 접근(`localStorage`/`sessionStorage`/`document.cookie`) 도입 없음(`grep` 확인).
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (mock 블록 — 기존 `getAccessToken: () => "test-token"` 등, 이번 diff 대상 라인 안에 토큰/비밀번호/API 키 신규 등장 없음)
  - 상세: diff 전체를 `token|secret|password|apikey|authorization|bearer` 패턴으로 검색한 결과 신규 매치 없음. `"test-token"` 계열은 이미 이전 라운드에서 vitest mock 반환값(실제 자격증명 아님)으로 확인된 기존 코드이며 이번 diff 로 추가되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `CHANGELOG.md`/`plan/in-progress/system-error-banner-live-ws.md` 는 문서 변경으로 보안 표면 없음
  - 상세: 두 파일 모두 이번 결함(라이브 WS 경로에서 `system_error` 배너 미노출)의 원인·조사 과정·운영 영향을 서술하는 문서이며, 백엔드 emit 코드의 파일:줄 좌표를 인용하지만 시크릿·내부 인프라 자격증명·민감 설정값은 포함하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 직전 5개 리뷰 라운드 산출물(`review/code/2026/08/28/{01_26_11,...,02_39_10}/**`)은 리뷰 문서일 뿐 코드 표면이 아니며, 프로젝트 컨벤션에 따른 정상 산출물이다.
  - 제안: 조치 불필요.

## 요약
이번 라운드의 실제 코드 diff(`use-execution-events.ts`/`use-execution-events.test.ts`)는 WS `execution.node.failed`/`execution.node.completed` payload 파싱 로직을 프로덕션이 실제로 보내는 shape(문자열 `error`, `output.output.error` 구조화 값)에 맞춰 정정한 순수 프런트엔드 파싱/배선 수정이며, `git diff origin/main...HEAD -- codebase/` 로 직접 재확인한 결과 다른 codebase 파일 변경은 없다. 인젝션·인증/인가 우회·시크릿 하드코딩·안전하지 않은 암호화·민감정보 에러 노출 등 전형적 취약점 패턴은 발견되지 않았다. 종전에 죽어 있던 렌더 경로가 이번 수정으로 처음 실행된다는 점을 직접 재확인했으나, 렌더 싱크가 JSX 텍스트 자식(자동 이스케이프)만 사용하고 `dangerouslySetInnerHTML` 을 쓰지 않으므로 XSS 위험은 없다. `details` 필드도 `retryable`/`retryAfterSec` 두 필드만 화이트리스트 소비되어 과도한 데이터 노출이 없고, ID 새니타이즈(`sanitizeUuid`)도 이번 diff 로 약화되지 않았다. 이는 직전 5개 라운드의 security 판정(전부 NONE/무발견)과 일치하는 결과다.

## 위험도
NONE
