## 발견사항

### **[WARNING]** `formatDuration` 함수 중복 정의 및 동작 불일치
- **위치**: `date.ts`, `execution-status.ts`
- **상세**: 두 파일 모두 `formatDuration`을 export하지만 로직이 다름. `date.ts`는 `Math.floor` (정수 초), `execution-status.ts`는 `Number(seconds.toFixed(1))` (소수점 1자리). `date.test.ts`와 `execution-status.test.ts` 모두 각각 import하여 테스트하지만, 사용처가 이 두 버전을 혼용할 경우 표시 결과가 달라짐.
- **제안**: 두 함수의 역할 차이를 명시하거나, 하나로 통합하여 단일 구현을 사용할 것.

---

### **[WARNING]** `date.test.ts` — 스토어 locale 가정이 암묵적
- **위치**: `date.test.ts:89` ("uses locale defaults from the store when no locale is passed")
- **상세**: 테스트 주석에 "Store default is 'ko' in tests"라고 명시하지만, `beforeEach`에서 `useLocaleStore.setState({ locale: "ko" })`를 호출하지 않음. 다른 테스트 파일에서 store를 변경할 경우 해당 테스트가 flaky해질 수 있음.
- **제안**:
  ```ts
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  ```

---

### **[WARNING]** 신규 컴포넌트에 대한 테스트 누락

- **위치**: 여러 파일
- **상세**: 이번 변경에서 새로 추출되었거나 i18n을 적용한 컴포넌트들에 대한 테스트가 없음.

  | 컴포넌트/모듈 | 주요 변경 | 테스트 상태 |
  |---|---|---|
  | `TabButton` (`node-settings-panel.tsx`) | 새 컴포넌트 추출 + `useT()` | ❌ 없음 |
  | `DocBodyNotice` | 신규 컴포넌트 | ❌ 없음 |
  | `DocHeader` | 신규 컴포넌트 | ❌ 없음 |
  | `locale.ts` (docs) | `localizedTitle`, `localizedSummary`, `localizedSectionLabel` 신규 | ❌ 없음 |
  | `ManualTriggerConfig` | 대량 i18n 변경 | ❌ 없음 |
  | `ChipInput` | aria-label, placeholder i18n 변경 | ❌ 없음 |

- **제안**: 최소한 `locale.ts`의 순수 함수들(`localizedTitle`, `localizedSummary`, `localizedSectionLabel`)과 `DocBodyNotice` (locale 조건부 렌더링)는 단위 테스트를 추가할 것.

---

### **[WARNING]** `preview.tsx` — `useMemo` 의존성에 `t` 추가 미검증
- **위치**: `preview.tsx:64`, `preview.tsx:82`
- **상세**: `t` 함수를 `useMemo` 의존성에 추가했으나, `useT()`가 locale 변경 시 새 참조를 반환하는지 테스트가 없음. `t`가 안정적인 참조가 아니라면 불필요한 재계산 발생 가능.
- **제안**: `useT()` 훅이 `useCallback`/`useMemo`로 안정화된 함수를 반환하는지 확인하는 테스트를 `i18n.test.ts`에 추가.

---

### **[WARNING]** `execution-status.test.ts` — `formatDuration` 동작 변경 검증 불완전
- **위치**: `execution-status.test.ts:54`
- **상세**: `formatDuration(1000, "en")`의 기대값이 `"1.0s"` → `"1s"`로 변경됨. 이는 `Number(seconds.toFixed(1))` → `1`이 되기 때문인데, `2500ms` → `2.5s`는 여전히 소수점을 포함. 정수/소수 경계 케이스(`1000ms`, `2000ms`, `1500ms`)에 대한 테스트가 부족함.
- **제안**:
  ```ts
  expect(formatDuration(1000, "en")).toBe("1s");   // 정수
  expect(formatDuration(1500, "en")).toBe("1.5s"); // 소수
  expect(formatDuration(2000, "en")).toBe("2s");   // 정수
  ```

---

### **[INFO]** `"use client"` 추가로 인한 서버 컴포넌트 사용 제한
- **위치**: `date.ts:1`, `execution-status.ts:1`
- **상세**: 두 유틸리티 파일에 `"use client"` 지시어가 추가됨. 기존에 서버 컴포넌트에서 이 함수들을 사용하던 경우 빌드 에러가 발생할 수 있음. 현재 테스트에서는 이 경계가 검증되지 않음.
- **제안**: CI 빌드에서 이 유틸리티를 import하는 서버 컴포넌트가 없는지 확인. Next.js `build` 출력에서 에러 여부 검토.

---

### **[INFO]** 버전 히스토리 테스트 — locale store 복원 없음
- **위치**: 4개의 version-history 테스트 파일
- **상세**: `beforeEach`에서 `useLocaleStore.setState({ locale: "en" })`를 설정하지만 `afterEach`에서 이전 상태로 복원하지 않음. Zustand는 모듈 레벨 싱글톤이므로 테스트 간 오염 가능성이 있음. 단, vitest의 기본 test isolation 설정에 따라 문제가 없을 수 있음.
- **제안**: 문제가 없더라도 명시적으로 `afterEach(() => useLocaleStore.setState({ locale: "ko" }))` 추가를 권장.

---

### **[INFO]** `i18n.test.ts` — 영어 복수 interpolation 테스트 부족
- **위치**: `i18n.test.ts`
- **상세**: `translate("en", "time.minutesAgo", { minutes: 5 })`은 테스트하지만, `translate("en", "time.minutesSeconds", { minutes: 3, seconds: 10 })`는 영어 locale로 테스트하지 않음. 한국어 interpolation 다중 파라미터만 테스트됨.
- **제안**: 영어 다중 파라미터 interpolation 테스트 추가.

---

## 요약

전반적으로 i18n 도입에 맞춰 기존 테스트를 locale-aware하게 업데이트하고, 핵심 `translate()` 함수에 대한 단위 테스트를 충실히 추가한 점은 긍정적입니다. 그러나 `formatDuration`의 중복 구현과 동작 불일치, `date.test.ts`의 암묵적 store 상태 의존, 그리고 신규 추출 컴포넌트(`TabButton`, `DocBodyNotice`, `DocHeader`)와 순수 함수(`locale.ts`)에 대한 테스트 누락이 주요 개선 과제입니다. 특히 `locale.ts`의 `localizedTitle`/`localizedSummary`는 순수 함수로 쉽게 테스트 가능하므로 테스트를 추가할 것을 강력히 권장합니다.

## 위험도

**MEDIUM**