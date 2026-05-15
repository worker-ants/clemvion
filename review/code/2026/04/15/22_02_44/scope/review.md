## 발견사항

- **[INFO]** `getEnabledProviders()`에서 `ConfigService` 대신 `process.env` 직접 참조
  - 위치: `auth-oauth.service.ts:81`
  - 상세: 서비스에 `ConfigService`가 이미 주입되어 있음에도 `getEnabledProviders()`만 `process.env`에 직접 접근. 동작에는 문제 없으나 서비스 내 다른 메서드(`requireEnv`, `redirectUri`)와 일관성이 다름
  - 제안: `configService.get<string>('oauth.stubMode') === 'true'` 또는 일관성을 위해 현재 방식 유지하되 주석으로 의도 명시

- **[INFO]** `RegisterForm` 함수 시그니처의 중복 기본값
  - 위치: `register-form.tsx:63`
  - 상세: `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps = {})` — 구조 분해 할당에 이미 기본값이 있으므로 `= {}` 는 불필요. 기능상 무해하나 불필요한 변경이 포함된 것으로 보임
  - 제안: `= {}` 제거 → `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps)`

- **[INFO]** 서버 컴포넌트에서 `NEXT_PUBLIC_API_URL` 사용
  - 위치: `auth-providers.ts:11`
  - 상세: `fetchEnabledOauthProviders`는 Next.js Server Component에서만 호출되는데, `NEXT_PUBLIC_` prefix 변수를 사용하면 해당 URL이 클라이언트 번들에 노출됨. 현재 `login-form.tsx`와 동일한 변수를 재사용하므로 실질적인 보안 위험은 없지만, 서버 전용 환경 변수(예: `INTERNAL_API_URL`)로 분리하는 것이 더 적합함
  - 제안: 별도 서버 전용 env var를 두거나, 현재 구조를 스펙/주석에 명시하여 의도적 선택임을 표시

---

## 요약

이번 변경은 "백엔드 자격증명이 설정된 OAuth provider만 UI에 표시" 기능을 구현하는 것으로, 모든 수정 파일이 해당 기능과 직접 연관되어 있다. 백엔드 서비스·컨트롤러·테스트, 프론트엔드 유틸리티·폼 컴포넌트·페이지, 스펙 문서가 일관되게 함께 변경되었으며 관련 없는 리팩토링, 무관한 파일 수정, 과도한 기능 확장은 발견되지 않는다. 위의 세 가지 지적은 모두 INFO 수준의 구현 스타일 차이로, 변경 범위를 벗어난 항목은 없다.

## 위험도

**LOW**