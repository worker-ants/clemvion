이제 접근 가능한 파일들을 기반으로 보안 리뷰를 작성하겠습니다. 백엔드 파일들(`expression-resolver.service.ts`, `evaluator.ts`, `system-prompt.ts`)은 현재 세션의 허용 디렉터리 외부에 있어 직접 접근이 불가능했습니다.

---

## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] OAuth 팝업 URL 유효성 검증 없이 `window.open()` 직접 사용**
- 위치: `integrations/[id]/page.tsx` L369–372, L499–509
- 상세: `reauthorize.mutate()` 및 `requestScopes()` 응답의 `res.authUrl`을 검증 없이 `window.open(url, ...)` 에 넘깁니다. 백엔드가 침해되거나 중간자 공격이 발생한 경우, 악의적인 URL이 OAuth 팝업으로 열릴 수 있습니다.
- 제안: `openOAuthPopup()` 내부에서 `new URL(url).protocol === 'https:'` 및 허용 도메인 목록(allowlist) 검사를 추가하여 방어층을 구성하세요.

```typescript
// 현재
function openOAuthPopup(url: string) {
  window.open(url, "integration-oauth", ...);
}

// 권장
function openOAuthPopup(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") return;
  window.open(url, "integration-oauth", ...);
}
```

---

**[WARNING] Webhook `endpointPath` 경로 탐색(Path Traversal) 미검증**
- 위치: `triggers/trigger-detail-drawer.tsx` L226–231
- 상세: `getWebhookUrl()` 함수가 API에서 수신한 `endpointPath`를 검증 없이 URL 문자열에 직접 연결합니다. `endpointPath`가 `../../admin`처럼 경로 조작 값을 포함할 경우, 화면에 표시되는 webhook URL이 공격자가 의도한 경로를 가리킬 수 있습니다. 표시 전용 URL이라도 사용자를 오도하는 소셜 엔지니어링에 악용될 수 있습니다.

```typescript
function getWebhookUrl(endpointPath: string) {
  const base = typeof window !== "undefined"
    ? window.location.origin.replace(/:\d+$/, ":3011")
    : "";
  return `${base}/api/hooks/${endpointPath}`; // endpointPath 미검증
}
```

- 제안: `endpointPath`에 대해 `/^[\w\-]+$/` 패턴 일치 여부를 확인하여 슬래시·점 등의 경로 조작 문자를 차단하세요.

---

**[WARNING] 타임존 입력 필드 클라이언트 측 유효성 검증 부재**
- 위치: `schedules/page.tsx` L891–898
- 상세: 타임존 필드가 자유 텍스트 입력(`<Input>`)으로 제공되며 클라이언트 측 검증이 없습니다. 유효하지 않은 타임존 문자열이 백엔드로 전달될 경우, 서버 측 파싱 오류나 예외 노출로 이어질 수 있습니다.
- 제안: 제출 시 `Intl.supportedValuesOf('timeZone').includes(formTimezone)` 등으로 유효성 검사를 추가하거나, `<select>` 요소로 교체하여 사전 정의된 값만 허용하세요.

---

**[WARNING] `window.confirm()` 으로 치명적 작업 승인 처리**
- 위치: `integrations/[id]/page.tsx` L853
- 상세: 통합 스코프 변경 확인에 `window.confirm()`을 사용합니다. 이 방식은 자동화 스크립트(클릭재킹, XSS 체인)로 우회가 가능하며, 브라우저 팝업 차단기에 의해 억제될 수도 있습니다.
- 제안: 인앱 확인 다이얼로그(React state 기반)로 교체하세요. 이미 삭제·재생성 확인에 사용된 패턴(`confirming` state)과 일관성도 유지됩니다.

---

