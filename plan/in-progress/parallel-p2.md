# Parallel 노드 P2 (중첩·`waitAll: false`·`errorPolicy` 노출)

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/02-parallel-node.md` (P1 완료)

## 배경

PRD 3 §4.9 ND-PL-01~04, PRD 0 §6.2~§6.3 에서 Parallel 노드의 P1 (`PARALLEL_ENGINE=v1` 환경변수 활성, `p-limit` + `Promise.allSettled`, branchCount 2~16, maxConcurrency 0~16) 은 ✅. P2 로 남은 항목:

- 중첩 Parallel (현재 graph 검증에서 reject)
- `waitAll: false` (schema 에는 있으나 엔진 무시)
- `errorPolicy` schema 노출 (엔진은 구현, schema 미노출 → 기본값 `stop` 으로만 동작)
- ND-PL-03 결과 합산 (현재 Merge `wait_all` 우회)

## 관련 문서

- `prd/3-node-system.md` §4.9 Parallel
- `prd/0-overview.md` §6.2 / §6.3 (P1 ✅, P2 로드맵)
- `spec/4-nodes/1-logic/10-parallel.md` §1 (P2 박스), §3 (`config.waitAll` raw echo), §6 (graph 검증)
- `user_memo/node-specs-improvement/logic/parallel.md` §2 항목 6 / §3
- `codebase/backend/src/modules/execution-engine/parallel-executor.ts` (있다면) / `nodes/logic/parallel/` 핸들러

## 작업 단위

### 1. errorPolicy schema 노출 (가장 작은 단위, 선행)

- [ ] `parallel.schema.ts` 에 `errorPolicy` enum 필드 추가 (`stop` | `continue` | `accumulate` 등 — 엔진 구현 옵션 확인)
- [ ] frontend Parallel 설정 패널에 errorPolicy 드롭다운 추가
- [ ] 단위 테스트 — 각 errorPolicy 값별 동작 검증
- [ ] spec `10-parallel.md` §3 미구현 박스 제거

### 2. `waitAll: false` 활성화 또는 제거

엔진 단계에서 무시되는 옵션. user_memo 개선안은 schema 제거 또는 validate reject 제안.

- [ ] **결정**: 활성화 (각 분기가 완료되는 즉시 emit) vs. schema 제거 — 사용자 질의
- [ ] (활성화 결정 시) `ParallelExecutor` 에 first-wins / accumulate-as-completed 모드 도입 + 출력 포트 emit 시점 명세 (CONVENTIONS Principle 4 준수) + 단위/통합 테스트
- [ ] (제거 결정 시) schema 에서 필드 삭제 + 마이그레이션 (기존 워크플로의 `config.waitAll: false` 를 `true` 로 강제하거나 경고)
- [ ] spec `10-parallel.md` §1 / §3 / §6 갱신

### 3. 중첩 Parallel 허용

현재 graph 검증에서 reject. 단순 허용 시 worker 폭발 위험.

- [ ] **설계 결정**: 중첩 깊이 한도, 외부 maxConcurrency 와 내부 maxConcurrency 의 곱셈 제한 (안전한 cap)
- [ ] graph 검증 (`workflow-validator` 등) 에서 중첩 Parallel reject 규칙 제거 + 새 검증 (깊이 한도) 추가
- [ ] ParallelExecutor 의 분기 격리 (variables `structuredClone`, nodeOutputCache shallow copy) 가 중첩 경로에서도 정상 동작하는지 확인 + 단위 테스트
- [ ] spec `10-parallel.md` §6 graph 검증 표 갱신

### 4. ND-PL-03 결과 합산 (현재 Merge 우회)

PRD 의 "모든 분기 완료 후 결과 합산"은 현재 Merge `wait_all` 조합으로 우회 가능. 직접 Parallel 노드의 출력 포트로 결과를 합치는 옵션을 제공할지 결정.

- [ ] **결정**: 별도 출력 포트(`mergedResult` 등) 추가 vs. 현재 Merge 우회 유지 — 사용자 질의 (UX 가치 vs. 노드 시스템 복잡도)
- [ ] 결정에 따라 PRD §4.9 ND-PL-03 상태 갱신 + 필요 시 schema/handler 변경

### 5. PRD 0 / PRD 3 표기 갱신

- [ ] `prd/0-overview.md` §6.2 Parallel 부분 박스에서 P2 항목 제거 (또는 갱신)
- [ ] `prd/3-node-system.md` §4.9 ND-PL-03 상태 표기 — 우회 vs. 직접 합산 결정 반영
- [ ] `prd/0-overview.md` §6.3 로드맵 표의 "Logic 확장 노드 — Parallel P2" 항목 정리

### 6. 검증

- [ ] backend lint / unit / integration / build
- [ ] frontend lint / unit / build (Parallel 설정 패널 변경 시)
- [ ] 회귀: P1 동작 (`PARALLEL_ENGINE=v1`, branchCount 2~16, maxConcurrency 0~16, blocking 노드/back-edge 금지) 가 깨지지 않음
- [ ] `ai-review` 실행 → Concurrency / Performance 중심 — Critical/Warning 해소

## 수용 기준

- ND-PL-01~04 가 PRD 에서 ✅ 표기로 활성화 (또는 결정에 따라 명확히 정리)
- spec `10-parallel.md` 의 P1/P2 미구현 박스 제거
- 회귀 테스트가 P1 + P2 동작을 모두 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. `logic-node-followups.md` 와 병렬 진행 가능 (Logic 카테고리 같지만 영향 범위 다름)
- **리스크**:
  - 중첩 Parallel 의 worker 폭발 — 깊이 한도와 maxConcurrency 곱셈 cap 정확히 정의
  - `waitAll: false` 활성화 시 다운스트림 노드의 입력 도착 시점 가정이 깨질 수 있음 (Merge 의 `wait_all` 과 동일 의미인지 명확화 필요)
