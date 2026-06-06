# Plan 정합성 검토 결과

target: `spec/5-system/17-agent-memory.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] ai-context-memory-followup-v2.md 의 미완료 SPEC-DRIFT 항목 (I1) — 대상 섹션 상이, 비충돌
- **target 위치**: `spec/5-system/17-agent-memory.md` — Rationale 섹션 끝에 "일괄 재임베딩 경로 부재 — TTL/dedup UPDATE 로 자연 대체" 소항 추가
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §"persistent 고도화 코드 리뷰 도출 백로그" — `[ ] SPEC-DRIFT: 17-agent-memory.md §3 AGM-04 "scheduleBackgroundBody snapshot" 표현 → 전용 BullMQ 큐(agent-memory-extraction, concurrency=2) 로 갱신(I1)`
- **상세**: 해당 plan 의 오픈 항목 I1 은 §3(추출 파이프라인) 본문의 `AGM-04` 요구사항 표현을 수정하는 것이다. 반면 target 이 추가하는 내용은 Rationale 섹션의 완전히 새로운 소항으로, §3 본문에 접촉하지 않는다. 섹션이 서로 다르므로 I1 과 충돌하지 않는다. 단, I1 이 향후 적용될 때 §3 AGM-04 와 Rationale 신규 소항이 정합한지 확인이 권장된다 (Rationale 에서 "scheduleBackgroundBody 계열 background 실행 패턴" 표현이 §3 본문과 여전히 일치해야 함).
- **제안**: target 변경 자체는 허용 가능하나, I1 적용 시 §3 본문("scheduleBackgroundBody snapshot 격리 invariant")과 Rationale 신규 소항 간 표현 일관성을 확인할 것. plan 측 변경 불필요.

### [INFO] rag-quality-improvement.md P6 spec 갱신 완료 — 중복 없음
- **target 위치**: `spec/5-system/17-agent-memory.md` — Rationale 추가 (§4 inputType 비대칭 크로스링크 언급 포함)
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md` §P6 — `[x] spec 갱신: spec/5-system/17-agent-memory §4` (PR #492 완료)
- **상세**: P6 의 §4 spec 갱신은 이미 완료(✅)됐으며 대상은 §4 본문(recall inputType 비대칭 배선). target 이 추가하는 Rationale 소항은 §4 완성 이후의 보완적 설명이다. 완료된 항목과의 이중 편집 아님.
- **제안**: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보로 검토된 브랜치 목록 및 판정:

- `embedding-followup-c09eb2` (branch `claude/embedding-followup-c09eb2`) — Step 1: ancestor 검사 STALE. 현재 target worktree 자체이므로 충돌 검토 대상에서 자동 제외.
- `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`) — Step 1 ancestor STALE. `spec/5-system/17-agent-memory.md` 비접촉, skip.
- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 2 PR #459 MERGED. plan frontmatter `worktree: ai-context-memory-9c7e6e` 가 가리키는 브랜치이나 이미 머지됨 — stale. `spec/5-system/17-agent-memory.md` 에 대한 active worktree 경합 없음.
- `claude/exec-park-pr-b2` — Step 2 PR MERGED. skip.
- `claude/fix-webchat-sse-field-map-22cd94` — Step 2 PR MERGED. skip.
- `claude/harden-review-hooks-cb1c84` — Step 2 PR MERGED. skip.
- `claude/plan-complete-p6-043804` — Step 2 PR MERGED. skip.
- `claude/impl-concurrency-cap-pr2b` — Step 1 ACTIVE, Step 2 PR empty([]). Step 3 fallback — active 로 간주. 단 `spec/5-system/17-agent-memory.md` 비접촉(해당 브랜치 최상위 커밋은 PR2b 착수 결정 기록). stale 판정 cascade Step 1/2 모두 확정 신호 없음. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.
- `claude/webchat-eager-start-2a7b86` — Step 1 ACTIVE, Step 2 PR empty([]). Step 3 fallback — active 로 간주. `spec/5-system/17-agent-memory.md` 비접촉(web-chat 영역 커밋만). stale 판정 cascade Step 1/2 모두 확정 신호 없음. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

worktree 충돌 후보 9건 중 stale 7건 skip, active 2건(impl-concurrency-cap-pr2b, webchat-eager-start-2a7b86) 분석 — 둘 다 `17-agent-memory.md` 비접촉으로 §5 worktree 충돌 해당 없음.

`./cleanup-worktree-all.sh --yes --force` 실행으로 확정 stale 5건(ai-context-memory-9c7e6e, exec-park-b2b-04a2f8, exec-park-pr-b2, fix-webchat-sse-field-map-22cd94, harden-review-hooks-cb1c84, plan-complete-p6-043804) cleanup 권장.

---

## 요약

target `spec/5-system/17-agent-memory.md` 에 대한 변경(Rationale 소항 "일괄 재임베딩 경로 부재" 추가)은 in-progress plan 들과 실질적 충돌이 없다. 유일하게 주목할 사항은 `ai-context-memory-followup-v2.md` 의 미완료 SPEC-DRIFT I1 (§3 AGM-04 BullMQ 표현 갱신)이 존재하나, 이는 §3 본문 대상이고 target 은 Rationale 섹션 신규 소항이라 섹션이 교차하지 않는다. 미해결 결정 우회·active worktree 경합·선행 plan 미해소 어느 항목도 해당되지 않는다. worktree 충돌 후보 9건 중 stale 7건 skip, active 2건은 대상 파일 비접촉으로 CRITICAL 없음.

### 위험도

NONE
