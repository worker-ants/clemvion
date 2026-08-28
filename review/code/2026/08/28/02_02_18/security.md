# 보안(Security) 코드 리뷰

## 대상
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `CHANGELOG.md`, `plan/in-progress/system-error-banner-live-ws.md`
- `review/code/2026/08/28/01_26_11/**`, `review/code/2026/08/28/01_44_22/**` (이전 라운드 리뷰 산출물 — 정보 문서, 실행 코드 아님)

## 변경 요약
`system_error` 재시도 배너가 라이브 WS 경로에서 한 번도 뜨지 않던 결함(정정 전 spec §4.1 문구를 믿고 `payload.error` 를 객체로, `payload.output.error` 를 1단만 파싱)을 프런트 파싱 로직만 고쳐 복구한다. `extractNodeErrorPayload` 가 `rawOutput.output.error`(래퍼 2단 언래핑)만 보도록 좁혀졌고, `handleNodeFailed` 가 이전에 누락했던 `payload.output` 인자를 실제로 전달한다. 이 diff 는 이미 이전 두 라운드(`01_26_11`, `01_44_22`)에서 security 관점 리뷰를 거쳤고(둘 다 위험도 NONE), 이번 라운드는 그 사이 반영된 fix(JSDoc 정정, `direct` 분기 제거, `!code || !message` 가드에 대한 양성 테스트 추가, `wrapNodeHandlerOutput` 테스트 헬퍼 추출)를 담고 있다. 소스 코드(`use-execution-events.ts` 84-100행, 807-935행)를 직접 열어 재확인했다.

## 발견사항

- **[INFO]** 죽어 있던 렌더 경로가 이번 수정으로 처음 실사용됨 — 렌더 싱크 안전성 재확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`handleNodeFailed` 807-935행 / `makeSystemErrorItem` 112-137행), 렌더 싱크 `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx`
  - 상세: 종전 버그로 `system_error` 배너가 라이브 경로에서 한 번도 렌더되지 않았으나, 이번 수정으로 백엔드가 보내는 `code`/`message`(및 `details.retryable`/`retryAfterSec`)가 처음으로 대화 타임라인에 실제 표시된다. 렌더 싱크를 직접 열어 확인한 결과 `dangerouslySetInnerHTML`/`innerHTML` 사용이 전혀 없고(`grep` 확인), `{item.systemError?.code ?? "ERROR"}`, `{item.content}` 형태의 JSX 텍스트 자식으로만 출력된다. React 의 자동 이스케이프가 적용되므로 백엔드가 보내는 LLM 프로바이더 에러 메시지(사용자 제어 불가, 그러나 잠재적으로 신뢰할 수 없는 upstream 응답 반영 문자열)에 HTML/스크립트가 섞여도 XSS 로 이어지지 않는다.
  - 제안: 조치 불필요 — 향후 이 렌더 경로에 마크다운 렌더러나 `dangerouslySetInnerHTML` 이 추가될 경우 재검토할 것.

