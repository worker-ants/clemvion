## 보안 코드 리뷰

### 발견사항

- **[INFO]** 서버 에러 메시지 UI 직접 노출
  - 위치: `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`
  - 상세: `error.response?.data?.message`를 그대로 `toast.error(message)`로 표시. 서버가 내부 상태를 메시지에 포함할 경우 사용자에게 노출될 수 있음.
  - 제안: 서버 응답 메시지를 그대로 쓰되, 백엔드에서 클라이언트에 노출 가능한 범용 메시지만 반환하도록 API 계약을 명시하거나, 프론트에서 화이트리스트 방식으로 알려진 에러 코드만 번역하여 표시.

- **[INFO]** API_BASE_URL 개발 fallback이 HTTP
  - 위치: `login-form.tsx:29`, `register-form.tsx:25`
  - 상세: `process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` — fallback이 평문 HTTP. 개발 환경 전용이지만 실수로 프로덕션에 환경변수 미설정 시 비암호화 통신.
  - 제안: 개발 환경에서도 HTTPS 사용을 권장하거나, 빌드 시 환경변수 누락 검증 추가. (현재 변경 범위와 직접 관련 없으나 기존 코드 위험성 언급)

- **[POSITIVE]** 비밀번호 찾기 사용자 열거 방지 적절히 구현됨
  - 위치: `forgot-password-form.tsx:onSubmit`
  - 상세: 오류 발생 시 에러를 `void`로 무시하고 항상 `setIsSubmitted(true)` + 동일 토스트를 표시. 이메일 존재 여부를 공격자가 추론할 수 없음. 올바른 설계.

- **[INFO]** `page.evaluate()` 사용 — 테스트 컨텍스트 한정
  - 위치: `smoke.spec.ts:97`
  - 상세: `document.activeElement?.tagName`를 읽는 읽기 전용 eval. 테스트 파일이므로 프로덕션 공격면 없음. 단, 미래에 사용자 입력 기반 동적 쿼리가 추가되면 XSS 위험 존재.

- **[INFO]** OAuth URL에 쿼리 파라미터 직접 삽입
  - 위치: `login-form.tsx:startOauth()`, `register-form.tsx:startOauth()`
  - 상세: `provider`는 TypeScript `OAuthProvider` 타입으로 제한되어 있고, `rememberMe`는 boolean 조건 문자열이므로 주입 위험 없음. Open redirect는 `API_BASE_URL`이 빌드타임 환경변수라 런타임 조작 불가.

---

### 요약

이번 변경은 WCAG 2.1 AA 접근성 개선(색 대비, 링크 underline 항시 표시, `aria-hidden`, e2e axe 테스트 추가)을 중심으로 하며, 보안 관련 신규 취약점은 도입되지 않았다. 기존 코드에서 서버 에러 메시지가 UI에 그대로 노출되는 패턴과 HTTP fallback URL이 잠재적 개선 대상이나, 이는 이번 diff 범위 밖의 기존 코드이며 현재 변경으로 인한 위험 증가는 없다. `forgot-password` 폼의 사용자 열거 방지 패턴은 보안 관점에서 올바르다.

### 위험도
**NONE** (이번 변경 기준)