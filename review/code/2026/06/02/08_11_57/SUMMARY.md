# Code Review 통합 보고서

## 전체 위험도
**LOW** — 타입 시그니처 강화(W-1) 및 타입 추론 위임(W-2) 리팩터링. 런타임 동작 변경 없음. 보안·아키텍처·동시성·범위 관점 결함 없음. 테스트 타이밍 불확실성 및 문서 주석 보완 권고 수준.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 중첩 Parallel 피크 동시성 측정이 `setTimeout` 타이밍에 의존 — `toBeLessThanOrEqual(2)` 상한만 검증하고 하한(`toBeGreaterThan(0)`) 미포함 (통합 테스트) | `parallel-p2-integration.spec.ts` L159-183 | Barrier 패턴 또는 `jest.useFakeTimers()` 적용으로 결정적 검증. 단위 테스트에서 `toBeGreaterThan(0)` 이미 커버됨 — 통합 테스트에도 추가 권고 |
| 2 | Testing | `execution-engine.service.ts` 의 `branchParentContext` 타입 어노테이션 제거(W-2)에 대한 타입 레벨 테스트 부재 | `execution-engine.service.ts` L7701 | `tsd` 또는 `ts-expect-error` 패턴으로 `ParallelBranchContext` 컨텍스트에서 `parentParallelConcurrency` 필드 접근 가능 여부를 타입 단언 테스트로 검증 |
| 3 | Requirement | 통합 테스트 clamp 검증에 clamp 하한(최소 1 브랜치) 검증 누락 | `parallel-p2-integration.spec.ts` L164-183 | `expect(observedPeak).toBeGreaterThan(0)` 추가. 단위 테스트에서 이미 커버됨 |
| 4 | Documentation | 테스트 파일 내 `undefined` 인자 추가에 대한 인라인 설명 부재 — 테스트 파일만 읽는 리뷰어가 맥락 파악 곤란 | `parallel-executor.spec.ts` / `parallel-p2-integration.spec.ts` describe 블록 상단 | `describe` 블록 상단에 1회 주석 삽입: `// parentParallelConcurrency 는 optional 이 아니라 required number | undefined — 최외각 Parallel 테스트에서 undefined 명시 전달 (W-1)` |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `execute()` 메서드가 동시성 제어·AbortSignal cascade·errorPolicy 집계·clamp 등 여러 책임 보유 (~150줄) | `parallel-executor.ts` `execute()` 전체 | 기술 부채. `computeEffectiveConcurrency`, `buildBranchAbortSignal` 헬퍼 추출 고려 — 긴급 불필요 |
| 2 | Architecture | `ExecutionEngineService` 4200줄 God Object — 이번 변경이 악화시키지 않음, JSDoc 에 분해 계획 명시됨 | `execution-engine.service.ts` | 기존 PR-H/I 분해 계획 계속 추적 |
| 3 | Maintainability | `parentEffective` 중간 변수 — 동일 값을 별칭으로 재바인딩해 독자가 두 이름을 추적해야 함 | `parallel-executor.ts` L908 | 별칭 제거 후 `parentParallelConcurrency` 직접 사용 또는 파라미터명 단축 |
| 4 | Maintainability | 테스트 파일에 `undefined` 18회 반복 — 시각적 노이즈 | `parallel-executor.spec.ts` 16곳, `parallel-p2-integration.spec.ts` 2곳 | `const NO_PARENT_CONCURRENCY = undefined as number \| undefined` 공유 상수 추출 (선택) |
| 5 | Maintainability | 테스트 매직 넘버 `5`/`4` — 유도 근거 주석 부재 | `parallel-executor.spec.ts` L546, L570 | `// floor(32/8)=4, clamp 없을 때 peak>=5` 형태 짧은 주석 추가 |
| 6 | Maintainability | W-2 인라인 주석 4줄 — 변수 선언 1줄 대비 과도 | `execution-engine.service.ts` L7057-7062 | 핵심만 1줄 압축: `// ParallelBranchContext spread 시 ghost field 은닉 방지 — 타입 추론 위임 (W-2)` |
| 7 | Documentation | W-2 주석에 배경 문서 경로 미참조 | `execution-engine.service.ts` W-2 주석 | 말미에 `(spec/conventions/execution-context.md §원칙 2 참조)` 추가 — 필수 아님 |
| 8 | Testing | `parentParallelConcurrency` 경계값(0, 음수, NaN) 입력 케이스 미커버 | `parallel-executor.spec.ts` | `NaN` 전달 시 `Math.max(1, NaN)=1` 로 의도치 않은 clamp 발동 가능 — 엣지 케이스 단위 테스트 추가 권고 |
| 9 | Testing | `failures` 배열 내 AbortError 선행 시나리오(branch0 느림·branch1 먼저 AbortError) root-cause 선택 미검증 | `parallel-executor.spec.ts` L719-757 | 지연 branch0 + 즉시 AbortError branch1 시나리오 테스트 케이스 추가 |
| 10 | Testing | 통합 테스트 `clampedConcurrency` describe 이름 vs 실제 대상 불일치 (`planParallelBody` 포함 없음) | `parallel-p2-integration.spec.ts` L158-198 | describe 이름을 `nested Parallel concurrency cap (ParallelExecutor 직접 검증)` 으로 명확화 |
| 11 | Requirement | 통합 테스트 `describe` 이름과 실제 검증 대상 사이 괴리 — `planParallelBody` dispatch chain 주석 vs 실제 `ParallelExecutor` 직접 호출 | `parallel-p2-integration.spec.ts` 헤더 | 파일 주석 또는 describe 명 수정 |
| 12 | Security | `structuredClone(context.variables)` — 직렬화 불가 값 주입 시 런타임 크래시 가능성 | `parallel-executor.ts` ~L970 | 기존 입력 검증 레이어가 variables 를 JSON 타입으로 제한하는지 확인. 이번 변경 자체의 추가 위험 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·인젝션·인증 우회 없음. 모두 INFO 수준 |
| architecture | NONE | W-1 ISP 방향 올바름, W-2 타입 정확성 개선. `execute()` SRP 경계는 기술 부채로 분류 |
| requirement | LOW | WARNING 1건(통합 테스트 clamp 하한 미검증) — 단위 테스트에서 이미 커버됨 |
| scope | NONE | 4개 파일 모두 W-1·W-2 범위 내 변경만 포함, 의도 초과 없음 |
| side_effect | LOW | production 호출처 시그니처 반영 여부를 diff 범위에서 직접 확인 불가 — tsc 통과로 검증됨 |
| maintainability | LOW | `parentEffective` 별칭, 매직 넘버, 과다 주석 등 INFO급. W-1 자체는 유지보수성 개선 |
| testing | LOW | WARNING 2건: 타이밍 의존 피크 측정, W-2 타입 레벨 테스트 부재 |
| documentation | LOW | WARNING 1건: 테스트 파일 `undefined` 추가 이유 주석 미기재 |
| concurrency | NONE | 경쟁 조건·데드락·동기화 누락 없음. Node.js 단일 이벤트 루프 모델 적절히 준수 |

