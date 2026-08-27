# 보안(Security) 리뷰

## 발견사항

없음.

검토한 두 파일(`codebase/frontend/src/lib/websocket/use-execution-events.ts`,
`codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`)의 변경은
WebSocket 이벤트에서 구조화 에러(`{code, message, details}`)를 꺼내는 위치를
`rawOutput.error`(1단 언래핑) 에서 `rawOutput.output.error`(2단 언래핑, `NodeHandlerOutput`
래퍼 통과)로 정정하고, 죽어있던 `payload.output` 배선(`undefined` → 실제 값)을 복구하는
버그 수정이다. 점검 관점별 확인 결과는 다음과 같다.

- **인젝션**: 신규/변경 코드는 문자열 결합·`eval`·DOM 삽입 등을 포함하지 않는다.
  `extractNodeErrorPayload`(`codebase/frontend/src/lib/websocket/use-execution-events.ts:84-100`)는
  순수 property 접근/타입 체크만 수행.
- **하드코딩 시크릿**: 두 파일 diff 전체에 API 키·토큰·자격증명 패턴 없음(grep 확인).
- **인증/인가**: 이 diff 는 WS 인증 로직(`ensureFreshAccessToken`/`getAccessToken`, import 는
  있으나 미변경)을 건드리지 않는다. 신규 인가 우회 지점 없음.
- **입력 검증**: 신규 헬퍼 `asRecord`(`use-execution-events.ts:52-56`)가 `typeof === "object"
  && !Array.isArray` 로 형태를 검증한 뒤에만 프로퍼티에 접근하도록 만들어, 오히려 기존보다
  **널/타입 안전성이 개선**됐다(`domain`·`source` 체인 전부 옵셔널 체이닝 + 명시적 `null`
  폴백이라 런타임 예외 없이 안전하게 `null` 로 수렴). 제거된 `direct`(객체 형태 `rawError`)
  분기는 프로덕션 호출부 2곳 모두 도달 불가능했던 죽은 코드였고, 제거로 인해 신뢰 불가능한
  입력을 받아들이는 표면이 오히려 줄었다(공격 표면 축소).
- **OWASP Top 10**: 새로 활성화된 `system_error` 배너 렌더링 경로를 확인—
  `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx:45,68,95,98`
  전부 JSX 텍스트 자식(`{item.content}`, `{item.systemError?.code}`)으로만 소비하며
  `dangerouslySetInnerHTML` 사용 없음. React 의 기본 이스케이프가 적용되므로 백엔드가 보내는
  에러 메시지 문자열(`code`/`message`)이 그대로 반사돼도 저장형/반사형 XSS 로 이어지지
  않는다. `details` 필드도 `retryable`(boolean)·`retryAfterSec`(number) 두 화이트리스트
  키만 명시적으로 꺼내 쓰므로(`use-execution-events.ts:815-822, 911-918`) 임의 키가
  UI 로 새지 않는다.
- **암호화**: 해시/암호화 알고리즘 관련 변경 없음. 평문 전송 이슈 없음(기존 WS 연결 보안
  설정은 이 diff 범위 밖).
- **에러 처리**: `errorMessage`/`errorPayload.message` 는 백엔드가 이미 사용자 노출용으로
  생성한 메시지(예: `"Anthropic API returned 429 (Too Many Requests)"`)이며, 이 diff 는
  그 값을 UI 에 전달하는 배선만 고친다 — 새로 스택트레이스나 내부 경로/환경변수 등 민감
  정보를 노출하는 지점을 추가하지 않았다. `console.warn` 호출(`use-execution-events.ts`
  기존 코드, 미변경)도 non-sensitive 식별자만 로깅.
- **의존성 보안**: 이 diff 는 `package.json`/lockfile 을 변경하지 않는다. 신규 라이브러리
  도입 없음.

테스트 파일(`use-execution-events.test.ts`)의 변경은 fixture 를 production shape(`error`:
문자열, `output`: `NodeHandlerOutput` 래퍼)에 맞추는 작업과 공유 빌더
`wrapNodeHandlerOutput`(`__tests__/use-execution-events.test.ts:1986-1990`) 추출로,
테스트 전용 코드이며 보안 관점 영향 없음.

## 요약

이번 변경은 WebSocket 에러 페이로드 파싱 위치를 정정하는 버그 수정으로, 인젝션·시크릿
노출·인증 우회·안전하지 않은 암호화·민감정보 에러 노출·취약 의존성 도입 등 보안 관점의
새로운 리스크를 발견하지 못했다. 오히려 `asRecord` 타입 가드 도입과 도달 불가능했던
`direct` 분기 제거로 입력 검증이 더 엄격해지고 공격 표면이 줄었다. 새로 활성화되는
`system_error` 배너 렌더링 경로도 JSX 텍스트 전용 렌더링으로 XSS 로부터 안전함을 직접
확인했다.

## 위험도
NONE
