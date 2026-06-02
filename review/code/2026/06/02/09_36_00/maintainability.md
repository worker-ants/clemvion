# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] evaluator.ts — 조건부 spread 대신 직접 할당이 더 명확
- 위치: `/codebase/packages/graph-warning-rules/src/evaluator.ts` — `...(triggered.params ? { params: triggered.params } : {})`
- 상세: `params` 가 optional 필드이므로 `params: triggered.params` 직접 할당(undefined 포함)이 동일 동작을 하며 더 읽기 쉽다. 현재 방식은 의도를 파악하는 데 불필요한 인지 부담을 준다.
- 제안: `params: triggered.params ?? undefined` 또는 타입이 허용한다면 `params: triggered.params` 로 단순화.

### [INFO] editor-toolbar.tsx — JSX `title` 속성에 IIFE 사용
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L1399-1406 — `title={(() => { ... })()}`
- 상세: JSX 속성 안에서 IIFE(`(() => { ... })()`)를 사용하면 렌더링마다 함수 객체를 생성하고, 로직이 JSX 마크업에 섞여 가독성을 해친다. 기존 `useMemo` / `useCallback` 패턴과 일관성이 없다.
- 제안: `useMemo`로 추출하거나 렌더 함수 본문에서 변수로 선언. 예:
  ```ts
  const saveButtonTitle = useMemo(() => {
    if (!graphWarnings.hasError) return undefined;
    const err = graphWarnings.results.find((r) => r.severity === "error");
    return err ? translateGraphWarning(err, locale) : undefined;
  }, [graphWarnings, locale]);
  ```

### [INFO] custom-node.tsx — 대형 컴포넌트에서 책임 집중
- 위치: `/codebase/frontend/src/components/editor/canvas/custom-node.tsx` — 전체 컴포넌트 약 370라인
- 상세: 이번 변경은 `graphWarningMessage` 계산 로직의 이동으로 소규모이며 기존 크기 문제를 악화시키지 않는다. 그러나 `useMemo` 블록이 7개 이상이고 JSX가 200라인을 넘는 구조는 향후 수정 시 인지 부담이 크다. 이번 변경 자체는 패턴에 부합한다.
- 제안: 이번 변경 범위에서는 수정 불필요. 추후 리팩토링 기회에 포트 렌더링, 배지 렌더링 등을 하위 컴포넌트로 분리 고려.

### [INFO] backend-labels.ts — `translateBackendError` 가 현재 사용처 없음
- 위치: `/codebase/frontend/src/lib/i18n/backend-labels.ts` — `translateBackendError` 함수
- 상세: plan 문서에 "저장 버튼은 `hasError` 시 local 평가로 이미 차단되어 title 은 `translateGraphWarning` 으로 rule 메시지 직접 표시"라고 명시되어 있어 `translateBackendError` 의 실제 호출 지점이 현재 코드에 없다. API 400 경로 대응을 위해 준비된 함수이나 현재 미사용 상태다.
- 제안: 해당 함수가 실제로 호출되지 않는다면 dead code 위험. 사용 예정이면 TODO 주석을 추가하거나 실제 호출 지점이 포함된 후속 PR에서 함께 추가.

### [INFO] parallel.ts — `buildNodeIndex` 가 각 rule의 `evaluate` 호출마다 재구축됨
- 위치: `/codebase/packages/graph-warning-rules/src/rules/parallel.ts` — `parallelNestedDepthExceededRule.evaluate` 와 `parallelNestedConcurrencyCapRule.evaluate` 각각에서 `buildNodeIndex(graph)` 호출
- 상세: 이번 변경과 직접 관련은 없으나, 두 rule 이 같은 graph 를 받아 각자 `buildNodeIndex`를 호출한다. 동일 graph 에서 두 rule 이 연속 실행되면 인덱스가 두 번 구축된다. evaluator 레벨에서 인덱스를 공유하면 성능과 유지보수성이 개선된다.
- 제안: 이번 변경 범위에서는 수정 불필요. 추후 `evaluate` 시그니처에 캐시/context 파라미터 추가 고려.

### [INFO] backend-labels.test.ts — `LOCALIZED_ERROR_CODES` 인라인 배열이 단일 진실 위반 가능성
- 위치: `/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` L2471 — `const LOCALIZED_ERROR_CODES = ["GRAPH_VALIDATION_FAILED"];`
- 상세: 이 배열은 수동으로 관리되어야 하며 새로운 user-facing error 코드가 추가될 때 이 파일도 함께 업데이트해야 한다는 것을 개발자가 알아야 한다. 주석으로 업데이트 의무를 이미 명시했으나, 코드상으로 해당 배열이 어디서 파생되어야 하는지(예: `ERROR_KO` 의 키 목록) 불명확하다.
- 제안: 현재 수준은 허용 가능. 코드 규모가 커지면 `Object.keys(ERROR_KO)` 를 직접 순회하는 형태로 전환해 동기화 부담 제거 고려.

### [INFO] no-internal-refs.test.ts — 정규식의 alternation 순서 고려
- 위치: `/codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L2019-2021
- 상세: `GRAPH_WARNING_KO` 가 `WARNING_KO` 보다 먼저 나와야 한다. 현재 순서는 `ERROR_KO|GRAPH_WARNING_KO|WARNING_KO` 로 `GRAPH_WARNING_KO` 가 `WARNING_KO` 앞에 있어 올바르다. 변경은 정확히 적절한 위치에 삽입되었다.
- 제안: 현재 상태 양호.

## 요약

이번 변경은 i18n Principle 3-C 구현을 위해 `params` 필드를 shared 타입 계약에 추가하고 frontend 번역 함수 2개(`translateBackendError`, `translateGraphWarning`)를 신설하는 일관된 패턴의 변경이다. 타입 확장(`optional`)으로 하위호환성을 유지하고, 자동 가드 테스트(P3-C-1/P3-C-2)와 문서가 함께 추가되어 규약 이탈을 기계적으로 차단하는 구조는 유지보수성 측면에서 긍정적이다. 주요 우려는 `editor-toolbar.tsx` 의 JSX `title` IIFE 패턴으로, 기존 `useMemo` 컨벤션과 일관되지 않는다. `translateBackendError` 가 현재 호출 지점 없이 export 된 점도 향후 추적성을 위해 명시가 필요하다. 전반적인 코드 구조와 네이밍은 코드베이스 기존 패턴과 일관적이다.

## 위험도

LOW
