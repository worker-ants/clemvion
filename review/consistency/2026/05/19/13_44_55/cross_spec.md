# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-followup-cron-7d-statemachine.md`
**검토 일시**: 2026-05-19
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [WARNING] `spec/2-navigation/4-integration.md` §10.5 본문의 `now - 10d` 참조 — draft 변경 대상 누락 가능성
- **target 위치**: draft A-1 "§10.5 본문 (line 821)" 변경 지시
- **충돌 대상**: `spec/2-navigation/4-integration.md` line 821 (§10.5 본문)
- **상세**: draft 가 §10.5 본문의 `lastRotatedAt < now - 10d OR IS NULL` 을 `now - 7d` 로 갱신하도록 지시한다. 그런데 line 821 의 원문은 `lastRotatedAt < now - 10d OR IS NULL` 이라는 독립된 단언이 아니라 `**백그라운드 갱신**: 일일 cafe24-background-refresh 잡 (§11.1) 이 lastRotatedAt < now - 10d OR IS NULL 인 connected cafe24 통합을 …` 형태로 §11.1 표를 전달 (forward reference) 하는 산문이다. draft 는 이 단일 위치만 명시하고 있으나 같은 §10.5 블록 안에는 `Cafe24 한정` 단락 전체에 `10d` 언급이 한 곳뿐이므로 범위 자체는 정확하다. 다만 draft 의 side-effect 점검 항목(line 142)이 `spec/2-navigation/4-integration.md` 의 "다른 인라인 10일 참조" grep 을 별도로 요구하고 있어 일관성 검토에서 이 확인을 선행한다.
  실제 grep 결과: `spec/2-navigation/4-integration.md` 에서 `now-10d` 혹은 `10일` 이 line 821, 842, 1207(Rationale 절 제목), 1211, 1213-1216, 1384 에 존재한다. draft 가 명시하는 변경 위치는 line 842 (§11.1 표), Rationale 절 (1207), line 821 (§10.5 본문), line 1384 이므로 모두 커버된다. 충돌은 없으나 Rationale 본문 (line 1211-1216) 의 세부 내용 ("10일 근거: 14일 - 4일 안전 마진") 도 7일 근거로 교체해야 하는데, draft 의 Rationale 교체 문안은 이를 포함한다. 명시적으로 확인되므로 WARNING 등급으로 기록한다.
- **제안**: draft 적용 전 `grep -n "10d\|10일" spec/2-navigation/4-integration.md` 로 잔존 참조를 확인하고, Rationale 본문 (line 1211-1216) 의 옛 임계 근거 단락 전체를 draft 제시 문안으로 완전히 대체한다.

---

### [WARNING] `spec/data-flow/5-integration.md` §1.4 도입부가 "매일 00:00 UTC" 로 하드코딩 — cron 분리 반영 필요
- **target 위치**: draft A-2 "§1.4 본문 (line 130)" 변경 지시
- **충돌 대상**: `spec/data-flow/5-integration.md` line 130
- **상세**: 현재 line 130 원문은 `네 개의 독립 BullMQ 스케줄러가 매일 00:00 UTC 에 각자 job 을 enqueue 한다`. draft 는 이 문구를 cafe24 분리 반영으로 수정하도록 지시하고 있다. 그런데 동일 파일 line 215 (Redis 표) 의 scheduler ID 컬럼 설명 (`connected-expiry-daily / pending-install-ttl-daily / usage-log-prune-daily / cafe24-background-refresh-daily`) 도 cron 주기를 명시하지 않아 `cafe24-background-refresh-daily` 가 여전히 daily 인 것처럼 읽힌다. draft 는 line 215 의 `cafe24-background-refresh-daily` scheduler ID 에 "ID historical (BullMQ idempotent upsert), 실제 주기 6h" 주석을 추가하도록 지시하므로 충돌 자체는 draft 범위 내에서 해소된다. 그러나 line 130 의 도입부 수정과 line 215 의 Redis 표 수정이 원자적으로 이루어지지 않으면 두 위치가 일시적으로 불일치한다.
- **제안**: draft 에 명시된 변경이 완전하므로 추가 spec 수정 불필요. 적용 시 line 130 + line 137 (표) + line 144 (mermaid participant) + line 181 (mermaid query) + line 215 (Redis 표) 를 단일 커밋으로 묶어 부분 적용 방지.

---

### [WARNING] `spec/data-flow/5-integration.md` §1.4 mermaid 다이어그램 — `source: 'background'` enqueue 경로 참조 값이 `now-10d`
- **target 위치**: draft A-2 "§1.4 mermaid query (line 181)" 변경 지시
- **충돌 대상**: `spec/data-flow/5-integration.md` line 181
- **상세**: 현재 mermaid 시퀀스 다이어그램의 Scan->>PG 쿼리 라인: `SELECT integration WHERE service_type='cafe24' AND status='connected' AND (last_rotated_at < now-10d OR last_rotated_at IS NULL)`. draft 는 `now-10d → now-7d` 로 변경하도록 지시한다. 이 변경이 누락되면 §11.1 표의 `now-7d` 와 다이어그램의 `now-10d` 가 동일 파일 내에서 충돌한다.
- **제안**: draft 에 이미 포함되어 있다. 적용 시 표(line 137)와 다이어그램(line 181)을 동시에 수정한다.