**[INFO] 서버 오류 메시지 직접 toast 출력**
- 위치: `integrations/[id]/page.tsx` L392–393, L829
- 상세: `e.response?.data?.message`를 검증 없이 `toast.error()`에 출력합니다. 서버가 내부 구현 세부사항이 담긴 상세 오류 메시지를 반환하면 사용자에게 노출됩니다.
- 제안: 백엔드에서 오류 메시지를 표준화하거나, 프론트엔드에서 알려진 오류 코드만 매핑하여 i18n 키로 출력하세요.

---

**[INFO] `integration.credentials` 객체 전달 여부 확인 필요**
- 위치: `integrations/[id]/page.tsx` L524–526
- 상세: `integration.credentials.scopes`에 직접 접근합니다. `credentials` 객체 전체가 API 응답으로 내려오는 경우, 프론트엔드에서 필요한 `scopes` 필드만 노출하도록 백엔드 DTO를 제한했는지 확인이 필요합니다. 실제 자격증명(토큰, 시크릿)이 포함되어서는 안 됩니다.

---

**[INFO] 툴 호출 인자(arguments) 마스킹 없이 UI 출력**
- 위치: `conversation-inspector.tsx` L83–87
- 상세: AI 에이전트 툴 호출 인자를 그대로 표시합니다. 툴에 민감한 파라미터(토큰, 개인정보 등)가 전달된 경우 대화 인스펙터에서 평문으로 노출됩니다.
- 제안: 내부 툴 전용 화면이므로 당장 Critical은 아니지만, 파라미터 키 이름 기반 마스킹(`password`, `token`, `secret` 등) 처리를 고려하세요.

---

**[POSITIVE] URL 프로토콜 화이트리스트 검증 (양호)**
- 위치: `button-bar.tsx` L33–40
- 상세: `isSafeUrl()` 함수가 외부 링크 URL의 프로토콜을 `http:`/`https:`로 제한하여 `javascript:` 프로토콜 인젝션 공격을 적절히 차단합니다.

---

**[POSITIVE] API 키 단회 노출 패턴 (양호)**
- 위치: `authentication/page.tsx` L210–230
- 상세: 생성·재생성된 API 키를 React state(`generatedKey`)에만 보관하고 한 번만 표시하는 업계 표준 패턴을 준수합니다.

---

**[NOTICE] 백엔드 핵심 파일 리뷰 제외됨**
- 대상: `expression-resolver.service.ts`, `evaluator.ts`, `system-prompt.ts`
- 상세: 현재 세션 허용 디렉터리 외부에 위치하여 읽기가 불가능했습니다. 이 파일들은 표현식 평가 엔진을 구성하며, 보안 관점에서 가장 위험도가 높은 영역입니다(동적 코드 평가, 샌드박스 이탈, 프롬프트 인젝션 가능성). **별도 리뷰가 반드시 필요합니다.**

---

### 요약

접근 가능한 프론트엔드 파일들은 전반적으로 양호한 보안 패턴을 따르고 있습니다. React JSX의 기본 이스케이핑으로 XSS 위험이 낮고, `dangerouslySetInnerHTML` 사용이 없으며, 외부 링크 URL에 프로토콜 화이트리스트 검증이 적용되어 있습니다. 주요 우려사항은 OAuth 팝업 URL 미검증, Webhook 경로 탐색 가능성, 타임존 입력 미검증, `window.confirm()` 우회 가능성이며, 서버 오류 메시지 직접 노출도 개선이 필요합니다. **가장 중요한 것은 표현식 평가 백엔드 코드(`evaluator.ts`, `expression-resolver.service.ts`)와 시스템 프롬프트(`system-prompt.ts`)에 대한 별도 보안 리뷰로, 이 영역은 서버사이드 코드 인젝션 및 프롬프트 인젝션 공격의 주요 공격 표면입니다.**

### 위험도

**MEDIUM** (프론트엔드 기준, 백엔드 표현식 엔진 미포함)

> **참고**: 백엔드 `evaluator.ts` 및 `expression-resolver.service.ts` 파일이 리뷰에 포함되지 않아 전체 위험도는 더 높을 수 있습니다. 해당 파일들에 대한 별도 보안 리뷰를 권장합니다.