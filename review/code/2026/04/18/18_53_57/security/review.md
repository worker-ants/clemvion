### 발견사항

- **[INFO]** 서버 오류 메시지 직접 노출 (기존 패턴 유지)
  - 위치: `verify-email-content.tsx`, `accept-invitation-content.tsx`, `reset-password-form.tsx`
  - 상세: `error.response?.data?.message`를 직접 toast/UI에 노출 — 백엔드가 내부 경로, DB 오류, 스택 트레이스 등을 메시지에 포함할 경우 정보 유출 가능. i18n 변경 이전부터 존재하던 패턴.
  - 제안: 서버 오류 메시지는 허용 목록 기반으로 필터링하거나, 번역된 일반 오류 문자열로 대체할 것.

- **[INFO]** `localStorage` 기반 locale 저장
  - 위치: `README.md`, `locale-store.ts` (추정)
  - 상세: `idea-workflow.locale` 키로 locale을 localStorage에 유지. locale 값이 `translate()` 호출에만 쓰이고 보안 결정에 영향을 주지 않으므로 실질적 위험 없음.
  - 제안: locale 저장소에서 읽은 값을 URL redirect, HTML injection 등의 경로로 사용하지 않도록 향후 기능 추가 시 주의.

- **[INFO]** 번역 키 미등록 시 키 문자열 그대로 렌더링
  - 위치: `README.md` (fallback 정책 설명)
  - 상세: 양쪽 locale 모두 키가 없으면 `"auth.verifyEmail.title"` 같은 내부 키 이름이 UI에 노출됨. 앱 구조 정보 노출에 해당하나 심각도는 낮음.
  - 제안: 프로덕션 빌드에서 키 누락 시 빈 문자열 또는 기본값 반환 처리 권장.

- **[INFO]** Zod 스키마를 `useMemo` 내부에 정의 (보안 긍정 요소)
  - 위치: `forgot-password-form.tsx`, `reset-password-form.tsx`, `login-form.tsx`
  - 상세: 스키마가 컴포넌트 내부에서 생성되므로 locale 변경 시 validation 메시지가 갱신됨. 검증 로직 자체(`min`, `email`, `refine`)는 변경되지 않아 입력 검증 보안성은 유지됨.

---

### 요약

이번 변경은 순수한 i18n(다국어) 적용 작업으로, 하드코딩된 UI 문자열을 번역 키로 교체한 것이 전부입니다. 신규 보안 취약점은 도입되지 않았으며, 인증·인가 로직, 암호화, API 통신 경로에는 변경이 없습니다. 다만 서버 오류 메시지를 그대로 UI에 노출하는 기존 패턴이 번역 작업 이후에도 그대로 유지되고 있어, 별도 작업으로 정리할 것을 권고합니다.

### 위험도

**LOW**