# ai-review SUMMARY — orphan pending backstop

- 세션: `review/code/2026/07/04/22_12_26` · 대상 커밋 `2014421e5` · diff base `origin/main`
- router 활성 9/14: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency
  - skip: performance, architecture, dependency, api_contract, user_guide_sync

## 전체 위험도: LOW

## Critical: 0

## Warning: 4 (전부 조치 완료)

| # | reviewer | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| W1 | database | `execution-engine.service.ts` recoverOrphanPendingExecutions find | 신규 스캔 `status='pending' AND queued_at<τ` 에 전용 `(status,queued_at)` 복합 인덱스 없음 | **인덱스 미추가 정당화**(인라인 주석): boot-only cold query·sparse pending·기존 RUNNING backstop(`status='running' AND started_at<τ`)도 동일하게 `idx_execution_status` 의존하는 **대칭 선례**·핫 테이블 write-path 인덱스 유지비 회피. |
| W2 | documentation | `execution-engine.service.ts:2780` recoverStuckExecutions JSDoc | orphan-pending-cancel 책임 미반영 | JSDoc 헤더에 orphan pending 회수 책임 추가. |
| W3 | documentation | `execution-engine.service.ts:753` runStuckRecoveryScan JSDoc | test-hook 래퍼도 orphan cancel 트리거하나 미기재 | JSDoc 에 §8 orphan pending cancel 명시. |
| W4 | documentation | `CHANGELOG.md` | 관측가능 동작 변경인데 항목 없음 | `## Unreleased — orphan pending backstop` 추가. |

## reviewer별 핵심 (NONE/LOW)

| reviewer | 결과 | 핵심 |
| --- | --- | --- |
| security | NONE | 서버 시각 기반·파라미터 바인딩·test-hook 이중 게이팅. 신규 표면 없음. |
| requirement | NONE | 코드가 §8/§7.4/Rationale line-for-line 일치. impl-prep RUNNING-only stale 문구 WARNING 해소 확인. unit 361/361. |
| scope | NONE | early-return 제거는 pre-approved in-scope(RUNNING 로직 재들여쓰기만). spec/artifact 정당. |
| side_effect | LOW(INFO) | 4 불변식(stale-running 불변·finally lock·reclaim-throws 전파·markQueueWaitTimeout 재사용) 확인. |
| maintainability | NONE | INFO만. |
| testing | NONE | 신규 테스트가 diff 핵심(early-return 제거) 회귀 검증. e2e margin(10분/1초 vs 8초) 충분. |
| documentation | 3 WARNING | W2·W3·W4 (위). spec 편집 정확·stale "후속" 문구 잔존 0 확인. |
| database | WARNING | W1 (위). LessThan NULL 제외·no migration·parameterized·race-safe 확인. |
| concurrency | NONE | 3 race 가설 전부 안전(admission vs backstop status='pending' CAS·TOCTOU 멱등·advisory-lock 비중첩). |

## 미조치(기록) INFO

- unit `queuedAt` 필터 `toBeDefined()` 검증(LessThan 값 미검증), 한도 이내 e2e 의 redundant 1s setTimeout(hook 동기 await), 글로벌 스캔 cross-file e2e 오염 이론적 리스크(설계상 글로벌 필수·spec 파일 내 안전). 전부 비차단.

## 조치 후

comment/doc 전용 변경(런타임 로직 무변경). TEST WORKFLOW 재통과: lint·unit·build·e2e(234). fix 커버 fresh ai-review 예정.
