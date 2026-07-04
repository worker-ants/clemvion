# RESOLUTION — orphan pending backstop ai-review

세션: `review/code/2026/07/04/22_12_26` · 대상 `2014421e5`

## 조치 항목

| # | reviewer/등급 | 조치 | fix |
| --- | --- | --- | --- |
| W1 | database/WARNING | `(status,queued_at)` 전용 인덱스 **미추가 — 정당화 주석**. boot-only cold query·sparse pending·기존 RUNNING backstop 대칭 선례(`idx_execution_status` 단독 의존)·핫 테이블 인덱스 유지비. recoverOrphanPendingExecutions find 위 인라인 주석 명시. | 본 커밋 |
| W2 | documentation/WARNING | `recoverStuckExecutions` JSDoc 헤더에 orphan pending 회수 책임 + RUNNING re-drive/PENDING cancel 근거 추가. | 본 커밋 |
| W3 | documentation/WARNING | `runStuckRecoveryScan` JSDoc 에 §8 orphan pending cancel 트리거 명시. | 본 커밋 |
| W4 | documentation/WARNING | `CHANGELOG.md` `## Unreleased — orphan pending backstop` 항목 추가. | 본 커밋 |

### 곁들임 INFO 조치

- e2e 파일 헤더 시나리오 목록에 (3) workspace cap·(4) orphan pending backstop 추가 (documentation INFO).
- `exec-intake-followups.md` "orphan pending backstop" 항목 `[x]` (requirement INFO).

### 미조치(기록) INFO

- unit `queuedAt` 필터 `toBeDefined()`(LessThan 값 미검증)·redundant 1s setTimeout·글로벌 스캔 cross-file e2e 이론 리스크(설계상 글로벌 필수·spec 파일 내 안전). 비차단 유지.

## TEST 결과

- lint / unit(361) / build : 통과
- e2e : 통과(234) — 조치가 comment/doc 전용(런타임 무변경)이라 결과 불변. 첫 시도 Docker VM 디스크 포화(initdb pg_wal)는 인프라 — `docker container/image prune`(42GB 회수) 후 통과.

## 보류·후속 항목

없음. INFO 잔여는 위 "미조치(기록)"로 종결.
