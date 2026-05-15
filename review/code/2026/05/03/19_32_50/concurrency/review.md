## 발견사항

- **[INFO]** `turnRagAcc` 는 각 함수 호출 스코프에 지역 선언됨
  - 위치: `ai-agent.handler.ts` — `execute()` 내 `turnRagAcc = new RagAccumulator(...)`, `processMultiTurnMessage()` 내 동일 패턴
  - 상세: 요청 간 공유 가변 상태가 없음. 동시에 여러 워크플로가 실행되어도 각 호출이 독립적인 `ragAcc` / `turnRagAcc` 인스턴스를 생성하므로 경쟁 조건 없음.
  - 제안: 현재 구조 유지.

- **[INFO]** KB 메타 병렬 조회에 `Promise.allSettled` 사용
  - 위치: `kb-tool-provider.ts` `buildTools()` — 기존 코드, 이번 변경에서 수정 없음
  - 상세: 한 KB 의 `findById` 실패가 다른 KB tool 노출을 막지 않도록 settled 처리. diff 에서 `execute()` 시그니처만 포매팅 변경이며 로직 변화 없음. 올바른 비동기 패턴.
  - 제안: 현재 구조 유지.

- **[INFO]** `turnRagAcc.pushSources` / `pushDiagnostic` 호출 순서
  - 위치: `ai-agent.handler.ts` L314–315, L664–665
  - 상세: tool call 루프가 `for … of` 순차 실행이며, 각 `execResult` 를 `await` 후 동기적으로 push 하므로 단일 이벤트 루프 내에서 순서 보장. Node.js 단일 스레드 모델상 push 연산이 인터리브될 수 없음.
  - 제안: 현재 구조 유지. 만약 향후 `Promise.all` 로 병렬 tool 실행을 도입할 경우 push 이후 합산 시점을 명시적으로 확보해야 함 (현재는 해당 없음).

- **[INFO]** React render-time 에서 `setState` 3회 동시 호출
  - 위치: `result-detail.tsx` `ResultDetail` 컴포넌트 내 `if (result && activeTabNodeId !== result.nodeId)` 블록
  - 상세: `setActiveTabNodeId`, `setActiveTab`, `setHighlightTurnIndex` 를 render 함수 본문에서 직접 호출하는 패턴. React 공식 문서에서 "props 변화에 따른 state 리셋"에 허용하는 방식이지만, React 는 현재 렌더 결과를 버리고 즉시 재렌더하므로 한 노드 전환 당 렌더가 2회 발생함. `concurrent mode` 에서도 동일하게 안전하게 처리됨.
  - 제안: 기능 안전성에 문제는 없음. 성능 민감 구간이라면 `useEffect` + cleanup 패턴으로 교체를 검토할 수 있으나 현재 수준에서는 불필요.

---

### 요약

변경 코드는 전체적으로 동시성 안전성이 높다. `turnRagAcc` 인스턴스가 항상 함수 스코프에 지역으로 생성되어 요청 간 공유 가변 상태가 없고, 비동기 흐름은 기존과 동일한 순차 `for…of` + `await` 패턴을 유지한다. `Promise.allSettled` 를 통한 병렬 KB 메타 조회도 올바르게 격리되어 있다. 프론트엔드의 render-time `setState` 패턴은 React 허용 범위 내이며 실질적 버그 위험은 없다.

### 위험도
**NONE**