# Security Review

## 발견사항

### [WARNING] 민감 시크릿/토큰 평문 UI 노출
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard`, `rotateResult` / `revokeResult` 상태 렌더 블록 (라인 약 1657–1706)
- 상세: Notification signing secret (`rotateResult`) 및 per-trigger interaction token (`revokeResult`) 이 API 응답에서 받는 즉시 컴포넌트 state 에 평문으로 저장되고, `<code>` 태그로 DOM 에 직접 렌더된다. 이 값들은 보안 민감 자료임에도 마스킹 없이 전체 값이 표시된다. 악의적인 브라우저 확장 프로그램, XSS 공격자, 혹은 화면 녹화 툴이 이 값을 그대로 캡처할 수 있다.
- 제안: "1회 표시" 패턴은 의도적인 설계이므로 완전 제거 대신, 값을 보여준 뒤 일정 시간(예: 30초) 후 자동으로 state 를 null 로 초기화하거나, 초기 렌더 시 일부 마스킹(`****`로 일부 치환)과 "클릭해서 전체 보기" UX를 적용하는 방안을 고려할 것. 최소한 autocomplete 차단 등으로 스크린샷/자동화 도구의 캡처 면적을 줄이는 것을 권장.

### [WARNING] 에러 메시지에 서버 내부 정보 노출
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard` `onError` 핸들러, `handleRotateSecret` catch 블록, `handleRevokeToken` catch 블록, `ChatChannelCard.handleSave` catch 블록, `handleRotate` catch 블록
- 상세: 에러 toast 메시지에 `err instanceof Error ? err.message : String(err)` 패턴으로 서버 측 에러 메시지 원문을 그대로 사용자에게 노출한다. 서버가 DB 스키마 정보, 내부 경로, 스택 트레이스 일부 등을 에러 메시지에 포함할 경우 프런트엔드가 이를 필터링 없이 화면에 표시하게 된다. `OverviewCard.onError` 는 이미 `t("triggers.detail.saveFailed")` 만 사용하는 올바른 패턴이다.
- 제안: 에러 toast 에는 서버 응답 원문 대신 사전 정의된 i18n 문자열만 사용하거나, HTTP 상태 코드 기반 분기로 노출 가능한 에러를 명시적으로 제한할 것. `OverviewCard.onError` 패턴을 전체 컴포넌트에 일관 적용할 것.

### [WARNING] getWebhookUrl — 포트 하드코딩 및 origin 의존성
- 위치: `trigger-detail-drawer.tsx` — `getWebhookUrl` 함수
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` 로 현재 origin 의 포트를 `:3011` 로 교체하여 webhook URL 을 생성한다. 프로덕션에서 이 규칙이 의도치 않게 적용되면 잘못된 webhook URL 을 사용자에게 제공하게 된다. 또한 `window.location.origin` 은 클라이언트 환경에 의존하므로 피싱 컨텍스트(iframe 등)에서 조작된 origin 을 그대로 사용할 위험이 있다. 이 로직은 이번 변경에서 새로 도입된 것은 아니지만 보안 관점에서 지적이 필요하다.
- 제안: webhook base URL 은 환경 변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL` 등)에서 읽어오도록 변경하고, 하드코딩된 포트 교체 로직을 제거할 것.

### [INFO] notification URL 입력값 클라이언트 검증 없음
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard` 편집 폼 내 `urlValue` 입력
- 상세: notification webhook URL 입력 필드가 `type="text"` 이며, 저장 전 URL 형식 검증이 없다. `javascript:`, `file://` 등 비정상 프로토콜 또는 내부 네트워크 주소를 입력할 경우 서버 측 SSRF(Server-Side Request Forgery) 를 유발할 수 있는 경로가 열려 있다. 최종 방어선은 서버 측이나 클라이언트 조기 차단이 UX 및 심층 방어 측면에서 바람직하다.
- 제안: `type="url"` 로 변경하거나, 저장 전 `URL` 생성자를 사용해 `https://` 또는 `http://` 프로토콜만 허용하는 클라이언트 측 검증을 추가할 것.

### [INFO] ChatChannelCard — languageHints JSON 사용자 입력 키/값 길이 제한 없음
- 위치: `trigger-detail-drawer.tsx` — `ChatChannelCard.handleSave` 내 `languageHintsJson` 파싱 블록
- 상세: `JSON.parse(languageHintsJson)` 결과를 flat object 여부로 검증하고 있어 기본 방어는 갖춰져 있다. 다만 키 개수 및 개별 키/값 길이에 대한 상한이 없어, 매우 큰 입력이 서버로 전달될 수 있다. DOM 기반 XSS 위험은 없다(React 가 텍스트 노드로 렌더).
- 제안: 키 개수 및 개별 키/값 길이에 대한 상한(예: 키 최대 50개, 값 최대 500자)을 클라이언트 검증에 추가 고려.

---

## 요약

이번 변경은 `useCopyToClipboard` 훅 추출 및 `ExternalInteractionCard` 저장 로직의 `useMutation` 교체가 핵심인 리팩토링이다. 신규 코드 자체에 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회 위험은 없으며, 역할 기반 접근 제어(role gate)도 기존 패턴을 유지한다. 주요 보안 우려는 기존 코드에서 이어진 두 가지로, 첫째 rotate/revoke 결과 시크릿/토큰이 DOM 에 평문으로 노출되는 점(자동 만료 처리 권장), 둘째 서버 에러 메시지 원문이 toast 를 통해 사용자에게 그대로 전달되는 패턴(i18n 문자열 일관 적용으로 해결 가능)이다. `getWebhookUrl` 의 하드코딩 포트 치환도 환경 변수화를 권장한다. 전반적으로 이번 변경이 보안 상황을 악화시키지는 않으나, 기존 잠재 문제를 해소할 기회를 활용하지 않은 부분이 있다.

## 위험도

MEDIUM
