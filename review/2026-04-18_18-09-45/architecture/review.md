### 발견사항

---

**[WARNING] `date.ts`, `execution-status.ts`에 `"use client"` 지시어 추가로 인한 서버 컴포넌트 호환성 파괴**
- 위치: `src/lib/utils/date.ts:1`, `src/lib/utils/execution-status.ts:1`
- 상세: 두 파일 모두 원래 서버/클라이언트 양쪽에서 사용 가능한 순수 유틸리티였으나, `useLocaleStore` 임포트로 인해 `"use client"` 지시어가 추가됐다. 이제 이 두 파일을 임포트하는 모든 서버 컴포넌트는 클라이언트 컴포넌트로 강제 전환되거나 빌드 오류를 유발한다. 레이어 구조상 유틸리티(lib/utils)가 상태 관리(lib/stores)에 의존하는 역방향 의존성이다.
- 제안: `useLocaleStore.getState()` 기본값 대신, `locale` 파라미터를 항상 필수 또는 명시적 옵션으로 두고 호출 측에서 로케일을 주입하도록 변경. 유틸리티 함수 내부에서 스토어를 직접 참조하지 않는다.

```ts
// 변경 전 (store 의존)
export function formatDuration(ms: number, locale?: Locale): string {
  const loc = locale ?? useLocaleStore.getState().locale;
  ...
}

// 변경 후 (순수 함수)
export function formatDuration(ms: number, locale: Locale): string { ... }
// 호출 측에서: formatDuration(ms, useLocaleStore.getState().locale)
```

---

**[WARNING] `formatDuration` 두 벌 공존으로 인한 동작 불일치**
- 위치: `src/lib/utils/date.ts`, `src/lib/utils/execution-status.ts`
- 상세: 두 모듈 모두 `formatDuration`을 export한다. `execution-status.ts` 버전은 초 단위에서 `toFixed(1)`을 사용(예: `"2.5s"`)하는 반면 `date.ts` 버전은 `Math.floor`를 사용(예: `"2s"`)한다. 테스트도 서로 다른 기댓값을 가진다(`execution-status.test.ts: 2500ms → "2.5s"`, `date.test.ts: 5000ms → "5s"`). 같은 도메인의 동일 기능이 두 벌로 존재하면 일관성이 깨진다.
- 제안: 단일 정규 구현을 `date.ts`(혹은 별도 `duration.ts`)에 두고 `execution-status.ts`는 이를 재export하거나 위임한다. 두 구현의 소수점 표시 정책을 통일한다.

---

**[WARNING] `ForgotPasswordForm`의 `key={locale}` 강제 리마운트 패턴**
- 위치: `src/components/auth/forgot-password-form.tsx:108-111`
- 상세: 로케일 변경 시 외부 컴포넌트(`ForgotPasswordForm`)가 `key={locale}`로 내부 컴포넌트를 강제 언마운트/리마운트한다. 사용자가 이메일을 입력하던 중 언어를 변경하면 입력 내용이 소실된다. 이 패턴이 동일한 이유(Zod 스키마 재생성)로 `LoginForm`, `RegisterForm`, `ResetPasswordForm`에도 적용됐는지 일관성 확인이 필요하며, Zod 스키마를 `useMemo([t])`로 재계산하는 것 자체는 적절하지만 리마운트는 과도한 부작용이다.
- 제안: Zod 스키마를 `useForm`에서 분리하고 `resolver`를 `useForm` 바깥 `useMemo`로 교체하거나, react-hook-form의 `reset()`을 `locale` 변경 effect에서 호출하여 리마운트 없이 폼 상태를 유지한다.

---

**[WARNING] `formatDate`에서 `format === "date"` 분기 제거**
- 위치: `src/lib/utils/date.ts`
- 상세: 원본 코드에 있던 `if (format === "date")` 전용 분기가 diff에서 제거됐다. `format === "date"`로 호출 시 이제 fallthrough로 기본 분기(`toLocaleDateString`)가 실행되며, `datetime` 분기 없이 동작할 경우 동일 결과를 낼 수 있으나 명시적 처리 의도가 사라진다. 호출처에서 `"date"` 포맷을 명시적으로 사용 중이라면 예기치 않은 결과가 생길 수 있다.
- 제안: 제거가 의도적이라면 호출처를 전수 검색하여 `"date"` 포맷 사용 여부 확인 후 필요시 복원.

---

**[INFO] 비동기 콜백 내 `useLocaleStore.getState()` 접근 패턴 — 올바른 선택이나 문서화 필요**
- 위치: `verify-email-content.tsx:37`, `accept-invitation-content.tsx:39`, `editor-loader.tsx:27`
- 상세: 훅을 비동기 함수 내에서 호출할 수 없으므로 `useLocaleStore.getState()`를 직접 사용한 것은 정확한 판단이다. 그러나 이 패턴과 `useT()` 훅 패턴이 혼재하면 기여자들이 올바른 선택 기준을 모를 수 있다.
- 제안: 내부 문서나 주석으로 "동기 컴포넌트 렌더링 → useT(), 비동기 핸들러/이펙트 내부 → translate(useLocaleStore.getState().locale, ...)" 가이드라인을 명시한다.

---

**[INFO] 상수 배열의 `labelKey` 패턴 — 타입 안전성 적절**
- 위치: `sidebar.tsx`, `integrations/page.tsx`, `executions/page.tsx` 등
- 상세: `label: string` 대신 `labelKey: TranslationKey`로 변경하고 `as const satisfies` 타입 가드를 적용한 것은 컴파일 타임에 유효하지 않은 번역 키 사용을 막는 좋은 패턴이다.

---

**[INFO] `attentionPrefix`/`attentionSuffix` 분리 — 복수형 처리 불완전**
- 위치: `integrations/page.tsx:169-173`
- 상세: 원본의 `{attentionCount} integration{attentionCount > 1 ? "s" : ""} need attention`을 `attentionPrefix`와 `attentionSuffix` 두 키로 분리했다. 복수형 처리 로직이 번역 파일로 이동됐는지, 아니면 소실됐는지 확인 필요. 한국어는 복수형이 없으나 영어 번역에서 복수형 미처리 시 항상 단수형으로 표시될 수 있다.
- 제안: ICU 메시지 포맷 또는 `count` 파라미터를 활용해 번역 파일 내에서 복수형을 처리한다.

---

### 요약

이번 변경은 프론트엔드 전체에 i18n을 일관되게 도입한 대규모 작업으로, `TranslationKey` 타입을 통한 컴파일 타임 안전성 확보, 비동기 컨텍스트와 React 훅 컨텍스트를 구분한 접근 방식, 상수 배열의 키 기반 패턴 등 전반적으로 타당한 설계 결정이 이루어졌다. 다만 두 가지 구조적 문제가 중요하다: (1) 순수 유틸리티 모듈(`date.ts`, `execution-status.ts`)이 Zustand 스토어에 직접 의존하게 되어 서버 컴포넌트 호환성이 파괴되고 레이어 경계가 역전됐으며, (2) 동일한 기능인 `formatDuration`이 두 모듈에 미묘하게 다른 구현으로 공존하여 일관성 위험이 생겼다. 이 두 문제를 해결하면 전체 아키텍처의 완성도가 크게 향상될 것이다.

### 위험도

**MEDIUM**