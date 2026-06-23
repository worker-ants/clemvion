# 보안(Security) Review

## 발견사항

### 파일: external-interaction-card.tsx

- **[WARNING]** `window.confirm()` 를 보안 게이트로 사용 — rotate/revoke 액션 전 확인
  - 위치: `external-interaction-card.tsx` `handleRotateSecret` (line ~851), `handleRevokeToken` (line ~863)
  - 상세: `window.confirm()` 은 브라우저 기본 대화상자로 스타일·접근성 제어가 불가하며, 일부 환경(iframe 임베드, headless browser)에서 자동으로 dismissed 되거나 suppressed 될 수 있다. rotate/revoke 는 비가역적 보안 작업(키 폐기)이므로 고의적 CSRF 또는 clickjacking 시나리오에서 confirm 우회가 가능하다. 단, 이 UI 자체가 인증된 editor 권한(`useHasRole("editor")` 게이트) 내에서만 노출되므로 실질 위험은 낮다.
  - 제안: 애플리케이션 통일 Modal/Dialog(shadcn Dialog 등)로 교체. `webhook-config-card.tsx` 의 `handleSaveClick`도 동일 패턴 사용 — 일관성 차원에서 동반 교체 권장. 단, 현재 다른 카드(`RotateBotTokenModal`)가 이미 커스텀 모달을 사용하므로 이 패턴으로 통일.

- **[INFO]** `rotateResult` / `revokeResult` 를 React state 로 메모리에 보유
  - 위치: `external-interaction-card.tsx` line ~796–797
  - 상세: 새로 발급된 시크릿/토큰이 컴포넌트 state 에 plain string 으로 저장된다. `SecretRevealBox` 가 60초 자동 소거(`onDismiss` 콜백)를 처리한다고 명시되어 있으므로 설계 의도가 있다. React DevTools 에서 state 가 노출될 수 있으나 이는 개발 환경 이슈로 프로덕션 위협 없음.
  - 제안: 현재 설계 유지 가능. `SecretRevealBox` 의 60s 자동 소거 동작이 실제 구현되어 있는지 확인 권장.

- **[INFO]** notification URL 클라이언트 검증은 `isValidNotificationUrl` 한 줄로 수행
  - 위치: `external-interaction-card.tsx` `handleSave` (line ~829–835)
  - 상세: 코드 주석에 "최종 SSRF 차단은 백엔드 권위" 가 명시되어 있어 설계 의도가 명확하다. 클라이언트 단에서 `https://` 만 허용하는 사전 검증은 UX 목적이며, 실제 SSRF 방어는 백엔드 책임임을 코드가 인식하고 있음.
  - 제안: 백엔드에서 private IP range(RFC 1918), loopback, link-local 등을 실제로 차단하는지 확인 필요(이 PR 범위 밖).

### 파일: chat-channel-card.tsx

- **[INFO]** Bot Token 입력 필드에 형식 검증 부재
  - 위치: `chat-channel-card.tsx` `RotateBotTokenModal` (line ~306–338)
  - 상세: `value.trim().length === 0` 체크만으로 제출을 막는다. Bot Token 형식(예: Telegram `<number>:<alphanum>`) 검증이 클라이언트에 없다. 잘못된 형식의 토큰이 제출되어도 백엔드가 거부할 것이지만, UX 측면에서 불필요한 네트워크 왕복이 발생한다.
  - 제안: `botTokenFormatHelp` i18n 문자열이 있으므로 형식 힌트는 이미 제공됨. 클라이언트 regex 검증 추가는 UX 개선이며 보안상 필수는 아님.

- **[INFO]** `languageHints` JSON 파싱 — 키/값 길이 제한 없음
  - 위치: `chat-channel-card.tsx` `parseLanguageHints` (line ~122–141)
  - 상세: `languageHints` 는 `Record<string, string>` 으로 파싱되는데 키·값 길이나 항목 수에 제한이 없다. 악의적 사용자가 매우 큰 JSON 을 제출할 수 있다. 단, 이 컴포넌트는 editor 권한 내에서만 접근 가능하고 최종 저장은 백엔드가 검증하므로 직접적 위협은 제한적.
  - 제안: 클라이언트에서 항목 수(예: 최대 20개) 및 값 길이(예: 최대 1000자) 제한 추가 고려. 현재는 백엔드 위임으로 허용.

### 파일: webhook-config-card.tsx

- **[INFO]** cURL 예시 생성 시 `url` 변수가 template literal 에 직접 삽입됨
  - 위치: `webhook-config-card.tsx` `getCurlExample` (line ~1583–1615)
  - 상세: `url` 은 `getWebhookUrl(trigger.endpointPath)` 의 반환값이며 서버에서 온 데이터다. 이 값이 `<pre>` 태그 안에서 React 의 text content 로 렌더링되므로 XSS 위험 없음(React 가 escaping 처리). cURL 예시에 쓰인 placeholder (`<HMAC_SECRET>`, `<BEARER_TOKEN>` 등)는 실제 시크릿 값이 아닌 리터럴 placeholder 이므로 시크릿 노출 없음.
  - 제안: 현재 설계 안전.

- **[INFO]** `endpointPath` 편집 시 `maxLength={255}` 제한만 적용
  - 위치: `webhook-config-card.tsx` line ~1662–1667
  - 상세: endpoint path 의 경로 탐색 문자(`../`, `%2e%2e` 등) 클라이언트 검증이 없다. 그러나 이는 REST API 경로로서 백엔드에서 정규화·검증이 이루어져야 하며, 클라이언트 HTML input 조작이 직접 서버 경로 탐색으로 이어지지 않는다.
  - 제안: 백엔드에서 endpointPath 유효성(허용 문자 whitelist) 검증 확인 필요(이 PR 범위 밖).

### 파일: overview-card.tsx

- **[INFO]** 트리거 이름 편집: `maxLength={255}` 제한 적용됨, trim 후 빈 값 제출 차단
  - 위치: `overview-card.tsx` line ~1261–1265
  - 상세: `nameValue.trim().length === 0` 체크로 빈 이름 제출 차단. XSS 위험 없음(React text rendering). 특수문자 등 추가 검증은 백엔드 위임으로 적절.
  - 제안: 현재 설계 양호.

### 공통 관찰

- **[INFO]** 모든 변경 카드 컴포넌트에서 `useHasRole("editor")` 로 편집 UI 게이트를 일관되게 적용함. 단, 이는 UI 렌더링 게이트이며 API 호출 레벨 인가는 백엔드가 담당해야 함(이 PR 범위).
- **[INFO]** 모든 `onError` 핸들러가 서버 에러 메시지 원문(`err.message`)을 toast 에 노출하지 않고 i18n 문자열만 표시 — 이는 명시적 보안 패턴으로 올바름 (코드 주석에도 `보안(ai-review W)` 로 표기됨).
- **[INFO]** 하드코딩된 시크릿 없음. API 키·비밀번호·토큰 등이 코드에 직접 포함되지 않음.
- **[INFO]** 의존성 신규 추가 없음(순수 리팩토링 파일 재구성).

## 요약

이번 변경은 `trigger-detail-drawer.tsx` god-component 를 카드 단위로 파일 분리하는 순수 구조 리팩토링으로, 새로운 보안 취약점을 도입하지 않는다. 인젝션·하드코딩 시크릿·암호화 관련 이슈는 없다. 주목할 개선점은 두 가지: (1) `window.confirm()` 를 보안 게이트로 사용하는 패턴은 clickjacking 환경에서 이론적 우회 가능성이 있으며 애플리케이션 Modal 컴포넌트로 교체가 권장된다(다만 `useHasRole` 게이트가 존재해 실질 위험 낮음). (2) 에러 처리에서 서버 원문 메시지를 i18n 문자열로 일관되게 대체하는 패턴이 전체 카드에 올바르게 적용되어 있다. 백엔드 인가·SSRF 방어·endpointPath 검증은 이 PR 범위 밖이며 프론트엔드 클라이언트가 명시적으로 백엔드 위임을 선언하고 있다.

## 위험도

LOW