## 발견 없는 에이전트

- **security**: OWASP Top 10 해당 항목 전무 (NONE)
- **architecture**: Critical·Warning 급 아키텍처 결함 없음 (NONE)
- **scope**: 의도 초과 변경 없음 (NONE)
- **concurrency**: 실질적 동시성 결함 없음 (NONE)

## 권장 조치사항

1. **(권고)** `parallel-p2-integration.spec.ts` L183에 `expect(observedPeak).toBeGreaterThan(0)` 추가 — clamp 하한 보증 (단위 테스트 이미 커버, 통합도 대칭 처리)
2. **(권고)** 피크 동시성 측정 테스트에 Barrier 패턴 적용 — `setTimeout` 타이밍 의존성 제거 (`should respect maxConcurrency limit` 테스트가 이미 Barrier 사용 중, 동일 패턴 적용)
3. **(권고)** `parallel-executor.spec.ts` describe 블록 상단에 `// parentParallelConcurrency 는 required number | undefined — 최외각 Parallel 테스트에서 undefined 명시 전달 (W-1)` 주석 1회 삽입
4. **(선택)** W-2 타입 어노테이션 제거에 대한 타입 레벨 테스트(`tsd` 또는 `ts-expect-error`) 추가 — 컴파일 타임 보증 회귀 방지
5. **(선택)** `parentParallelConcurrency` 경계값 단위 테스트 추가 — 0, 음수, NaN 입력 시 clamp 동작 명시적 검증
6. **(선택)** `parentEffective` 별칭 제거 — `parentParallelConcurrency` 직접 사용으로 단일 이름 통일
7. **(선택)** 통합 테스트 `clampedConcurrency` describe 이름 수정 — `planParallelBody` 미포함 사실 반영
8. **(참고)** `execute()` 메서드에서 `computeEffectiveConcurrency` / `buildBranchAbortSignal` 헬퍼 추출 — 기능 확장 시 기준으로 활용

## 라우터 결정

라우터가 reviewer 를 선별 실행함 (`routing=done`).

**실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`

**강제 포함 (router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |