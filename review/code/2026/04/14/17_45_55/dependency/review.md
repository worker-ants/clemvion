## 의존성 리뷰

### 발견사항

**[INFO]** `package-lock.json`의 `peer` 플래그 재배치
- 위치: `package-lock.json` 전반
- 상세: `react`, `react-dom`, `react-hook-form`, `react-redux`, `redux`, `zod`, `immer`, `@dnd-kit/core`, `d3-selection` 등 다수 패키지에서 `"peer": true` 플래그가 제거되었고, 반대로 일부 패키지(`@rtsao/scc`, `acorn` 등)에 `"peer": true`가 추가됨. 이는 의존성 트리 재해석 결과로 실제 설치된 패키지 버전에는 변화가 없음.
- 제안: npm이 자동으로 생성한 변경이므로 별도 조치 불필요.

**[INFO]** `@emnapi/core`, `@emnapi/runtime` 신규 진입
- 위치: `package-lock.json` lines ~609–635
- 상세: 두 패키지 모두 `"optional": true`이며 `@emnapi/wasi-threads`(기존 존재)의 동반 패키지. WASM/WASI 바인딩 런타임으로, 기존의 `@xyflow/react` 또는 Sharp 계열 optional 의존성 체인에서 유입된 것으로 보임. 라이선스는 MIT이고 선택적(optional)이므로 실제 번들에 포함되지 않음.
- 제안: 조치 불필요. optional 패키지이며 MIT 라이선스.

**[INFO]** 내부 모듈 의존성 구조 개선 — `use-execution-interaction-commands` 추출
- 위치: `use-execution-interaction-commands.ts` (신규 파일)
- 상세: `result-detail.tsx`와 `run-results-drawer.tsx`에서 직접 `getWsClient()`를 호출하던 로직을 공통 훅으로 추출. `ExecutionDetailPage`와 `ResultDetail` 모두 동일 훅을 사용하여 WebSocket 이벤트 emit 로직이 단일 지점으로 통합됨. 의존성 방향이 명확해짐.
- 제안: 좋은 방향. 단, 훅 내부에서 `useExecutionStore.getState()`를 직접 호출하는 패턴(sendMessage 내)은 Zustand의 구독 메커니즘을 우회하므로 주의 필요 — 그러나 이 경우 최신 상태 스냅샷을 한 번만 읽는 용도이므로 허용 가능.

**[WARNING]** `result-detail.tsx` — `useExecutionInteractionCommands` 훅의 `executionId` 타입 불일치 가능성
- 위치: `result-detail.tsx:261`, `use-execution-interaction-commands.ts:21`
- 상세: `ResultDetailProps.executionId`는 `string | null`이고 훅은 동일하게 허용하지만, `handleFormSubmit` 등의 내부 가드(`if (!executionId) return`)가 훅 내부와 컴포넌트 내부에 중복으로 존재함. 두 계층 모두 null 검사를 수행하는 방어 코드가 분산되어 있어 유지보수 시 혼란 가능.
- 제안: 훅 내부에서 guard를 처리하고 컴포넌트 핸들러에서는 중복 guard를 제거하거나, 반대로 컴포넌트에서만 guard하고 훅은 신뢰하는 방식으로 일관성 유지.

**[INFO]** `onSendMessage` prop 제거로 인터페이스 단순화
- 위치: `result-detail.tsx:244`, `run-results-drawer.tsx:378`
- 상세: `ResultDetailProps`에서 `onSendMessage` 콜백을 제거하고 훅 내부에서 직접 스토어를 업데이트하는 방식으로 변경. 컴포넌트 간 prop drilling이 줄어들고 책임이 명확해짐.
- 제안: 의존성 관점에서 올바른 방향.

---

### 요약

이번 변경의 핵심은 신규 외부 패키지 추가 없이 내부 의존성 구조를 개선한 리팩터링이다. `package-lock.json`의 변경은 npm이 의존성 트리를 재해석하면서 `peer` 메타데이터를 재배치한 결과이며, 유일하게 새로 등장한 `@emnapi/core`/`@emnapi/runtime`은 기존 WASI 체인의 optional 의존성으로 MIT 라이선스이고 번들에 포함되지 않는다. `useExecutionInteractionCommands` 훅 추출로 `result-detail.tsx`, `run-results-drawer.tsx`, `ExecutionDetailPage` 세 곳의 WebSocket emit 로직이 단일 진실 공급원으로 통합된 것은 의존성 관점에서 긍정적이다. 다만 `executionId` null guard가 훅과 컴포넌트 양쪽에 중복 존재하는 점은 경미한 유지보수 부채로 남는다.

### 위험도

**LOW**