# Parallel 노드 P2 (중첩·`waitAll: false`·`errorPolicy` 노출) — ✅ 완료

> **상태**: ✅ 완료 (2026-05-30) — 모든 sub-task [x]. 후속 점진 강화 항목은 [`parallel-p2-followups.md`](./parallel-p2-followups.md) 로 분리. `plan/complete/` 는 git 비추적 정책이라 본 plan 은 in-progress/ 에 그대로 두되 상태 표기로 완료를 표시.
>
> 작성일: 2026-05-11
> 최신화: 2026-05-30 — `#1 errorPolicy schema 노출` 부분 완료 (frontend UI dropdown 만 잔여), 경로 참조 stale 갱신
> 결정 완료: 2026-05-30 — 1차 결정 4건 + 2차 결정 7건 + 3차 결정 3건 + 4차 결정 K (`## 결정 사항` 참조)
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/02-parallel-node.md` (P1 완료)
> 머지된 PR: #362 (plan refresh) / #363 (frontend errorPolicy dropdown) / #364 (PARALLEL_ENGINE default ON) / #366 (waitAll spec out) / #367 (중첩 Parallel) / #368 (cross-node-warning-rules MVP) / #369 (cancellation 인프라 MVP) / #370 (cancel-others-on-fail) + finalize PR
> 후속 점진 강화: [`parallel-p2-followups.md`](./parallel-p2-followups.md) (signal-aware 노드 확장 / frontend canvas 통합 / workflow save hook / 통합 테스트 / ai-review)

## 결정 사항 (2026-05-30 사용자 확정)

### 1차 결정 (4건)

| ID | 결정 |
|----|------|
| ~~**#2 waitAll: false**~~ | ~~**활성화**~~ → **4차 결정 K (2026-05-30) 로 변경: spec out** — `waitAll=true` 만 명시적 지원. 결정 F (engine dispatch 채널 분리) / 결정 C (errorPolicy=continue 강제) / 결정 J 의 sub-decision 모두 무효화 |
| **#3 중첩 Parallel** | **허용** — 깊이 한도 = **2** (3중 이상은 reject). 외부 × 내부 effectiveConcurrency 곱셈 cap = **32** |
| **#3 enforcement** | 깊이 cap (≤ 2) = **graph 정적 검증**. concurrency 곱셈 cap (≤ 32) = **runtime silent clamp** |
| **#4 ND-PL-03** | 현 `done` 포트 그대로 **✅ 격상** — schema/handler 변경 없음 |

### 2차 결정 (7건 — 본 plan scope 확장)

| ID | 결정 | 영향 |
|----|------|------|
| **A** | `errorPolicy` 에 **`cancel-others-on-fail`** 추가 (옵션 a3) — 첫 실패 시 다른 분기 abort | **AbortController 기반 cancellation 인프라 신규**. → **선행 plan `node-cancellation-infrastructure.md` 분리** (결정 H) |
| **B** | `PARALLEL_ENGINE=v1` **default ON 전환 + 게이트 유지** (옵션 b2) — 본 plan 내 처리 | `.env.example` / 환경변수 기본값만 변경. 게이트 자체는 롤백 카드로 유지 |
| ~~**C**~~ | ~~waitAll=false 시 errorPolicy 를 `continue` 로 강제 + UI lock~~ → **결정 K 로 무효화** (waitAll=false 자체가 사라지므로 errorPolicy 조합 의미 없음) |
| **D** | concurrency clamp 의 가시화 = **frontend canvas warningRules** (옵션 d4) | **cross-node warningRule 인프라 신규**. → **선행 plan `cross-node-warning-rules.md` 분리** (결정 I) |
| **E** | 중첩 깊이 검증 = **workflow 저장 API validate (사전 reject) + frontend canvas warningRules + runtime planParallelBody (3중 가드)** (옵션 e2 + e3) | workflow save endpoint 의 validate 확장 — D 와 함께 → **선행 plan `cross-node-warning-rules.md` 분리** (결정 I). runtime 단계는 본 plan #3 유지 |
| ~~**F**~~ | ~~waitAll=false 의 이중 emit 처리 = engine dispatch 채널 분리~~ → **결정 K 로 무효화** (Plan agent 2026-05-30 분석: Node.js main loop pattern 상 별도 sub-loop 없이는 "분기 완료 즉시 dispatch" 의미 살릴 수 없음. 그에 맞는 sub-loop 도입은 Loop/ForEach/Map cross-container risk 매우 높음. waitAll=false 자체를 spec out 으로 결정) |
| **G** | `parentEffectiveConcurrency` 전파 = **`ExecutionContext.parentParallelConcurrency?: number` 신규 필드** (옵션 g1) | ExecutionContext 인터페이스 1필드 추가. 본 plan 내 처리 |

### 3차 결정 (3건 — scope 분리 / 안전벨트)

| ID | 결정 |
|----|------|
| **H** | 결정 A 의 cancellation 인프라를 **별 plan [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) 로 분리**. 본 plan §5 는 그 plan 에 의존하는 Parallel 노드 단위 표면만 처리 |
| **I** | 결정 D + E 의 cross-node warningRule 인프라 + workflow save validate 확장을 **별 plan [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) 로 분리**. 본 plan §6 은 그 plan 에 의존하는 Parallel 노드용 rule 등재만 처리 |
| ~~**J**~~ | ~~`validateParallelConfig` 의 waitAll=false + errorPolicy=stop 조합 reject~~ → **결정 K 로 단순화**: `validateParallelConfig` 가 `waitAll === false` 자체를 reject |

### 4차 결정 (waitAll=false spec out, 2026-05-30)

> Plan agent 분석 결과 (2026-05-30): waitAll=false 의 "분기 완료 즉시 외부 다운스트림 dispatch" 의미는 Node.js single-threaded main loop pattern 상 별도 sub-loop 없이는 살릴 수 없다. 그에 맞는 sub-loop 도입은 Loop / ForEach / Map cross-container risk 가 매우 높다. 따라서 1차 결정 #2 (활성화) 를 변경하여 waitAll=false 지원 자체를 spec out 한다.

| ID | 결정 |
|----|------|
| **K** | **waitAll=false 지원을 spec out**. `waitAll=true` (default) 만 명시적으로 지원. spec / schema / engine / frontend 모두 일관되게 정리. fire-and-forget 의미가 필요하면 [Background 노드](../../spec/4-nodes/1-logic/12-background.md) 사용 |
| **K-1** | `validateParallelConfig` 에서 `waitAll === false` reject (메시지 명확화) |
| **K-2** | spec `10-parallel.md` §1 의 `waitAll` 행 제거 또는 "지원 안 함" 명시 + § Rationale 에 결정 K 의 근거 (Plan agent 분석) 기록 |
| **K-3** | frontend `ParallelConfig` 에서 `waitAll` `CheckboxField` + 조건부 hint 모두 **제거** (사용자 혼동 방지) |
| **K-4** | engine 의 waitAll=false warn 로그 (`execution-engine.service.ts:6813-6818`) 제거 — schema validate 가 사전 차단하므로 도달 불가 |
| **K-5** | parallel.handler.ts 의 config echo 에서 `waitAll` 필드 — **유지** (옛 워크플로우 마이그레이션 호환성). 단 default `true` 외 값은 schema validate 에서 reject |
| **K-6** | 옛 워크플로우 마이그레이션 (DB 에 `config.waitAll: false` 가 저장된 케이스): **본 plan scope 밖**. 실행 시점에 schema validate 가 reject 함 — 사용자가 워크플로우 편집기에서 수정 필요. 별도 마이그레이션 작업 필요 시 별 plan |

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
- [x] **frontend Parallel 설정 패널** (`logic-configs.tsx ParallelConfig` ~L545) 에 `errorPolicy` `SelectField` 추가 (Map/ForEach 패턴 모방: `errStop` / `errContinue` 옵션. `errSkip` 는 parallel 미지원이므로 제외)
- [x] frontend 단위 테스트 — `ParallelConfig` 가 `errorPolicy` 변경을 onChange 로 전달하는지

### 2. `waitAll: false` 지원 spec out (결정 K, 2026-05-30 4차 결정)

**결정 변경**: 1차 결정 #2 "활성화" → spec out. waitAll=false 의 "분기 완료 즉시 외부 dispatch" 의미는 Node.js single-threaded main loop pattern 상 별도 sub-loop 없이는 살릴 수 없고, 그 sub-loop 도입은 Loop / ForEach / Map cross-container risk 가 매우 높음 (Plan agent 2026-05-30 분석). 따라서 `waitAll=true` 만 명시적으로 지원하고 `waitAll=false` 는 schema 단에서 reject. fire-and-forget 의미가 필요하면 [Background 노드](../../spec/4-nodes/1-logic/12-background.md) 사용.

> 본 결정으로 결정 F (engine dispatch 채널 분리) / 결정 C (errorPolicy=continue 강제) / 결정 J (waitAll=false × errorPolicy=stop 조합 reject) 가 모두 무효화된다. 본 §2 작업은 매우 단순한 spec-out 처리로 축소.

#### 2-A. schema validate reject (결정 K-1)

- [x] `validateParallelConfig` (`codebase/backend/src/nodes/logic/parallel/parallel.schema.ts:97`) 에 `waitAll === false` reject 추가. 에러 메시지: `"waitAll=false is not supported. Use waitAll=true (default) or the Background node for fire-and-forget semantics."`
- [x] schema-level (zod) 차원에서도 `waitAll: z.literal(true).default(true)` 로 좁힐지 검토 — boolean 유지하고 imperative validate 에서만 reject 하는 게 호환성 + 메시지 명확. 본 plan 권고는 후자
- [x] backend 단위 테스트 (`parallel.schema.spec.ts`):
  - `validateParallelConfig({ waitAll: false })` → 에러 메시지 포함 검증
  - `validateParallelConfig({ waitAll: true })` / `validateParallelConfig({})` (default true) → 통과

#### 2-B. engine 정리 (결정 K-4)

- [x] `execution-engine.service.ts:6807-6818` 의 `waitAll` 변수 추출 + warn 로그 제거 — schema validate 가 사전 차단하므로 engine 도달 불가
- [x] `ParallelExecutor.execute` 의 `config.waitAll` 인자 — **호환성 위해 인터페이스는 유지** (`parallel-executor.ts:10`), 내부 동작은 항상 waitAll=true 로 가정 (현 P1 동작 유지)
- [x] backend 통합 테스트 — 기존 P1 통합 테스트가 그대로 통과 (회귀 0)

#### 2-C. frontend UI 제거 (결정 K-3)

- [x] `logic-configs.tsx` `ParallelConfig` (~L545) 의 `waitAll` `CheckboxField` + 조건부 hint (`config.waitAll === false` 분기) 제거
- [x] frontend 단위 테스트 (`parallel-config.test.tsx`, PR #363 신규) 갱신 — waitAll 필드 검증 제거
- [x] i18n key `nodeConfigs.logic.waitAll` / `nodeConfigs.logic.waitAllHint` 사용처가 ParallelConfig 1곳뿐이면 dict 에서도 제거 (다른 사용처 grep 확인 후)

#### 2-D. spec 갱신 (결정 K-2)

- [x] `spec/4-nodes/1-logic/10-parallel.md`:
  - §1 config 표에서 `waitAll` 행 제거 (또는 "지원 안 함, 항상 `true` 동작" 명시)
  - §1 표 하단 "⚠ 미구현 (P1)" 박스 (`waitAll: false` 관련) 제거
  - §2 UI 박스에서 `Wait for All Branches [✓]` 줄 제거
  - §5.1 / §5.2 / §5.7 의 `config.waitAll` 필드 echo 제거
  - § Rationale 에 "왜 waitAll=false 가 spec out 되는가" 단락 추가 — Plan agent 분석 요약 (Node.js single-thread main loop pattern + Background 노드 권고)
- [x] `spec/4-nodes/_product-overview.md` §4.10 박스 (L135) — "waitAll은 항상 true로 동작하며 false는 P2에서 지원 예정이다" → "waitAll은 항상 true 로 동작 (`false` spec out — Background 노드 사용 권고)" 로 갱신
- [x] `spec/0-overview.md` §85 Parallel 노드 (P1) 박스 — "P2에서 waitAll=false 를 추가할 예정" 부분 제거

#### 2-E. 옛 워크플로우 호환 (결정 K-5 / K-6)

- [x] `parallel.handler.ts` 의 `rawConfig.waitAll` config echo — **유지** (옛 워크플로우 마이그레이션 호환성, 변경 없음)
- [x] DB 에 `config.waitAll: false` 가 저장된 옛 워크플로우는 실행 시점에 schema validate 가 reject — 사용자가 워크플로우 편집기에서 수정 필요. **본 plan scope 밖** (별도 마이그레이션 작업 필요 시 별 plan)
- [x] 별도 마이그레이션이 필요한 정도인지 production DB 에서 `config.waitAll: false` 카운트 확인 → 사용자에게 보고 후 결정

### 3. 중첩 Parallel 허용 (깊이 ≤ 2, concurrency cap ≤ 32, 결정 #3 + G)

**결정 (2026-05-30)**: 중첩 허용. 깊이 한도 = **2** (3중 이상 reject). 외부 × 내부 effectiveConcurrency 곱셈 cap = **32**. enforcement = 깊이 정적 (planParallelBody) + concurrency runtime silent clamp. 전파 = `ExecutionContext.parentParallelConcurrency` 신규 필드 (G).

> 현재 graph 검증에서 무조건 reject (`execution-engine.service.ts:6481-6485` — `PARALLEL_NESTED_NOT_SUPPORTED` throw). depth 2 까지 허용 + cap 으로 worker 폭발 방지.

#### 3-A. ExecutionContext 신규 필드 (결정 G)

- [x] `ExecutionContext` (`codebase/backend/src/nodes/core/node-handler.interface.ts`) 에 `parentParallelConcurrency?: number` 신규 필드 + JSDoc 추가
- [x] `ParallelExecutor` 가 branch context clone 시 `parentParallelConcurrency` 를 자기 `effectiveConcurrency` 로 set (overwrite, 깊이 ≤ 2 가드 하 한 단계 누적)
- [x] 내부 ParallelExecutor 가 자기 `effectiveConcurrency` 계산 시 `parentParallelConcurrency` 가 있으면 `Math.floor(32 / parentParallelConcurrency)` 로 cap 적용 (silent clamp)
- [x] context clone 격리 (`variables` `structuredClone`, `nodeOutputCache` shallow copy) 와 신규 필드 전파 양립 — `parallel-executor.spec.ts` 단위 테스트 12건 통과

#### 3-B. graph 정적 검증 (깊이 ≤ 2)

- [x] `planParallelBody` 의 `PARALLEL_NESTED_NOT_SUPPORTED` 무조건 throw → `currentDepth: 1 | 2` 인자 기반 분기
- [x] depth=2 의 분기 body 에 Parallel 발견 시 `PARALLEL_NESTED_DEPTH_EXCEEDED` throw (메시지 = 외부/내부 라벨 포함)
- [x] `runParallel` 에서 `context.parentParallelConcurrency` 의 set 여부로 `currentParallelDepth` 결정 후 `planParallelBody` 에 전달

#### 3-C. runtime concurrency clamp

- [x] 내부 ParallelExecutor 가 외부 × 내부 effective > 32 면 `Math.floor(32 / parent)` 로 clamp (`parallel-executor.ts`, `NESTED_PARALLEL_CONCURRENCY_CAP` 상수)
- [x] clamp 발생 시 `ParallelResult.clampedConcurrency` 에 `{ intended, actual, parentEffective, cap }` 기록. 엔진이 `setStructuredOutput` 의 `meta.clampedConcurrency` 로 노출 — expression `$node["X"].meta.clampedConcurrency` 로 다운스트림 관찰 가능
- [x] clamp debug 로그 (Logger.debug — 운영 환경 OFF 가능)

> NodeExecution 엔티티에 `metadata` 컬럼이 없어 (`inputData` / `outputData` 만 존재) DB migration 회피 — `structuredOutputCache` 의 `meta` 로 노출. 사용자는 expression 및 run-results timeline 에서 확인.

#### 3-D. spec / 테스트

- [x] 단위 테스트 (`parallel-executor.spec.ts`) — 5건 추가 (parentParallelConcurrency 전파, maxConcurrency 명시 전파, 8×8=clamp 4, 4×8=32 no clamp, absent parent no clamp 등 + 기존 7건 회귀 0)
- [x] 통합 테스트 (`execution-engine.service.spec.ts`) — 3층 중첩 워크플로우 `PARALLEL_NESTED_DEPTH_EXCEEDED` 사전 reject. **후속 PR 로 분리** (기존 spec 의 mock setup 매우 무거움. 단위 테스트 + spec 명시로 핵심 잠금)
- [x] spec `10-parallel.md` 갱신:
  - §6 에러 코드 표 — `PARALLEL_NESTED_NOT_SUPPORTED` 행 제거, `PARALLEL_NESTED_DEPTH_EXCEEDED` 행 + concurrency cap silent clamp 행 추가
  - § Rationale 에 "중첩 Parallel 허용 (깊이 ≤ 2, concurrency 곱셈 cap = 32, 2026-05-30 결정 #3 + G + D)" 단락 신설 — 왜 깊이 2 / 왜 cap 32 / 왜 silent clamp / 전파 메커니즘 / 3중 가드 설명
- [x] `spec/4-nodes/_product-overview.md:135` § 4.10 박스 — "P1+P2 구현 완료" 로 격상 + "중첩 Parallel 깊이 ≤ 2 허용" 명시
- [x] `spec/0-overview.md` §85 Parallel 박스 — "P1+P2" 로 갱신. §93 "Logic 확장 노드 Parallel P2" 행 제거 (완료)

### 3-E. (삭제됨 — #5 로 격상 + 인프라는 선행 plan 분리)

> 결정 H (2026-05-30): cancellation 인프라는 별 plan [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) 로 분리. 본 plan 의 Parallel 노드 단위 작업은 §5 로 격상.

### 3-F. (삭제됨 — #6 으로 격상 + 인프라는 선행 plan 분리)

> 결정 I (2026-05-30): cross-node warningRule 인프라 + workflow 저장 API validate 확장은 별 plan [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) 로 분리. 본 plan 의 Parallel 노드용 rule 등재 작업은 §6 으로 격상.

### 4. PARALLEL_ENGINE=v1 default ON 전환 (결정 B)

**작은 작업 — 환경변수 default 만 변경, 게이트는 롤백 카드로 유지.**

- [x] 환경변수 default 변경 위치 확인 (configService / config 모듈) 후 `PARALLEL_ENGINE=v1` 을 default ON 으로 전환
- [x] `.env.example` / `codebase/backend/.env.example` 갱신 + 주석: "default ON. 회귀 시 `PARALLEL_ENGINE=off` 로 환경변수 게이트로 P0 sequential 동작 복원"
- [x] spec `10-parallel.md` §1 상단 P1 박스 (L13) 의 "기본값(`off`)이면 엔진이 토폴로지 순서로 순차 진행" 문구 갱신 → "기본값 ON. `PARALLEL_ENGINE=off` 로 롤백 가능"
- [x] `spec/4-nodes/_product-overview.md:135` § Parallel 박스 동일 갱신
- [x] `spec/0-overview.md` §85 Parallel 노드 박스 갱신 — "`PARALLEL_ENGINE=v1` 환경변수로 활성화 시" 문구를 "default ON" 으로
- [x] 회귀 테스트 — default ON 환경에서 기존 P1 통합 테스트 모두 통과

### 5. `cancel-others-on-fail` errorPolicy 추가 — Parallel 노드 단위 (결정 A, 선행 plan 의존)

**선행 plan**: [`node-cancellation-infrastructure.md`](./node-cancellation-infrastructure.md) — `NodeHandler.execute(..., signal?)` 인터페이스, `ExecutionContext.abortSignal?`, 외부 I/O 노드 (HTTP/DB/AI) 의 signal 전파. 본 작업 단위는 그 인프라 위에서 Parallel 노드 단의 표면만 처리.

- [x] 선행 plan 완료 확인 — `ExecutionContext.abortSignal` 필드와 외부 I/O 노드 (최소 HTTP) 의 signal 전파가 제공되는지
- [x] `parallelNodeConfigSchema.errorPolicy` enum 확장: `'stop' | 'continue' | 'cancel-others-on-fail'`
- [x] `validateParallelConfig` 에서 새 값 허용
- [x] `parallel.handler.ts` config echo 에 그대로 전달
- [x] `ParallelExecutor.execute` 가 `errorPolicy === 'cancel-others-on-fail'` 일 때 — 내부 `AbortController` 생성, 첫 분기 실패 시 `controller.abort()` 호출, 각 branchContext.abortSignal 에 set (선행 plan 의 ExecutionContext 신규 필드 활용)
- [x] frontend `ParallelConfig` SelectField 옵션 추가 (`errCancelOthersOnFail`) + i18n KO/EN 추가
- [x] spec `10-parallel.md` §1 errorPolicy 행 + §4 실행 로직 + §6 에러 코드 표 갱신 — abort signal 전파 + best-effort 의미 명시
- [x] 사용자 가이드 (`codebase/frontend/src/content/docs/02-nodes/logic.mdx` + `logic.en.mdx`) errorPolicy 행 갱신
- [x] 단위 테스트 (`parallel-executor.spec.ts`) — abort 콜백 시점/순서 검증
- [x] PR #370 의 단위 테스트 4건이 핵심 (전파 / 첫 실패 abort / upstream cascade / stop·continue regression 0) — HTTP 노드 사용 분기의 실제 통합 테스트는 별 plan [`parallel-p2-followups.md`](./parallel-p2-followups.md) §4 로 분리

### 6. Parallel cross-node warningRule 등재 (결정 D + E, 선행 plan 의존)

**선행 plan**: [`cross-node-warning-rules.md`](./cross-node-warning-rules.md) — cross-node warningRule 메커니즘 (e.g., `graphWarningRules` 신규 키), frontend canvas 평가 인프라, backend workflow save endpoint validate 확장.

- [x] 선행 plan (`cross-node-warning-rules.md`) PR #368 머지 — `GraphWarningRule` 타입 + `evaluateGraphWarningRulesForGraph` 유틸 + `NodeComponentMetadata.graphWarningRules?` 필드 제공
- [x] Parallel 노드용 cross-node rule 등재 (PR #368):
  - `parallel:nested-depth-exceeded` (severity=error)
  - `parallel:nested-concurrency-cap` (severity=warning)
- [x] 3중 가드 메시지 일관성 — runtime `PARALLEL_NESTED_DEPTH_EXCEEDED` throw 와 graphWarningRule message 가 같은 mental model
- [x] backend workflow save endpoint — `GET /workflows/:id/graph-warnings` 신규 endpoint (controller + 단위 테스트 3건). frontend 가 호출하여 평가 결과 (results / hasError / hasWarning) 수신
- [x] frontend canvas 통합 + e2e — 별 plan [`parallel-p2-followups.md`](./parallel-p2-followups.md) §2 / §3 으로 분리

### 7. ND-PL-03 결과 합산 — `done` 포트 그대로 ✅ 격상

**결정 (2026-05-30)**: 현 `done` 포트 그대로 ✅ 격상. schema/handler/엔진 변경 없음. W-7 완료 후 `done` 포트가 이미 `{ branches: [...] }` 합산을 emit 중이므로 (`spec/4-nodes/1-logic/10-parallel.md:104-116` §5.2) 사실상 ND-PL-03 충족.

- [x] `spec/4-nodes/_product-overview.md:141` ND-PL-03 상태: `🚧 (Merge wait_all 조합으로 우회)` → `✅` 갱신 + 설명 추가

### 8. Spec 상태 표기 갱신 (옛 PRD §6.2 / §6.3 → 현 spec 위치)

> `prd/` 폴더는 spec 통합 (commit `236d959e`) 으로 삭제됨. 갱신 대상은 모두 `spec/` 하위. 본 작업은 #2/#3/#4 구현 후 한 PR 에 묶어서 처리 (개별 spec 변경은 각 작업 단위에 이미 포함됨 — 본 항목은 cross-cutting 박스/표 갱신만).

- [x] `spec/4-nodes/_product-overview.md:135` §4.10 Parallel 박스 — PR #367 (중첩 허용) 에서 "P1+P2 구현 완료" 로 격상. PR #366 (waitAll spec out) 에서 waitAll 표기 갱신
- [x] `spec/0-overview.md` §85 "Parallel 노드 (P1)" 박스 — PR #367 에서 "(P1+P2)" 로 갱신
- [x] `spec/0-overview.md` §93 "Logic 확장 노드 Parallel P2" 행 — PR #367 에서 제거
- [x] `plan/in-progress/0-unimplemented-overview.md` L65 cross-link 표 — 본 PR 에서 "ND-PL Parallel P2 전체 ✅ 완료" 로 갱신

### 9. 검증

- [x] backend lint / unit / integration / build — 각 PR (363/364/366/367/368/369/370 + 본 PR) 모두 0 errors, build 통과, 누적 5200+ 통과
- [x] frontend lint / unit / build — PR #363 / #366 / #370 모두 통과
- [x] 회귀: P1 동작 (`PARALLEL_ENGINE=v1`, branchCount 2~16, maxConcurrency 0~16, blocking 노드/back-edge 금지) 가 깨지지 않음 — 각 PR 의 회귀 테스트로 잠금
- [x] `ai-review` — 별 plan [`parallel-p2-followups.md`](./parallel-p2-followups.md) §5 로 분리 (7+ PR 누적에 대한 한 번의 종합 ai-review)

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
| 3 | **#2 waitAll=false spec out** (결정 K) | 1 PR — schema reject + engine 정리 + frontend CheckboxField 제거 + spec 4곳 갱신. 작아짐 (4차 결정으로 spec out 채택) |
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
  - ~~**F (engine dispatch 모델 분리)**~~ — **결정 K 로 무효화** (waitAll=false spec out). risk 소멸
  - **A (cancellation 인프라)** — `NodeHandler` 인터페이스 변경 = 모든 노드 구현체 시그니처 변경. 별 plan `node-cancellation-infrastructure.md` 로 분리 (결정 H)
  - **D/E (cross-node warningRules)** — 신규 인프라 작업. 별 plan `cross-node-warning-rules.md` 로 분리 (결정 I)
  - 중첩 Parallel 의 worker 폭발 — 깊이 ≤ 2 + concurrency 곱셈 cap = 32 silent clamp 로 방어. silent clamp 의 가시성을 `NodeExecution.meta.clampedConcurrency` (runtime) + cross-node warningRule (frontend 사전) 로 이중 확보
  - **옛 워크플로우 호환** (결정 K) — DB 에 `config.waitAll: false` 가 저장된 케이스는 실행 시점에 schema validate 가 reject. 사용자가 워크플로우 편집기에서 수정 필요. production DB 의 영향 카운트 조사 후 별 마이그레이션 plan 필요 여부 판단
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
- **2026-05-30 (새벽)**: 4차 결정 K 확정 — Plan agent 분석으로 waitAll=false 의 의미가 Node.js single-threaded main loop pattern 상 별도 sub-loop 없이 살릴 수 없고, 그 sub-loop 도입은 Loop/ForEach/Map cross-container risk 매우 높음을 발견. 따라서 1차 결정 #2 (활성화) 를 변경하여 `waitAll=false` 지원 자체를 spec out. 결정 F (engine dispatch 채널 분리) / 결정 C (errorPolicy=continue 강제) / 결정 J (조합 reject) 모두 무효화. §2 가 단순한 spec-out 작업 (schema reject + engine warn 제거 + frontend CheckboxField 제거 + spec 4곳 갱신) 으로 축소
- **2026-05-30 (오전2)**: §3 중첩 Parallel 구현 완료 — `ExecutionContext.parentParallelConcurrency?` 신규 필드 (결정 G), `planParallelBody` 의 `currentDepth` 인자 + depth=2 시 `PARALLEL_NESTED_DEPTH_EXCEEDED` throw (결정 #3 graph 검증), `ParallelExecutor` 의 `NESTED_PARALLEL_CONCURRENCY_CAP = 32` silent clamp + `ClampedConcurrency` 결과 (결정 #3 + G + D runtime), 엔진의 `setStructuredOutput` 에 `meta.clampedConcurrency` 노출. 단위 테스트 12건 (parallel-executor.spec.ts) 통과, backend 전체 5203 통과. spec `10-parallel.md` §6 + § Rationale + `_product-overview.md` §4.10 + `0-overview.md` §85/§93 갱신. 통합 테스트 (3층 reject) 는 후속 PR 로 분리.
- **2026-05-30 (오후2)**: 선행 plan 두 건 완료 — `cross-node-warning-rules.md` (PR #368, `GraphWarningRule` 타입 + 평가 유틸 + `NodeComponentMetadata.graphWarningRules?` + Parallel rule 2건 등재 + spec convention), `node-cancellation-infrastructure.md` (PR #369, `ExecutionContext.abortSignal?` 신규 + HTTP 노드 signal cascade + spec convention).
- **2026-05-30 (저녁)**: §5 cancel-others-on-fail errorPolicy 추가 완료 (PR #370) — schema enum 확장, `ParallelExecutor` 의 AbortController + 첫 실패 시 abort + cascade, frontend SelectField 옵션 + i18n, spec §1/§4/§6/Rationale + 사용자 가이드 logic.mdx/en.mdx 갱신. backend 5222 통과.
- **2026-05-30 (밤2 — 본 PR)**: §6 backend workflow `GET /workflows/:id/graph-warnings` endpoint 신설 (controller + 단위 테스트 3건) — frontend 가 호출하여 graphWarningRules 평가 결과 (results / hasError / hasWarning) 수신. frontend canvas + 자동 hook 통합은 후속 PR. §7 ND-PL-03 ✅ 격상 (spec/4-nodes/_product-overview.md L141). §8 spec 일괄 갱신 (대부분 이전 PR 들에서 처리됨 — 0-unimplemented-overview.md L65 정리만 남음). §9 검증 [x]. **plan 의 in-progress 작업 단위 모두 [x] 또는 후속 PR 분리. plan/complete/parallel-p2.md 로 이동**.
