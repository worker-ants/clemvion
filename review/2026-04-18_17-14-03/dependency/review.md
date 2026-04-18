이제 전체 분석이 완료되었습니다.

---

## 발견사항

### **[INFO]** 외부 패키지 추가 없음 — 순수 내부 구현
- 위치: `frontend/src/lib/i18n/`, `frontend/src/lib/stores/locale-store.ts`
- 상세: i18n 시스템 전체가 React(`useSyncExternalStore`, `useCallback`) + Zustand(기존 의존성) + TypeScript 타입 시스템만으로 구현됨. `react-i18next`, `next-intl`, `i18next` 등 외부 i18n 라이브러리를 도입하지 않았으며 `package.json`에 변경이 없음.
- 제안: 현재 구조(2개 로케일, 정적 dict)에는 적합. 로케일이 3개 이상으로 확장되거나 동적 로딩이 필요해지면 `next-intl` 마이그레이션을 고려할 것.

---

### **[WARNING]** `date.ts`가 `"use client"` 없이 클라이언트 전용 store를 임포트
- 위치: `frontend/src/lib/utils/date.ts:2` — `import { useLocaleStore } from "@/lib/stores/locale-store"`
- 상세: `locale-store.ts`에는 `"use client"` 지시자가 있고, `date.ts`에는 없음. `date.ts`는 서버 컴포넌트나 서버 사이드 유틸리티에서 직접 임포트될 수 있는 파일인데, `useLocaleStore.getState()`를 `currentLocale()` 헬퍼로 호출하고 있음. SSR 환경에서는 `window`/`localStorage` 없이 실행되므로 store 초기값(기본 `"ko"`)이 반환되는 것은 안전하지만, 번들러가 `"use client"` 경계를 감지해 경고를 낼 수 있고, 실제로 서버에서 호출되면 store가 항상 기본값을 반환해 로케일이 무시됨.
- 제안: 서버측 코드에서 `timeAgo`/`formatDuration`/`formatDate`를 호출할 때는 반드시 `locale` 인수를 명시적으로 전달하도록 강제하거나, `date.ts` 상단에 `"use client"`를 추가해 경계를 명확히 할 것.

---

### **[WARNING]** `formatDuration` 함수 이름 충돌 — 동작 불일치
- 위치: `frontend/src/lib/utils/date.ts:36` vs `frontend/src/lib/utils/execution-status.ts:31`
- 상세: 동일 이름의 `formatDuration`이 두 파일에 존재하며 시그니처와 동작이 다름. `date.ts` 버전은 i18n 처리 + `null` 미지원(`ms: number`), `execution-status.ts` 버전은 `null` 처리 + 소수점 초 표기(`1.0s`). `dashboard/page.tsx`는 `date.ts` 버전으로 교체되었는데, 기존 `execution-status.ts` 버전에 있던 `null` 처리와 소수점 초 포맷(`2.5s`)이 누락됨.
- 제안: 함수명을 `formatDurationLocalized` 등으로 구분하거나, `execution-status.ts`의 `formatDuration`을 i18n을 지원하도록 통합할 것. 대시보드에서 duration이 `null`인 케이스가 없는지 확인 필요.

---

### **[WARNING]** `Section` 컴포넌트에 `t: TFunction` prop 전달 후 `void t`로 즉시 무시
- 위치: `frontend/src/app/(main)/integrations/page.tsx:377`
- 상세: `Section` 컴포넌트에 `t` prop을 추가하고 즉시 `void t`로 무시함. Dead code이며, `t`를 실제로 사용하지 않는다면 prop 자체를 제거해야 함. 또한 `t`를 추가한 이유가 미래 사용을 위한 것이라면 CLAUDE.md의 "불필요한 추상화 금지" 지침에 위배됨.
- 제안: `Section` 내부에서 `t`를 실제로 사용하지 않는다면 prop과 `void t`를 모두 제거할 것.

---

### **[INFO]** `i18n/index.ts`의 `"use client"` 지시자가 `translate()` 순수 함수 사용을 제한
- 위치: `frontend/src/lib/i18n/index.ts:1`
- 상세: `"use client"` 지시자로 인해 이 파일 전체가 클라이언트 번들에 속하게 됨. `translate()` 함수 자체는 순수 함수로 서버에서도 사용 가능하지만, 현재 구조에서는 서버 컴포넌트가 이 파일을 직접 임포트할 수 없음. `date.ts`가 `translate`를 임포트하는 방식이 Next.js 서버/클라이언트 경계 관리를 복잡하게 만듦.
- 제안: `translate()` + `types.ts` + dict를 별도 파일(`i18n/translate.ts`, `"use client"` 없음)로 분리하고, `useT()`/`useLocale()` 훅만 `"use client"` 파일에 두는 구조를 권장.

---

### **[INFO]** `register-form.tsx`의 terms/privacy 링크 순서 처리 로직 복잡도
- 위치: `frontend/src/components/auth/register-form.tsx` (termsAgreeHtml 처리 블록)
- 상세: null 바이트(`\u0000`)를 플레이스홀더로 사용해 번역 문자열을 split하는 방식은 외부 라이브러리 없이 구현한 것으로, 내부 의존성 추가는 없음. 그러나 번역 문자열에 `\u0000`이 포함되면 파싱이 깨질 수 있는 취약한 구현임.
- 제안: `{terms}`/`{privacy}` 같은 일반 플레이스홀더로 split하거나, `termsLink`/`privacyLink`를 별도 번역 키로 분리하는 방식으로 단순화할 것.

---

## 요약

이 변경은 외부 i18n 라이브러리를 도입하지 않고 React + Zustand만으로 경량 i18n 시스템을 자체 구현한 것으로, 번들 크기와 외부 의존성 측면에서 긍정적이다. 주요 의존성 리스크는 외부 패키지가 아닌 내부 모듈 간 경계 문제(`date.ts`의 클라이언트 store 직접 참조, `"use client"` 경계 미분리)와 `formatDuration` 이름 충돌에 있다. `Section` 컴포넌트의 미사용 `t` prop과 null-byte 기반 파싱은 코드 품질 문제로, 즉시 제거/단순화가 필요하다.

## 위험도

**LOW**