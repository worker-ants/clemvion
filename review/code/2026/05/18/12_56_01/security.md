# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `PresentationCardBody` 내 사용자 제공 데이터의 렌더링 방식
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `PresentationCardBody` 함수 (diff +225~+273)
  - 상세: `form_submitted` 경로에서 `Object.entries(data)` 를 순회하며 키(`k`)와 값(`v`)을 React 엘리먼트에 직접 삽입한다. `data` 는 백엔드 WebSocket payload(`conversationThread.turns[].data`)에서 온 신뢰 경계 외부 데이터다. React 는 기본적으로 JSX 내 텍스트 삽입을 이스케이프하므로 XSS 위험은 낮다. 그러나 `url` 필드(`button_continue` 경로)는 별도 검증 없이 텍스트로만 출력된다. 현재는 `<a>` 태그가 아닌 `<div>` 에 텍스트로만 렌더되어 실제 네비게이션은 발생하지 않으므로 직접적 오픈 리다이렉트 위험은 없다. 그러나 향후 URL을 클릭 가능 링크로 변경할 경우 `javascript:` 스킴 등을 포함한 악성 URL이 삽입될 수 있다.
  - 제안: URL 필드 사용 시점에 스킴 허용 목록(`https:`, `http:`) 검증 함수를 추가한다. 예: `if (!/^https?:\/\//i.test(url)) return null;` 또는 공통 `safeUrl()` 유틸리티를 마련하고, 링크로 렌더링할 때는 반드시 통과시킨다.

- **[INFO]** `SystemDetail` 내 `item.content` 렌더링
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `SystemDetail` 함수 (diff +309~+331)
  - 상세: `item.content` 는 `stripInlineMarkers` 후 `system` turn의 `text` 필드에서 온다. React JSX 내 텍스트 보간은 자동 이스케이프되므로 XSS 위험은 없다. `{item.content}` 방식으로 안전하게 렌더된다.
  - 제안: 현행 방식 유지. 추후 Markdown 렌더러(`MarkdownRenderer`)로 교체 시 XSS 위험을 재검토해야 한다.

- **[INFO]** `stripInlineMarkers` 정규식의 ReDoS 위험 부재 확인
  - 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `USER_INPUT_MARKER_RE` (diff +694)
  - 상세: `/\[\/?user-input\]/g` 정규식은 선형 복잡도(`O(n)`)를 가지며 백트래킹이 발생하지 않는다. ReDoS(정규식 기반 서비스 거부) 위험 없음.
  - 제안: 해당 없음. 현행 구현 안전.

- **[INFO]** WebSocket 신뢰 경계 — `turns` 배열 타입 검증
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — diff +1000~+1005; `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `threadTurnsToConversationItems` 함수
  - 상세: `threadTurnsToConversationItems` 함수는 `!Array.isArray(turns)` 검사로 배열 여부를 확인하나, 배열 요소(`ConversationTurn`) 의 개별 필드 타입은 런타임에서 검증되지 않는다. `turn.source` 가 열거형 범위를 벗어날 경우 `switch` 문이 해당 케이스를 무시하므로 결과물에서 누락되는 수준에 그치며 보안 취약점은 아니다. 그러나 `turn.data` 를 `Record<string, unknown>` 으로 캐스팅하는 부분(`const data = turn.data as ...`)은 런타임 타입 보증 없이 형 변환하므로 예기치 않은 값이 UI에 렌더될 수 있다.
  - 제안: 신뢰 경계가 명확한 내부 백엔드 WebSocket이라면 현행 수준으로 충분하다. 외부 연동 또는 보안 강화가 필요한 경우 `zod` 등의 런타임 스키마 검증 라이브러리 도입을 고려한다.

- **[INFO]** `_retry_state.json` 내 절대 경로 노출
  - 위치: `review/consistency/2026/05/18/12_04_05/_retry_state.json` (diff +1274~+1277)
  - 상세: JSON 파일에 `/Volumes/project/private/clemvion/` 형태의 로컬 절대 경로가 포함되어 있다. 이 파일이 git 리포지터리에 커밋되어 외부에 공개될 경우 개발자 환경의 디렉터리 구조가 노출된다. 현재 프로젝트가 비공개라면 실질적 위험은 낮으나, 나중에 오픈소스화하거나 리포지터리가 유출될 경우 정보 노출이 될 수 있다.
  - 제안: `review/**/_retry_state.json` 을 `.gitignore`에 추가하거나, 경로를 프로젝트 상대 경로로 저장하는 방식을 검토한다. 최소한 이 파일 패턴을 `.gitignore` 대상으로 검토할 것을 권장한다.

- **[INFO]** `presentation` 데이터의 `buttonId`/`buttonLabel` 필드 처리 — 입력 길이 미제한
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `PresentationCardBody` (diff +235~+243)
  - 상세: `buttonLabel` 또는 `buttonId` 가 매우 긴 문자열일 경우 UI 레이아웃이 깨질 수 있다. 보안 위험보다는 UX 문제에 해당하나, 악의적으로 조작된 payload가 길이 제한 없이 UI를 점거할 수 있다.
  - 제안: 백엔드에서 필드 길이를 제한하거나, 프론트엔드 렌더 시 CSS `truncate`/`line-clamp` 등을 적용해 과도하게 긴 값이 레이아웃을 파괴하지 않도록 방어한다.

## 요약

이번 변경은 ConversationInspector에 `presentation` 및 `system` 두 가지 새로운 메시지 유형을 추가하고, WebSocket payload의 `conversationThread.turns` snapshot을 conversation Preview의 1차 데이터 소스로 채택하는 프론트엔드 렌더링 리팩토링이다. 전반적으로 React의 JSX 이스케이핑 덕분에 XSS 위험은 낮게 유지되고 있으며, 하드코딩된 시크릿, 인증/인가 로직, 암호화 관련 코드는 이번 diff 범위에 존재하지 않는다. 주요 잠재 리스크는 URL 필드를 향후 클릭 가능한 링크로 변환할 시 발생할 수 있는 오픈 리다이렉트/javascript: 스킴 문제, 그리고 `_retry_state.json`에 포함된 로컬 절대 경로의 리포지터리 노출이다. 나머지 사항은 모두 INFO 등급으로 즉각적인 보안 위협은 없다.

## 위험도

LOW
