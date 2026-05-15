아키텍처 관점에서 제공된 파일들을 분석하겠습니다.

### 발견사항

---

- **[WARNING] i18n 모듈이 auth 도메인에 직접 의존 — 레이어 경계 역전**
  - 위치: `locale-sync.tsx:5` — `import { useAuthStore } from "@/lib/stores/auth-store"`
  - 상세: `i18n/` 모듈 내부의 `LocaleSync`가 `auth-store`를 직접 임포트함. i18n은 앱 전반이 사용하는 기반 레이어인데, auth는 도메인 레이어다. 기반 레이어가 도메인 레이어에 의존하는 방향은 DIP(의존성 역전 원칙) 위반이며, 향후 auth 모듈 교체·리팩터링 시 i18n까지 변경이 전파됨.
  - 제안: `LocaleSync`를 `i18n/` 디렉터리 밖(`src/lib/providers/` 또는 `src/components/layout/`)으로 이동하거나, auth store가 locale 동기화 콜백을 주입받는 구조로 역전. 또는 auth store의 user 변경을 구독하는 별도 coordination hook(`useLocaleFromUser`)을 `i18n/` 밖에 두는 것도 선택지.

---

- **[WARNING] `Dict` 타입이 `ko.ts`에 종속 — 비대칭 언어 의존성**
  - 위치: `dict/en.ts:1` — `import type { Dict } from "./ko"`
  - 상세: 영어 사전이 한국어 사전 파일로부터 타입을 가져옴. 한국어가 스키마 소스로 고정되어, 한국어 dict에 수정이 생기면 영어 dict의 타입도 즉시 영향을 받음. 3번째 언어 추가 시에도 동일하게 `ko.ts`에 의존하게 되어 언어 간 의존 방향이 불균형해짐.
  - 제안: `Dict` 타입과 `WidenString` 유틸리티를 `dict/types.ts`(또는 `dict/schema.ts`)로 분리하고, `ko.ts`와 `en.ts` 양쪽에서 import. 한국어 dict는 `as const`로 타입 추론 소스 역할만 하고, 공유 타입은 독립 파일에서 관리.

---

- **[INFO] `initFromStorage` 초기화 타이밍 — 레이어 책임 분산**
  - 위치: `locale-store.ts:23` vs `locale-sync.tsx:13-15`
  - 상세: store는 `DEFAULT_LOCALE("ko")`로 초기화되고, localStorage 읽기는 `LocaleSync` 마운트 시점(`useEffect`)까지 지연됨. store 초기화(`create()`)와 실제 초기값 적용 책임이 두 파일에 나뉘어 있어, `LocaleSync` 없이 store만 사용하는 경우 항상 기본값이 노출됨. 저장 레이어(store)의 초기 상태 책임이 UI 레이어(component)에 의존하는 구조.
  - 제안: `create()` 콜백 내에서 `typeof window !== "undefined"`를 체크해 클라이언트라면 즉시 `readStoredLocale()`로 초기화하거나, `initFromStorage`를 store 생성 시 lazy하게 실행. `LocaleSync`는 user 동기화만 담당하도록 범위 축소.

---

- **[INFO] `useSyncExternalStore` 서버 스냅샷 하드코딩**
  - 위치: `index.ts:21` — `() => "ko" as Locale`
  - 상세: 영어 사용자의 경우 서버 렌더(ko)와 클라이언트 hydration(en) 불일치로 suppressed hydration warning이 발생. `suppressHydrationWarning`으로 흡수 중임을 RESOLUTION.md에서 인지하고 있으나, `getServerSnapshot`이 항상 `"ko"`를 반환한다는 사실이 코드에서 드러나지 않아 다음 개발자가 의도를 파악하기 어려움.
  - 제안: 현 방식을 유지하더라도 `// always 'ko' on server; client hydrates from LocaleSync` 같은 주석으로 의도를 명시. 근본 해결은 쿠키 기반 locale 전달이지만 범위 외로 적절히 판단.

---

- **[INFO] `PathInto` 타입 유틸리티 재귀 한계**
  - 위치: `core.ts:7-14`
  - 상세: `PathInto<Dict>`는 dict 구조가 깊어질수록 TypeScript 재귀 타입 연산량이 증가함. 현재 dict 깊이(최대 3~4 레벨)에서는 문제없으나, 번역 키가 크게 확장될 경우 TS 컴파일 성능에 영향을 줄 수 있음. 또한 `TranslationKey` 유니온 타입이 매우 커질수록 자동완성 성능이 저하됨.
  - 제안: 현 규모에서는 수용 가능. dict가 현재 대비 2배 이상 확장될 시 `PathInto` 대신 flat key 방식이나 namespace 분리를 검토할 것.

---

- **[INFO] `LOCALES` 배열과 `Locale` 유니온 타입 수동 동기화 필요**
  - 위치: `types.ts:1-5`
  - 상세: `Locale = "ko" | "en"` 유니온과 `LOCALES = ["ko", "en"]` 배열이 별도로 정의되어 있어 새 locale 추가 시 두 곳을 모두 수정해야 함. TypeScript가 배열에서 유니온을 파생시키는 것(`type Locale = typeof LOCALES[number]`)이 일반적으로 더 안전한 패턴.
  - 제안: `export const LOCALES = ["ko", "en"] as const;` → `export type Locale = (typeof LOCALES)[number];` 순서로 변경해 LOCALES가 단일 소스가 되도록.

---

### 요약

RESOLUTION.md에서 조치된 핵심 이슈(`core.ts` 분리, `"use client"` 경계, Section void t, useEffect deps)들은 잘 반영되어 있다. 남은 아키텍처 문제의 핵심은 **i18n 기반 레이어가 auth 도메인 레이어에 직접 의존하는 방향 역전**과, **한국어 dict가 공유 타입 소스 역할을 겸하는 비대칭 의존성**이다. 전자는 향후 auth 모듈 변경 시 i18n 전체에 영향이 전파되는 구조적 취약점이고, 후자는 다국어 확장 시 복잡도를 키우는 요인이다. 나머지는 SSR 타이밍과 타입 유틸리티 관련 INFO 수준 사항으로, 현재 규모에서는 즉각적 위험은 없다. 전반적으로 `translate()` 순수 함수 분리, Zustand 기반 reactive locale store, `TranslationKey` 타입 안전성 설계는 응집도와 타입 안전성 측면에서 잘 구현되어 있다.

### 위험도
**LOW**