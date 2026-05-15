파일 쓰기 권한이 필요합니다. 승인해 주시면 `SUMMARY.md`를 저장하겠습니다.

아래는 13개 에이전트 리뷰 결과의 통합 보고서입니다.

---

# Code Review 통합 보고서

> 리뷰 대상 브랜치: `refactor-schema-driven-canvas` | 리뷰 일시: 2026-04-17 | 에이전트: 13개

## 전체 위험도

**HIGH** — `appendExecutionPath` DB N+1 병목이 고분기 병렬 워크플로우에서 실행 시간을 선형 증가시키며, 타이밍 의존 테스트 다수·공유 가변 상태·`waitAll=false` 침묵 무시 등 복합 위험이 존재함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `flushPromises()` 대신 `setTimeout(200ms)` 사용 — CI flaky 위험 | `execution-engine.service.spec.ts:2643`, `parallel-executor.spec.ts:85` | `await flushPromises()` 로 교체; maxConcurrency 검증은 barrier 카운터 기반으로 대체 |
| 2 | Testing | `mockConfigService.get.mockImplementation()` 후 `afterEach` 복원 없음 — `PARALLEL_ENGINE=v1` 상태가 후속 테스트에 누수 | `execution-engine.service.spec.ts` Parallel 테스트 블록 | `afterEach(() => mockConfigService.get.mockReset())` 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Database | `appendExecutionPath` 노드당 DB Read-Modify-Write N+1 패턴 — 병렬 실행 처리량 이점이 직렬 DB 체인으로 상쇄 | `execution-engine.service.ts` `appendExecutionPath` | 실행 중 메모리 누적 후 완료 시 1회 bulk 업데이트, 또는 `array_append` atomic 쿼리 적용 |
| 2 | Database / Concurrency | 분산 배포 환경에서 `executionPath` 비원자적 갱신 — 인메모리 Promise 체인은 단일 프로세스에서만 유효 | `execution-engine.service.ts` `appendExecutionPath`, `executionPathChain` Map | DB 레벨 atomic append 쿼리 또는 `SELECT FOR UPDATE` 트랜잭션으로 교체 |
| 3 | Concurrency / Security | `executedNodes: Set<string>` 전체 브랜치 공유 — 플래닝 버그 시 노드 중복 실행 가능 | `execution-engine.service.ts` `runParallel` → `executeParallelBranchBody` | 브랜치별 로컬 Set 생성 후 완료 후 병합; 진입 시 교집합 assert 추가 |
| 4 | Concurrency / Security | `context.variables` 얕은 복사 — 브랜치 간 변수 상태 상호 오염 | `parallel-executor.ts` `execute()` `branchContext` 생성부 | `variables: { ...context.variables }` 로 1단계 격리 |
| 5 | Security | `parallelNode.label` 사용자 입력이 필터링 없이 Error 메시지 삽입 — 로그 인젝션 위험 | `execution-engine.service.ts` `planParallelBody` throw 구문 | `s.replace(/[\r\n\t]/g, ' ').slice(0, 100)` 헬퍼 적용 |
| 6 | API Contract / Side Effect | `_selectedPort: '__parallel_internal__'` sentinel이 `nodeOutputCache`에 주입되어 API 직렬화 시 외부 노출 가능 | `execution-engine.service.ts` `runParallel` 종료부 | 직렬화 시 `_selectedPort` 키 필터링 또는 service-level Map으로 분리 |
| 7 | Architecture / Side Effect | `runParallel` 이후 `continue` 없음 — `propagateReachability` 이중 호출 (현재 sentinel로 억제되나 향후 silent regression 위험) | `execution-engine.service.ts` 메인 루프 parallel 블록 | `await this.runParallel(...)` 이후 `continue` 명시 |
| 8 | Architecture / Maintainability | `ExecutionEngineService` God Class 심화 — BFS 플래닝·브랜치 실행·동시성 조율까지 흡수 | `execution-engine.service.ts` 전반 | `ParallelPlanner` 클래스 분리로 `planParallelBody` 위임; `executeParallelBranchBody`를 `ParallelExecutor` 내부로 이동 |
| 9 | Architecture / Maintainability | `executeParallelBranchBody`가 `executeContainerBody`의 container dispatch 로직 중복 — 새 노드 타입 추가 시 양쪽 수정 필요 | `execution-engine.service.ts` `executeParallelBranchBody` | `dispatchContainerIfNeeded(node, ...)` 공통 헬퍼 추출 |
| 10 | Architecture | Feature flag(`PARALLEL_ENGINE=v1`)가 매 노드 실행마다 `configService.get` 평가 — 핫패스 I/O 낭비 | `execution-engine.service.ts:973` | `OnModuleInit`에서 한 번 캐시: `private readonly parallelEngineEnabled: boolean` |
| 11 | Architecture / Concurrency | `waitAll=false` 설정 시 경고 로그만 출력하고 `true`처럼 동작 — 사용자의 의도와 실제 동작 불일치 | `execution-engine.service.ts` `runParallel`, `parallel-executor.ts` | validate에서 명시적 에러 반환 또는 UI Phase P1 제한 배너 강화 |
| 12 | Maintainability | 브랜치 수 경계값(`2`, `16`)이 5개 파일에 분산 하드코딩 | `parallel.handler.ts`, `parallel.schema.ts`, `execution-engine.service.ts`, `resolve-dynamic-ports.ts` | `parallel/constants.ts`에 `MIN_BRANCH_COUNT`, `MAX_BRANCH_COUNT` 공유 상수 선언 |
| 13 | Testing | `planParallelBody` 핵심 분기 로직(back-edge, nested parallel 거부, blocking node 거부) 단위 테스트 부재 | `execution-engine.service.ts:2849-3062` | 각 시나리오별 테스트 추가 |
| 14 | Testing | `appendExecutionPath` 동시 쓰기 무결성 검증 테스트 부재 | `execution-engine.service.ts:1163-1190` | 2~3개 브랜치 동시 호출 시 중복 없이 모든 nodeId 기록 검증 |
| 15 | Testing | `MergeHandler` timeout/`partialOnTimeout` 경고 로직 테스트 누락 | `merge.handler.ts:47-63` | `Logger.warn` 호출 여부 spy로 검증 |
| 16 | Testing | `errorPolicy=stop` 브랜치 실패 처리 통합 테스트 누락 | `execution-engine.service.spec.ts` Parallel 블록 | 브랜치 throw 케이스 + `ExecutionStatus.FAILED` 저장 검증 추가 |
| 17 | Testing | `waitAll=false` no-op 동작 명시적 테스트 부재 | `parallel-executor.spec.ts` | `waitAll=false` 전달 시에도 전체 브랜치 settle 대기 검증 |
| 18 | Testing | 프론트엔드 `parallelBranchPorts` / `parallel-branches` 케이스 테스트 없음 | `resolve-dynamic-ports.ts:23-32` | `resolve-dynamic-ports.spec.ts`에 경계값 케이스 추가 |
| 19 | Documentation | `PARALLEL_ENGINE` 환경변수가 README, `.env.example`, spec 어디에도 문서화되지 않음 | `execution-engine.service.ts:973` | `.env.example`에 `PARALLEL_ENGINE=v1 # Enables concurrent branch execution. Default: off` 추가 |
| 20 | Requirement | `parallel` 노드가 schema-driven auto-form 대신 OVERRIDE_REGISTRY에 수동 등록 — 스키마 메타 미활용 | `override-registry.ts:63`, `logic-configs.tsx:509-544` | `widget: 'switch'` → `'checkbox'` 수정 후 auto-form 전환 검토; 불가 시 override 유지 이유 주석 명시 |
| 21 | Requirement | `widget: 'switch'`가 `UiHint.widget` 및 `UiWidget` 타입에 미정의 | `parallel.schema.ts:35`, `node-component.interface.ts`, `types.ts` | `'switch'` 타입 추가 또는 `'checkbox'`로 통일 |
| 22 | Requirement | `MergeHandler.validate()`에 `partialOnTimeout` 타입 검증 누락 | `merge.handler.ts:19-38` | boolean 타입 체크 조건 추가 |
| 23 | Requirement | Parallel 노드 `summaryTemplate` 미정의 — 캔버스 카드에 설정 요약 미표시 | `parallel.schema.ts:56-66` | `summaryTemplate: '{{branchCount}} branches'` 추가 |
| 24 | Concurrency | `appendExecutionPath` 체인 DB 쓰기 실패 시 `catch(() => undefined)` 묵살 | `execution-engine.service.ts` `appendExecutionPath` finally 블록 | catch에서 metric/alert 기록 또는 불일치 명시적 마킹 |
| 25 | Performance | BFS `queue.shift()` O(N) 연산 — O(B×V²) 복잡도 | `execution-engine.service.ts` `planParallelBody` BFS 루프 | 인덱스 포인터 `queue[head++]`으로 교체 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | `p-limit@7` ESM-only로 Jest `transformIgnorePatterns` 설정 복잡도 증가 | `backend/package.json` | `p-limit@3.x`(CJS)로 다운그레이드 또는 현행 유지 시 이유 주석 추가 |
| 2 | Documentation | `ParallelPlan` 인터페이스 JSDoc 누락 | `execution-engine.service.ts:97-101` | 필드 의미 설명 JSDoc 추가 |
| 3 | Documentation | spec 문서에 Phase P1 병렬 실행 동작·한계 미반영 | `spec/` 디렉토리 | spec 최신화 |
| 4 | Maintainability | Phase P1/P2 로드맵 용어가 사용자 노출 UI 문자열에 포함 — P2 구현 후 stale 위험 | `logic-configs.tsx:533`, `merge.handler.ts`, `parallel.schema.ts` | 사용자 문자열은 기능 동작 관점으로 재작성, 단계 참조는 코드 주석으로만 유지 |
| 5 | Database | `nodeExecutionRepository.findOne`에 `(executionId, nodeId, startedAt)` 복합 인덱스 미비 가능 | `execution-engine.service.ts` `runParallel` 내 `findOne` | 엔티티에 `@Index` 존재 여부 확인 및 미비 시 추가 |
| 6 | Scope | `MergeConfig.partialOnTimeout` Phase P2 필드가 프로덕션 인터페이스에 조기 노출 | `merge.handler.ts` `MergeConfig` | Phase P2까지 보류 검토; 현행 warn-only는 적절 |
| 7 | Performance | `planParallelBody` 호출마다 `forwardAdj` 맵 O(E) 재구성 | `execution-engine.service.ts` `planParallelBody` 상단 | 호출자에서 미리 구성 후 파라미터 전달 |
| 8 | Performance | `parallelBranchPorts` 렌더 사이클마다 새 배열 생성 | `resolve-dynamic-ports.ts` | 호출자 `useMemo` 적용 또는 모듈 수준 캐시 맵 |
| 9 | Concurrency | `PARALLEL_DISPATCHED_PORT` sentinel — `propagateReachability` 변경 시 이중 실행 위험 | `execution-engine.service.ts` `PARALLEL_DISPATCHED_PORT` | `reachable`에서 `plan.allBodyNodeIds` 직접 제거하는 명시적 방식으로 대체 |
| 10 | Security | 최대 16개 브랜치 × LLM/HTTP 노드 동시 실행 — 리소스 고갈 위험 | `parallel-executor.ts` | `MAX_PARALLEL_BRANCHES` 환경변수 또는 rate limiting 검토 |
| 11 | Requirement | `ParallelConfig.waitAll` 필드 `ParallelExecutor` 내부 미사용 (Phase P2 예정) | `parallel-executor.ts:execute()` | `// Phase P2: waitAll=false 지원 예정` 주석 추가 |
| 12 | Testing | `errorPolicy=continue` 시 전체 브랜치 실패 케이스 미검증 | `parallel-executor.spec.ts` | 전체 throw 케이스 추가 |
| 13 | Documentation | override-registry 마이그레이션 주석과 `parallel` 등록 위치 불일치 | `override-registry.ts:62-63` | override 유지 이유 한 줄 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| performance | **HIGH** | `appendExecutionPath` DB N+1 병목이 병렬 실행 처리량을 선형 저하 |
| testing | MEDIUM | 타이밍 의존 테스트 flaky, `mockConfigService` 상태 누수, 핵심 로직 테스트 부재 |
| architecture | MEDIUM | `ExecutionEngineService` God Class 심화, dispatch 로직 중복, sentinel 암묵적 결합 |
| concurrency | MEDIUM | 공유 참조 부분 실패 시 잔류 상태, `appendExecutionPath` 오류 묵살 |
| security | MEDIUM | 공유 가변 상태, 로그 인젝션, 리소스 고갈 위험 |
| api_contract | MEDIUM | sentinel API 노출 가능, feature flag로 인한 실행 동작 변화 |
| database | MEDIUM | 비원자적 갱신, 분산 배포 정합성 위험, 복합 인덱스 확인 필요 |
| maintainability | MEDIUM | 과도한 책임, 경계값 다중 중복, 타이밍 테스트 불안정 |
| requirement | MEDIUM | `PARALLEL_ENGINE` 기본 off로 스펙 불일치, `waitAll=false` 미지원, auto-form 우회 |
| documentation | MEDIUM | `PARALLEL_ENGINE` 환경변수 외부 문서 누락, spec 동기화 필요 |
| side_effect | MEDIUM | `nodeOutputCache` 공유 변이, `continue` 누락, `widget: 'switch'` 타입 불일치 |
| scope | LOW | `partialOnTimeout` 조기 노출, 순차 경로 변경 |
| dependency | LOW | `p-limit@7` ESM-only 설정 복잡도 |

