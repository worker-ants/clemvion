## 발견사항

### **[INFO]** 외부 패키지 추가 없음 — 기존 의존성(React + Zustand)만 사용
- 위치: 전체 파일
- 상세: `react-i18next`, `next-intl` 등 외부 i18n 라이브러리를 도입하지 않고 `useSyncExternalStore`(React 18 내장) + Zustand(기존)로 구현. `package.json` 변경 없음.
- 제안: 현재 2개 로케일 정적 dict 구조에는 적합. 로케일이 3개 이상이거나 동적 로딩이 필요해지면 `next-intl` 마이그레이션 검토.

---

### **[WARNING]** `en.ts`가 `ko.ts`에서 `Dict` 타입을 임포트 — 한국어 딕셔너리가 스키마 권위
- 위치: `dict/en.ts:1` — `import type { Dict } from "./ko"`
- 상세: 영어 딕셔너리가 한국어 딕셔너리의 `Dict` 타입에 의존하여 `ko.ts`가 스키마 정의의 단일 출처가 됨. `ko.ts`에 키를 추가하면 TypeScript가 `en.ts` 누락을 감지하므로 타입 안전성은 확보됨. 그러나 의존 방향이 `en → ko`이므로 `ko.ts`를 실수로 삭제하거나 구조를 바꾸면 영어 딕셔너리 전체가 컴파일 오류가 됨. 또한 제3 로케일(`fr.ts` 등) 추가 시 동일하게 `ko.ts` 타입에 의존해야 하는 구조적 제약이 생김.
- 제안: `Dict` 타입을 `dict/types.ts` 또는 `i18n/dict-type.ts` 같은 별도 파일로 분리하여 `ko.ts`와 `en.ts` 모두 해당 파일에서 임포트하도록 구조 변경. `ko.ts`는 `WidenString<typeof ko>`만 export.

---

### **[WARNING]** `PathInto<Dict>` 재귀 타입이 대형 딕셔너리에서 TypeScript 성능 저하 유발 가능
- 위치: `core.ts:7-13` — `PathInto<T>` 재귀 타입, `TranslationKey = PathInto<Dict>`
- 상세: 현재 딕셔너리는 수백 개의 중첩 키를 포함하며, `PathInto<Dict>`는 모든 가능한 점 경로(dot-path)의 유니언 타입을 재귀적으로 생성함. 딕셔너리 규모가 커질수록 타입 인스턴스화 수가 기하급수적으로 증가하여 IDE 자동완성 지연 및 `tsc` 컴파일 속도 저하로 이어질 수 있음. TypeScript의 재귀 타입에는 깊이 제한이 있어 일정 규모 이상에서는 `Type instantiation is excessively deep` 오류가 발생할 수 있음.
- 제안: 단기적으로는 현재 규모에서 문제없이 동작하므로 유지 가능. 딕셔너리 크기가 2배 이상 확장될 경우 `tsc --diagnostics`로 타입 체크 성능 측정 필요. 근본 해결책은 flat key 방식(`"auth.login.title"` 문자열 리터럴 직접 정의) 또는 코드 생성(codegen) 방식.

---

### **[INFO]** `locale-store.ts` → `i18n/types`, `i18n/index.ts` → `locale-store` 의존 방향 교차 — 순환 없음 확인됨
- 위치: `locale-store.ts:3`, `i18n/index.ts:3`
- 상세: `locale-store` → `i18n/types`(타입만), `i18n/index.ts` → `locale-store`(스토어). `i18n/core.ts`는 `locale-store`를 임포트하지 않으므로 순환 의존성은 없음. `core.ts` 분리로 서버 컴포넌트에서 `translate()`를 안전하게 사용할 수 있는 구조가 확보됨.
- 제안: 현재 구조 유지. 단, `core.ts` 내부에서 실수로 `locale-store`를 임포트하는 사태를 방지하기 위해 ESLint `no-restricted-imports` 규칙 설정을 고려.

---

### **[INFO]** `useSyncExternalStore` React 18 이상 요구
- 위치: `i18n/index.ts:3`
- 상세: `useSyncExternalStore`는 React 18에서 안정화된 API. 프로젝트가 React 18+ 환경이면 문제 없음.
- 제안: `package.json`의 `"react"` 버전 범위를 `>=18`로 명시하여 의도를 문서화.

---

## 요약

이번 i18n 구현은 외부 라이브러리를 추가하지 않고 React 내장 API와 기존 Zustand로 경량 구현하여 번들 크기 측면에서 우수하다. `core.ts` 분리로 `"use client"` 경계가 명확해졌고, `locale-store` ↔ `i18n` 간 순환 의존성도 없다. 가장 주목할 의존성 구조 문제는 **`en.ts`가 `ko.ts`에서 `Dict` 타입을 직접 임포트**하는 것으로, `ko.ts`가 스키마 권위가 되는 구조적 결합이 생긴다. 또한 **`PathInto<Dict>` 재귀 타입**은 딕셔너리가 현재보다 대폭 확장될 경우 TypeScript 컴파일 성능에 영향을 줄 수 있어 모니터링이 필요하다. 전반적으로 현재 규모에서는 안전하며 실질적 위험도는 낮다.

## 위험도
**LOW**