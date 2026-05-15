### 발견사항

- **[INFO]** `buildDisambiguatedKeys` 내부 패키지 함수 노출
  - 위치: `packages/expression-engine/src/index.ts`
  - 상세: `@workflow/expression-engine` 패키지의 public API에 `buildDisambiguatedKeys`가 추가됨. 순수 내부 로직이지만 프론트엔드(`use-expression-context.ts`)와 백엔드(`expression-resolver.service.ts`) 양쪽에서 공유됨. 이는 올바른 의존성 방향(공유 패키지 → 소비자)을 따름.
  - 제안: 현재 구조 적절. 다만 이 함수가 실행 순서(topological order)에 의존하므로 호출 측이 올바른 순서로 전달하는지 문서화 필요.

- **[INFO]** `Not` 연산자 import 추가 (`typeorm`)
  - 위치: `backend/src/modules/nodes/nodes.service.ts`
  - 상세: 기존 의존성 `typeorm`에서 `Not`을 추가 import. 신규 외부 패키지 없음.
  - 제안: 없음.

- **[INFO]** `ConflictException` import 추가 (`@nestjs/common`)
  - 위치: `backend/src/modules/nodes/nodes.service.ts`
  - 상세: 기존 의존성 `@nestjs/common`에서 추가 import. 신규 외부 패키지 없음.
  - 제안: 없음.

- **[INFO]** `generateUniqueLabel` 프론트엔드 유틸리티 신규 파일
  - 위치: `frontend/src/lib/utils/generate-unique-label.ts`
  - 상세: 외부 의존성 없는 순수 유틸리티 함수. `disambiguate-labels.ts`(`#` 구분자)와 `generate-unique-label.ts`(공백+숫자 구분자)가 유사한 목적으로 분리 존재함. 두 함수의 구분자 형식이 다름(`Label#2` vs `Label 2`).
  - 제안: 두 함수의 역할 차이(실행 컨텍스트 내부용 vs 노드 생성 UI용)가 명확하므로 분리는 합리적. 다만 향후 혼용 위험이 있으므로 주석으로 용도를 명시하는 것이 바람직함.

- **[WARNING]** `useMemo` 내부에서 `useEditorStore.getState()` 직접 호출
  - 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:130`
  - 상세: `useMemo` 훅 내부에서 store를 구독하지 않고 `getState()`로 스냅샷을 직접 읽음. `label` 변경 시 재계산되지만, 다른 노드가 외부에서 변경될 경우 `isDuplicateLabel`이 stale 상태가 될 수 있음. 의존성 관점에서 store와의 결합 방식이 불일치함(나머지 코드는 `useEditorStore(selector)` 훅 사용).
  - 제안: `const nodes = useEditorStore((s) => s.nodes)`를 컴포넌트 상단에서 구독하고 `useMemo`의 deps에 포함시켜 반응성 확보.

- **[INFO]** 테스트 mock 방식 변경 (`importOriginal`)
  - 위치: `frontend/src/components/editor/expression/__tests__/use-expression-context.test.ts`
  - 상세: `@workflow/expression-engine` 모킹 방식을 전체 교체에서 partial mock(`importOriginal` + spread)으로 변경. 이는 `buildDisambiguatedKeys` 실제 구현이 테스트에서도 동작해야 하기 때문. 의존성 테스트 격리 관점에서 실제 구현 포함이 적절한 선택임.
  - 제안: 없음.

---

### 요약

이번 변경은 외부 패키지를 새로 추가하지 않고, 기존 내부 패키지(`@workflow/expression-engine`)의 공유 유틸리티 확장과 기존 외부 패키지(`typeorm`, `@nestjs/common`)의 추가 API 활용으로만 구성되어 있어 의존성 관점의 위험도는 낮다. `buildDisambiguatedKeys`를 공유 패키지에서 export하여 프론트엔드-백엔드 간 로직 중복을 제거한 구조는 올바른 의존성 방향을 따른다. 단, `node-settings-panel.tsx`에서 `useMemo` 내부의 `getState()` 직접 호출은 Zustand store와의 반응성 결합 방식이 불일치하여 stale 데이터 위험이 있으므로 수정이 권장된다.

### 위험도

**LOW**