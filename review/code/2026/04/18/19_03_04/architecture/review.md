## 아키텍처 코드 리뷰 — i18n 도입

### 발견사항

---

- **[CRITICAL]** `formatDuration` 함수 중복 구현
  - 위치: `date.ts` vs `execution-status.ts`
  - 상세: 동일한 이름의 `formatDuration`이 두 파일에 독립적으로 구현되어 있으며 동작이 다릅니다. `execution-status.ts`는 소수점 초(`2.5s`)를 표시하고, `date.ts`는 정수 초(`2초`)만 표시합니다. 테스트 파일(`date.test.ts`)도 `formatDuration`을 `date.ts`에서 별도로 import합니다. 두 진실의 원천이 공존하여 호출자가 어느 버전을 사용하는지에 따라 포맷이 달라지는 일관성 문제가 발생합니다.
  - 제안: `date.ts`의 `formatDuration`을 제거하고 `execution-status.ts`의 단일 구현으로 통합하거나, `@/lib/i18n/duration.ts`와 같은 전용 모듈로 분리하여 두 파일이 공유하도록 수정하세요.

---

- **[WARNING]** 유틸리티 모듈에 `"use client"` + Zustand 스토어 직접 의존
  - 위치: `date.ts:1`, `execution-status.ts:1`
  - 상세: 순수해야 할 유틸리티 파일에 `"use client"` 지시자와 `useLocaleStore.getState()` 임포트가 추가되었습니다. 이 파일들은 이제 React 클라이언트 환경에 결합되어 서버 컴포넌트, RSC 렌더링 경로, 또는 Node.js 컨텍스트(예: cron 스크립트, 백엔드 공유 코드)에서 사용할 수 없습니다. 레이어 경계(유틸리티 레이어 → 상태 관리 레이어)가 역전되는 구조입니다.
  - 제안: 유틸리티 함수 시그니처를 `locale` 파라미터 필수화로 변경하고 스토어 접근 제거, 또는 `locale`을 optional로 유지하되 기본값 해석을 호출 측(훅 레이어)에서 담당하도록 설계하세요. 유틸리티 자체는 순수 함수로 유지되어야 합니다.

---

- **[WARNING]** 문서 다국어 frontmatter 구조의 확장성 한계
  - 위치: `registry.ts:DocFrontmatter`, `locale.ts`, MDX 파일 전체
  - 상세: `title_en`, `summary_en` 방식의 플랫 필드 전략은 현재 2개 로케일에서는 작동하지만, 3번째 언어(예: `ja`) 추가 시 `DocFrontmatter` 인터페이스 수정과 모든 MDX 파일 수정이 필요합니다. 로케일별 필드명이 타입 레벨에서 강제되지 않아 누락 시 정적 검증이 되지 않습니다.
  - 제안: `translations?: Partial<Record<Locale, { title: string; summary: string }>>` 구조를 도입하면 새 로케일 추가 시 인터페이스 변경 없이 확장 가능합니다. 단, 현재 2개 로케일이 전체 요구사항이라면 YAGNI 관점에서 현행 유지도 수용 가능합니다.

---

- **[INFO]** `ops.tsx`에서 다수의 분리된 컴포넌트가 각자 `useT()` 호출
  - 위치: `ops.tsx` — `RenameFieldFields`, `RemoveFieldFields`, `SetFieldFields`, `TypeConvertFields`, `StringOpFields`, `MathOpFields`, `DateOpFields`, `ArrayFilterFields`, `ArraySortFields`, `ObjectPickFields`, `ObjectOmitFields` 각각
  - 상세: 11개 함수 컴포넌트가 각자 `useT()`를 호출합니다. `useT`가 안정적인 함수 참조를 반환하는 한 성능 문제는 없지만, `useT` 구현이 변경될 경우 광범위한 영향 범위가 됩니다. 현재 구조는 각 컴포넌트가 독립적으로 사용 가능하다는 설계 의도(SRP)와 일치하므로 허용 가능한 트레이드오프입니다.
  - 제안: 현행 유지 가능. 단, `useT`의 반환값 안정성(memoization)이 보장되는지 i18n 코어 구현에서 확인이 필요합니다.

---

- **[INFO]** `preview.tsx`의 `useMemo` 의존성 배열에 `t` 포함
  - 위치: `preview.tsx` — `[sampleText, t]`, `[input, operations, t]`
  - 상세: `t` 함수가 로케일 변경 시 새 참조를 반환한다면 이 의존성은 정확합니다. 그러나 `t`가 안정적이지 않다면 불필요한 재계산이 발생합니다. 의도는 올바르나 `useT` 구현의 안정성과 결합된 암묵적 계약입니다.

---

### 요약

이번 i18n 도입은 `TranslationKey` 타입 안전성, `satisfies` 제약, `TAB_LABEL_KEYS` 상수 패턴, `locale.ts`와 `registry.ts`의 서버/클라이언트 경계 분리 등 전반적으로 견고한 설계를 보여줍니다. 그러나 핵심 아키텍처 위반이 두 가지 있습니다: `formatDuration`의 이중 구현은 동작 불일치의 실질적 위험을 만들며, 유틸리티 파일(`date.ts`, `execution-status.ts`)에 클라이언트 상태 의존성을 삽입한 것은 레이어 경계를 침범하여 서버 사이드 재사용성을 제거합니다. 나머지 문서 frontmatter 구조 문제는 현재 요구사항 범위라면 수용 가능한 수준입니다.

### 위험도

**MEDIUM**