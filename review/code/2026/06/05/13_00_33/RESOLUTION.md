# RESOLUTION — 13_00_33

PR-A3 — user-defined variables durable park 영속 + rehydration 복원
commit: 18fc07f7, worktree: exec-park-durable-resume

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W#1 | 코드 (테스트) | 0061082b | form park 통합 테스트에 userVariables DB save assertion 추가 — updateExecutionStatus 트랜잭션 경로(dataSource.transaction→manager.save(Execution,...)) 가 userVariables 필드를 포함함을 통합 레벨에서 검증 |
| W#2 | 코드 (테스트) | 0061082b | Phase 2.7 rehydration 통합 테스트 내 PR-A3 WARNING #2 variant 추가 — mock Execution.userVariables: { counter: 5 } 설정 후 rehydrateContext 가 context.variables.counter === 5 로 복원하는지 검증 |
| W#3 | 코드 (테스트) | 0061082b | stageDurableResumeSnapshot 테스트에 배열/null 값 + 시스템만 케이스 추가 — shallow copy mutability 의도적 설계 명시 + userVariables === {} 검증 (INFO #8 포함) |
| INFO#4 | 코드 (리팩토링) | 0061082b | filterUserVariables private 헬퍼 추출 — stageDurableResumeSnapshot + rehydrateUserVariables 의 __* 필터 로직 단일 출처 관리 |
| INFO#5/#14 | 코드 | 0061082b | rehydrateUserVariables 에 Array.isArray guard 추가 (`[]`/배열 → {}) — 단위 테스트 추가 |
| INFO#12/#13 | 코드 (문서) | 0061082b | rehydrateContext JSDoc "user_variables merge" 한 줄 추가, stageDurableResumeSnapshot JSDoc @remarks "3개 park 진입점" 추가 |
| INFO#2 | 코드 (문서) | 0061082b | execution.entity.ts userVariables 주석에 DTO 배제 방식 확정 — ExecutionDto/ExecutionDetailDto whitelist 방식으로 자동 배제됨 확인·명시 (grep 확인: execution-response.dto.ts 에 userVariables 노출 없음) |
| INFO#3 | 확인 + 기록 | — | Variable Declaration/Modification 노드에 `__` prefix 거부 가드 없음 확인 (grep 결과: handler/schema에 startsWith/__guard 없음). 사용자가 `__custom_var` 를 선언하면 park 시 필터에 의해 제외되어 데이터 손실 가능. 본 PR 범위 밖(logic 노드 변경) → 보류·후속 항목 기록 |

## TEST 결과

- lint  : 통과 (backend 0 errors, frontend eslint CLI 미설치는 기존 환경 상태)
- unit  : 통과 (744 passed — execution-engine + executions 모듈)
- build : 통과 (npx nest build 0 errors)
- e2e   : 통과 (173/173, log: _test_logs/e2e-20260605-131454.log)

## 보류·후속 항목

- INFO#3 (Security — 후속): Variable Declaration/Modification 노드에 `__` prefix 변수명 거부 가드 없음. 사용자가 `__*` 변수를 선언하면 park 필터에서 제외되어 silent data loss 가능. 별도 가드 신설은 logic 노드 변경이라 PR-A3 scope 외 — 후속 PR 에서 처리 권장. 기존 park 필터가 방어선으로 동작하므로 운영 위험 낮음(INFO 수준).
- INFO#1/#15 (Security/Database — 후속): user_variables JSONB 크기 상한 없음 — conversation_thread 도 동일하게 cap 없어 일관성 유지. 운영 중 크기 이슈 발생 시 앱 레이어 guard 또는 PostgreSQL CHECK 추가 권장. 현재 NONE/INFO 수준.
- INFO#6 (Maintainability): 테스트 이중 타입 단언 (`as unknown` 후 재단언) — 기존 코드 패턴 유지. 별도 리팩터링 PR 에서 처리 가능.
- INFO#7 (Maintainability): stageDurableResumeSnapshot 의 두 필드 동시 변경 — 현재 규모 허용. 세 번째 필드 추가 시점에 빌더 패턴 고려 권장.
- INFO#9 (Testing): rehydrateContext fast-path(context 캐시 히트) 에서 user variables 미적용을 검증하는 테스트 — 설계 의도(fast-path 는 기존 context 반환)를 주석으로 대체 가능. 별도 후속.
- INFO#10 (Side-Effect): rehydrateContext initialVariables spread 순서 주석 — "user vars 먼저, 시스템 __* 나중" 순서가 코드에 이미 반영되어 있으나 명시 주석 없음. 별도 후속.
- INFO#11 (Side-Effect): stageDurableResumeSnapshot JSDoc "모든 park 진입점 필수 호출" — @remarks 에 이미 3개 진입점 명시됨(이번 조치). 향후 4번째 진입점 추가 시 주석 갱신 필요.
