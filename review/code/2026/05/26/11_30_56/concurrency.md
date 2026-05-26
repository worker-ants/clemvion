# 동시성(Concurrency) 리뷰

리뷰 대상: LLM 설정 / 임베딩 모델 select-only 전환 (llm-model-select)
분석 일시: 2026-05-26

---

## 발견사항

### [INFO] `embedding-model-combobox.tsx` — stale closure 가드의 범위 제한

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` `onSuccess` 콜백 (라인 387~391)
- 상세: `onSuccess` 에서 `snapshot !== effectiveConfigId` 비교로 stale 응답을 필터링하고 있다. 이 패턴 자체는 올바르나, `effectiveConfigId` 는 `llmConfigId ?? defaultConfigId` 로 결정된다. 만약 `llmConfigId` 가 `undefined` 인 상태에서 요청이 출발한 뒤, `useQuery` 가 `defaultConfigId` 를 새로 resolve 하여 `effectiveConfigId` 값이 변경된다면 snapshot 비교가 다른 ID 를 비교하게 된다. 실제로 stale 응답을 무시하는 방향으로 동작하므로 안전한 실패이지만, 예상치 못한 "응답은 도착했으나 화면에 반영되지 않는" 현상이 발생할 수 있다.
- 제안: 동작상 안전한 수준이므로 즉시 변경이 필수는 아니다. 명확성을 높이려면 mutation 실행 시점의 `effectiveConfigId` 전체 값을 snapshot 에 포함시키면 된다 — 현재 코드는 이미 `const snapshot = effectiveConfigId` 로 캡처하고 있으므로 구조적으로는 문제 없다. INFO 등급.

---

### [INFO] `use-model-loader.ts` — 연속 클릭 시 in-flight 요청 취소 없음

- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` `load` 함수 (라인 139)
- 상세: 버튼의 `disabled` 조건이 `loadMutation.isPending` 을 포함하므로 pending 중에는 버튼이 비활성화된다. 그러나 `loadMutation.isPending` 상태가 React 렌더 사이클 지연 등으로 일시적으로 반영되지 않은 시점에 사용자가 빠르게 두 번 클릭하면 두 개의 요청이 동시에 in-flight 할 수 있다. TanStack Query `useMutation` 은 별도 de-duplication 을 제공하지 않으므로, 두 번째 응답이 첫 번째보다 늦게 도착하면 snapshot 가드(provider/configId 동일) 통과 후 최종 state 를 덮어쓰게 된다. 실제 UX 영향은 미미하지만 경쟁 조건의 가능성은 존재한다.
- 제안: `disabled` 조건에 이미 `isPending` 이 포함되어 있어 대부분의 경우 방어된다. 더 엄격하게 하려면 `mutateAsync` 대신 상위에서 `AbortController` 를 사용하거나, 버튼 클릭 핸들러에서 `loadMutation.isPending` 을 다시 확인하는 guard 를 추가할 수 있다. INFO 등급.

---

### [INFO] `embedding-model-combobox.tsx` — render 중 setState 호출 패턴

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 라인 363~367 (prevResetKey 비교 블록)
- 상세: React 공식 문서가 권장하는 "render 중 setState" 패턴을 사용하고 있으며, `use-model-loader.ts` 에도 동일한 패턴이 적용되어 있다. 이 패턴은 React 가 현재 render 를 중단하고 즉시 re-render 를 트리거하므로 이론적으로 concurrent mode 에서 두 번의 render 가 발생한다. React 18+ concurrent features(Suspense, `startTransition`)와 함께 사용될 경우 예상치 못한 render 순서나 state tearing 이 발생할 가능성이 있다. 현재 코드베이스에서 concurrent mode 를 적극적으로 사용하지 않는 한 실제 문제로 이어지지 않는다.
- 제안: 현재 사용 범위에서는 안전하다. 장기적으로 concurrent mode feature 를 도입할 때 이 패턴을 `key` prop 기반 완전 remount 방식으로 교체하는 것을 검토할 수 있다. INFO 등급.

---

## 요약

이번 변경은 React 단일 스레드 이벤트 루프 환경에서 동작하는 프론트엔드 컴포넌트이므로 멀티스레드 경쟁 조건, 데드락, 뮤텍스/세마포어 등 전통적인 동시성 문제는 해당 없다. 비동기 처리 측면에서는 `useMutation` + snapshot 기반 stale closure 가드를 적절하게 적용하여 in-flight 요청 결과가 변경된 prop 에 의해 오염되는 문제를 방어하고 있다. 발견된 세 가지 항목은 모두 INFO 등급으로, 현재 구현에서 실질적인 버그로 이어질 가능성이 낮다. 연속 클릭 경쟁 조건과 render 중 setState 패턴은 이미 제품 수준에서 충분히 방어되어 있다.

---

## 위험도

LOW
