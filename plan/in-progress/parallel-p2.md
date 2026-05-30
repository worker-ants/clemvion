# Parallel 노드 P2 (중첩·`waitAll: false`·`errorPolicy` 노출)

> 작성일: 2026-05-11
> 최신화: 2026-05-30 — `#1 errorPolicy schema 노출` 부분 완료 (frontend UI dropdown 만 잔여), 경로 참조 stale 갱신
> 결정 완료: 2026-05-30 — #2 활성화, #3 깊이=2 + cap=32, #4 done 포트 그대로 ✅ 격상 (`## 결정 사항` 참조)
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/02-parallel-node.md` (P1 완료)

## 결정 사항 (2026-05-30 사용자 확정)

### 1차 결정 (4건)

| ID | 결정 |
|----|------|
| **#2 waitAll: false** | **활성화** — emit 모델: `branch_i` 포트가 자기 분기 완료 시 즉시 emit, `done` 포트는 모든 분기 완료 후 1회 (현 `done` 컨트랙트 유지). `done` 포트는 streaming 아님 |
| **#3 중첩 Parallel** | **허용** — 깊이 한도 = **2** (3중 이상은 reject). 외부 × 내부 effectiveConcurrency 곱셈 cap = **32** |
| **#3 enforcement** | 깊이 cap (≤ 2) = **graph 정적 검증**. concurrency 곱셈 cap (≤ 32) = **runtime silent clamp** |
| **#4 ND-PL-03** | 현 `done` 포트 그대로 **✅ 격상** — schema/handler 변경 없음 |

### 2차 결정 (7건 — 본 plan scope 확장)

| ID | 결정 | 영향 |
|----|------|------|
| **A** | `errorPolicy` 에 **`cancel-others-on-fail`** 추가 (옵션 a3) — 첫 실패 시 다른 분기 abort | **AbortController 기반 cancellation 인프라 신규**. → **선행 plan `node-cancellation-infrastructure.md` 분리** (결정 H) |
| **B** | `PARALLEL_ENGINE=v1` **default ON 전환 + 게이트 유지** (옵션 b2) — 본 plan 내 처리 | `.env.example` / 환경변수 기본값만 변경. 게이트 자체는 롤백 카드로 유지 |
| **C** | waitAll=false 시 errorPolicy 를 **`continue` 로 강제** (옵션 c2) + **UI 에서도 waitAll=false 시 errorPolicy SelectField 가 disabled + value 가 continue 로 lock + hint 표시** | 엔진/schema validate/frontend 3곳 변경. schema validate 단계에서 waitAll=false + errorPolicy=stop 조합 **reject** (결정 J — silent normalize 안 함) |
| **D** | concurrency clamp 의 가시화 = **frontend canvas warningRules** (옵션 d4) | **cross-node warningRule 인프라 신규**. → **선행 plan `cross-node-warning-rules.md` 분리** (결정 I) |
| **E** | 중첩 깊이 검증 = **workflow 저장 API validate (사전 reject) + frontend canvas warningRules + runtime planParallelBody (3중 가드)** (옵션 e2 + e3) | workflow save endpoint 의 validate 확장 — D 와 함께 → **선행 plan `cross-node-warning-rules.md` 분리** (결정 I). runtime 단계는 본 plan #3 유지 |
| **F** | waitAll=false 의 이중 emit 처리 = **engine dispatch 모델 변경** (옵션 f3) — branch 서브그래프 진입 dispatch 와 외부 다운스트림 dispatch 의 채널 분리 | **엔진 dispatch 모델의 구조 변경**. Loop / ForEach / Map 등 다른 컨테이너 노드의 fan-out 동작에도 영향 가능 — 회귀 잠금 필수. 본 plan 내 처리 |
| **G** | `parentEffectiveConcurrency` 전파 = **`ExecutionContext.parentParallelConcurrency?: number` 신규 필드** (옵션 g1) | ExecutionContext 인터페이스 1필드 추가. 본 plan 내 처리 |

### 3차 결정 (3건 — scope 분리 / 안전벨트)

| ID | 결정 |
|----|------|
| **H** | 결정 A 의 cancellation 인프라를 **별 plan [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) 로 분리**. 본 plan §5 는 그 plan 에 의존하는 Parallel 노드 단위 표면만 처리 |
| **I** | 결정 D + E 의 cross-node warningRule 인프라 + workflow save validate 확장을 **별 plan [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) 로 분리**. 본 plan §6 은 그 plan 에 의존하는 Parallel 노드용 rule 등재만 처리 |
| **J** | `validateParallelConfig` 의 waitAll=false + errorPolicy=stop 조합 = **reject** (silent normalize 안 함). UI lock 통과한 외부 API 직접 호출 / 옛 워크플로우 마이그레이션 케이스를 명시적으로 차단 |

## 배경

PRD 시절 PRD 3 §4.9 ND-PL-01~04 (현재는 [`spec/4-nodes/_product-overview.md`](../../spec/4-nodes/_product-overview.md) §4.10 으로 이관) + PRD 0 §6.2~§6.3 (현재 [`spec/0-overview.md`](../../spec/0-overview.md) §노드 시스템 / §확장 노드 로드맵) 에서 Parallel 노드 P1 (`PARALLEL_ENGINE=v1` 환경변수 활성, `p-limit` + `Promise.allSettled`, branchCount 2~16, maxConcurrency 0~16) 은 ✅. P2 로 남은 항목:

- 중첩 Parallel (현재 graph 검증에서 reject — `PARALLEL_NESTED_NOT_SUPPORTED`)
- `waitAll: false` (schema 에 있으나 엔진 무시 + warn 로그)
- ~~`errorPolicy` schema 노출 (엔진은 구현, schema 미노출 → 기본값 `stop` 으로만 동작)~~ → **2026-05-17 commit `1ded2c57` (W-7) 로 schema·엔진·spec·backend 테스트 완료**. **frontend 설정 패널 dropdown 만 잔여**.
- ND-PL-03 결과 합산 (현재 Merge `wait_all` 우회)

## 관련 문서 (경로 갱신 — `prd/` → `spec/`, `user_memo/` 삭제)

- [`spec/4-nodes/_product-overview.md`](../../spec/4-nodes/_product-overview.md) §4.10 Parallel (ND-PL-01~04 표)
- [`spec/0-overview.md`](../../spec/0-overview.md) §노드 시스템 / §확장 노드 로드맵 (P2 박스)
- [`spec/4-nodes/1-logic/10-parallel.md`](../../spec/4-nodes/1-logic/10-parallel.md) §1 (P2 박스), §3 (`config.waitAll` raw echo), §6 (graph 검증)
- [`codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts`](../../codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts) (P1 엔진 — `containers/` 하위)
- [`codebase/backend/src/nodes/logic/parallel/parallel.schema.ts`](../../codebase/backend/src/nodes/logic/parallel/parallel.schema.ts) / `parallel.handler.ts`
- [`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`](../../codebase/backend/src/modules/execution-engine/execution-engine.service.ts) (중첩 reject 위치 ~L6483, `waitAll` warn 위치 ~L6813)
- [`codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx`](../../codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx) `ParallelConfig` (~L545 — errorPolicy dropdown 미존재)

> ⚠ 옛 plan 본문이 인용한 `user_memo/node-specs-improvement/logic/parallel.md` 는 더 이상 존재하지 않는다 (memory/·user_memo/ 가 `plan/complete/archive/from-*/` 로 흡수). 의사결정 근거는 spec 본문 + 본 plan 으로 일원화한다.

## 작업 단위

### 1. errorPolicy schema 노출 (가장 작은 단위, 선행)

> **2026-05-17 commit `1ded2c57` (W-7) 로 backend / spec / 테스트 완료**. frontend dropdown 만 잔여.

- [x] `parallel.schema.ts` 에 `errorPolicy` enum 필드 추가 (`stop` | `continue`) — 기본값 `stop`, `.meta({ ui: { widget: 'select', ... } })` 명시 (`parallel.schema.ts:69-78`)
- [x] `validateParallelConfig`: enum 외 값 reject (`parallel.schema.ts:129-135`)
- [x] `parallel.handler.ts`: `rawConfig.errorPolicy` 를 config echo 에 포함 (L57)
- [x] `ExecutionEngineService.runParallel`: `config.errorPolicy` 명시 시 직접 사용, 미지정 시 공통 `errorHandling.policy` 매핑으로 fallback (`execution-engine.service.ts:6820-6838`)
- [x] backend 단위 테스트 — `parallel.schema.spec.ts` (L12, L34, L166, L172), `parallel-executor.spec.ts` (L109 stop, L126 continue)
- [x] spec `10-parallel.md` §1 (errorPolicy 행 추가) + §3 UI 박스 (`Error Policy [stop ▾]`) + §4 실행 로직 5번 (errorPolicy 적용) + §6 에러 코드 표 갱신
- [ ] **frontend Parallel 설정 패널** (`logic-configs.tsx ParallelConfig` ~L545) 에 `errorPolicy` `SelectField` 추가 (Map/ForEach 패턴 모방: `errStop` / `errContinue` 옵션. `errSkip` 는 parallel 미지원이므로 제외)
- [ ] frontend 단위 테스트 — `ParallelConfig` 가 `errorPolicy` 변경을 onChange 로 전달하는지

### 2. `waitAll: false` 활성화 (emit 모델: branch_i 즉시 + done 일괄, 결정 #2 + F + C)

**결정 (2026-05-30)**: 활성화. emit 모델 = 각 `branch_i` 포트가 자기 분기 완료 시 즉시 다운스트림을 트리거, `done` 포트는 모든 분기 완료 후 1회 emit. dispatch 구현 = 결정 F (engine dispatch 모델 분리). errorPolicy 조합 = 결정 C (waitAll=false 시 continue 강제).

> 현 P1 동작: `branch_0` ~ `branch_{N-1}` 이 fan-out 시작 시점에 한꺼번에 활성화되고, 엔진이 토폴로지 순서로 분기 서브그래프를 처리한 뒤 `done` 으로 합산 emit. waitAll=false 활성화의 핵심은 분기 완료 시점에 자기 branch_i 의 외부 다운스트림이 즉시 트리거 되도록 dispatch 채널을 분리하는 것 (F).

#### 2-A. Engine dispatch 모델 채널 분리 (결정 F, 큰 작업)

- [ ] `ExecutionEngineService` dispatch 흐름에서 컨테이너 노드의 fan-out 을 두 채널로 분리:
  - **채널 1 (branch-internal dispatch)**: `branch_i` 가 분기 서브그래프 진입 트리거 (현재 동작 — fan-out 시점에 활성화)
  - **채널 2 (branch-external dispatch)**: `branch_i` 가 외부 (Parallel 노드 밖) 다운스트림 트리거 — 분기 완료 시점에 자기 terminal 출력으로 발화
  - 두 채널을 어떻게 routing 분리할지 설계 (예: `Edge.targetNodeId` 가 Parallel body 안인지 밖인지로 판별)
- [ ] 영향 범위 회귀 잠금 — Loop / ForEach / Map 등 다른 컨테이너 노드의 fan-out → 다운스트림 dispatch 패턴이 본 변경에 영향받는지 검토 + 통합 테스트
  - 후보: `executeLoopBranchBody`, `executeForEachBranchBody`, `executeMapBranchBody` 등의 dispatch 경로
  - **리스크 高** — Loop/ForEach 의 P1 회귀 시 본 plan 차단됨
- [ ] dispatch 모델 변경의 spec 영향 검토 — [`spec/conventions/node-output.md`](../../spec/conventions/node-output.md) Principle 4/5 (port 출력 컨트랙트) 와 정합성 보강

#### 2-B. ParallelExecutor 분기 완료 시점 콜백 + waitAll=false 분기 (결정 #2)

- [ ] `ParallelExecutor` 인터페이스 확장 — 분기 완료 시점 콜백 (`onBranchComplete(branchIndex, branchContext, terminalOutput)`) 도입. `Promise.allSettled` 안에서 각 `runBranch` 가 resolve 되는 시점에 콜백 호출
- [ ] `ExecutionEngineService.runParallel` — `waitAll=false` 분기:
  - 각 `runBranch` 완료 시점에 자기 branch 의 terminal 노드 출력을 채널 2 (branch-external) 로 발화
  - `done` 포트는 기존처럼 모든 분기 완료 후 1회 emit (`branches: [...]`)
  - `waitAll=true` 분기: 현 P1 동작 그대로 (변경 없음). warn 로그 (`execution-engine.service.ts:6813-6818`) 제거

#### 2-C. waitAll=false × errorPolicy=continue 강제 (결정 C)

- [ ] **엔진 강제**: `runParallel` 가 `waitAll=false` + effective errorPolicy 계산 시 — 사용자 명시 값이 `stop` 이어도 `continue` 로 강제 (`execution-engine.service.ts:6820-6838` 근처에서 처리). 강제 발생 시 debug 로그
- [ ] **schema validate 안전벨트** (결정 J): `validateParallelConfig` 에서 `waitAll === false && errorPolicy === 'stop'` 조합 시 **reject** (사용자 의도 보호 — silent normalize 안 함). 에러 메시지: `"errorPolicy 'stop' is not allowed when waitAll=false. Use 'continue' or set waitAll=true."`. UI lock 이 있으므로 정상 케이스는 schema validate 까지 오지 않음 — reject 는 외부 API 직접 호출 / 옛 워크플로우 마이그레이션 케이스의 가드
- [ ] **frontend `ParallelConfig` UI lock**:
  - `waitAll=false` 일 때 errorPolicy `SelectField` 가 `disabled` + value 가 `continue` 로 고정
  - `waitAll=false` 일 때 errorPolicy 옆에 hint: "waitAll=false 에서는 errorPolicy 가 continue 로 고정됩니다"
  - `waitAll=true ↔ false` 전환 시 자동 재기록 (false 진입 시 continue, true 복귀 시 사용자 직전 선택 또는 default stop 복원)
- [ ] **spec 갱신**: `10-parallel.md` §1 errorPolicy 행에 "waitAll=false 시 continue 로 고정" 명시 + § Rationale 에 "왜 continue 강제인가" 근거 추가

#### 2-D. spec / 테스트 (#2 공통)

- [ ] spec `10-parallel.md` 갱신:
  - §1 `waitAll` 행: P1 미구현 캐비엣 (L23) → "true: 모든 분기 완료 후 다운스트림 트리거 / false: 각 분기 완료 시 자기 `branch_i` 다운스트림 즉시 트리거 + `done` 은 모든 분기 완료 후 합산. errorPolicy 는 continue 로 고정" 설명으로 치환
  - §1 표 아래 "⚠ 미구현 (P1)" 박스 (L30) 제거
  - §4 실행 로직 — waitAll=false 분기의 emit 시점 step 추가 + dispatch 채널 2 (branch-external) 명세
  - §5.1 / §5.2 — waitAll=false 일 때 `branch_i` 의 두 시점 emit 명시 (fan-out 시 활성화 + 분기 완료 시 terminal output emit). 다운스트림은 두 번째 emit 만 의미 있음을 명문화
- [ ] frontend `ParallelConfig` 의 `waitAll` `CheckboxField` hint 텍스트 갱신
- [ ] 단위 테스트 (`parallel-executor.spec.ts`) — waitAll=false 모드의 emit 콜백 호출 순서/시점 검증
- [ ] 통합 테스트 (`execution-engine.service.spec.ts`) — waitAll=false 워크플로우에서 빠른 분기의 다운스트림이 느린 분기 완료 전에 실행되는지 검증
- [ ] 통합 테스트 — waitAll=false × errorPolicy=stop 조합이 effective continue 로 동작하는지 검증

### 3. 중첩 Parallel 허용 (깊이 ≤ 2, concurrency cap ≤ 32, 결정 #3 + G)

**결정 (2026-05-30)**: 중첩 허용. 깊이 한도 = **2** (3중 이상 reject). 외부 × 내부 effectiveConcurrency 곱셈 cap = **32**. enforcement = 깊이 정적 (planParallelBody) + concurrency runtime silent clamp. 전파 = `ExecutionContext.parentParallelConcurrency` 신규 필드 (G).

> 현재 graph 검증에서 무조건 reject (`execution-engine.service.ts:6481-6485` — `PARALLEL_NESTED_NOT_SUPPORTED` throw). depth 2 까지 허용 + cap 으로 worker 폭발 방지.

#### 3-A. ExecutionContext 신규 필드 (결정 G)

- [ ] `ExecutionContext` (`codebase/backend/src/nodes/core/node-handler.interface.ts`) 에 `parentParallelConcurrency?: number` 신규 필드 추가 + JSDoc — "외부 Parallel 이 자기 effectiveConcurrency 를 branch 진입 시 이 필드에 set. 내부 Parallel 이 이를 읽어 자기 effectiveConcurrency 를 clamp"
- [ ] `ParallelExecutor` 가 branch context clone 시 `parentParallelConcurrency` 를 자기 `effectiveConcurrency` 로 set (overwrite — 깊이 ≤ 2 가드 하에 한 단계만 set)
- [ ] 내부 ParallelExecutor 가 자기 `effectiveConcurrency` 계산 시 `parentParallelConcurrency` 가 있으면 `Math.floor(32 / parentParallelConcurrency)` 로 cap 적용 (silent clamp)
- [ ] context clone 의 격리 (`variables` `structuredClone`, `nodeOutputCache` shallow copy — `parallel-executor.ts:65-91`) 와 신규 필드 전파의 양립 확인

#### 3-B. graph 정적 검증 (깊이 ≤ 2)

- [ ] `planParallelBody` (`execution-engine.service.ts:6481-6485`) 의 reject 규칙 수정:
  - 기존 `PARALLEL_NESTED_NOT_SUPPORTED` 무조건 throw 제거
  - 재귀 깊이 계산: 외부 Parallel 의 분기 서브그래프 안에 다른 Parallel 노드가 있으면 depth=2 로 카운팅. 그 내부 분기에 또 Parallel 이 있으면 depth=3 → reject
  - 깊이 > 2 시 새 에러 코드 `PARALLEL_NESTED_DEPTH_EXCEEDED` throw (메시지: 외부/내부/3중 노드 라벨을 포함해 사용자가 어디서 발생했는지 알 수 있도록)

#### 3-C. runtime concurrency clamp

- [ ] 내부 ParallelExecutor 가 외부 × 내부 effective > 32 면 자기 effectiveConcurrency 를 `Math.floor(32 / parent)` 로 clamp
- [ ] clamp 발생 시 `NodeExecution.meta.clampedConcurrency = { intended, actual, parentEffective, cap: 32 }` 기록 (run-results timeline 에서 사용자가 확인 가능 — D 의 frontend 사전 경고와 별개로 runtime 추적성 확보)
- [ ] clamp debug 로그 (운영 환경 OFF 가능)

#### 3-D. spec / 테스트

- [ ] 단위 테스트 (`parallel-executor.spec.ts`) — 2층 중첩 시나리오 (외부 4 × 내부 8 = 32 OK, 외부 4 × 내부 16 = clamp 8, 외부 8 × 내부 8 = clamp 4 등)
- [ ] 통합 테스트 (`execution-engine.service.spec.ts`) — 3층 중첩 워크플로우가 `PARALLEL_NESTED_DEPTH_EXCEEDED` 로 사전 reject 되는지
- [ ] spec `10-parallel.md` 갱신:
  - §6 에러 코드 표 — `PARALLEL_NESTED_NOT_SUPPORTED` 행을 `PARALLEL_NESTED_DEPTH_EXCEEDED` (depth > 2) 로 치환
  - §6 graph 검증 표 — "중첩 Parallel 금지" 행 제거, "중첩 depth ≤ 2 허용" / "concurrency 곱셈 cap = 32 (runtime silent clamp + meta 기록)" 행 추가
  - § Rationale — "왜 깊이 2 인가" / "왜 cap 32 인가" / "왜 silent clamp 인가" 명시
- [ ] [`spec/4-nodes/_product-overview.md:135`](../../spec/4-nodes/_product-overview.md) "중첩 Parallel 금지(P2 예정)" 문구 → "중첩 Parallel 허용 (depth ≤ 2, concurrency 곱셈 cap = 32 silent clamp)" 로 치환
- [ ] [`spec/0-overview.md`](../../spec/0-overview.md) Parallel P1 박스 (§85) 의 "중첩 Parallel 은 금지" / "P2에서 중첩 Parallel과 waitAll=false를 추가할 예정" 문구 갱신

### 3-E. (삭제됨 — #5 로 격상 + 인프라는 선행 plan 분리)

> 결정 H (2026-05-30): cancellation 인프라는 별 plan [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) 로 분리. 본 plan 의 Parallel 노드 단위 작업은 §5 로 격상.

### 3-F. (삭제됨 — #6 으로 격상 + 인프라는 선행 plan 분리)

> 결정 I (2026-05-30): cross-node warningRule 인프라 + workflow 저장 API validate 확장은 별 plan [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) 로 분리. 본 plan 의 Parallel 노드용 rule 등재 작업은 §6 으로 격상.

### 4. PARALLEL_ENGINE=v1 default ON 전환 (결정 B)

**작은 작업 — 환경변수 default 만 변경, 게이트는 롤백 카드로 유지.**

- [ ] 환경변수 default 변경 위치 확인 (configService / config 모듈) 후 `PARALLEL_ENGINE=v1` 을 default ON 으로 전환
- [ ] `.env.example` / `codebase/backend/.env.example` 갱신 + 주석: "default ON. 회귀 시 `PARALLEL_ENGINE=off` 로 환경변수 게이트로 P0 sequential 동작 복원"
- [ ] spec `10-parallel.md` §1 상단 P1 박스 (L13) 의 "기본값(`off`)이면 엔진이 토폴로지 순서로 순차 진행" 문구 갱신 → "기본값 ON. `PARALLEL_ENGINE=off` 로 롤백 가능"
- [ ] `spec/4-nodes/_product-overview.md:135` § Parallel 박스 동일 갱신
- [ ] `spec/0-overview.md` §85 Parallel 노드 박스 갱신 — "`PARALLEL_ENGINE=v1` 환경변수로 활성화 시" 문구를 "default ON" 으로
- [ ] 회귀 테스트 — default ON 환경에서 기존 P1 통합 테스트 모두 통과

### 5. `cancel-others-on-fail` errorPolicy 추가 — Parallel 노드 단위 (결정 A, 선행 plan 의존)

**선행 plan**: [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) — `NodeHandler.execute(..., signal?)` 인터페이스, `ExecutionContext.abortSignal?`, 외부 I/O 노드 (HTTP/DB/AI) 의 signal 전파. 본 작업 단위는 그 인프라 위에서 Parallel 노드 단의 표면만 처리.

- [ ] 선행 plan 완료 확인 — `ExecutionContext.abortSignal` 필드와 외부 I/O 노드 (최소 HTTP) 의 signal 전파가 제공되는지
- [ ] `parallelNodeConfigSchema.errorPolicy` enum 확장: `'stop' | 'continue' | 'cancel-others-on-fail'`
- [ ] `validateParallelConfig` 에서 새 값 허용
- [ ] `parallel.handler.ts` config echo 에 그대로 전달
- [ ] `ParallelExecutor.execute` 가 `errorPolicy === 'cancel-others-on-fail'` 일 때 — 내부 `AbortController` 생성, 첫 분기 실패 시 `controller.abort()` 호출, 각 branchContext.abortSignal 에 set (선행 plan 의 ExecutionContext 신규 필드 활용)
- [ ] frontend `ParallelConfig` SelectField 옵션 추가 (`errCancelOthersOnFail`) + i18n KO/EN 추가
- [ ] spec `10-parallel.md` §1 errorPolicy 행 + §4 실행 로직 + §6 에러 코드 표 갱신 — abort signal 전파 + best-effort 의미 명시
- [ ] 사용자 가이드 (`codebase/frontend/src/content/docs/02-nodes/logic.mdx` + `logic.en.mdx`) errorPolicy 행 갱신
- [ ] 단위 테스트 (`parallel-executor.spec.ts`) — abort 콜백 시점/순서 검증
- [ ] 통합 테스트 — HTTP 노드를 사용한 분기에서 첫 실패 시 나머지 분기의 HTTP 가 abort 되는지 (선행 plan 의 HTTP signal 전파 활용)

### 6. Parallel cross-node warningRule 등재 (결정 D + E, 선행 plan 의존)

**선행 plan**: [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) — cross-node warningRule 메커니즘 (e.g., `graphWarningRules` 신규 키), frontend canvas 평가 인프라, backend workflow save endpoint validate 확장.

- [ ] 선행 plan 완료 확인 — cross-node warningRule 등재 API + save validate 평가가 가능한지
- [ ] Parallel 노드용 cross-node rule 등재:
  - `parallel:nested-depth-exceeded` — 깊이 > 2 시 reject (저장 차단 + canvas error 배지 + runtime `PARALLEL_NESTED_DEPTH_EXCEEDED` 와 메시지 일관성)
  - `parallel:nested-concurrency-cap` — 외부 maxConcurrency × 내부 maxConcurrency > 32 시 경고 (저장은 통과, canvas warning 배지, runtime 은 silent clamp + meta 기록 그대로 유지)
- [ ] 3중 가드 메시지 일관성 — 저장 reject 메시지, canvas 배지 텍스트, runtime throw 메시지가 동일한 사용자 멘탈 모델
- [ ] spec `10-parallel.md` §6 graph 검증 표 갱신 — "저장 단계 / canvas / runtime 3중 가드" 명시
- [ ] e2e 테스트 — 3층 중첩 워크플로우 저장 시도 시 frontend 에서 저장 버튼이 disabled / 에러 표시되는지

### 7. ND-PL-03 결과 합산 — `done` 포트 그대로 ✅ 격상

**결정 (2026-05-30)**: 현 `done` 포트 그대로 ✅ 격상. schema/handler/엔진 변경 없음. W-7 완료 후 `done` 포트가 이미 `{ branches: [...] }` 합산을 emit 중이므로 (`spec/4-nodes/1-logic/10-parallel.md:104-116` §5.2) 사실상 ND-PL-03 충족.

- [ ] [`spec/4-nodes/_product-overview.md:141`](../../spec/4-nodes/_product-overview.md) ND-PL-03 상태: `🚧 (Merge wait_all 조합으로 우회)` → `✅` 갱신 + 옆 설명에 "Parallel 노드의 `done` 포트가 `{ branches: [...] }` 로 직접 합산. Merge 우회는 선택 사항으로 유지" 추가

### 8. Spec 상태 표기 갱신 (옛 PRD §6.2 / §6.3 → 현 spec 위치)

> `prd/` 폴더는 spec 통합 (commit `236d959e`) 으로 삭제됨. 갱신 대상은 모두 `spec/` 하위. 본 작업은 #2/#3/#4 구현 후 한 PR 에 묶어서 처리 (개별 spec 변경은 각 작업 단위에 이미 포함됨 — 본 항목은 cross-cutting 박스/표 갱신만).

- [ ] [`spec/4-nodes/_product-overview.md:135`](../../spec/4-nodes/_product-overview.md) §4.10 Parallel 박스 — "중첩 Parallel 금지(P2 예정) / waitAll은 항상 true / P2에서 추가 예정" 문구 일괄 치환:
  - "중첩 Parallel 은 depth ≤ 2 까지 허용 (concurrency 곱셈 cap = 32 silent clamp)"
  - "waitAll: false 활성 — 각 분기 완료 시 자기 `branch_i` 다운스트림 즉시 트리거, `done` 은 모든 분기 완료 후 합산 1회 emit"
- [ ] [`spec/0-overview.md`](../../spec/0-overview.md) §85 "Parallel 노드 (P1)" 박스 — P2 항목 정리 (중첩/waitAll 모두 활성 반영)
- [ ] [`spec/0-overview.md`](../../spec/0-overview.md) §93 "Logic 확장 노드" 행 — "Parallel P2(중첩 Parallel, waitAll=false)" 항목 제거 (✅ 완료로 격하)
- [ ] [`plan/in-progress/0-unimplemented-overview.md`](./0-unimplemented-overview.md) L65 cross-link 표 — "P2 예정" → "✅ 완료" 또는 항목 제거

### 9. 검증

- [ ] backend lint / unit / integration / build
- [ ] frontend lint / unit / build (#1 의 errorPolicy dropdown 추가 시 필수)
- [ ] 회귀: P1 동작 (`PARALLEL_ENGINE=v1`, branchCount 2~16, maxConcurrency 0~16, blocking 노드/back-edge 금지) 가 깨지지 않음
- [ ] `ai-review` 실행 → Concurrency / Performance 중심 — Critical/Warning 해소

## 수용 기준

- ND-PL-01~04 가 `spec/4-nodes/_product-overview.md` 에서 **모두 ✅** (ND-PL-03 격상 포함)
- `spec/4-nodes/1-logic/10-parallel.md` 의 P1/P2 미구현 박스 (L23, L30, L168) 모두 제거
- frontend `ParallelConfig` 가 errorPolicy 를 노출 + waitAll=false 시 errorPolicy lock 동작
- `PARALLEL_ENGINE` default ON 환경에서 기존 P1 + 새 P2 통합 테스트 모두 통과
- `waitAll=false` 워크플로우에서 빠른 분기의 다운스트림이 느린 분기 완료 전에 실행됨을 통합 테스트가 잠금
- `waitAll=false` × `errorPolicy=stop` 조합이 effective continue 로 동작
- 2층 중첩 Parallel (depth=2) 워크플로우가 동작 + 3층 중첩이 저장 시점 / canvas 시점 / runtime 시점 모두에서 reject (3중 가드)
- 중첩 시 외부 × 내부 effectiveConcurrency 가 32 를 초과하지 않음 (runtime clamp + `NodeExecution.meta.clampedConcurrency` 기록)
- frontend canvas 가 외부 × 내부 maxConcurrency > 32 시 경고 배지 표시 (cross-node warningRule 인프라)
- `cancel-others-on-fail` 정책에서 첫 분기 실패 시 다른 분기의 외부 I/O (HTTP/DB/AI) 가 abort 됨을 통합 테스트가 잠금
- 회귀 테스트가 P1 + P2 동작을 모두 잠금. Loop/ForEach/Map dispatch 회귀 0
- ai-review Critical/Warning 0

## 작업 순서 권고 (PR 분할 권장)

> 결정 H/I 로 인프라 부분이 별 plan 으로 분리됨. 본 plan 의 PR 분할은 인프라 plan 완료 의존.

| 순서 | 작업 단위 | 의존 / 비고 |
|------|----------|-------------|
| 1 | **#1 잔여** (frontend errorPolicy dropdown) | 독립 — 즉시 처리 가능. 가장 작은 가치 단위 |
| 2 | **#4 PARALLEL_ENGINE default ON** (결정 B) | 독립 — P1 회귀만 확인. 환경변수 1줄 + spec 박스 갱신 |
| 3 | **#2 waitAll=false 활성화** (결정 #2 + F + C + J) | F (dispatch 채널 분리) 가 Loop/ForEach/Map 회귀 위험 — 단계적 PR 권장 (2-A engine 채널 분리 → 2-B ParallelExecutor 콜백 → 2-C UI lock + reject 안전벨트 → 2-D spec/test) |
| 4 | **#3 중첩 Parallel** (결정 #3 + G) | #2 의 ParallelExecutor 변경 후 |
| 5 | **선행 plan [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) 완료 대기** | 인프라 + workflow save validate 확장 + frontend canvas 평가 인프라 |
| 6 | **#6 Parallel cross-node rule 등재** (결정 D + E) | 위 선행 plan 완료 후 |
| 7 | **선행 plan [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) 완료 대기** | `NodeHandler.execute(..., signal?)` 인터페이스 + `ExecutionContext.abortSignal` + 외부 I/O 노드 (HTTP/DB/AI) signal 전파 |
| 8 | **#5 cancel-others-on-fail Parallel 단위** (결정 A) | 위 선행 plan 완료 후 |
| 9 | **#7 ND-PL-03 ✅ 격상** + **#8 spec 일괄 갱신** | 위 모두 안정화 후 한 PR |
| 10 | **#9 검증** | 각 PR 단위로 lint/unit/integration/build + ai-review |

> 본 plan 의 #1 / #2 / #3 / #4 는 선행 plan 없이 진행 가능. #5 / #6 은 선행 plan 완료 후 진행.

## 의존성·리스크

- **의존**:
  - `merge-p2-async-fanin.md` 와 병렬 진행 가능 (Logic 카테고리 같지만 영향 범위 다름)
  - **3-F cross-node warningRule 인프라가 별 plan 으로 분리될 경우 본 plan #3 (특히 D/E 부분) 가 그 plan 에 의존**
  - **3-E cancellation 인프라가 별 plan 으로 분리될 경우 본 plan A 결정 부분이 그 plan 에 의존**
- **리스크** (높음 → 낮음 순):
  - **F (engine dispatch 모델 분리)** — Loop/ForEach/Map 등 다른 컨테이너 노드의 fan-out → 외부 다운스트림 dispatch 가 영향받을 수 있음. 회귀 잠금 실패 시 본 plan 차단됨. 첫 PR 에 통합 테스트 충분히 추가 필수
  - **A (cancellation 인프라)** — `NodeHandler` 인터페이스 변경 = 모든 노드 구현체 시그니처 변경. 본 plan 안에 두면 PR 크기 폭증. 별 plan 분리 강력 권고
  - **D/E (cross-node warningRules)** — 신규 인프라 작업. 본 plan 안에 두면 frontend canvas 평가 엔진 / backend save validate 동시 변경. 별 plan 분리 권고
  - 중첩 Parallel 의 worker 폭발 — 깊이 ≤ 2 + concurrency 곱셈 cap = 32 silent clamp 로 방어. silent clamp 의 가시성을 `NodeExecution.meta.clampedConcurrency` (runtime) + cross-node warningRule (frontend 사전) 로 이중 확보
  - `waitAll: false` 의 이중 emit — F (채널 분리) 로 처리되나, 첫 emit (fan-out 시점 활성화) 과 두 번째 emit (분기 완료 시점 terminal) 이 같은 sourceNodeId 에서 발생. 외부 다운스트림은 채널 2 만 받도록 routing 명확화 필요
  - **PARALLEL_ENGINE default ON 회귀** — default 변경 후 P0 sequential 동작이 환경변수 OFF 로만 복원되는데, CI / dev 환경에서 OFF case 가 충분히 테스트되는지 검증 필요
  - 본 plan 의 #1 잔여 (frontend dropdown) 가 누락된 상태로 다른 작업 단위가 진행되면 사용자는 errorPolicy 를 UI 에서 설정할 수 없음 — #1 을 우선 마무리

## 선행 plan (결정 H + I 로 분리)

| 선행 plan | 의존하는 본 plan 작업 | 책임 범위 |
|-----------|---------------------|----------|
| [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) | §5 cancel-others-on-fail | `NodeHandler.execute(..., signal?: AbortSignal)` 인터페이스 + `ExecutionContext.abortSignal?` 신규 + 외부 I/O 노드 (HTTP/DB/AI) 의 signal 전파. 향후 Workflow timeout / 사용자 cancel 버튼 등에도 재사용 |
| [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) | §6 Parallel cross-node rule 등재 | cross-node warningRule 메커니즘 (e.g., `graphWarningRules` 신규 키) + frontend canvas 평가 인프라 + backend workflow save endpoint validate 확장. 다른 노드 (Loop / ForEach / Map 등) 의 향후 cross-node 검증에도 재사용 |

## 변경 이력

- **2026-05-11**: 최초 작성 (4개 작업 단위 + 검증)
- **2026-05-17** (commit `1ded2c57`, W-7): #1 errorPolicy 의 backend / spec / 단위 테스트 완료. frontend UI dropdown 만 잔여
- **2026-05-30 (오전)**: 본 plan 최신화 — #1 진행 상태 반영, 옛 `prd/` 경로 → 현 `spec/` 경로 치환, `user_memo/` 참조 제거, `parallel-executor.ts` 위치를 `containers/` 하위로 정정, ND-PL-03 사실상 직접 합산 경로 보유 사실 #4 에 추가
- **2026-05-30 (오후)**: 사용자 결정 확정 — #2 활성화 (emit 모델: branch_i 즉시 + done 일괄), #3 깊이 = 2 + concurrency cap = 32 (정적/runtime 혼합 enforcement), #4 done 포트 그대로 ✅ 격상. 각 작업 단위에 sub-task 구체화 + 작업 순서/scope 밖 항목 명시
- **2026-05-30 (밤)**: 2차 사용자 결정 7건 확정 — A `cancel-others-on-fail` 추가, B PARALLEL_ENGINE default ON, C waitAll=false 시 errorPolicy=continue 강제 + UI lock, D 사전 경고 frontend cross-node warningRule, E 저장 단계 reject + canvas + runtime 3중 가드, F engine dispatch 채널 분리, G `ExecutionContext.parentParallelConcurrency` 신규 필드. plan scope 가 cross-node warningRule 인프라 + cancellation 인프라까지 확장됨에 따라 **3-E (cancellation) / 3-F (cross-node warningRule) 의 별 plan 분리 권고** 명시
- **2026-05-30 (심야)**: 3차 결정 3건 확정 — H/I 별 plan 분리 권고 채택 (`node-cancellation-infrastructure.md` / `cross-node-warning-rules.md` 신규 작성), J waitAll=false × errorPolicy=stop 조합 schema validate 단계에서 reject. 본 plan 의 3-E → §5 (선행 plan 의존), 3-F → §6 (선행 plan 의존) 으로 격상 + 강등. 작업 단위 9개로 재정렬
