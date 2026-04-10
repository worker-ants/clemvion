### 발견사항

- **[INFO]** `MergeConfig` UI에서 `inputCount` 필드 제거로 UI가 단순화됨
  - 위치: `logic-configs.tsx` - `MergeConfig` 컴포넌트
  - 상세: 변경 후 UI와 스펙, 노드 정의가 모두 `in` (단일 포트, 다중 엣지 수신) 방식으로 일관성 있게 정렬됨. 기존에는 `inputCount`로 동적 포트를 관리했으나 이제 엔진이 다중 엣지를 단일 `in` 포트로 수렴하는 방식으로 변경됨
  - 제안: 현재 상태 적절. 추가 조치 불필요

- **[WARNING]** `merge.handler.spec.ts`의 `context` 객체가 `ExecutionContext` 인터페이스와 불일치할 가능성
  - 위치: `merge.handler.spec.ts:10-15`
  - 상세: `context`에 `executionId`, `workflowId`, `variables`, `nodeOutputCache`만 포함되어 있음. `ExecutionContext` 인터페이스에 다른 필수 필드가 있다면 테스트가 타입 에러 없이 통과되더라도 실제 실행 환경과 괴리가 생길 수 있음. `as ExecutionContext`와 같은 타입 단언을 사용하면 이 문제가 은폐됨
  - 제안: `context` 구성 시 인터페이스가 요구하는 모든 필드를 포함하거나, 불필요한 필드가 없는지 `ExecutionContext` 정의를 기준으로 검토

- **[WARNING]** 입력 정규화 로직에 암묵적 가정이 존재
  - 위치: `merge.handler.spec.ts` - `input normalization` describe 블록
  - 상세: `{ z_node: 'last', a_node: 'first' }` 입력에서 키를 알파벳 정렬하여 `['first', 'last']`를 기대함. 그러나 이 정렬 규칙이 구현 명세(`spec`)에 명시되어 있지 않음. 향후 핸들러 내부 구현이 변경(예: 삽입 순서 유지)될 경우 테스트가 예기치 않게 실패하거나 잘못된 신뢰를 줄 수 있음
  - 제안: spec에 "object input의 키 정렬 방식은 알파벳 오름차순"임을 명시하거나, 해당 테스트에 주석으로 정렬 근거를 기술

- **[INFO]** `strategy: append`와 `strategy: wait_all`의 테스트 결과가 동일
  - 위치: `merge.handler.spec.ts:116-122`
  - 상세: `append` 전략의 테스트가 `wait_all`과 동일한 결과를 검증함. 두 전략의 차이(도착 순서 기반 배열 누적 vs 전체 대기 후 병합)가 현재 단위 테스트 수준에서 구별되지 않음. `append`의 고유 동작(순차 도달 시 배열에 누적하는 스트리밍 시나리오)이 검증되지 않은 상태
  - 제안: 현재 동기 실행 환경에서의 제약이라면 주석으로 명시. 비동기 도착 시나리오 테스트를 추가하거나, 전략 간 동작 차이를 spec에 더 명확히 기술

- **[INFO]** `NumberField` import가 `MergeConfig`에서 더 이상 사용되지 않을 수 있음
  - 위치: `logic-configs.tsx:3`
  - 상세: `MergeConfig`에서 `NumberField`를 사용하는 `inputCount` 필드가 제거되었으나, `LoopConfig`에서 여전히 `NumberField`를 사용하므로 import 자체는 유효함. 단, 향후 `LoopConfig`도 변경될 경우 dead import가 될 수 있음
  - 제안: 현재는 문제 없음. lint가 미사용 import를 잡아주는지 확인

- **[INFO]** spec 문서의 캔버스 요약 섹션(`## 13. 캔버스 요약`)에서 Merge 요약 포맷이 변경된 모델과 불일치
  - 위치: `spec/4-nodes/1-logic-nodes.md` - 캔버스 요약 테이블
  - 상세: 요약 포맷이 `{N} inputs · {strategy}`로 되어 있으나, 포트 모델이 `in_0, in_1, ...`에서 단일 `in`(다중 엣지)으로 변경되었으므로 "N inputs"의 N을 어떻게 산출하는지가 모호해짐
  - 제안: 요약 포맷을 `{strategy} · {outputFormat}` 등으로 변경하거나, N이 연결된 엣지 수를 의미함을 명시

---

### 요약

이번 변경은 Merge 노드의 포트 모델을 동적 다중 포트(`in_0`, `in_1`, ...)에서 단일 포트(`in`) + 다중 엣지 수신 방식으로 단순화하는 의도적인 아키텍처 결정으로, frontend UI, 노드 정의, spec 문서가 일관되게 갱신되어 전반적인 유지보수성이 향상되었다. 테스트 코드는 핵심 시나리오를 잘 커버하고 있으나, 입력 키 정렬에 대한 암묵적 가정과 `append`/`wait_all` 전략 간 동작 구분 부재는 향후 구현 변경 시 오해를 유발할 수 있는 약점이다. spec 문서의 캔버스 요약 포맷이 새 모델과 미세하게 불일치하는 부분도 정리가 필요하다.

### 위험도

**LOW**