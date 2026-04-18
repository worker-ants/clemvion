## 발견사항

---

### **[INFO]** 외부 패키지 추가 없음 — 순수 내부 구현
- 위치: 전체 변경 파일
- 상세: `react-i18next`, `next-intl`, `i18next` 등 외부 i18n 라이브러리를 도입하지 않고 React 18 내장 `useSyncExternalStore`·`useCallback`·`useEffect`와 기존 Zustand로 구현. `package.json` 변경 없어 번들 크기 증가·라이선스 충돌·공급망 위험 없음.
- 제안: 현재 2개 로케일 정적 dict 구조에 적합. 로케일이 3개 이상이거나 동적 로딩이 필요해지면 `next-intl` 마이그레이션 검토.

---

### **[WARNING]** `dict/types.ts`가 여전히 `ko.ts`에 의존 — ko가 스키마 권위로 고정
- 위치: `dict/types.ts:1` — `import type { ko } from "./ko"`
- 상세: `en.ts → ko.ts` 직접 의존은 해소됐지만, `types.ts`가 `ko.ts`의 런타임 값(`typeof ko`)으로 `Dict`를 파생하므로 한국어 딕셔너리가 여전히 스키마 단일 권위다. `ko.ts`에서 키를 추가·삭제하면 TypeScript가 `en.ts`(및 미래 `fr.ts` 등)의 누락을 감지하는 이점은 있지만, `ko.ts` 파일을 삭제하거나 `as const` 구조를 변경하면 `types.ts`·`en.ts`·`core.ts` 전체가 컴파일 오류가 된다. 제3 로케일 추가 시에도 동일하게 `ko.ts` 구조에 종속된다.
- 제안: 수용 가능한 수준. 단, `dict/types.ts` 내 `import type { ko }` 위에 `// ko.ts is the reference shape — all locales must structurally satisfy Dict` 주석을 추가해 의도를 명시할 것.

---

### **[WARNING]** `i18n/locale-sync.tsx` → `auth-store` 도메인 역전 의존성
- 위치: `locale-sync.tsx:4` — `import { useAuthStore } from "@/lib/stores/auth-store"`
- 상세: i18n은 앱 전반이 사용하는 기반(infrastructure) 레이어인데, `auth-store`는 도메인 레이어다. 기반 레이어가 도메인 레이어에 의존하는 방향은 DIP 위반이며, auth 모듈 교체·리팩터링 시 i18n까지 변경이 전파된다. 다만 현재 구조는 `selector` 호출(`s.user?.locale`)에 그치고 domain 데이터를 가공·저장하지 않으므로 즉각적 위험은 낮다.
- 제안: `LocaleSync`를 `src/lib/providers/` 또는 `src/components/layout/`으로 이동하거나, auth store가 locale 동기화 콜백을 주입받는 구조로 역전. 단기적으로는 RESOLUTION.md에 기록된 대로 이월 허용.

---

### **[INFO]** `locale-store` ↔ `i18n` 순환 의존 없음 — 분리 적절
- 위치: `locale-store.ts:3`, `i18n/core.ts`, `i18n/index.ts`
- 상세: `locale-store` → `i18n/types`(타입만), `i18n/index.ts` → `locale-store`(스토어 구독), `core.ts` → store 의존 없음. 순환 없이 단방향 의존이 유지된다. `core.ts`가 store를 임포트하지 않으므로 서버 컴포넌트에서 `translate()`를 안전하게 사용 가능한 구조가 확보됐다.
- 제안: `core.ts` 내에서 실수로 `locale-store`를 임포트하는 사태 방지를 위해 ESLint `no-restricted-imports` 규칙 설정 고려.

---

### **[INFO]** `PathInto<Dict>` 재귀 타입 — 대형 딕셔너리 성능 주의
- 위치: `core.ts:7-13`
- 상세: 현재 딕셔너리 규모(수백 키)에서는 문제없으나, 도메인이 확장되면 TypeScript 재귀 타입 연산량이 기하급수적으로 증가해 IDE 자동완성 지연 및 `Type instantiation is excessively deep` 오류가 발생할 수 있다.
- 제안: 딕셔너리가 현재 대비 2배 이상 확장될 경우 `tsc --diagnostics`로 측정 후 flat key 방식 또는 codegen 방식으로 전환 검토.

---

### **[INFO]** `LOCALES` 배열과 `Locale` 유니온 타입 수동 동기화 필요
- 위치: `types.ts:1-5`
- 상세: `Locale = "ko" | "en"` 유니온과 `LOCALES = ["ko", "en"]` 배열이 별도로 정의되어, 새 로케일 추가 시 두 곳을 모두 수정해야 한다. `type Locale = (typeof LOCALES)[number]` 파생 방식으로 변경하면 `LOCALES`가 단일 소스가 된다.
- 제안: 이월 허용(RESOLUTION.md 참조). 다음 로케일 추가 작업 시 일괄 전환 권장.

---

## 요약

이번 변경은 외부 i18n 라이브러리를 전혀 추가하지 않고 React 18 내장 API와 기존 Zustand만으로 구현해 번들 크기·라이선스·공급망 측면에서 완전히 안전하다. 내부 의존성 관점의 핵심 이슈는 두 가지다: `dict/types.ts`가 `ko.ts` 런타임 값으로 `Dict`를 파생해 한국어 딕셔너리가 스키마 권위로 고정되는 구조(위험도 낮음·허용 가능), `i18n/locale-sync.tsx`가 `auth-store`에 직접 의존하는 레이어 역전(위험도 낮음·장기 이슈). `core.ts`가 store 의존 없이 순수 함수로 분리된 것과 순환 의존성이 없는 점은 긍정적이며, 이전 리뷰에서 지적된 `date.ts` `"use client"` 문제와 `Section void t` dead prop은 이미 조치 완료 상태다.

## 위험도

**LOW**