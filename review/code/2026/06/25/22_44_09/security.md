# 보안(Security) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** postMessage 핸들러에서 `event.source` 미검증 — 동일 오리진 내 타 발신자 주입 가능
  - 위치: `/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` 라인 3391 (handler 함수)
  - 상세: `event.origin !== window.location.origin` 검증은 올바르게 적용되어 있으나 `event.source` 를 확인하지 않는다. 동일 오리진의 다른 창(예: 악성 iframe, 다른 탭에서 열린 동일 오리진 페이지)이 `type: "oauth_callback", previewToken: "<임의값>"` 페이로드를 postMessage 로 보내면 핸들러가 수락하여 previewToken 을 상태에 저장하고 `onAuthorized()` 를 호출한다. 서버가 previewToken 을 재검증하면 실제 익스플로잇 가능성은 낮지만, 클라이언트 단 방어 자체가 부재하다.
  - 제안: `if (event.source !== popupRef.current) return;` 을 origin 검증 직후에 추가한다. `popupRef.current` 가 null 이면(팝업이 아직 열리지 않은 상태) 메시지를 거부하도록 null 체크도 포함해야 한다.

### 발견사항 2
- **[WARNING]** 폴링 에러 메시지(`lastErrorMessage`)를 백엔드 원문 그대로 UI 에 렌더링 — 정보 노출
  - 위치: `cafe24-private-pending-step.tsx` 라인 720, `makeshop-pending-step.tsx` 라인 1057
  - 상세: `lastErrorMessage` 는 폴링 훅이 반환하는 값으로, 백엔드 API 응답의 오류 메시지 원문이 포함될 수 있다. React JSX 는 자동 이스케이프하므로 XSS 위험은 없다. 그러나 백엔드가 내부 스택 트레이스, DB 오류 코드, 내부 서비스 URL, Cafe24/MakeShop API 응답 원문 등을 포함한 메시지를 반환할 경우 인프라 정보가 사용자에게 노출된다(OWASP A09 — Security Logging and Monitoring Failures 인접, 실질적으로는 A05 정보 노출).
  - 제안: `useCafe24PendingPolling` / `useMakeshopPendingPolling` 훅 내부 또는 이 컴포넌트에서 백엔드 오류 메시지를 i18n 키로 매핑하거나, 매핑이 없으면 제네릭 오류 문자열로 대체한다. `page.tsx` 의 `formatErrorToast` 패턴을 참고한다.

### 발견사항 3
- **[WARNING]** `TestStep` 에서 API `result.message` 를 통해 생성된 오류 메시지를 UI 에 직접 표시 — 정보 노출
  - 위치: `test-step.tsx` 라인 1341–1344 (`throw new Error(result.message)`), 라인 1488–1490 (`test.error.message` 렌더)
  - 상세: `previewTest` API 가 실패를 반환하면 `result.message` 로 Error 를 생성하고, 해당 오류 메시지가 `message` 변수를 통해 UI 에 직접 표시된다. 백엔드 응답의 `message` 필드에 내부 정보(연결 오류 원문, 외부 서비스 응답 등)가 포함될 경우 사용자에게 노출된다.
  - 제안: `TestStep` 의 `onTestError` 콜백 호출 전, 또는 훅이 오류를 캡처하는 지점에서 `formatErrorToast` 와 유사한 코드 매핑 계층을 적용해 제네릭 메시지로 정규화한다.

### 발견사항 4
- **[INFO]** `client_secret` 이 React state(`credentials`) 에 평문 보관
  - 위치: `auth-step.tsx` `Cafe24ExtraFields` (라인 376–377), `MakeshopExtraFields` (라인 544–545)
  - 상세: `client_secret` 값이 `credentials: Record<string, unknown>` 에 평문 문자열로 저장된다. 브라우저 환경에서 불가피하나, React DevTools 나 메모리 덤프에서 노출될 수 있다. 입력 필드에 `type="password"`, `autoComplete="new-password"` 는 올바르게 적용되어 있어 기본 UX 수준 보호는 존재한다. `credentials` 가 URL 파라미터, 로컬 스토리지, 세션 스토리지에 직렬화되지 않는다면 허용 가능한 수준이다.
  - 제안: `credentials` 객체가 외부 스토리지나 로깅에 직렬화되지 않도록 데이터 흐름을 감사한다. 현재 코드 내에서는 직렬화 경로가 보이지 않아 현재는 수용 가능하다.

### 발견사항 5
- **[INFO]** `integrationId` 를 URL 세그먼트에 직접 삽입 — 경로 탐색 위험 미미
  - 위치: `cafe24-private-pending-step.tsx` 라인 758, `makeshop-pending-step.tsx` 라인 1092 (`router.push(\`/integrations/${integrationId}\`)`)
  - 상세: `integrationId` 는 서버 응답(`oauthBeginMutation.onSuccess`)에서 받은 값이며 Next.js App Router 는 경로를 정규화하므로 실질적 위험은 없다. `router.push` 는 앱 내부 라우팅만 수행하여 Open Redirect 도 해당하지 않는다.
  - 제안: 방어적으로 `integrationId` 가 UUID 형식임을 타입 또는 런타임에서 명시할 수 있으나 필수는 아니다.

### 발견사항 6
- **[INFO]** Cafe24 mall_id `pattern` 속성은 클라이언트 전용 UI 힌트
  - 위치: `auth-step.tsx` 라인 410 (`pattern="^[a-z0-9\-]{3,50}$"`)
  - 상세: HTML `pattern` 속성은 JavaScript 로 우회 가능하다. 그러나 `validate()` 함수의 `CAFE24_MALL_ID_PATTERN.test(mallId)` 와 백엔드 가드가 이중으로 검증하고 있어 보안 제어로는 충분하다. 코드 주석에도 백엔드 가드가 backstop 임을 명시한다.
  - 제안: 현재 설계가 올바르다. 추가 조치 불필요.

## 요약

이번 변경은 기존 `page.tsx` 의 로직을 behavior-preserving 으로 분리한 리팩터링이므로 신규 취약점이 도입된 사례는 없다. 기존부터 존재하던 설계 패턴을 그대로 이전한 것이다. 보안 관점에서 가장 주의할 사항은 두 가지다. 첫째, `use-oauth-popup-return.ts` 의 postMessage 핸들러에서 `event.source` 를 검증하지 않아 동일 오리진 내 타 발신자가 임의의 previewToken 을 주입할 가능성이 있다(서버 측 토큰 재검증이 존재하면 실제 공격 성공 가능성은 낮으나 클라이언트 방어가 미흡함). 둘째, 폴링 에러 메시지와 credential 테스트 오류 메시지가 백엔드 원문을 그대로 노출할 수 있어 내부 정보 노출(Information Exposure) 가능성이 있다. 하드코딩된 시크릿, 인젝션 취약점, 암호화 문제, 인증/인가 우회는 발견되지 않았다.

## 위험도

LOW
