---
worktree: spec-followup-cron-7d-statemachine-868886
started: 2026-05-19
owner: project-planner
---

# Spec 정합화 — Cafe24 background refresh cron 6h + cutoff 7일, Execution 상태머신 WFI→FAILED

## 배경

본 작업은 **이미 머지된/머지 예정인 코드 변경에 spec 문서를 정합화**하는 작업이다. 신규 spec 정의 / 요구사항 추가 없음.

대응 코드 PR:
- [#212 (cafe24-bg-refresh-tuning)](https://github.com/worker-ants/clemvion/pull/212) — cafe24 cron `'0 0 * * *' → '0 */6 * * *'`, `REFRESH_PROACTIVE_THRESHOLD_DAYS 10 → 7`. cafe24-background-refresh 만 별도 cron 으로 분리, 다른 3개 스케줄러 (connected-expiry / pending-install-ttl / usage-log-prune) 는 daily 유지.
- [#209 (ai-agent-turn-fail-finalize)](https://github.com/worker-ants/clemvion/pull/209) — `state-machine.ts` 의 `ALLOWED_TRANSITIONS` 에 `WAITING_FOR_INPUT → FAILED` 추가. AI Agent multi-turn turn 실패 (LLM 429 등) 시 spec §7.9 (`port='error', status='ended'`) 로 finalize.

## 변경 대상 spec 파일

### A. #212 — cafe24 cron 6h + cutoff 7일

#### A-1. `spec/2-navigation/4-integration.md`

**§11.1 표 (line 842)** — `cafe24-background-refresh` 잡 표 행:
- before: `status='connected' AND service_type='cafe24' AND (last_rotated_at < now-10d OR last_rotated_at IS NULL)` … `10일 임계 = refresh_token 14일 - 4일 안전 마진`
- after: `… last_rotated_at < now-7d OR last_rotated_at IS NULL` … `7일 임계 = refresh_token 14일의 50% 마진 (cron 6h 와 짝)`

**§11.1 cron 도입부 (line 835)** — "네 개의 일일 BullMQ 잡 (`Cron: 0 0 * * *` UTC)" → cafe24 만 6h 별도임을 명시:
- 표 위 문구에 "cafe24-background-refresh 만 `0 */6 * * *` UTC (6h 주기), 나머지 3개는 daily 00:00 UTC" 분기 설명.

**§10.5 본문 (line 821)** — `lastRotatedAt < now - 10d OR IS NULL` → `now - 7d` 로 갱신.

**§1.4 의 "10일 임계 백그라운드 갱신" 참조 (line 1207 - Rationale 절)** — 절 제목 자체를 갱신하고 본문을 다음으로 교체:

```
### `cafe24-background-refresh` 7일 임계 + 6h cron (2026-05-19 갱신)

Cafe24 의 `refresh_token` 은 14일 유효. 일일 `cafe24-background-refresh` 잡이
`lastRotatedAt < now - 7d OR IS NULL` 인 connected cafe24 통합을 자동 refresh.

**임계 7일 + cron 6h 근거 (2026-05-19 갱신)**:
- 옛 정책 (10일 cutoff + 24h cron) 은 마진 3일. cron 한 번 누락 시 즉시 2일로 압박.
- 새 정책: 7일 cutoff = 14일의 50% 마진. cron 6h 주기로 cron 누락 1회 (6h) 가 마진에 거의 영향을 주지 않음.
- scheduler ID `cafe24-background-refresh-daily` 는 historical 보존 — BullMQ idempotent upsert
  활용 (ID 변경 시 옛 Redis entry 가 orphan 으로 잔존해 daily/6h 가 동시 fire 되는 회귀 위험).

대안 검토:
- 1h cron: 쿼리 비용 (idle 통합 풀스캔) 누적 위험 + cutoff 자체가 throttle 역할이라 과도.
- 14일 cutoff (마진 0): cron 누락 1회만으로도 refresh_token 만기.

옛 결정 ("`cafe24-background-refresh` 10일 임계 (2026-05-16)") 은 본 절로 대체. PR #212 와 함께 적용.
```

**기타 인라인 참조 (line 1384)** — `last_rotated_at < now - 10d OR IS NULL` → `now - 7d`.

#### A-2. `spec/data-flow/5-integration.md`

**§1.4 본문 (line 130)** — "네 개의 독립 BullMQ 스케줄러가 매일 00:00 UTC 에 각자 job 을 enqueue" → cafe24 분리 반영.

**§1.4 잡 표 (line 137)** — `cafe24-background-refresh` 행:
- before: `last_rotated_at < now-10d` … `14일 - 4일 안전 마진`
- after: `last_rotated_at < now-7d` … `14일의 50% 마진 (cron 6h 와 짝)`. scheduler ID 가 historical 보존 명시.

**§1.4 mermaid participant (line 144)** — `participant CR as cafe24-background-refresh-daily (cron)` → `participant CR as cafe24-background-refresh (6h cron, ID historical)`.

**§1.4 mermaid query (line 181)** — `now-10d` → `now-7d`.

**§1.5 Redis 표 (line 215)** — `cafe24-background-refresh-daily` scheduler ID 에 "ID historical (BullMQ idempotent upsert), 실제 주기 6h" 주석 추가.

#### A-3. `spec/0-overview.md`

**§6.2 cafe24 항목 (line 90)** — "10일 임계 백그라운드 갱신" → "7일 임계 + 6h cron 백그라운드 갱신".

#### A-4. `spec/4-nodes/4-integration/_product-overview.md`

**INT-ST-02 (line 48)** — "매일 00:00 만료 스캐너 Cron 실행" 문구를 cafe24 분리 반영해 보완:
- before: `매일 00:00(워크스페이스 타임존) 만료 스캐너 Cron 실행 — 임계치 7일/3일/당일에 상태·알림 생성`
- after: `매일 00:00 UTC 만료 스캐너 Cron — 임계치 7일/3일/당일 상태·알림 생성 (connected-expiry / pending-install-ttl / usage-log-prune 일일). Cafe24 background refresh 는 별도 6h 주기 — refresh_token 14일 만기 사전 차단용 (자세한 분기는 spec/2-navigation/4-integration.md §11.1).`

### B. #209 — AI Agent multi-turn turn-fail finalize (Execution 상태머신)

#### B-1. `spec/5-system/4-execution-engine.md`

**§1.1 Execution 상태머신 (line 30-41)** — "허용되는 상태 전이" 표에 `waiting_for_input → failed` 전이 추가:
- 행 삽입 (line 41 다음): `| waiting_for_input | failed | AI Agent multi-turn turn 처리 중 LLM throw (429/timeout/connection) — spec/4-nodes/3-ai/1-ai-agent.md §7.9 |`

**§1.2 NodeExecution 상태 다이어그램 (line 103-112)** — `waiting_for_input → failed` 분기 추가 (cross-spec checker WARNING 4 반영). PR #209 가 NodeExecution.status=FAILED 도 저장하므로 본 다이어그램에도 명시:

```
                    ┌─ completed
                    │
pending → running ──┤
                    ├─ failed
                    │
                    ├─ skipped
                    │
                    └─ waiting_for_input ──┬─ completed (폼 제출, 버튼 클릭, AI 대화 정상 종료)
                                           │
                                           └─ failed (AI Agent multi-turn turn 처리 중 LLM throw)
```

§1.2 표의 `waiting_for_input` 행 설명 보강 — "AI 대화 입력 대기. turn 처리 중 LLM throw 시 `failed` 로 전이 (`handleAiTurnError` — spec/4-nodes/3-ai/1-ai-agent.md §7.9)".

**§1.1 Rationale** (해당 절 끝 또는 새 Rationale 항목) — 다음 추가:

```
### `waiting_for_input → failed` 전이 추가 (2026-05-19)

옛 정책은 `waiting_for_input` 종료를 RUNNING 으로만 가정했다. AI Agent multi-turn 의 turn
처리가 LLM throw (429 / timeout / connection) 로 종결될 때, `handleAiTurnError` →
`finalizeAiNode('FAILED')` 가 직접 Execution 을 FAILED 로 전이시켜야 spec §7.9 의
`port='error', status='ended'` shape 으로 정상 finalize 된다. 본 전이가 없으면
NodeExecution.status 가 WAITING_FOR_INPUT 으로 영구 잔류하고 Execution 만 top-level
catch 로 FAILED 가 되어 frontend 가 헤더 "실패" + 노드 "Waiting" 의 모순 상태를 표시한다
(운영 보고 2026-05-19, PR #209).

원자성 보장: 본 전이도 `running ↔ waiting_for_input` 와 동일하게 NodeExecution.status=
FAILED save + WS 이벤트 발사가 단일 트랜잭션. WebSocket 이벤트 발행 순서: NODE_FAILED →
EXECUTION_FAILED.
```

## 결정 사항

- **변경 위치 정확성**: 사용자 prompt 의 "§1.2 상태머신 다이어그램" 표현은 §1.1 의 "허용되는 상태 전이" 표가 정확한 위치. §1.2 는 별개의 "NodeExecution 상태" 절 (line 101 이하).
- **모든 변경 Rationale 명시**: 각 spec 문서 끝 `## Rationale` 절 (또는 본문에 inline Rationale 절이 있는 경우 거기에) "2026-05-19 갱신" 항목 추가. 옛 결정의 폐기 사유 + 새 결정의 근거 + 검토된 대안.
- **historical 식별자 보존**: `cafe24-background-refresh-daily` scheduler ID 는 BullMQ idempotent upsert 활용을 위해 보존. spec 에 historical 명시로 혼동 방지.

## consistency-check 진행 계획

본 draft 작성 후 `/consistency-check --spec plan/in-progress/spec-followup-cron-7d-statemachine.md` 호출:
- 5개 checker (cross-spec / rationale-continuity / convention-compliance / plan-coherence / naming-collision) 병렬.
- Critical (BLOCK: YES) 발견 시 spec write 차단, 차단 사유 해소 후 재호출.
- BLOCK: NO + Warning 만 있으면 본문에 반영하고 spec 적용 진행.

## side-effect 점검 항목

- `spec/2-navigation/4-integration.md` 의 다른 인라인 "10일" 참조가 §11.1 표·Rationale 외에 남아있는지 grep.
- `spec/data-flow/integration.md` (다른 이름의 파일 — `5-integration.md` 와 별개) 가 존재한다면 동일 변경 필요한지.
- `plan/in-progress/cafe24-backlog-residual.md` 의 F-2 항목 (spec §11.1 갱신 추적) 이 본 작업으로 해소되는지 — 해소되면 본 spec PR 의 commit 메시지 또는 plan 후속에 명시.

## 후속 (본 plan 범위 외)

- **`ai-agent-turn-fail-finalize.md` 후속 체크박스 갱신** (plan-coherence INFO): 본 plan 의 spec PR 머지 후 `plan/in-progress/ai-agent-turn-fail-finalize.md` 의 "후속" 첫 항목 ("spec §1.2 다이어그램에 waiting_for_input → failed 전이 명시") 을 `[x]` 로 갱신하는 chore commit.
- **`cafe24-bg-refresh-tuning.md` 후속 체크박스 갱신** (별도 발견): 동일하게 `plan/in-progress/cafe24-bg-refresh-tuning.md` 의 "후속" 항목 ("spec 정합화") 도 `[x]` 갱신.
- **`spec-overview-followups-2026-05-18.md §2` 와의 머지 순서** (plan-coherence WARNING): `spec/0-overview.md §6.2` 의 cafe24 행을 양 plan 이 모두 수정함. 본 plan 이 먼저 머지되어야 그 후속 plan 이 갱신된 텍스트 위에서 분류 재배치만 수행 가능. 본 plan 의 PR 본문에 명시.
- **`cafe24-backlog-residual.md` F-2 는 별도 영역**: F-2 는 `spec/2-navigation/4-integration.md §6` mermaid install_token 보존 정책으로 본 plan 의 §10.5/§11.1 갱신과 영역 분리. 본 plan 으로 해소되지 않음 — `cafe24-backlog-residual` 에서 별도 처리.
- **`node-output-redesign/ai-agent.md` P0 (single-turn) 경계**: single-turn LLM throw 의 spec §1.1 추가 전이 필요 여부는 그 P0 plan 에서 결정. 본 plan 은 multi-turn (`waiting_for_input → failed`) 만 다룸.
