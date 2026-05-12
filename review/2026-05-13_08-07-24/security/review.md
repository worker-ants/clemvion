## 발견사항

### [WARNING] 백엔드 에러 메시지 직접 노출
- **위치**: `change-password/page.tsx:24-29`, `profile-info-card.tsx:43-48`, `profile-preferences-card.tsx:30-35` — `axiosMessage()` 함수 (3개 파일에 중복)
- **상세**: `err.response?.data?.message`를 toast에 그대로 출력한다. 백엔드가 내부 구현 세부사항(스택 트레이스, DB 쿼리 구조 등)을 message 필드에 담아 반환하거나, 비밀번호 변경 실패 시 "User not found" vs "Invalid password"처럼 구별되는 메시지를 반환한다면 정보 노출·사용자 열거(user enumeration)로 이어질 수 있다.
- **제안**: 프론트엔드에서는 HTTP 상태 코드 기준으로 범주별 제네릭 메시지를 선택하고, 서버 응답 message를 그대로 노출하지 않는다. 예: `401 → t("error.unauthorized")`, `400 → t("error.invalidInput")`, `5xx → t("error.serverError")`. 단, 백엔드가 이미 UI 노출용 안전한 메시지만 반환한다고 보장된다면 현 방식도 허용 가능.

---

### [WARNING] 비밀번호 복잡도 요구사항 없음
- **위치**: `change-password/page.tsx:44-47`
- **상세**: `z.string().min(8).max(100)` — 길이만 검사하며 대문자·숫자·특수문자 혼합 여부를 검증하지 않는다. "12345678" 같은 약한 비밀번호가 통과한다.
- **제안**: 백엔드에서 동일 규칙을 강제하지 않는다면 프론트엔드 단에서도 복잡도 규칙을 추가한다. 예: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/` 또는 `zxcvbn` 기반 강도 피드백.

---

### [INFO] `data-testid` 속성 프로덕션 DOM 노출
- **위치**: `confirm-diff-dialog.tsx:65,71` — `data-testid={`diff-before-${entry.label}`}` 등, `profile-info-card.tsx`, `profile-preferences-card.tsx` 전반
- **상세**: `data-testid` 속성이 프로덕션 빌드에 그대로 남아 있다. 직접적인 취약점은 아니지만 DOM 구조와 컴포넌트 의도가 외부에 노출되어 자동화 공격의 표적 식별이 쉬워진다. 특히 `diff-before-이름`, `diff-after-이름` 같이 필드명이 그대로 노출된다.
- **제안**: 프로덕션 빌드에서 `data-testid`를 제거하도록 Vite/Babel 플러그인(`babel-plugin-react-remove-properties`)을 구성하거나, 테스트 전용 셀렉터로 `aria-label` / role 조합을 사용한다.

---

### [INFO] `axiosMessage` 함수 3중 중복
- **위치**: `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx`
- **상세**: 동일한 함수가 3개 파일에 복사되어 있다. 보안 정책 변경 시(예: 특정 응답 필드 차단) 3곳을 모두 동시에 수정해야 하며, 누락 시 불일치가 발생한다.
- **제안**: `@/lib/api/error.ts` 등 공통 모듈로 추출하여 단일 진실(single source of truth)을 유지한다.

---

### [INFO] `noValidate`로 브라우저 기본 검증 비활성화
- **위치**: `change-password/page.tsx:90`
- **상세**: `<form noValidate>`는 zod + react-hook-form으로 JS 검증을 대체하기 위한 의도적 선택이다. 정상 패턴이지만, JS가 비활성화된 환경에서는 검증 없이 폼이 제출될 수 있다. 서버 측 검증이 존재하므로 실질적 위험도는 낮다.
- **제안**: 이슈 없음 (서버 측 검증 존재 확인 전제).

---

## 요약

이번 변경은 보안 관점에서 전반적으로 양호하다. React의 자동 이스케이프로 XSS가 방지되고, zod 스키마로 입력 검증이 이루어지며, 버튼 비활성화를 통해 중복 제출이 차단된다. 로케일 값은 `isLocale()` 화이트리스트로 검증되고, 비밀번호 필드에는 `type="password"`와 `autoComplete` 속성이 올바르게 설정되어 있다. 하드코딩된 시크릿은 존재하지 않는다. 주요 개선점은 두 가지다: 첫째, `axiosMessage`가 서버 응답의 `message` 필드를 그대로 toast로 출력하는 구조는 백엔드 에러 메시지 품질에 종속되므로 계층적 에러 처리로 전환을 권장한다. 둘째, 비밀번호 복잡도 요구사항이 없어 길이만 만족하는 약한 비밀번호가 허용된다.

## 위험도

**LOW**