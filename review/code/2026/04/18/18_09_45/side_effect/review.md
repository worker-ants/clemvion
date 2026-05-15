---

## 부작용 코드 리뷰 결과

### 발견사항

---

**[CRITICAL]** `date.ts`와 `execution-status.ts`에 `"use client"` 지시어 추가 — Server Component 임포트 차단
- 위치: `date.ts:1`, `execution-status.ts:1`
- 상세: 두 파일 모두 순수 유틸리티였으나 `"use client"` 마킹으로 클라이언트 전용 모듈이 됨. Next.js에서 Server Component가 `"use client"` 모듈을 임포트하면 빌드/런타임 에러 발생. 현재 diff에 포함되지 않은 서버 컴포넌트 중 `formatDate`, `timeAgo`, `formatDuration`, `getStatusLabel`을 임포트하는 파일이 있다면 즉시 파괴적 변경이 됨.
- 제안: 서버 컴포넌트 호환이 필요하다면, `locale` 인자를 필수로 받는 순수 함수로 분리하고 `"use client"` 바인딩은 별도 래퍼 훅으로 격리하거나, 전체 앱에서 server component에서 이 유틸들을 사용하는지 grep으로 확인 필요.

---

**[WARNING]** `integrations/page.tsx` — 영어 단수/복수 문법 손실
- 위치: `integrations/page.tsx:169-175`
- 상세: 기존 코드는 `attentionCount > 1 ? "s" : ""` 로 단수/복수 처리를 했으나, 신규 코드는 `t("integrations.attentionPrefix")` + `t("integrations.attentionSuffix")` 고정 문자열 조합으로 변경됨. 영어 locale에서 `attentionCount=1`일 때 "1 integrations need attention" 처럼 문법 오류가 발생할 가능성이 높음 (사전 값에 따라 다르나 static 키로는 복수형을 올바르게 처리하기 어려움).
- 제안: `t("integrations.attentionBanner", { count: attentionCount })` 형태로 단일 보간 키를 사용하고, 영어 사전에서 복수 처리를 포함한 문장 전체를 정의하거나, `count === 1` 분기를 유지.

---

**[WARNING]** `formatDuration`이 두 모듈에 공존하며 정밀도 동작이 다름
- 위치: `date.ts:formatDuration`, `execution-status.ts:formatDuration`
- 상세: 두 함수 모두 `formatDuration(ms, locale?)` 시그니처이나 동작이 다름. `date.ts`는 `Math.floor` (정수 초: `5000ms → "5s"`), `execution-status.ts`는 소수점 유지 (`2500ms → "2.5s"`). `dashboard/page.tsx`가 기존 로컬 구현을 제거하고 `date.ts`의 것으로 교체했는데, 기존 대시보드는 정수 초(`2s`), 신규는 동일하게 정수이므로 대시보드는 무방. 그러나 이름 충돌로 인해 향후 잘못된 모듈을 임포트하는 실수가 유발될 수 있음.
- 제안: 함수명을 `formatDurationExact` (소수점, execution용) / `formatDurationCoarse` (정수, 일반 표시용)로 구분하거나, 단일 구현으로 통합.

---

**[WARNING]** Auth Form 컴포넌트의 locale `key` 패턴 — 로케일 전환 시 폼 상태 초기화
- 위치: `forgot-password-form.tsx:111-113` (및 유사 패턴의 login, register, reset-password form)
- 상세: `<ForgotPasswordFormInner key={locale} />`는 locale이 바뀔 때 폼 전체를 unmount/remount함. 사용자가 이메일이나 비밀번호를 입력 중에 언어를 전환하면 **입력 내용 전체가 소실**됨. 로그인 폼의 경우 비밀번호를 다 입력한 후 언어 바꾸면 재입력 필요.
- 제안: Zod 스키마를 `useMemo([t])` 의존성으로 정의하는 것은 맞으나, `key`로 강제 remount하는 대신 `form.clearErrors()` + 스키마만 교체하는 방식을 고려. 또는 Zod schema를 `useEffect`에서 `form.setSchema`처럼 업데이트하거나, validation message는 런타임에 `t()`로 교체 (react-hook-form의 `resolver` 레벨에서만 locale 적용).

