# RESOLUTION — 09_26_57

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | spec | c4586fa8 | `spec/5-system/6-websocket-protocol.md §4.2` — `queued: false` 정의를 "publish 단계 실패 — 재시도 권장"으로 정정. ack 예시의 `queued: false` 도 `true` 로 통일 (정상 publish 는 항상 `true`) |
| #3 | spec | c4586fa8 | `spec/5-system/4-execution-engine.md §9.2` — `exec:cont:seq:<executionId>` 행 추가 + TTL 미설정 근거 + §9.1 전역 키 예외 note 보완 |
| #4 | spec | c4586fa8 | `spec/5-system/3-error-handling.md` — `### 1.5 WS commands 에러 코드 (도메인 spec 참조)` 절 신설. `INVALID_EXECUTION_STATE` / `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` / `SERVER_SHUTTING_DOWN` 5개 등재 |
| #6 | spec | c4586fa8 | `spec/5-system/4-execution-engine.md §Rationale "Phase 2 cont 후속 정리"` — heartbeat 기반 Recovery 전환 결정 + WAITING_FOR_INPUT 회귀(2026-05-24) 방지 근거 등재 |
| #7 | spec | c4586fa8 | 동일 Rationale 절 — rehydration 단말 상태 `cancelled` (Execution) vs `failed` (NodeExecution) 이분 사유 등재 |
| #11 | spec | c4586fa8 | `spec/5-system/6-websocket-protocol.md §4.2` — 공통 ack shape 표 + `submit_form.ack` / `submit_message.ack` / `end_conversation.ack` 예시 3개 신설 |
| #12 | harness | c4586fa8 | `review/consistency/2026/05/25/08_41_30/_retry_state.json` — `agents_pending` 5개 → `agents_success` 이전. `07_12_25` / `08_28_14` / `09_26_57` 세션은 이미 정상 상태 확인 |

**검증 항목 (#9)**: `spec/data-flow/3-execution.md §2.3` anchor 파괴 가능성 — `grep -rn` 결과 해당 앵커(`#23-redis-pub` 등)를 직접 참조하는 링크 없음. 현재 섹션 헤딩 "Redis (보조 키 — 분산 lock & seq)" 에 대한 broken 링크 없음. 추가 조치 불필요.

## TEST 결과

- lint  : 통과 (28s)
- unit  : 통과 (4797 passed, 28s)
- build : (변경 set이 spec/**·review/** 전용이므로 별도 빌드 불필요)
- e2e   : 면제 (화이트리스트: spec/** · review/** — 코드 변경 0줄)

## 보류·후속 항목

- WARNING #5 (follow-up): `recoverStuckExecutions` 동반 NodeExecution 처리 spec 미명시 — 별 PR
- WARNING #10 (follow-up): `spec/1-data-model.md error` 컬럼 정보 분리 — 별 PR
- INFO 항목 다수: stale 문서 표현 정리 — 별 PR
- Pre-existing CRITICAL 4건 (auth / graph-rag / mcp-client / chat-channel `status` 갱신) — 별 spec PR
