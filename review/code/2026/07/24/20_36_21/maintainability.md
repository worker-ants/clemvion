### 발견사항

- **[WARNING]** 동일한 "진행 중 노드 대기" 폴링 블록이 파일 내 두 곳에 그대로 중복
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:246-251` (첫 번째 `it`)와 `:300-305` (세 번째 `it`)
  - 상세: `waitUntil(() => nodeStatus(executionId, slowNodeId), (s) => s === 'running', 30_000, 'in-flight node to start running')` 호출이 인자까지 완전히 동일하게 두 테스트에 반복된다. 같은 파일 안에서 발생한 신규 중복이라 "기존 관행 답습"으로 보기 어렵다.
  - 제안: `waitForNodeRunning(nodeId: string)` 같은 헬퍼로 추출하면 의도(“진행 중 상태를 관측한다”)가 더 분명해지고, 향후 타임아웃 값을 한 곳에서만 조정할 수 있다.

- **[INFO]** "terminal 상태 대기" 폴링 블록도 3회 반복
  - 위치: `:263-268`(첫 번째 `it`), `:287-292`(두 번째 `it`), `:316-321`(세 번째 `it`)
  - 상세: `label` 문자열만 다르고 `timeoutMs=60_000`, predicate, probe 는 동일하다.
  - 제안: `waitForTerminal(executionId, label?)` 헬퍼로 통합 가능. 다만 label 이 실패 메시지 가독성에 기여하므로 필수 리팩터링은 아님 — 위 WARNING 항목 대비 우선순위 낮음.

- **[INFO]** 같은 "stop 호출 후 200 확인" 동작이 테스트마다 다른 스타일로 작성됨
  - 위치: `:254-259` (`const stop = await request(...)...; expect(stop.status).toBe(200)` — 변수로 추출) vs `:306-314` (동일한 요청을 `expect(( await request(...)... ).status).toBe(200)` 형태로 인라인) vs `:324-329` (다시 `const second = ...` 로 추출)
  - 상세: 같은 액션(“stop 호출 → 200 검증”)에 대해 한 파일 안에서 두 가지 스타일이 혼재해 읽는 사람이 매번 패턴을 다시 파악해야 한다.
  - 제안: 세 곳 모두 `const res = await request(...)...; expect(res.status).toBe(200)` 형태로 통일하거나, 공용 `stopExecution(executionId)` 헬퍼로 추출.

- **[INFO]** `downstream` 노드 config 의 `timeout: 5` 가 이유 설명 없는 매직 넘버
  - 위치: `:153` (`config: { ..., timeout: 5 }`, `downstream` 객체 리터럴 내부)
  - 상세: 파일 상단에는 `INFLIGHT_WINDOW_MS`/`CODE_TIMEOUT_SEC` 를 이름 붙이고 근거까지 자세히 주석으로 남겼는데(§"진행 중 노드가 열어 두는 창" JSDoc), 바로 아래 `downstream` 노드의 `timeout: 5` 는 상수화·설명 없이 하드코딩돼 있어 취급 수준이 비일관적이다.
  - 제안: 이미 도달하지 않는 게 정상인 노드라 값 자체는 무해하지만, 다른 값들과 동일하게 이름 있는 상수(`DOWNSTREAM_TIMEOUT_SEC`)로 옮기거나 최소한 한 줄 주석으로 “도달 자체가 안 되므로 값은 무관” 정도 명시하면 일관성이 좋아진다.

- **[INFO]** `slow` 변수명이 실제 동작(고정 시간 busy-wait)과 다소 어긋남
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` `createTwoStepWorkflow` 내부 `const slow: CanvasNode = { ..., label: 'InFlight', ... }` (`:122` 부근)
  - 상세: 노드의 `label` 은 `'InFlight'` 인데 변수명은 `slow` 다. 실제로는 "느려서" 가 아니라 "고정된 창을 여는 busy-wait" 이므로 `slow` 라는 이름이 (파일 상단 JSDoc 이 강조하는) "타이밍이 아니라 관측" 이라는 설계 의도와 약간 어긋난 인상을 준다.
  - 제안: `inflightNode` 등으로 변수명을 label 과 맞추면 코드와 주석 서사가 더 일치한다. 사소한 지적이라 강한 리팩터링 필요는 없음.

- **[INFO]** `CanvasNode` 인터페이스가 인접 e2e 파일(`execution-concurrency-cap.e2e-spec.ts` 등)과 완전히 동일하게 파일마다 재정의됨
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:60-68`
  - 상세: 신규 파일이 도입한 중복은 아니고 기존 e2e 파일군 전체의 확립된 패턴(과거 리뷰에서 axes 발산으로 인한 full-unification 은 defer 된 이력 있음)을 그대로 따른 것. 새로운 문제는 아니므로 이번 변경에 대한 감점 요인은 아니며 참고용으로만 기록.

### 요약

신규 e2e 스펙 파일은 파일 상단 JSDoc 이 "왜 e2e 인가"·"왜 결정적인가"를 매우 상세히 설명하고 있어 가독성·의도 전달력이 높고, 함수 분리(`createTwoStepWorkflow`/`execute`/`getStatus`/`nodeStatus`/`waitUntil`)도 책임이 명확해 함수 길이·중첩·복잡도 측면에서는 문제가 없다. 다만 같은 파일 안에서 "진행 중 노드 대기" 폴링 블록이 두 테스트에 완전히 동일하게 중복되고, "stop 호출" 패턴이 테스트마다 스타일이 갈리는 등 소소한 DRY·일관성 개선 여지가 있다. `plan/complete` 이동·`plan/in-progress` 삭제·`spec/conventions/node-cancellation.md` frontmatter 정리는 단순 메타데이터 갱신으로 유지보수성 이슈 없음. 전반적으로 코드 품질은 양호하며 지적 사항은 모두 사소한 개선 제안 수준이다.

### 위험도
LOW
