### 발견사항

---

**[WARNING] `planParallelBody` 메서드의 과도한 책임 분산**
- 위치: `execution-engine.service.ts`, `planParallelBody` 메서드 (~150줄)
- 상세: 하나의 메서드가 인접 그래프 구성, 각 브랜치별 BFS 탐색, 노드 소유권 분석, 백엣지/중첩 병렬/블로킹 노드 검증, 브랜치 플랜 조립까지 6개 이상의 책임을 가짐. 순환 복잡도가 높아 개별 책임의 단위 테스트가 사실상 불가능함.
- 제안: `buildForwardAdjacency`, `computeBranchReachability`, `classifyNodeOwnership`, `validateBranchBody` 등 단일 책임 헬퍼 메서드로 분리

---

**[WARNING] `runParallel` 메서드의 과도한 파라미터 수**
- 위치: `execution-engine.service.ts`, `runParallel` 시그니처 (파라미터 13개)
- 상세: `allNodes`, `allEdges`, `forwardEdges`, `backEdges`, `outgoingEdgeMap`, `context`, `executionId`, `executedNodes`, `executionMeta`, `reachable`, `input` 등 개별 파라미터 나열. 호출부 가독성이 낮고 파라미터 추가 시 모든 호출 지점 수정 필요.
- 제안: 그래프 관련 파라미터를 `GraphPlan` 인터페이스로, 실행 컨텍스트 관련을 별도 객체로 묶어 2~3개의 구조화된 파라미터로 축소

---

**[WARNING] `executeParallelBranchBody` 내 컨테이너 디스패치 로직 중복**
- 위치: `execution-engine.service.ts`, `executeParallelBranchBody` 메서드 내 `foreach/loop/map/background` 분기
- 상세: 메인 실행 루프의 컨테이너 디스패치 로직과 거의 동일한 코드가 복제됨. 새 컨테이너 타입 추가 시 두 곳을 동시에 수정해야 하며, 한 곳 누락 시 브랜치 내 해당 노드가 올바르게 동작하지 않는 버그 발생 가능.
- 제안: 공통 로직을 `dispatchContainerIfNeeded(node, ...)` 형태의 private 메서드로 추출하여 재사용

---

**[WARNING] 브랜치 수 경계값(2, 16)이 여러 파일에 하드코딩**
- 위치: `parallel.handler.ts`, `parallel.schema.ts`, `execution-engine.service.ts` (`planParallelBody`, `runParallel`), `resolve-dynamic-ports.ts`
- 상세: `Math.max(2, Math.min(16, ...))` 패턴이 최소 5곳에 중복. 범위 정책 변경 시 모두 누락 없이 수정해야 함.
- 제안: `packages/` 또는 `backend/src/nodes/logic/parallel/constants.ts`에 `MIN_BRANCH_COUNT = 2`, `MAX_BRANCH_COUNT = 16` 공유 상수 선언 후 import

---

**[WARNING] 타이밍 의존 테스트 (flaky 위험)**
- 위치: `parallel-executor.spec.ts:85` (`setTimeout(r, 10)`), `execution-engine.service.spec.ts` 말미 (`setTimeout(r, 200)`)
- 상세: `setTimeout` 기반 동기화는 CI 환경 부하에 따라 타이밍이 달라져 간헐적 실패 가능. 특히 `expect(running).toBe(2)` 검증은 정확히 10ms 후 2개가 실행 중임을 가정하나 보장되지 않음.
- 제안: `p-limit` 내부 동작은 Promise 체이닝으로 예측 가능하므로, barrier Promise와 `await Promise.resolve()` 기반 마이크로태스크 플러시로 대체

---

**[WARNING] `parallel` 노드를 override registry에 등록하면서 기존 마이그레이션 주석과 불일치**
- 위치: `override-registry.ts:63`
- 상세: 바로 위 주석에 `split, map, foreach, merge`가 auto-form으로 마이그레이션됐다고 기술하고 있으나, `parallel`은 zod 스키마가 완비됐음에도 override registry에 추가됨. 이 주석은 유지보수자에게 `parallel`이 아직 auto-form 미지원임을 알리는 근거가 없음.
- 제안: 주석을 `// parallel: zod 스키마 완비됐으나 waitAll 미지원 경고 UI로 인해 임시 override 유지` 형태로 의도 명시

---

**[INFO] `parallel.schema.ts`에서 `widget: 'switch'` 사용 — UiWidget 타입 미정의**
- 위치: `parallel.schema.ts:38`, `frontend/src/lib/node-definitions/types.ts` `UiWidget` 타입
- 상세: `waitAll` 필드의 `ui.widget`에 `'switch'`를 사용하나, `UiWidget` union에 `'switch'`가 없음 (`'checkbox'`는 있음). `passthrough()` 사용으로 타입 오류가 런타임까지 전파되지 않을 수 있음.
- 제안: `UiWidget`에 `'switch'`를 추가하거나 `'checkbox'`로 통일

---

**[INFO] Phase P1/P2 한시적 참조가 사용자 노출 UI 문자열에 포함**
- 위치: `logic-configs.tsx:533`, `merge.handler.ts` 경고 메시지, `parallel.schema.ts` hint 문자열
- 상세: "Phase P1", "Phase P2"와 같은 내부 로드맵 용어가 런타임 경고 로그와 사용자 UI hint에 노출됨. P2 구현 완료 후 이 문자열들이 stale해질 위험이 높음.
- 제안: 사용자 노출 문자열은 기능 동작 관점("모든 브랜치가 완료될 때까지 대기합니다")으로 작성하고, 내부 단계 참조는 코드 주석으로만 유지

---

**[INFO] `package.json` transformIgnorePatterns에 의도 설명 없음**
- 위치: `backend/package.json:124`
- 상세: `yocto-queue`가 `p-limit`의 ESM 전용 전이 의존성임을 알 수 없음. 향후 패키지 업그레이드 시 이 항목의 필요성을 판단하기 어려움.
- 제안: `// p-limit@7+, yocto-queue are ESM-only; jest requires them to be transpiled` 형태의 인라인 주석 추가 (json이므로 별도 문서나 PR 설명에 기술)

---

### 요약

전체적으로 `ParallelExecutor`의 분리, 직렬화된 `executionPath` 업데이트, 스키마 기반 동적 포트 등 설계 의사결정이 명확하고 기존 아키텍처 패턴과 일관성이 있다. 주요 유지보수 위험은 `planParallelBody`와 `runParallel`의 과도한 크기와 책임 집중, 컨테이너 디스패치 로직의 이중화, 브랜치 범위 경계값의 다중 중복에 있다. 특히 컨테이너 디스패치 중복은 새 노드 타입 추가 시 버그 유발 가능성이 있어 조기에 해소할 것을 권장한다. 타이밍 기반 테스트는 CI 환경에서 신뢰도를 낮출 수 있으므로 결정론적 방식으로 전환이 필요하다.

### 위험도

**MEDIUM**