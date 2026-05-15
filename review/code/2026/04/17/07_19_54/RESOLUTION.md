# Code Review Resolution

> 리뷰 세션: 2026-04-17_07-19-54

## Critical 이슈 조치

| # | 발견사항 | 조치 내용 |
|---|----------|-----------|
| 1 | `setTimeout(200ms)` 타이밍 의존 테스트 | `execution-engine.service.spec.ts`의 Parallel 테스트에서 `await flushPromises()`로 교체 |
| 2 | `mockConfigService.get` 상태 누수 | Parallel describe 블록에 `afterEach(() => mockConfigService.get.mockReset(); ...)` 추가로 격리 |

## Warning 이슈 조치

| # | 발견사항 | 조치 내용 |
|---|----------|-----------|
| 4 | `context.variables` 분기 간 오염 | `parallel-executor.ts`의 branchContext 생성 시 `variables: { ...context.variables }` 추가로 1단계 격리 |
| 5 | 로그 인젝션 위험 | INFO로 재분류 — 현재 Error 메시지는 사용자 노출이 아닌 서버 내부 로그에만 사용. 향후 P2에서 sanitizer 도입 시 적용 예정 |
| 6 | `_selectedPort` sentinel API 노출 | INFO로 재분류 — `stripSelectedPort()`가 이미 downstream 노드 입력에서 제거. API 직렬화 경로(NodeExecution.outputData)에서의 노출은 디버깅에 유용하므로 현행 유지 |
| 7 | `runParallel` 후 `continue` 없음 | dispatch 블록 끝에 `pointer++; continue;` 추가로 propagateReachability 이중 호출 및 불필요한 blocking/back-edge 검사 방지 |
| 8 | God Class 심화 | INFO로 재분류 — P2에서 ParallelPlanner 분리 예정. P1 범위에서는 기존 Container 패턴과의 일관성 우선 |
| 9 | container dispatch 코드 중복 | INFO로 재분류 — P2에서 `dispatchContainerIfNeeded` 공통 헬퍼 추출 예정 |
| 10 | configService.get 매 노드 평가 | INFO로 재분류 — Node.js 인메모리 Map 접근이라 I/O 비용 없음. 핫패스 최적화는 벤치마크 후 판단 |
| 11 | `waitAll=false` 침묵 무시 | 현재 경고 로그 출력 + UI에 P1 제한 안내 표시 중. validate에서 에러까지 던지면 기존 저장 워크플로우가 깨질 수 있어 경고 유지 |
| 12 | 경계값 하드코딩 분산 | INFO로 재분류 — P2에서 `parallel/constants.ts` 추출 예정 |
| 13 | `planParallelBody` 단위 테스트 부재 | `execution-engine.service.spec.ts`에 Parallel e2e 시나리오(Trigger→Parallel→[A,B]→Merge)가 간접적으로 planParallelBody를 커버. 독립 단위 테스트는 P2에서 ParallelPlanner 분리 시 추가 예정 |
| 15 | Merge timeout/partialOnTimeout 경고 로직 테스트 누락 | 기존 warn-only 구현이며 로직 분기 없음. P2 barrier 구현 시 함께 테스트 추가 예정 |
| 18 | 프론트엔드 `parallelBranchPorts` 테스트 없음 | `resolve-dynamic-ports.test.ts`에 parallel-branches 케이스 4개(기본, 설정, min 클램프, max 클램프) 추가 |
| 21 | `widget: 'switch'` 타입 미정의 | `parallel.schema.ts`에서 `'switch'` → `'checkbox'`로 변경 |
| 22 | `MergeHandler.validate()` partialOnTimeout 검증 누락 | `merge.handler.ts`에 `partialOnTimeout` boolean 타입 검증 조건 추가 |
| 23 | summaryTemplate 미정의 | `parallel.schema.ts`에 `summaryTemplate: '{{branchCount}} branches'` 추가 |

## Warning 이슈 — 향후 P2에서 해결 예정

| # | 발견사항 | 비고 |
|---|----------|------|
| 1 | `appendExecutionPath` DB N+1 | P2에서 메모리 누적 후 bulk 업데이트 또는 atomic append로 전환 예정 |
| 2 | 분산 배포 정합성 | 현재 단일 프로세스 환경. 수평 확장 시 DB atomic append로 전환 필요 |
| 3 | `executedNodes` 전체 브랜치 공유 | P1에서는 분기 독립 nodeId 보장(planParallelBody 검증). P2에서 브랜치별 Set 분리 검토 |
| 14 | appendExecutionPath 동시 쓰기 테스트 | P2에서 async mutex 제거 시 동시성 테스트 추가 예정 |
| 16 | errorPolicy=stop 통합 테스트 | P2에서 추가 |
| 17 | waitAll=false no-op 테스트 | P2에서 waitAll=false 실구현 시 추가 |
| 19 | PARALLEL_ENGINE .env.example 문서화 | .env에 이미 주석 포함. README에는 P1 안정화 후 추가 |

## 검증

- Backend: 91 suites, 1274 tests passed, build clean
- Frontend: 55 suites, 709 tests passed, build clean
