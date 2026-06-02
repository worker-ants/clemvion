# RESOLUTION — 08_11_57

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (Testing) | 679f347e | `parallel-p2-integration.spec.ts` L125: `expect(observedPeak).toBeGreaterThan(0)` 추가 — clamp 하한 양방향 검증 |
| #2 | 코드 (Testing) | 679f347e | `parallel-executor.spec.ts` 에 W-2 타입 레벨 회귀 테스트 추가 — `@ts-expect-error` 패턴으로 branchParentContext 추론 시 `parentParallelConcurrency` ghost field 보존 및 명시 `: ExecutionContext` 어노테이션 시 은닉 컴파일 증명 |
| #3 | 코드 (Requirement) | 679f347e | #1 과 동일 위치 — clamp 하한 검증 (`toBeGreaterThan(0)`) |
| #4 | 코드 (Documentation) | 679f347e | `parallel-executor.spec.ts` 및 `parallel-p2-integration.spec.ts` describe 블록 상단에 `undefined` 명시 전달 이유 주석 삽입 (W-1 시그니처 강화 맥락) |

## TEST 결과

- lint  : 통과 (33s)
- unit  : 통과 (5401 passed, 35s)
- e2e   : 통과 (140/140, 69s)

## 보류·후속 항목

INFO 항목 (자동 수정 대상 아님, 추적용):

- INFO #1 (Architecture): `execute()` SRP 경계 — `computeEffectiveConcurrency` / `buildBranchAbortSignal` 헬퍼 추출. 기술 부채 추적용. 긴급 불필요.
- INFO #2 (Architecture): `ExecutionEngineService` 4200줄 God Object — 기존 PR-H/I 분해 계획 계속 추적.
- INFO #3 (Maintainability): `parentEffective` 별칭 제거 — `parentParallelConcurrency` 직접 사용. 선택적 리팩터링.
- INFO #4 (Maintainability): `NO_PARENT_CONCURRENCY` 공유 상수 추출 — 선택.
- INFO #5 (Maintainability): 테스트 매직 넘버 `5`/`4` 주석 추가 — 선택.
- INFO #6 (Maintainability): W-2 인라인 주석 압축 — 선택.
- INFO #7 (Documentation): W-2 주석에 spec 경로 참조 추가 — 필수 아님.
- INFO #8 (Testing): 경계값(0, 음수, NaN) 단위 테스트 — 선택.
- INFO #9 (Testing): AbortError 선행 시나리오 root-cause 선택 테스트 — 선택.
- INFO #10 (Testing): `clampedConcurrency` describe 이름 명확화 — 선택.
- INFO #11 (Requirement): describe 이름과 실제 검증 대상 괴리 수정 — 선택.
- INFO #12 (Security): `structuredClone` 입력 검증 레이어 확인 — 이번 변경 자체의 추가 위험 없음.
