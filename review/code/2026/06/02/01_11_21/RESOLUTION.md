# RESOLUTION — continuation worker concurrency env 설정화

리뷰 산출물: [`SUMMARY.md`](./SUMMARY.md) — 위험도 **LOW**, Critical 0 / Warning 1 / Info 13.

## 조치 항목

| SUMMARY # | 등급 | 조치 | 비고 |
|---|---|---|---|
| W-1 (동시성 — cancel `void` fire-and-forget) | WARNING | **수정** | 리뷰 제안(`void`→`await`)은 현 상태에서 **no-op**: `applyCancellation(executionId): void` 은 `rejectPending` 만 호출하는 **동기** 메서드라 `await undefined` 는 무의미. 실질 조치로 cancel case 에 **동시성 안전 invariant 주석**을 추가 — (a) 동기 완료라 `process()` 반환 전 cancel 종결(async race window 없음), (b) cancel vs resume 순서 경합은 기존 `isNodeExecutionWaiting` status 가드 + BullMQ jobId 멱등성이 흡수, (c) TODO 를 plan 항목2(optimistic lock 후속)에 연결. async 전환 시 `await` 복원 필요 조건도 명시. |
| I-5 (`@Processor` DI 불가 배경 주석 부재) | INFO | **수정** | 호출부 위에 평가 시점·env 파싱 규약 cross-ref + "재시작 시 반영" 주석 추가. |
| I-11 (spec §7.4 fallback 정책 미기재) | INFO | **수정** | §7.4 "Worker 동시성" 행에 fallback·재시작 반영 병기. |
| I-13 (런타임 env 변경 미반영 — 운영 문서) | INFO | **수정** | `.env.example` 에 "Read once at module load — changing it requires an instance restart" 추가. |
| I-1 / I-2 (parsePositiveInt DRY / env 파싱 SRP) | INFO | **보류** | `continuation-dlq-monitor.config.ts` 의 sibling 파서와 **의도적 parity** 유지 — 공통 유틸 추출은 DLQ config 파일까지 건드려 본 변경 범위를 넘김. 리뷰도 즉시 위험 낮음으로 평가. 설정 항목 증가 시 통합 검토(후속). |
| I-4 (정규식 후 `Number.isInteger>0` 재검증 중복) | INFO | **보류** | sibling `parsePositiveInt` 와 동일 형태 유지가 일관성 측면에서 우선. 동작상 무해(방어적). |
| I-3 (`applyContinuation` conditional UPDATE 명시) | INFO | **보류** | 기존 동작·기존 코드 영역으로 본 변경 범위 밖. concurrency>1 안전 근거는 W-1 주석에서 status 가드로 요약. |
| I-6 (`ContinuationJob.payload` 타입 좁히기) | INFO | **보류** | 본 변경과 무관한 기존 구조. 후속 plan 검토 대상으로 명시. |
| I-7 (cancel TODO 추적 연결) | INFO | **수정** | W-1 주석에서 plan 항목2 경로로 연결. |
| I-10 (`.env.example` ↔ JSDoc 케이스 표현 동기화) | INFO | **부분 수정** | 양쪽 모두 "정규식 `\d+` 후 양의 정수, 그 외 fallback 1" 정책으로 서술 통일 방향 반영. |
| I-12 (`onFailed` `opts.attempts` 미설정 fallback 테스트 갭) | INFO | **보류** | `onFailed` fallback 경로는 본 변경이 건드리지 않은 기존 코드. 범위 밖 — 후속 테스트 보강 항목. |
| I-8 (spec §7.4 "메시지 타입" 행 `retry_last_turn` 미등재) | INFO | **위임** | pre-existing spec 불일치 → `project-planner` 영역. 본 PR 미포함. |
| I-9 (spec §11 내 `### 10.3` 서브섹션 번호 오기) | INFO | **위임** | pre-existing 번호 오기 → `project-planner` 영역. 본 PR 미포함. |

> Critical 0건. Warning 1건 모두 조치 완료. INFO 는 즉시-가치 높은 항목(I-5/I-7/I-10/I-11/I-13)만 본 PR 에서 처리, 나머지는 범위/계층 사유로 보류·위임.

## TEST 결과

마지막 코드 수정(리뷰 반영 주석/문서) 이후 전 단계 재수행:

- **lint**: 통과 (`_test_logs/lint-20260602-012115.log`). `eslint --fix` 가 main 기준 pre-existing 비-prettier 파일 6종을 reformat 했으나 본 변경과 무관하여 모두 revert(scope 노이즈 제거).
- **build**: 통과 (`_test_logs/build-20260602-012154.log`).
- **unit**: 통과 — 신규 `continuation-execution.queue.spec.ts` 포함, 본 변경 관련 전부 green. 단 1건 **pre-existing 실패** `src/lib/docs/__tests__/spec-pending-plan-existence.test.ts > spec/5-system/13-replay-rerun.md`(commit #408 에서 replay-rerun plan git-rm 되었으나 spec frontmatter `pending_plan` 잔존) — baseline main 에서도 동일 실패 재현 확인, 본 변경과 무관.
- **e2e**: 통과 — 140 tests passed (`_test_logs/e2e-20260602-012318.log`).

## 보류·후속 항목

- I-1/I-2/I-4 (parsePositiveInt 통합·SRP) — 설정 항목 증가 시 공통 유틸/전용 config 파일 분리 검토.
- I-6 (`ContinuationJob.payload` 유니언 타입화), I-12 (`onFailed` fallback 테스트) — 기존 코드 영역 후속 보강.
- I-8/I-9 (spec §7.4 `retry_last_turn` 미등재, §11 `### 10.3` 번호 오기) — `project-planner` 위임 (pre-existing spec 정합).
- `spec/5-system/13-replay-rerun.md` frontmatter `pending_plan` 잔존 (unit 1건 실패 원인) — 본 작업 범위 밖, 별도 grooming 필요.
