### 발견사항

---

**[WARNING]** `i18n/locale-sync.tsx`가 `auth-store`에 직접 의존 — 레이어 경계 위반
- **위치**: `locale-sync.tsx:4` — `import { useAuthStore } from "@/lib/stores/auth-store"`
- **상세**: `locale-sync.tsx`는 `src/lib/i18n/` 디렉터리 내에 위치하지만 `auth` 도메인 스토어를 직접 임포트한다. i18n 모듈이 auth 모듈에 결합되어 단방향 의존성이 성립하지 않는 상황이다. 향후 i18n을 별도 패키지로 분리하거나, `auth-store`의 인터페이스/경로가 변경될 경우 이 결합 지점에서 파급이 발생한다. 또한 `locale-sync.tsx`를 테스트할 때 반드시 `auth-store`를 함께 setup해야 하는 테스트 부담도 생긴다.
- **제안**: `LocaleSync`를 i18n 모듈 외부(`src/components/` 또는 `src/providers/`)로 이동시켜 i18n 내부가 auth에 의존하지 않도록 분리하거나, prop/context로 `userLocale`을 주입받는 방식으로 의존 방향을 역전시킬 것.

---

**[INFO]** `locale-store.ts` ↔ `i18n/index.ts` 간 단방향 의존 체인 — 레이어 모호성
- **위치**: `locale-store.ts:4`, `i18n/index.ts:4`
- **상세**: `locale-store.ts`가 `@/lib/i18n/types`를 임포트하고, `i18n/index.ts`가 다시 `@/lib/stores/locale-store`를 임포트한다. 완전한 순환 의존은 아니다(`core.ts`는 `locale-store`를 임포트하지 않음). 그러나 i18n 타입 → store → i18n hook 방향의 체인이 형성되어, store 레이어와 i18n 레이어의 경계가 불명확하다. 번들러의 tree-shaking에 영향을 줄 수 있고, 레이어 분리 리팩토링 시 꼬임이 발생할 수 있다.
- **제안**: `Locale` 타입과 `isLocale()` 가드를 `@/lib/i18n/types`가 아닌 `@/lib/locale` 또는 `@/lib/types/locale`처럼 i18n/store 양쪽이 공통으로 의존하는 neutral 위치로 이동하는 방안 검토.

---

**[INFO]** `dict/types.ts`가 `typeof ko`를 기반으로 `Dict` 타입 도출 — `ko.ts`가 구조 기준점으로 고정
- **위치**: `dict/types.ts:1`, `dict/types.ts:14` — `export type Dict = WidenString<typeof ko>`
- **상세**: `en.ts`는 `ko.ts`의 구조에서 파생된 `Dict` 타입을 만족해야 한다. 즉 `ko.ts`의 키 추가/삭제가 `en.ts`의 컴파일 타임 의무를 자동으로 변경한다. 이 패턴 자체는 견고하나, `ko.ts`가 런타임 의존뿐 아니라 타입 수준에서도 참조 딕셔너리 역할을 겸한다는 사실이 명시적으로 문서화되어 있지 않다.
- **제안**: `dict/types.ts` 상단에 한 줄 주석(`// ko.ts is the reference shape; all other locales must satisfy Dict`)을 추가하여 의존 이유를 명시.

---

**[INFO]** `useSyncExternalStore`로 Zustand 구독 — Zustand selector API 우회
- **위치**: `i18n/index.ts:18-22`
- **상세**: `useLocaleStore.subscribe`와 `useLocaleStore.getState`를 직접 사용해 `useSyncExternalStore`에 연결한다. Zustand 5의 공개 API(`useLocaleStore(s => s.locale)`)를 우회하지만, SSR 서버 스냅샷 지원(`getServerSnapshot`)을 명시적으로 제공하기 위한 의도적 선택으로 정당하다. Zustand 5.x의 `subscribe`/`getState`는 안정적 공개 API이므로 버전 호환성 위험은 낮다.
- **제안**: 없음. 의도적 패턴이며 현재 구조에서 올바른 선택.

---

**[INFO]** 신규 외부 패키지 추가 없음 — 번들 영향 없음
- **위치**: `package.json` 전체
- **상세**: i18n 전체 구현(`core.ts`, `index.ts`, `locale-store.ts`, `locale-sync.tsx`, 딕셔너리, 타입)이 이미 프로젝트에 존재하는 `react`와 `zustand`만 사용한다. 새 외부 의존성이 없으므로 라이선스, 취약점, 번들 크기 측면에서 추가 위험이 없다.

---

### 요약

이번 i18n 구현은 신규 외부 패키지 없이 기존 `react`와 `zustand`만으로 완성되어 의존성 관점의 위험도는 전반적으로 낮다. 주요 지적 사항은 `locale-sync.tsx`가 i18n 모듈 내부에 위치하면서 `auth-store`에 직접 의존하는 레이어 경계 위반으로, i18n 모듈의 독립성을 해치고 테스트 setup 부담을 증가시킨다. 그 외 `locale-store` ↔ `i18n/index.ts` 간 의존 체인은 순환이 아니나 레이어 경계가 모호하며, `Dict` 타입이 `ko.ts`를 암묵적 기준 딕셔너리로 고정하는 구조는 문서화가 부족하다.

### 위험도
**LOW**