- **[INFO]** `details` 필드는 화이트리스트 방식으로만 소비됨 — 임의 객체 노출 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` `extractNodeErrorPayload` 95-98행(`details` 캐스팅), 소비부 `handleNodeFailed` 911-918행 / `handleNodeCompleted` 815-822행
  - 상세: `source.details` 는 타입 검사 없이 `Record<string, unknown>` 으로 캐스팅되지만, 실제로 store/UI 로 전달되는 값은 `typeof === "boolean"` / `typeof === "number"` 로 명시 검증된 `retryable`, `retryAfterSec` 두 필드뿐이다. `provider`, `statusCode` 등 나머지 `details` 하위 필드는 조용히 버려진다 — 백엔드가 향후 `details` 에 과도하거나 민감한 데이터를 실어도 클라이언트에 그대로 노출되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 입력 검증이 이전보다 강화됨 (`asRecord` 타입 가드 + `direct` 분기 제거)
  - 위치: `use-execution-events.ts` 51-56행(`asRecord`), 84-100행(`extractNodeErrorPayload`)
  - 상세: 새 헬퍼 `asRecord` 는 `typeof === "object" && !Array.isArray` 로 형태를 검증한 뒤에만 프로퍼티에 접근해 런타임 예외 없이 안전하게 `null` 로 수렴한다. 신뢰할 수 없는 `rawError` 를 객체로 직접 받아들이던 `direct` 분기가 이번 정정으로 완전히 제거되어, 프로덕션 호출부 2곳(`payload.error` 문자열/undefined) 기준 도달 불가능했던 입력 수용 표면이 줄었다. `!code || !message` 가드(94행)도 이번 라운드에서 처음 양성 테스트로 커버돼(`use-execution-events.test.ts` "[가드] 구조화 에러에 code/message 가 없으면 배너를 안 띄운다"), `code`/`message` 가 `undefined` 인 빈 배너가 렌더되는 경로를 확실히 막는다.
  - 제안: 조치 불필요.

- **[INFO]** ID 필드는 여전히 UUID 화이트리스트로 새니타이즈됨 (이번 diff 로 약화되지 않음)
  - 위치: `use-execution-events.ts` `sanitizeUuid` 47-49행, 사용부 `handleNodeFailed`/`handleNodeCompleted` 내 `nodeExecutionId`/`parentNodeExecutionId` 처리
  - 상세: `UUID_REGEX` 통과 값만 store 및 React key 로 흘러가는 기존 방어가 그대로 유지되며, 신규 데이터 흐름(`payload.output` 배선 교정)도 이 새니타이즈 경로를 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:31` (`getAccessToken: () => "test-token"`)
  - 상세: `"test-token"` 은 vitest mock 반환값(기존 테스트 인프라, 이번 diff 대상 밖)으로 실제 자격증명이 아니다. 이번 diff 전체(신규 캐너리 테스트, `wrapNodeHandlerOutput` 헬퍼, plan/CHANGELOG 문서, 이전 라운드 review 산출물 포함)에 API 키·비밀번호·토큰·인증서 패턴은 발견되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 이전 두 라운드 security 리뷰(`review/code/2026/08/28/01_26_11/security.md`, `01_44_22/security.md`)가 동일 결론(위험도 NONE)에 도달했고, 이번 라운드의 diff 증분(JSDoc/주석 정정, `direct` 분기 제거, 방어 가드 테스트 추가, 테스트 헬퍼 추출)은 보안 관점에서 새로운 표면을 추가하지 않는다.
  - 위치: N/A (교차 확인)
  - 상세: `RESOLUTION.md` 두 건 모두 반영된 항목은 문서 정합성(JSDoc stale)·테스트 커버리지(뮤테이션 실증) 문제였고 보안 카테고리 지적은 없었다.
  - 제안: 조치 불필요.

## 요약
이번 변경은 WS `execution.node.failed`/`node.completed` 이벤트에서 구조화 에러를 파싱하는 위치를 프로덕션이 실제로 보내는 shape(문자열 `error` + 래퍼 한 겹 아래 `output.output.error`)에 맞춰 정정한 순수 프런트엔드 파싱/배선 버그 수정이다. 소스를 직접 열어 재확인한 결과 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출, 취약 의존성 도입 등 전형적 취약점 패턴은 없다. 새로 활성화되는 `system_error` 배너 렌더 경로도 JSX 텍스트 전용(`dangerouslySetInnerHTML` 미사용)임을 직접 확인해 XSS 위험이 없고, `details` 필드는 화이트리스트 2개 키만 소비돼 과도한 데이터 노출도 없다. `asRecord` 타입 가드 도입과 도달 불가능하던 `direct` 분기 제거로 입력 검증 표면이 오히려 줄었다. 이전 두 라운드의 security 리뷰(NONE)와 결론이 일치한다.

## 위험도
NONE
