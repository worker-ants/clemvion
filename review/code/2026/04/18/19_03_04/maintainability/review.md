## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** `"use client"` 지시어 추가로 유틸리티 함수의 서버 사용 가능성 차단
  - 위치: `frontend/src/lib/utils/date.ts:1`, `frontend/src/lib/utils/execution-status.ts:1`
  - 상세: `date.ts`와 `execution-status.ts` 모두 최상단에 `"use client"` 지시어를 추가했습니다. 이 파일들은 순수 유틸리티 함수를 제공하는 모듈인데, `useLocaleStore.getState()` 호출을 위해 브라우저 전용으로 강제됩니다. 이후 서버 컴포넌트나 서버 액션에서 `formatDate`, `timeAgo` 등을 임포트하면 런타임 오류가 발생합니다.
  - 제안: `currentLocale()` 헬퍼 및 스토어 임포트를 별도 파일로 분리하거나, 유틸리티 함수들이 항상 명시적인 `locale` 인자를 받도록 강제하여 스토어 직접 접근을 제거하세요.

---

- **[WARNING]** `formatDuration` 구현 이중화
  - 위치: `frontend/src/lib/utils/date.ts:formatDuration`, `frontend/src/lib/utils/execution-status.ts:formatDuration`
  - 상세: 동일한 이름과 유사한 로직을 가진 `formatDuration`이 두 파일에 독립적으로 존재합니다. `date.ts`는 정수 초(`5s`), `execution-status.ts`는 소수점 1자리 초(`2.5s`)를 반환하는 미묘한 차이가 있습니다. 또한 `date.test.ts`의 `formatDuration` 테스트가 스토어 기본값(`ko`)에 암묵적으로 의존하는 테스트 케이스를 포함하고 있어 나중에 기본 로케일이 바뀌면 조용히 깨집니다.
  - 제안: `date.ts`의 `formatDuration`을 `execution-status.ts`로 통합하거나 공유 i18n 유틸 모듈 하나로 단일화하고, 스토어 기본값에 의존하는 테스트는 `useLocaleStore.setState({ locale: "ko" })`를 명시적으로 설정하도록 수정하세요.

---

- **[WARNING]** `execution-status.ts` — `formatDuration` 동작 변경이 API 계약 파손
  - 위치: `frontend/src/lib/utils/execution-status.ts:formatDuration`, 테스트 `execution-status.test.ts:53`
  - 상세: 기존 `formatDuration(1000)` 결과가 `"1.0s"`였으나 이제 `"1s"`로 변경됩니다. 테스트가 갱신되었지만, 이 함수를 직접 참조하는 다른 컴포넌트나 스냅샷 테스트가 있다면 표시 결과가 달라집니다. 변경 사유가 코드에 드러나지 않습니다.
  - 제안: 변경 의도(소수점 제거)를 커밋 메시지 또는 PR 설명에 명시하고, 영향받는 컴포넌트를 전수 확인하세요.

---

- **[INFO]** `ops.tsx` — 다수의 소형 컴포넌트가 각각 `const t = useT()`를 중복 호출
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/transform/ops.tsx`
  - 상세: `RenameFieldFields`, `RemoveFieldFields`, `SetFieldFields`, `TypeConvertFields`, `StringOpFields`, `MathOpFields`, `DateOpFields`, `ArrayFilterFields`, `ArraySortFields`, `ObjectPickFields`, `ObjectOmitFields` — 11개 컴포넌트가 모두 동일한 패턴으로 `useT()`를 호출합니다. 현재 구조상 불가피하지만, 향후 컴포넌트가 더 늘어날 경우 보일러플레이트가 누적됩니다.
  - 제안: 단기적으로는 현 구조 유지가 적절합니다. 컴포넌트 수가 더 늘어날 경우 `FieldLabel`을 i18n-aware하게 만들거나 context를 통해 `t`를 공유하는 방안을 검토할 수 있습니다.

---

- **[INFO]** `TabButton` 컴포넌트 분리 — 훅 규칙 준수를 위한 필수적 리팩터링
  - 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:99-121`
  - 상세: `.map()` 콜백 내에서 `useT()`를 직접 호출할 수 없기 때문에 `TabButton` 컴포넌트로 분리한 것은 올바른 접근입니다. 다만, `TAB_LABEL_KEYS` 상수가 파일 모듈 스코프에 정의되어 있으나 오직 `TabButton` 내부에서만 사용됩니다. 응집도 측면에서 관계가 덜 명확합니다.
  - 제안: `TAB_LABEL_KEYS`를 `TabButton` 함수 내부에 인라인하거나 같은 위치에 두어 사용 맥락을 명확히 하는 것을 고려해 보세요.

---

- **[INFO]** `preview.tsx` — `t` 함수가 `useMemo` 의존성 배열에 올바르게 추가됨
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/transform/preview.tsx`
  - 상세: `t` 함수를 `useMemo` 의존성에 추가한 것은 ESLint `exhaustive-deps` 규칙 준수를 위한 올바른 처리입니다. Zustand 기반의 `useT()` 구현이 로케일 변경 시에만 새 레퍼런스를 반환한다면 불필요한 메모 재계산은 발생하지 않습니다.
  - 제안: `useT()`가 안정적인 레퍼런스(`useCallback` 래핑 등)를 반환하는지 i18n 코어 구현을 확인하세요. 그렇지 않으면 불필요한 재렌더링이 발생할 수 있습니다.

---

- **[INFO]** `operation-card.tsx` — 변수 새도잉 해소를 위한 `t` → `m` 이름 변경
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/transform/operation-card.tsx:47, 103`
  - 상세: `useT()` 도입으로 기존 `.find(t => ...)`, `.map(t => ...)` 패턴에서 `t`가 번역 함수와 충돌하게 되어 `m`으로 변경한 것은 적절한 처리입니다. 단, `m`이 "meta"의 축약임을 직관적으로 파악하기 어렵습니다.
  - 제안: 의미를 명확히 하려면 `m` 대신 `opType`이나 `entry`처럼 용도를 나타내는 이름을 사용하는 것이 더 읽기 쉽습니다.

---

### 요약

이번 변경은 프론트엔드 전반에 걸친 체계적인 i18n 도입으로, 패턴 일관성과 타입 안전성(TranslationKey, satisfies 연산자 활용) 측면에서 전반적으로 잘 설계되어 있습니다. 가장 중요한 유지보수성 위험은 순수 유틸리티 모듈(`date.ts`, `execution-status.ts`)에 `"use client"` 지시어를 추가하여 서버 환경에서의 재사용 가능성을 차단한 점과, `formatDuration`이 두 곳에 이중 구현된 점입니다. 나머지 사항들은 React 훅 규칙 준수를 위한 불가피한 구조적 선택이거나 소규모 명명 개선 여지로, 전체적인 코드 품질을 저해하지는 않습니다.

### 위험도

**MEDIUM**