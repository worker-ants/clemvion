## 의존성 코드 리뷰

### 발견사항

---

**[WARNING] `DATE_UNITS` 상수 중복 선언**
- 위치: `src/lib/transform/apply-operation.ts:11-18`
- 상세: `DATE_UNITS`가 `@/types/transform`에 이미 export되어 있음에도, `apply-operation.ts`에서 동일한 내용으로 재선언됨. 두 배열의 내용은 현재 동일하지만, 타입 정의와 구현이 각자 독립적으로 관리되어 향후 불일치 위험이 있음.
- 제안: `apply-operation.ts`의 로컬 `DATE_UNITS`를 제거하고 `import { DATE_UNITS } from "@/types/transform"`으로 교체

---

**[WARNING] `dayjs/plugin/customParseFormat` 미사용 임포트**
- 위치: `src/lib/transform/apply-operation.ts:2,10`
- 상세: `customParseFormat` 플러그인이 `extend`로 등록되어 있으나, 코드 내 모든 `dayjs()` 호출은 ISO 8601 또는 Unix timestamp 형식만 사용하며 커스텀 파싱 포맷 기능을 실제로 사용하지 않음. 플러그인은 번들 크기를 불필요하게 증가시킴.
- 제안: 커스텀 포맷 파싱이 실제로 필요한 경우가 없다면 두 줄 모두 제거

---

**[INFO] `@dnd-kit` 3개 패키지 도입**
- 위치: `src/components/editor/settings-panel/node-configs/transform/index.tsx`, `operation-card.tsx`
- 상세: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 3개 패키지가 추가됨. 합산 번들 크기 약 35~45KB(minified). 단순 수직 정렬(vertical sort)에 사용되지만, 접근성(a11y) 지원과 터치 지원을 제공하는 표준 선택으로 적절함. MIT 라이선스 ✓
- 제안: 현재 사용 방식은 적절. 단, `PointerSensor`와 `KeyboardSensor` 모두 등록되어 있어 접근성이 확보되어 있음을 확인.

---

**[INFO] `dayjs` 신규 도입**
- 위치: `src/lib/transform/apply-operation.ts`
- 상세: 날짜 포맷·연산·차이 계산을 위해 dayjs(~17KB minified) 추가. Moment.js 대비 경량이며 MIT 라이선스 ✓. 알려진 취약점 없음.
- 제안: 문제 없음. 단, `customParseFormat` 플러그인은 위에서 언급한 대로 제거 검토.

---

**[INFO] `preview.tsx`가 실행 스토어에 직접 의존**
- 위치: `src/components/editor/settings-panel/node-configs/transform/preview.tsx:4-5`
- 상세: Transform 설정 패널 내부 컴포넌트가 `useEditorStore`, `useExecutionStore`를 직접 import. 설정 패널 컴포넌트가 실행 상태에 결합되어 테스트 격리가 어려워짐.
- 제안: 재사용성·테스트 용이성 측면에서 `latestInput`을 prop으로 받는 구조가 더 적합하나, 현재 사용 범위에서는 허용 가능한 설계.

---

### 요약

신규 외부 의존성(`dayjs`, `@dnd-kit/*`)은 기능에 적합하고 라이선스·보안 측면에서 문제가 없다. 주요 위험은 내부 구조에 있다: `DATE_UNITS`가 `@/types/transform`과 `apply-operation.ts`에 이중 선언되어 있어 타입 정의와 구현 간 불일치가 발생할 수 있으며, `customParseFormat` 플러그인이 불필요하게 포함되어 있다. 두 가지 모두 즉시 수정이 필요한 Warning 수준의 이슈다.

### 위험도
**LOW**