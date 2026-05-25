# Code Review 통합 보고서 (post-rebase)

## 전체 위험도

**MEDIUM** — `queued: boolean` 의미론·`INVALID_EXECUTION_STATE` 동기 반환 규범·Rationale 미등재 3건이 실질적 리스크. codebase 코드는 이전 /ai-review(`08_02_14`)에서 이미 검증된 상태로 재변경 없음. router 가 본 diff 를 "스펙·문서 위주"로 식별해 security/architecture/concurrency/testing/api_contract/dependency/database/performance/user_guide_sync 9건 skip — 합당 (코드는 rebase 로 그대로 replay).

## Critical

없음.

## WARNING (12건)

| # | 카테고리 | 발견 | 본 PR 처리 |
|---|----------|------|------------|
| 1 | spec-impl | `queued: false` 의미가 spec(=in-instance fast path) vs 구현(=enqueue 실패) 정반대 | 즉시 fix — spec §4.2 의 `queued: false` 정의를 "enqueue 실패" 로 갱신 |
| 2 | spec-impl | `§7.5.1` INVALID_EXECUTION_STATE 동기 반환 규범 vs 구현 sentinel 우회 | 이미 spec §7.5.1 끝에 "Phase 2 cont 시점 구현은 sentinel publish 경로 우회 → 후속 PR" 인라인 노트 추가됨. 추가 조치 불필요 |
| 3 | spec SoT | `exec:cont:seq:<executionId>` Redis 키가 SoT §9.2 에 미등재 | 즉시 fix — §9.2 표에 행 추가 |
| 4 | spec SoT | `RESUME_*` / `SERVER_SHUTTING_DOWN` 4코드 `3-error-handling.md` 공용 카탈로그 미등재 | 즉시 fix — 카탈로그 범위 선언("WS-only 에러 코드는 각 domain spec 참조") 추가 또는 등재 |
| 5 | spec ambiguity | `recoverStuckExecutions` 의 동반 NodeExecution 처리 spec 미명시 | follow-up plan |
| 6 | rationale | heartbeat 기반 Recovery 전환 결정 미등재 | 즉시 fix — `§Rationale` 보완 |
| 7 | rationale | rehydration 단말 상태 `cancelled` 선택 근거 미등재 | 즉시 fix — `§Rationale` 보완 |
| 8 | rationale | `INVALID_EXECUTION_STATE` WS 전용 분리 근거 미등재 | 이미 §Rationale "Phase 2 cont 후속 정리 (2026-05-25)" 에 등재됨 (4dd805ed). 추가 조치 불필요 |
| 9 | docs | `spec/data-flow/3-execution.md §2.3` anchor 파괴 가능성 | grep 확인 후 backward-compatible 앵커 |
| 10 | docs | `spec/1-data-model.md error` 컬럼 셀 정보 과밀 | follow-up |
| 11 | docs | `queued` 필드가 click_button ack 예시에만 표시 | 즉시 fix — 4개 ack 예시 통일 |
| 12 | harness | `08_41_30/_retry_state.json` 의 `agents_pending` 미flush | 즉시 fix — 상태 정규화 |

## INFO (11건)

I1-I11 — 대부분 follow-up. 본 SUMMARY 의 즉시 fix 항목에서 인접 작업으로 처리 가능한 항목 (I7 ENV/상수 표 비고, I8 stale Redis pub/sub 잔여) 만 손본다.

## 본 PR 즉시 처리

1. **WARNING #1**: spec §4.2 의 `queued: false` 정의를 "enqueue 실패 — 재시도 권장" 으로 갱신 (구현이 SoT).
2. **WARNING #3**: §9.2 표에 `exec:cont:seq:<executionId>` 행 추가 (TTL 미설정 근거 포함).
3. **WARNING #4**: `3-error-handling.md` 또는 §1.4 에 `RESUME_*` / `SERVER_SHUTTING_DOWN` 등재 또는 범위 선언.
4. **WARNING #6/#7**: `§Rationale` heartbeat 전환 + cancelled 단말 상태 결정 등재.
5. **WARNING #11**: §4.2 의 `queued` 필드 ack 예시 4개 통일 (submit_form / submit_message / end_conversation 추가).
6. **WARNING #12**: `08_41_30/_retry_state.json` 의 `agents_pending` flush (state 정규화).
7. **(검증)** WARNING #9: anchor 참조 grep.

## Follow-up (별 PR)

- WARNING #5: `recoverStuckExecutions` 동반 NodeExecution 처리 spec 명시
- WARNING #10: `spec/1-data-model.md error` 컬럼 정보 분리
- INFO 다수: stale 문서 표현 정리
- pre-existing CRITICAL 4건 (auth / graph-rag / mcp-client / chat-channel `status` 갱신) — 별 spec PR

## Router skip 9건

router 판단 모두 합당 — codebase 코드는 rebase 로 그대로 replay 되었으며 이전 /ai-review(`08_02_14`) 에서 검증 완료. 본 review 는 spec 갱신과 cross-rebase 영향만 cover.

**BLOCK: NO** — 즉시 처리 6건 후 push 가능.
