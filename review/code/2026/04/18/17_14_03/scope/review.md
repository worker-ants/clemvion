### 발견사항

- **[WARNING]** `Section` 컴포넌트에 `void t;` 데드 코드
  - 위치: `integrations/page.tsx:371` — `void t;`
  - 상세: `t` 파라미터를 받아 `void t;`로 소비만 하고 실제로 사용하지 않음. 컴포넌트 내부에서 i18n이 적용되지 않은 미완성 상태.
  - 제안: Section 내부의 i18n 대상 텍스트를 `t`로 번역하거나, 파라미터 자체를 제거.

- **[WARNING]** `STATUS_FILTERS`에서 잘못된 번역 키 사용
  - 위치: `integrations/page.tsx:50` — `{ value: "all", labelKey: "integrations.scopeAll" }`
  - 상세: 상태 필터의 "All" 항목이 스코프 필터용 키(`integrations.scopeAll`)를 재사용. 현재는 같은 문자열이더라도 의미론적으로 분리되어야 함 (`integrations.statusAll` 같은 별도 키 필요).
  - 제안: 상태 필터 전용 키를 dict에 추가하고 사용.

- **[WARNING]** 약관 링크 처리에 null 문자 기반 템플릿 파싱
  - 위치: `register-form.tsx:193–229`
  - 상세: `\u0000TERMS\u0000` / `\u0000PRIVACY\u0000`를 구분자로 사용하는 커스텀 파싱 로직. 번역 문자열에 null 문자가 혼입된 경우 Silent 오류가 발생하고, 순서 판단 로직이 복잡해 취약함.
  - 제안: 별도 `termsLink`, `privacyLink` 컴포넌트를 props로 받거나, 고정 위치 플레이스홀더 방식(`{termsLink}`, `{privacyLink}`)으로 단순화.

- **[INFO]** Zod 스키마가 컴포넌트 내부로 이동
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`
  - 상세: i18n 동적 검증 메시지를 위해 스키마를 컴포넌트 함수 안으로 이동. 렌더링마다 스키마 객체가 재생성됨. `useMemo`로 감싸는 것이 더 적절하나, 기능 동작에는 영향 없음.
  - 제안: `useMemo(() => z.object({...}), [t])`로 래핑 권장.

- **[INFO]** `i18n/index.ts`에 `"use client"` 지시어
  - 위치: `i18n/index.ts:1`
  - 상세: `translate` 함수 자체는 순수 함수라 서버에서도 사용 가능하지만, `"use client"` 때문에 서버 컴포넌트/RSC에서 직접 임포트 불가.
  - 제안: `translate`와 타입 정의를 별도 파일로 분리하고, `useT`/`useLocale` 훅만 `"use client"` 파일에 위치.

- **[INFO]** i18n 무관 주석 삭제
  - 위치: `accept-invitation-content.tsx:39`, `profile/security/page.tsx:54`, `profile/page.tsx:59`
  - 상세: 기능 설명 주석이 번역 작업과 관계없이 일괄 삭제됨. 내용 자체는 유효한 컨텍스트였음.
  - 제안: 주석 변경은 별도 커밋으로 분리하거나 복원.

- **[INFO]** 인라인 주석 한→영 번역
  - 위치: `login-form.tsx:59` — `/* AuthProvider가 다음 페이지 로드에서 복원 */` → English
  - 상세: i18n 범위(UI 텍스트)와 무관한 코드 주석 언어 변경. 실질적 문제는 없으나 범위 이탈.
  - 제안: 코드 주석 변경은 이 PR에서 제외.

---

### 요약

변경 전반이 i18n(국제화) 목적에 부합하며 핵심 구현(번역 딕셔너리, `translate`/`useT` 함수, `locale-store`, `LocaleSync`, `date.ts` 로케일 지원)은 범위 내에 있다. 단, `integrations/page.tsx`의 `Section` 컴포넌트에 `t` 파라미터를 받아놓고 실제 미사용(`void t;`)인 미완성 코드가 남아 있고, 상태 필터 "All"에 잘못된 번역 키가 사용된 점은 기능 버그로 이어질 수 있다. `register-form.tsx`의 null 문자 기반 링크 파싱 방식은 유지보수 위험이 있으며, 코드 주석 삭제/번역 등 i18n과 무관한 부수 변경이 여러 파일에 혼입된 점은 리뷰 범위를 불필요하게 확대한다.

### 위험도
**MEDIUM**