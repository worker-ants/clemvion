### 발견사항

---

**[WARNING]** `formatDuration` 함수가 두 모듈에 중복 구현됨
- 위치: `lib/utils/date.ts` (line 39), `lib/utils/execution-status.ts` (line 48)
- 상세: 두 파일 모두 `formatDuration`을 export하며 동일한 translation key(`time.ms`, `time.seconds`, `time.minutesSeconds`)를 사용하지만 동작이 다름. `date.ts`는 초 단위를 `Math.floor`로 버림, `execution-status.ts`는 `toFixed(1)`로 소수점 1자리를 유지함. 같은 이름의 함수가 `1000ms`에 대해 각각 `"1s"`(date.ts)와 `"1.0s"`(execution-status.ts, 단 `Number(toFixed(1))` 후 "1s")를 반환. 테스트 파일도 별도로 작성됨. 미래에 translation key 변경 시 두 곳을 동기화해야 함.
- 제안: 두 함수를 하나로 통합하거나(null 처리를 매개변수로), 최소한 `execution-status.ts`가 `date.ts`의 구현을 재사용하도록 리팩터링할 것

---

**[WARNING]** `currentLocale()` 헬퍼 함수가 두 유틸리티 파일에 중복 선언됨
- 위치: `lib/utils/date.ts`, `lib/utils/execution-status.ts` 각각
- 상세: 두 파일 모두 `function currentLocale(): Locale { return useLocaleStore.getState().locale; }` 를 동일하게 선언함. 향후 로케일 해석 로직이 바뀌면 두 곳을 모두 수정해야 함.
- 제안: `lib/i18n` 또는 `lib/stores/locale-store.ts`에서 `getCurrentLocale()` 유틸을 export하고 두 파일에서 import하여 사용

---

**[WARNING]** `"use client"` 지시어가 순수 유틸리티 모듈에 추가됨
- 위치: `lib/utils/date.ts` (line 1), `lib/utils/execution-status.ts` (line 1)
- 상세: Zustand store import로 인해 SSR에서 사용 불가한 클라이언트 전용 모듈이 됨. 이 함수들은 원래 서버 컴포넌트나 Node.js 환경에서도 쓸 수 있는 순수 유틸리티였음. 장기적으로 서버사이드 데이터 포매팅(예: 메타데이터 생성, OpenGraph 등)에서 재사용이 불가해짐.
- 제안: `locale` 파라미터를 optional로 유지하되, store 접근을 컴포넌트 레이어에서만 하고 유틸 함수는 항상 명시적 locale을 받도록 강제하거나, store에 의존하는 래퍼를 별도 파일(`date.client.ts`)로 분리할 것

---

**[WARNING]** 주의(attention) 메시지가 prefix/suffix로 분리됨
- 위치: `frontend/src/app/(main)/integrations/page.tsx`
- 상세:
  ```tsx
  <strong>{attentionCount}</strong> {t("integrations.attentionPrefix")}
  {" "}
  {t("integrations.attentionSuffix")}
  ```
  문장을 prefix/suffix로 분리하면 어순이 다른 언어(예: 영어에서 수식어 순서가 다를 때)에서 번역이 불가능함. JSX 내 보간(interpolation)의 대표적인 안티패턴.
- 제안: 카운트를 포함한 단일 translation key로 대체: `t("integrations.attentionMessage", { count: attentionCount })` 후 JSX에서 `<strong>` 처리는 번역 함수가 React 노드를 지원하도록 확장하거나, 카운트를 별도 span으로 렌더링

---

**[INFO]** 테스트 파일마다 locale 초기화 코드가 반복됨
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx`, `node-palette.test.tsx`, `restore-confirm-dialog.test.tsx`, `version-detail-dialog.test.tsx`, `version-diff-dialog.test.tsx`, `version-history-panel.test.tsx` (7개 파일)
- 상세: 각 `beforeEach`에 `useLocaleStore.setState({ locale: "en" })` 라인이 수동으로 추가됨. 현재 `src/test/setup.ts`에는 locale 초기화가 없음. 앞으로 테스트가 추가될 때 누락되기 쉬움.
- 제안: `src/test/setup.ts`에 `useLocaleStore.setState({ locale: "en" })` 한 줄 추가하여 모든 테스트의 기본 locale을 일관되게 설정

---

**[INFO]** auth form의 locale 재마운트 패턴이 각 컴포넌트에 반복됨
- 위치: `forgot-password-form.tsx`, `login-form.tsx` (및 register, reset 추정)
- 상세: Inner/Outer 분리 + `key={locale}` 패턴이 여러 auth 컴포넌트에 동일하게 반복됨. 패턴 자체는 명확하나, 개발자가 새 form을 추가할 때 패턴을 몰라서 누락할 위험이 있음.
- 제안: `withLocaleKey(Component)` HOC 또는 `useLocaleRemount()` 커스텀 훅으로 추상화하거나, 최소한 패턴을 주석으로 문서화

---

**[INFO]** `STEPS` 배열의 타입 어노테이션이 과도하게 상세함
- 위치: `canvas-empty-state.tsx` (module-level constant)
- 상세: 모듈 스코프의 3개 항목 배열에 `Array<{ icon: typeof MousePointer2; titleKey: TranslationKey; descriptionKey: TranslationKey; href: string; }>` 전체 타입을 인라인 명시함. TypeScript 추론으로 충분히 처리 가능하며, `TranslationKey`로 타입 안전성은 `as const satisfies`로도 확보 가능.
- 제안: `as const satisfies Array<{ icon: ComponentType; titleKey: TranslationKey; descriptionKey: TranslationKey; href: string }>` 패턴으로 간소화 (sidebar.tsx에서 이미 `satisfies` 패턴을 사용 중)

---

### 요약

전반적으로 i18n 적용은 일관된 아키텍처(React 렌더 내 `useT()`, 비동기 콜백 내 `translate()` + store 직접 접근) 를 유지하며 대규모 변경을 체계적으로 수행했다. 그러나 `formatDuration`의 이중 구현(정밀도 차이 포함), `currentLocale()` 헬퍼의 중복 선언, 유틸리티 파일에 `"use client"` 추가로 인한 SSR 유연성 손실이 중장기 유지보수 부담을 높인다. 특히 integrations 페이지의 attention 메시지 prefix/suffix 분리는 번역 언어 확장 시 실제 버그로 이어질 수 있다. 테스트 locale 초기화 중복은 minor하지만 누락 위험이 있어 setup.ts에서 일괄 처리하는 것이 바람직하다.

### 위험도
**MEDIUM**