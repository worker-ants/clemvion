# RESOLUTION — 14_35_37

> 대상: PR2a — §8 active-running 누적 타임아웃 (d4271ed9)
> 처리: 2026-06-04

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 (SPEC-DRIFT) | spec | 20252d34 (draft) | `plan/in-progress/spec-update-pr2a-timeout.md` — §8 헤더 구현 상태 배너 갱신 제안 |
| W2 (SPEC-DRIFT) | spec | 20252d34 (draft) | 동 draft — §8 표 active-running 기준 이미 #458 에서 반영됨, 추가 명확화 포함 |
| W3 (SPEC-DRIFT) | spec | 20252d34 (draft) | 동 draft — §8 "설정 위치" Workflow.settings → env 1단계 / per-workflow 후속 분리 |
| W4 (동시성 under-count) | 코드 | a0e972a2 | segmentStartMs 선언부에 설계 의도 주석 명시 (over-count 회피 위해 under-count 허용) |
| W5 (동시성 invariant) | 코드 | a0e972a2 | 동일 commit — 단일 Execution 직렬화 불변식 주석 명시 |
| W6 (테스팅 flaky) | 코드 | a0e972a2 | Date.now()-X 오프셋을 결정론적 충분값으로 교체 (500/600ms, 한도 1000ms 기준) |
| W7 (private 강결합) | - | (보류) | 장기 리팩토링 — ActiveRunningTracker 독립 클래스 추출 PR2b+ 검토 |
| W8 (data-flow §4 큐 미갱신) | spec | 20252d34 (draft) | 동 draft — execution-run 행 추가 제안 |
| W9 (EIA §5.2 미반영) | spec | 20252d34 (draft) | 동 draft — §6.4 error.code 예시에 EXECUTION_TIME_LIMIT_EXCEEDED 추가 제안 |
| W10 (ko 번역 누락) | 코드 | a0e972a2 | ERROR_KO[EXECUTION_TIME_LIMIT_EXCEEDED] 추가 |
| W11 (docs 미문서화) | 코드 | a0e972a2 | error-handling.mdx / .en.mdx "실행 시간 한도 초과" 섹션 신설 |

**총 WARNING 항목**: 11건 중
- 코드 직접 fix: 6건 (W4·W5·W6·W10·W11 — commit a0e972a2, plus W7 보류)
- spec draft: 5건 (W1·W2·W3·W8·W9 — commit 20252d34, draft 위임)
- 보류(장기): 1건 (W7 — private 강결합, 단기 유지 가능)

## TEST 결과

- lint  : 통과 (33s)
- unit  : 통과 (5907 + 140 + 40 = 6087 passed, 1 skipped)
- e2e   : 통과 (168 passed, 69s)

## INFO 항목 처리

| INFO # | 조치 |
|--------|------|
| I1 (보안 수치 노출) | 보류 — 채널 어댑터 경로 미노출 확인됨. REST 경로 확인은 PR2b 범위 |
| I2 (에러코드 layer pollution) | 보류 — PR2b 범위 (consistency-check W4 인지 항목) |
| I3 (SRP 경계) | 보류 — 장기 리팩토링 후속 |
| I4 (execution-limits.ts 모듈 경계) | 보류 — PR2b/per-workflow 설정 추가 시 재검토 |
| I5 (concurrency 파싱 패턴 불일치) | 보류 — 장기 통합 후속 |
| I6 (이중 검증 중복) | 보류 — 현행 유지 (정규식 선검증 의도 명시로 충분) |
| I7 (인자 타입 과대) | 완료 — commit a0e972a2 (Pick<Execution, 'id'|'activeRunningMs'>) |
| I8 (재시작 필요 미문서화) | 완료 — commit a0e972a2 (JSDoc @returns + 재시작 필요 주석) |
| I9 (classifier 테스트 케이스) | 완료 — commit a0e972a2 (EXECUTION_TIME_LIMIT_EXCEEDED → executionFailedTimeout) |
| I10 (ExecutionTimeLimitError 단위 테스트) | 완료 — commit a0e972a2 (execution-limits.spec.ts 3개 케이스) |
| I11 (e2e 큐 개수 설명 stale) | 완료 — commit a0e972a2 ("12개" → "13개") |
| I12 (JSDoc @returns 누락) | 완료 — commit a0e972a2 |
| I13 (@param 누락) | 완료 — commit a0e972a2 |
| I14 (PR2a 내부 참조) | 보류 — 외부 공개 시 검토 |
| I15 (INTEGER 범위 이론적 초과) | 보류 — 현행 유지 (실질 발생 가능성 낮음) |
| I16 (DTO 노출 미확인) | 보류 — PR2b 범위 확인 |

## 보류·후속 항목

- **W7 (private 강결합)**: ActiveRunningTracker 독립 클래스 추출 — PR2b+ 장기 검토
- **W2 (에러코드 layer pollution, I2)**: error-codes.ts 엔진 인프라 섹션 분리 — PR2b 범위
- **spec draft 위임**: `plan/in-progress/spec-update-pr2a-timeout.md` — W1·W2·W3·W8·W9 (5건)
  - §8 구현 상태 배너 + 설정 위치 컬럼 갱신
  - data-flow §4 execution-run 큐 카탈로그 추가
  - EIA §6.4 EXECUTION_TIME_LIMIT_EXCEEDED 에러코드 예시 추가
