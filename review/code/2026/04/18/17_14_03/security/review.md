### 발견사항

---

**[INFO]** Zod 유효성 검사 스키마가 컴포넌트 내부에서 매 렌더마다 재생성됨
- 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` — 컴포넌트 함수 본문 내 `z.object(...)` 선언부
- 상세: `useT()` 의존성을 얻기 위해 스키마 정의를 컴포넌트 내부로 이동했으나, `useMemo` 없이 매 렌더 시 새 스키마 인스턴스가 생성됨. `react-hook-form`은 `resolver`로 전달된 스키마 레퍼런스 변경을 감지해 불필요한 재검증을 유발할 수 있음. 보안 취약점은 아니지만, 비밀번호 입력 중 검증 상태가 초기화되는 UX 버그로 이어질 수 있음.
- 제안: `useMemo(() => z.object({...}), [t])` 로 감싸서 `t` 함수 레퍼런스가 변경될 때만 재생성되도록 처리.

---

**[INFO]** 미사용 prop `t`가 `Section` 컴포넌트에 전달되고 즉시 `void`로 무시됨
- 위치: `integrations/page.tsx:371` — `void t;`
- 상세: `t` prop을 받도록 타입을 확장하고 호출부에서 전달하지만, 함수 본문에서는 실제로 사용하지 않음. 미완성 구현 또는 향후 제거 예정 코드가 남아있을 가능성. `void` 표현식은 lint를 우회하기 위한 패턴으로, 실제 번역이 누락되었을 수 있음.
- 제안: `t` prop을 실제로 사용하거나, 사용하지 않는다면 prop 자체를 제거.

---

**[INFO]** 서버 응답 오류 메시지가 사용자에게 직접 노출됨
- 위치: `verify-email-content.tsx:44`, `accept-invitation-content.tsx:43`, `login-form.tsx:78` 등 다수
- 상세: `error.response?.data?.message`를 토스트·화면에 그대로 표시. 백엔드 내부 구현 상세(테이블명, 스택 트레이스 등)가 메시지에 포함될 경우 정보 노출 위험. 기존 패턴이지만 i18n 리팩토링에서도 유지됨.
- 제안: 백엔드 오류 메시지를 사용자 노출 전에 화이트리스트 기반으로 필터링하거나, 알 수 없는 오류는 generic 번역키로만 표시.

---

**[WARNING]** `date.ts`가 `"use client"` 지시어를 가진 모듈(`@/lib/i18n`)을 임포트
- 위치: `date.ts:1-2`
- 상세: `translate` 함수와 `useLocaleStore`가 포함된 `@/lib/i18n/index.ts`는 `"use client"` 지시어를 가짐. `date.ts`가 서버 컴포넌트나 서버 사이드 유틸리티에서 사용될 경우 번들러 경계 오류 또는 런타임 오류 발생 가능. `useLocaleStore.getState()`는 훅이 아닌 직접 접근이므로 실행 자체는 가능하지만, Next.js 서버 컴포넌트 트리에서 이 파일을 임포트하면 클라이언트 전용 모듈이 서버에 포함될 수 있음.
- 제안: `translate` 함수와 타입만 별도 `"use client"` 없는 파일(`@/lib/i18n/translate.ts`)로 분리하거나, `date.ts`에도 `"use client"` 지시어 추가.

---

**[INFO]** 번역 문자열 내 null byte 구분자 사용
- 위치: `register-form.tsx:197-229` — `"\u0000TERMS\u0000"`, `"\u0000PRIVACY\u0000"` 사용
- 상세: 번역 템플릿에 null byte를 주입해 링크 위치를 파싱하는 방식. `dangerouslySetInnerHTML`을 피하면서 링크를 삽입하는 의도로 안전함. 다만 번역 딕셔너리가 향후 외부 소스(CMS, DB)로 전환될 경우 null byte가 의도치 않게 제거되거나 오동작할 위험이 있음. 현재는 하드코딩된 딕셔너리이므로 즉각적인 취약점 없음.
- 제안: React의 `<Trans>` 패턴을 별도 유틸리티로 구현하거나, 링크 위치를 전용 slot 컴포넌트로 처리하는 방식을 검토.

---

**[INFO]** `isLocale()` 타입 가드가 localStorage 입력 및 사용자 입력 모두에 적절히 적용됨 (긍정적 발견)
- 위치: `locale-store.ts:readStoredLocale()`, `profile/page.tsx`, `locale-sync.tsx`
- 상세: localStorage에서 읽은 값, 사용자 선택값, 사용자 프로필의 `locale` 필드 모두 `isLocale()` 검증을 통과한 경우에만 적용됨. `document.documentElement.lang` 조작도 검증된 값만 사용.

---

### 요약

이번 변경은 순수 i18n 인프라 구축으로, 새로운 보안 취약점을 도입하지 않음. `isLocale()` 타입 가드가 모든 외부 입력 경계에서 일관되게 적용되고, 번역 보간 정규식이 `\w+`로 안전하게 범위 제한되어 있으며, `dangerouslySetInnerHTML` 없이 React 요소로 링크를 삽입하는 점은 긍정적. 다만 `"use client"` 모듈 경계 혼용(WARNING)과 Zod 스키마 미메모이제이션(INFO)은 런타임 오류 및 UX 버그 위험이 있어 수정을 권고하며, 서버 오류 메시지 직접 노출 패턴은 향후 백엔드 오류 응답 표준화 시 함께 개선이 필요함.

### 위험도

**LOW**