---

## 발견 없는 에이전트

없음 — 전체 13개 에이전트 모두 발견사항 보고.

---

## 권장 조치사항

**즉시 (Critical)**
1. 타이밍 의존 테스트 → `flushPromises()` / barrier 카운터로 교체
2. `mockConfigService` 테스트 격리 — `afterEach` mockReset 추가

**높은 우선순위**
3. `appendExecutionPath` DB N+1 → 메모리 누적 후 1회 bulk 업데이트
4. `context.variables` 격리 — `variables: { ...context.variables }`
5. `runParallel` 이후 `continue` 추가
6. `widget: 'switch'` → 타입 추가 또는 `'checkbox'`로 통일

**중간 우선순위**
7. `PARALLEL_ENGINE` 환경변수 문서화 (`.env.example`, spec)
8. `waitAll=false` 명시적 에러 또는 UI 배너 강화
9. `_selectedPort` sentinel API 노출 방지
10. 테스트 보강 — `planParallelBody` 분기, `appendExecutionPath` 동시성, `errorPolicy=stop`, 프론트엔드 `parallelBranchPorts`
11. 브랜치 수 경계값 → `constants.ts` 공유 상수화
12. `MergeHandler.validate()` `partialOnTimeout` 검증 추가
13. Parallel 노드 `summaryTemplate: '{{branchCount}} branches'` 추가

**낮은 우선순위**
14. `planParallelBody` 헬퍼 분리 / `ParallelPlanner` 클래스 추출
15. `executeParallelBranchBody` container dispatch 공통 헬퍼 추출
16. BFS `queue.shift()` → 인덱스 포인터 방식
17. Phase P1/P2 용어를 UI 문자열에서 코드 주석으로 이동
18. spec 문서 Phase P1 병렬 실행 내용 동기화