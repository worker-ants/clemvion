### 발견사항

- **[WARNING]** `ResolvedNodePorts` 타입이 `string[]` → `ShadowRuntimePort[]`로 변경 (breaking change)
  - 위치: `shadow-workflow.ts` — `ResolvedNodePorts` 인터페이스, `NodePortResolver` 타입 export
  - 상세: `NodePortResolver`를 외부에서 직접 구현하는 소비자는 `outputs/inputs` 필드를 `string[]`에서 `{ id, type?, label? }[]`로 전부 재작성해야 한다. TypeScript 컴파일러가 잡아주긴 하지만, 이 두 인터페이스는 `export`로 공개된 계약이므로 형식 계약 위반이다. `shadow-workflow.spec.ts`의 `toDesc` 래퍼 추가가 그 증거다.
  - 제안: 기존 string 배열 형식도 오버로드 또는 union으로 수용하거나, CHANGELOG에 breaking 변경으로 명시적으로 문서화

- **[WARNING]** `result.ports` 포트 수 상한(50) 초과 시 **무음 절단(silent truncation)**
  - 위치: `shadow-workflow.ts:RUNTIME_PORTS_MAX_PER_SIDE`, `buildRuntimePorts`
  - 상세: 포트가 50개를 초과하면 `slice(0, 50)`로 잘리지만 응답에 절단 여부를 알리는 필드(`truncated: true`, `totalCount` 등)가 없다. 소비자는 전체 목록을 받았다고 가정하여 포트 누락으로 인한 `PORT_NOT_FOUND` 오류를 디버깅하기 어렵다.
  - 제안: 절단이 발생한 경우 `ports.truncated: true` 또는 `ports.total: number` 필드 추가

- **[WARNING]** `port.type` 정규화: `system`/`control` 등의 포트 타입이 `'data'`로 무음 변환
  - 위치: `workflow-assistant-stream.service.ts` — `portResolver` 클로저 내 `p.type === 'error' ? 'error' : 'data'`
  - 상세: 서드파티 노드가 `system`, `control` 등 커스텀 포트 타입을 선언한 경우, 프런트엔드/LLM이 받는 `result.ports`에서는 모두 `data`로 나타난다. 이 정규화 규칙이 스펙 문서에만 있고 `ShadowRuntimePort` 인터페이스 주석에는 명시되지 않아 계약 불일치가 발생할 수 있다.
  - 제안: `ShadowRuntimePort.type` 주석에 "서버가 error 외 모든 타입을 data로 정규화함"을 명시하거나, `type` 리터럴 유니언에서 제거

- **[INFO]** `groupToolCalls()` 반환값 형태가 입력에 따라 달라지는 동작 변화
  - 위치: `tool-call-badge.tsx` — `mergeRecoveryGroups`
  - 상세: 기존에는 실패 그룹 + 성공 그룹이 항상 별개로 반환됐으나, `PORT_NOT_FOUND`/`NODE_NOT_FOUND` 패턴에서는 이제 단일 `retried` 그룹으로 병합된다. `groupToolCalls`를 직접 소비하는 코드(예: 로그 집계, 테스트 어설션 카운트)는 그룹 수가 달라질 수 있다.
  - 제안: `ToolCallGroup` 문서 또는 함수 JSDoc에 "특정 패턴에서 그룹 수가 입력 call 수보다 적을 수 있음"을 명시

- **[INFO]** `portResolver` 미주입 시 `ports` 필드 자체가 생략 — 두 가지 응답 형태 공존
  - 위치: `shadow-workflow.ts:buildRuntimePorts`, `ShadowResult.ports?`
  - 상세: `portResolver`가 없으면 `ports`가 undefined, 있으면 `ResolvedNodePorts` 객체. 같은 `add_node` 성공 응답이지만 프로덕션과 테스트 환경에서 형태가 다르다. 소비자는 `ports`의 존재 여부로 환경을 추론하게 되는 암묵적 계약이 생긴다.
  - 제안: 운영 경로(`portResolver` 항상 주입)에서 `ports`를 non-optional로 간주한다는 점을 스펙 주석에 명시

---

### 요약

이번 변경의 핵심은 `add_node`/`update_node` 성공 응답에 `result.ports`를 추가하는 것(ED-AI-40 §4.3.2)이다. `ShadowResult`에 옵셔널 필드를 추가한 것과 프런트엔드 `ToolCallGroup` 확장은 하위 호환성이 유지된 가산적 변경이다. 그러나 `ResolvedNodePorts`의 배열 원소 타입이 `string` → `ShadowRuntimePort` 객체로 바뀐 것은 `NodePortResolver`를 구현하는 모든 소비자에게 필수 수정을 요구하는 breaking change이며 TypeScript 이외의 경로(예: 향후 JS/런타임 통합)에서 조용히 실패할 수 있다. 포트 수 상한 초과 시 무음 절단과 타입 정규화 규칙의 암묵성도 향후 디버깅 비용을 높일 수 있는 계약 불명확성이다.

### 위험도
LOW