---

### [WARNING] `spec/0-overview.md` §6.2 Cafe24 항목 — "10일 임계 백그라운드 갱신" 참조가 잔존
- **target 위치**: draft A-3 "§6.2 cafe24 항목 (line 90)" 변경 지시
- **충돌 대상**: `spec/0-overview.md` line 90 (`6.2 백엔드만 존재 / 부분 구현` 표의 Cafe24 행)
- **상세**: 현재 원문: `+ 10일 임계 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신) — 모두 구현 완료 (PR #20-#67)`. draft 는 이를 "7일 임계 + 6h cron 백그라운드 갱신" 으로 갱신하도록 지시한다. 변경 이전에는 §0-overview 가 §11.1 표와 모순된다.
- **제안**: draft 에 포함되어 있다. §6.2 항목이 임베딩된 한 줄 요약이므로 "7일 임계 + 6h cron 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신)" 으로 교체한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md` §1.1 Execution 상태 전이 표 — `waiting_for_input → failed` 행 미존재
- **target 위치**: draft B-1 "§1.1 허용되는 상태 전이 표 (line 41 다음)" 변경 지시
- **충돌 대상**: `spec/5-system/4-execution-engine.md` lines 30-42 (§1.1 허용 상태 전이 표)
- **상세**: 현재 §1.1 표에는 `waiting_for_input → running` 과 `waiting_for_input → cancelled` 두 행만 있다. `waiting_for_input → failed` 전이는 없다. PR #209 의 `state-machine.ts ALLOWED_TRANSITIONS` 에는 이미 추가되어 있으나 spec 이 뒤처져 있다. spec 미반영 상태에서는 frontend / 신규 개발자가 해당 전이가 허용된다는 사실을 spec 에서 확인할 수 없고, 원자성 보장 주석(line 43)도 `running ↔ waiting_for_input` 만 언급해 `waiting_for_input → failed` 전이의 원자성 계약이 spec 에 부재한다.
- **제안**: draft 에 명시된 행 삽입과 Rationale 추가를 모두 적용한다. 삽입 행: `| waiting_for_input | failed | AI Agent multi-turn turn 처리 중 LLM throw (429/timeout/connection) — spec/4-nodes/3-ai/1-ai-agent.md §7.9 |`. 원자성 주석(line 43)도 `waiting_for_input → failed` 전이를 포함하도록 확장해야 한다 (draft 의 Rationale 문안에 "단일 트랜잭션" 언급이 있으므로 연계 수정 필요).

---

### [WARNING] `spec/5-system/4-execution-engine.md` §1.2 NodeExecution 상태 머신 다이어그램 — `waiting_for_input → failed` 전이 미반영
- **target 위치**: draft B-1 에서 §1.1 만 수정 지시; §1.2 는 별개 절로 수정 지시 없음
- **충돌 대상**: `spec/5-system/4-execution-engine.md` lines 101-122 (§1.2 NodeExecution 상태 다이어그램 및 표)
- **상세**: §1.2 의 NodeExecution 다이어그램은 `waiting_for_input → completed` 만 나타낸다. PR #209 에서 `finalizeAiNode('FAILED')` 가 `NodeExecution.status=FAILED` 로 저장하므로 NodeExecution 도 `waiting_for_input → failed` 전이가 발생한다. 현재 §1.2 다이어그램과 상태 설명 표 어디에도 이 전이가 없어 `NodeExecution` 의 상태 머신이 불완전하게 기술되어 있다. draft 의 B-1 은 §1.1 (Execution 상태 전이 표) 만 언급하고 §1.2 (NodeExecution 상태) 를 포함하지 않으므로 이 영역은 draft 의 변경 범위에서 누락되어 있다.
- **제안**: draft 에 §1.2 NodeExecution 다이어그램 수정을 추가한다. `waiting_for_input → completed (폼 제출, 버튼 클릭, 또는 AI 대화 종료 시)` 를 `waiting_for_input ─┬─ completed (폼 제출, 버튼 클릭, 또는 AI 대화 종료 시) / └─ failed (AI Agent turn 처리 중 LLM throw)` 로 확장한다.

---

### [INFO] `spec/4-nodes/4-integration/_product-overview.md` INT-ST-02 — "00:00(워크스페이스 타임존)" 표현이 실제 구현(UTC) 과 괴리
- **target 위치**: draft A-4 "INT-ST-02 (line 48)" 변경 지시
- **충돌 대상**: `spec/4-nodes/4-integration/_product-overview.md` line 48
- **상세**: 현재 INT-ST-02 원문: `매일 00:00(워크스페이스 타임존) 만료 스캐너 Cron 실행`. `spec/data-flow/5-integration.md` §1.4 (line 130) 와 `spec/2-navigation/4-integration.md` §11.1 (line 835) 는 실제 cron 이 `0 0 * * *` UTC 임을 명시한다. 워크스페이스 타임존 기준이 아니라 UTC 기준이다. draft 의 after 문안은 "매일 00:00 UTC 만료 스캐너 Cron" 으로 UTC 를 명시해 이 불일치를 해소한다. 기존 INT-ST-02 원문의 "워크스페이스 타임존" 은 다른 spec 과 충돌하는 오기로, draft 수정이 올바른 방향이다.
- **제안**: draft 에 포함되어 있다. INT-ST-02 after 문안이 정확하다. 별도 조치 불필요.

---

### [INFO] `spec/5-system/4-execution-engine.md` §1.1 원자성 주석 — `waiting_for_input → failed` 전이의 원자성 계약이 미언급
- **target 위치**: draft B-1 Rationale 문안 ("원자성 보장: 본 전이도 ... 단일 트랜잭션")
- **충돌 대상**: `spec/5-system/4-execution-engine.md` line 43 (원자성 보장 블록쿼트)
- **상세**: 현재 line 43 의 원자성 주석은 `running ↔ waiting_for_input` 전이만 명시한다. draft 의 Rationale 문안은 `waiting_for_input → failed` 전이도 동일하게 단일 트랜잭션임을 밝히고 있다. 그러나 §1.1 본문의 원자성 보장 블록쿼트 자체는 수정 대상으로 draft 에 명시되어 있지 않다. Rationale 섹션에만 언급하고 본문 원자성 주석을 갱신하지 않으면 독자가 해당 전이의 원자성을 본문에서 확인할 수 없다.
- **제안**: draft 에 §1.1 의 원자성 보장 블록쿼트 수정을 추가한다. "(`running ↔ waiting_for_input` 및 `waiting_for_input → failed` 전이 공통)" 으로 확장한다.

---

### [INFO] 명명 일관성 — draft Rationale 문안의 "scheduler ID `cafe24-background-refresh-daily` 는 historical 보존" 표현
- **target 위치**: draft A-1 Rationale 교체 문안 내 "scheduler ID `cafe24-background-refresh-daily` 는 historical 보존"
- **충돌 대상**: `spec/data-flow/5-integration.md` line 215 (Redis 표 scheduler ID 컬럼)
- **상세**: `spec/data-flow/5-integration.md` §1.5 Redis 표에서 scheduler ID 는 `cafe24-background-refresh-daily` 로 등록되어 있다. draft 의 A-2 는 이 표에 "ID historical (BullMQ idempotent upsert), 실제 주기 6h" 주석을 추가하도록 지시한다. 이는 일관성 있으나 Rationale 문안 (`spec/2-navigation/4-integration.md` Rationale 교체 문안) 의 표현과 data-flow 의 Redis 표 주석이 동일한 사실을 달리 표현할 수 있다. 단순 명명 동기화 권장이다.
- **제안**: 두 문서에서 동일한 표현을 사용하도록 정렬한다. "historical 보존" + "BullMQ idempotent upsert" 의 조합을 양 문서에서 일관 유지.

---

## 요약

Cross-Spec 일관성 관점에서 이번 draft 는 **CRITICAL 충돌 없음**. 주요 발견사항은 두 영역이다. 첫째, `cafe24-background-refresh` 의 10d → 7d 및 daily → 6h 변경은 `spec/2-navigation/4-integration.md`, `spec/data-flow/5-integration.md`, `spec/0-overview.md`, `spec/4-nodes/4-integration/_product-overview.md` 네 곳에 분산된 참조를 모두 갱신해야 하는데, draft 가 이를 대부분 포괄하고 있다. Rationale 본문(line 1211-1216)의 옛 임계 근거 단락도 교체 범위에 포함됨을 확인했다. 둘째, `waiting_for_input → failed` 전이 추가는 `spec/5-system/4-execution-engine.md` §1.1 (Execution 상태 전이 표) 의 행 삽입과 Rationale 추가만 지시하고, **§1.2 (NodeExecution 상태 다이어그램)** 에 대응하는 수정이 누락되어 있다. 코드(PR #209)에서는 `NodeExecution.status=FAILED` 저장이 이루어지므로 §1.2 다이어그램 + 원자성 주석(line 43)의 동반 갱신이 필요하다. 이 두 사항은 WARNING 등급이며 spec 작성 전에 draft 에 보완해야 한다.

---

## 위험도

**MEDIUM** — CRITICAL 충돌은 없으나 `spec/5-system/4-execution-engine.md` §1.2 NodeExecution 상태 다이어그램의 `waiting_for_input → failed` 전이 누락이 코드와 spec 의 불일치를 그대로 존속시키고, draft 이후에도 다른 개발자가 해당 전이가 허용되지 않는다고 오해할 수 있다. 해소 전 spec 확정 비권장.

STATUS: OK
