### 발견사항

- **[INFO]** 새로운 외부 패키지 없음
  - 위치: 전체 변경 파일
  - 상세: `reachable-nodes.ts`, `validate-scope.ts` 모두 외부 import 없는 순수 TypeScript 유틸리티 모듈. 테스트는 기존 `vitest` / `@testing-library/react` 재사용.
  - 제안: 해당 없음

- **[INFO]** 내부 의존성 그래프 — 단방향, 사이클 없음
  - 위치: `use-expression-context.ts → reachable-nodes.ts`, `expression-input.tsx → validate-scope.ts`
  - 상세: 두 신규 모듈은 의존성 리프 노드(incoming 없음). 기존 레이어(hook → util)를 위반하지 않음.
  - 제안: 해당 없음

- **[WARNING]** 모듈 수준 `/g` 정규식의 공유 상태 (`validate-scope.ts`)
  - 위치: `validate-scope.ts:43–47` (`LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`)
  - 상세: `/g` 플래그 정규식은 `lastIndex`를 인스턴스에 기억함. 현재 코드는 `.test()` 호출 후 `lastIndex = 0` 리셋을 수동으로 수행하고 있으나, 리셋 전에 예외가 발생하면 다음 호출에서 잘못된 결과가 나올 수 있음. 멀티스레드 환경은 아니지만 유지보수 중 리셋 누락 리스크 존재.
  - 제안: `String.prototype.matchAll()`처럼 매번 새 인스턴스를 생성하는 방식으로 교체하거나, `LOOP_ROOT_RE.exec()` 루프 대신 `[...block.matchAll(new RegExp(...))]` 패턴 사용.

- **[INFO]** `ExpressionData` 공개 인터페이스 확장 (`index.ts` re-export)
  - 위치: `use-expression-context.ts:34–65`, `index.ts`
  - 상세: `allNodeKeys: Set<string>`과 `containerScope` 두 필드가 추가됨. 기존 소비자 코드에 additive 변경이므로 하위 호환 유지. 단, `ExpressionData`를 직접 구현(mock)하는 테스트 코드는 두 필드를 채워야 함 — `use-expression-suggestions.test.ts`에서 이미 반영 확인.
  - 제안: 해당 없음

### 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않으며**, 신규 코드(`reachable-nodes.ts`, `validate-scope.ts`)가 의존성 최하단 리프 노드로 올바르게 배치되어 순환 의존성·버전 충돌·라이선스 문제가 없다. 유일한 실질적 위험은 `validate-scope.ts`의 모듈 수준 `/g` 정규식 공유 상태로, 현재는 수동 `lastIndex = 0` 리셋으로 회피하고 있으나 장기 유지보수 시 결함 발생 가능성이 있어 리팩터링이 권장된다.

### 위험도

**LOW**