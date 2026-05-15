### 발견사항

---

**[WARNING]** `locale-store.ts`가 단일 책임 원칙(SRP)을 위반함

- **위치**: `locale-store.ts` 전체 — `setLocale`, `initFromStorage`, `applyHtmlLang`
- **상세**: 하나의 Zustand 스토어가 세 가지 책임을 동시에 수행한다. (1) 반응형 상태 관리(`locale` 필드, `set`), (2) 영속성(`localStorage` 읽기/쓰기), (3) DOM 동기화(`document.documentElement.lang` 갱신). `applyHtmlLang`은 프레젠테이션 레이어의 부수효과임에도 상태 레이어인 스토어에 내장되어 있다. localStorage 로직이 인라인되어 있어 영속성 메커니즘 교체(예: 쿠키, SSR 기반 저장) 시 스토어 자체를 수정해야 한다.
- **제안**: DOM 동기화를 스토어 바깥으로 분리하여 `locale-sync.tsx`의 `useEffect`가 구독 후 처리하도록 위임하거나, 영속성을 별도의 어댑터 객체로 추출:
  ```typescript
  // 영속성 어댑터 예시
  const localeStorage = {
    get: (): Locale => { ... },
    set: (locale: Locale) => { ... },
  };
  ```

---

**[WARNING]** `index.ts`의 React 훅이 `locale-store` 구현에 직접 결합됨

- **위치**: `index.ts:4` — `import { useLocaleStore } from "@/lib/stores/locale-store"`
- **상세**: `useT()`와 `useLocale()`이 Zustand 스토어를 직접 임포트한다. i18n의 공개 훅 API가 특정 상태 관리 라이브러리 구현에 의존하므로, 스토어 구조 변경(미들웨어 추가, 영속성 전략 교체 등)이 훅 레이어까지 영향을 준다. 인터페이스 경계가 없다.
- **제안**: `useSyncExternalStore`의 `subscribe`/`getSnapshot` 인자를 스토어에서 직접 받도록 유지하되, i18n 모듈이 스토어 인스턴스를 직접 임포트하는 대신 의존성 주입(Context 또는 초기화 함수) 방식으로 분리하면 추후 전환 비용이 줄어든다. 현재 규모에서는 중간 우선순위.

---

**[WARNING]** `locale-sync.tsx`가 i18n 모듈에서 auth 도메인에 의존 — 크로스-도메인 결합

- **위치**: `locale-sync.tsx:4` — `import { useAuthStore } from "@/lib/stores/auth-store"`
- **상세**: `LocaleSync` 컴포넌트는 `lib/i18n/` 디렉터리에 존재하지만 `auth-store`에 의존한다. 이는 i18n 모듈이 인증 모듈의 데이터 모델(`user.locale`)을 알아야 함을 의미한다. 두 도메인 간 양방향 인식이 발생하며, `auth-store`가 `user` 형태를 변경하면 i18n 모듈도 함께 수정해야 한다.
- **제안**: `LocaleSync`를 `lib/i18n/`에서 `lib/providers/` 또는 `lib/stores/` 수준의 오케스트레이션 레이어로 이동시키거나, 외부에서 `userLocale`을 props로 주입받도록 변경:
  ```typescript
  // 현재: lib/i18n/locale-sync.tsx (auth에 의존)
  // 개선: lib/providers/locale-sync.tsx — i18n 모듈은 순수하게 유지
  export function LocaleSync({ userLocale }: { userLocale?: string }) { ... }
  ```

---

**[INFO]** locale 추가 시 변경 지점이 3개 파일에 분산됨 — 단일 등록 지점 없음

- **위치**: `types.ts:1-7`, `core.ts:6`, `dict/` 디렉터리
- **상세**: 새 locale을 추가하려면 (1) `types.ts`의 `Locale` 유니온 + `LOCALES` 배열 + `isLocale`, (2) `core.ts`의 `dictionaries` 레코드, (3) 새 dict 파일 생성을 모두 수정해야 한다. 단일 "locale 레지스트리" 파일이 없어 누락 위험이 있다. 현재 2개 locale에서는 무관하나 확장 시 비용이 선형 증가한다.
- **제안**: `types.ts`의 `LOCALES` 배열을 단일 진실 공급원으로 삼아 `isLocale`을 `LOCALES.includes(value)`로 도출하고, `core.ts`의 `dictionaries`도 해당 배열 기반으로 구성하면 locale 추가 지점이 2곳(`types.ts` + 새 dict 파일)으로 줄어든다.

---

**[INFO]** `STORAGE_KEY`가 스토어 내부에만 존재하여 테스트에서 문자열 중복

- **위치**: `locale-store.ts:6`, `locale-store.test.ts:4`
- **상세**: `STORAGE_KEY = "idea-workflow.locale"`이 `locale-store.ts` 내부 상수로만 존재하고 외부로 export되지 않는다. 테스트에서 동일 문자열을 하드코딩하므로, 키 변경 시 테스트도 함께 수동 업데이트해야 한다. 모듈 경계를 통한 계약이 없다.
- **제안**: `export const LOCALE_STORAGE_KEY = "idea-workflow.locale"`로 공개하고 테스트에서 import.

---

**[INFO]** `dict/types.ts`의 `WidenString<typeof ko>` 패턴이 ko를 암묵적 마스터로 지정

- **위치**: `dict/types.ts:14` — `export type Dict = WidenString<typeof ko>`
- **상세**: `Dict` 타입이 `ko.ts`의 구조에서 파생되므로 한국어 딕셔너리가 암묵적 정규(canonical) 딕셔너리가 된다. `en.ts`에 `ko.ts`에 없는 키를 추가해도 `TranslationKey` 타입에 반영되지 않고 `translate()`로 접근할 수 없다. 이 "ko가 마스터" 규칙이 아키텍처 문서나 주석에 명시되지 않아 신규 기여자가 혼동할 수 있다.
- **제안**: `dict/types.ts` 또는 `core.ts` 상단에 `// ko.ts is the reference dictionary: all other locales must satisfy its shape` 주석 한 줄 추가.

---

### 요약

i18n 아키텍처는 핵심 설계 결정에서 강점을 보인다. `core.ts`는 진정한 순수 모듈로 RSC 호환성을 보장하고, `useSyncExternalStore` 기반 `useT()`는 concurrent mode를 올바르게 처리하며, 단일 effect로 통합된 `LocaleSync`는 이전 두 effect 설계의 경쟁 조건을 제거했다. 그러나 세 가지 구조적 우려가 있다: `locale-store.ts`가 상태·영속성·DOM 동기화를 단일 파일에 혼재시켜 SRP를 위반하고, i18n 공개 훅이 특정 Zustand 스토어 구현에 직접 결합되며, `locale-sync.tsx`가 i18n 모듈 경계 안에서 auth 도메인에 의존한다. 기능적 결함은 없으나 이 세 결합이 향후 영속성 전략 교체나 locale 확장 시 변경 비용을 높인다.

### 위험도

**LOW**