---

**[WARNING]** `execution-status.ts`의 `formatDuration` — `1.0s` → `1s` 출력 변경 (암묵적 breaking change)
- 위치: `execution-status.ts:formatDuration`
- 상세: 기존 `formatDuration(1000)` → `"1.0s"`. 변경 후 `"1s"` (`Number("1.0".toFixed(1))` = 1이 되어 소수점 없이 출력). 스냅샷 테스트, E2E 테스트, 혹은 실행 시간 파싱 로직이 있다면 파괴. `execution-list-page.test.tsx`에서도 `"1.0s"` → `"1s"` 기대값이 변경됨.
- 제안: 의도된 변경이라면 CHANGELOG에 기록. 소수점을 유지하려면 `value: seconds` (float 그대로) 대신 `toFixed(1)` 결과를 문자열로 직접 번역키에 넣거나 별도 포맷 로직 유지.

---

**[INFO]** `verify-email-content.tsx` / `accept-invitation-content.tsx` — useEffect 내 async에서 `useLocaleStore.getState()` 스냅샷
- 위치: `verify-email-content.tsx:37`, `accept-invitation-content.tsx:39`
- 상세: `const currentLocale = useLocaleStore.getState().locale`을 async 함수 시작 시점에 스냅샷함. `t`(훅 클로저)는 렌더 시점 locale을 사용하고, `getState()` 패턴은 실행 시점 locale을 사용함. 이메일 인증 중 locale이 바뀌는 경우 toast 메시지만 새 locale로 표시되고 나머지 UI는 이전 locale로 유지되는 불일치 발생 가능. 실용적으로는 무시 가능한 edge case이나, 일관성을 위해 `t`(클로저) 활용이 더 단순함.
- 제안: async 콜백 내 toast 메시지도 `t()` 클로저를 그대로 사용 가능 (React hooks 규칙상 `useT`를 callback 내에서 직접 호출할 수 없으나, 렌더 시점에 캡처된 `t` 함수 자체는 콜백에서 자유롭게 사용 가능).

---

**[INFO]** `editor-loader.tsx` — async load 함수 내 locale 스냅샷 타이밍
- 위치: `editor-loader.tsx:27`
- 상세: `load()` 함수 시작 시 locale을 한 번 읽음. 비동기 로딩 완료 전 locale이 변경되면 에러/경고 메시지가 이전 locale로 출력됨. 에디터 로딩은 단발성이므로 실용적 문제는 없음.

---

**[INFO]** `LocaleSync` 비동기 초기화 — 첫 렌더에서 기본값(ko) 사용
- 위치: `providers.tsx:54`
- 상세: `<LocaleSync />`는 `useEffect`로 localStorage에서 locale을 복원하므로, hydration 직후 첫 렌더는 항상 기본 locale("ko")로 그려짐. 영어 사용자의 경우 locale="en"으로 전환 전까지 한국어로 한 번 렌더됨 (flash). 서비스 특성에 따라 허용 가능한 수준.

---

### 요약

이번 변경은 전반적으로 i18n 적용을 올바르게 수행했으나, **`date.ts`와 `execution-status.ts`에 `"use client"` 지시어가 추가된 것이 가장 큰 잠재적 부작용**이다. 두 파일이 서버 컴포넌트에서 사용되는지 즉각 확인이 필요하다. 그 외 영어 단수/복수 문법 손실, 두 모듈의 `formatDuration` 정밀도 불일치, Auth form의 locale 전환 시 입력 상태 소실은 사용자 경험에 직접 영향을 미치는 Warning 수준 이슈들이다. `useLocaleStore.getState()` 패턴은 Zustand에서 허용된 패턴이므로 Rules of Hooks 위반은 없다.

### 위험도

**MEDIUM** — `"use client"` 추가로 인한 Server Component 호환성 파괴 가능성이 실재하나, 현재 diff의 모든 소비 컴포넌트가 Client Component이므로 즉각적 폭발은 없음. 단, 미래 또는 누락된 서버 컴포넌트 존재 여부 확인 전까지 MEDIUM 유지.