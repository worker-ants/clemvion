# Consistency Check SUMMARY — spec/conventions/conversation-thread.md (재개정)

**BLOCK: YES** — Critical 3건 발견. 호출자(planner) 차단. 모두 해소 후 재실행 필요.

- **모드**: `--spec`
- **세션**: `2026-05-18T13:51:05`
- **위험도**: HIGH
- **결과**: CRITICAL 3건 · WARNING 9건 · INFO 15건

---

## Critical (BLOCK 사유)

| # | Checker | 내용 | 위치 | 해소 |
|---|---------|------|------|------|
| C-1 | Rationale Continuity | §1.2 `text` 행의 "인라인 마커는 박지 않는다" 와 §1.6 "LLM-facing 의무" 가 동일 문서 내 자기 충돌 | §1.2 ConversationTurn 표 `text` 행 | §1.2 문구를 "보안 목적의 `[user-input]` 마커는 LLM-facing 의무 (§1.6). UI 표시는 §9.5 strip" 으로 교체 |
| C-2 | Plan Coherence | `ai-thread-source-mark` Open Questions Phase 3 잠정 결정을 spec 이 일방적 번복 | §8.1 Rationale, §9.3 D4, §9.4 | `ai-thread-source-mark.md` Open Questions Phase 3 항목에 "2026-05-18 확정" 명시 (planner 단계에서 일부 처리됨 — 추가 검증) |
| C-3 | Plan Coherence | chip 표시 Follow-up 흡수가 `ai-thread-source-mark` Phase 3 체크박스와 충돌 | §9.1·§9.2 강제 매핑 | Follow-up 항목을 Phase 3 로 흡수 표기 (planner 단계에서 일부 처리됨 — 추가 검증) |

---

## WARNING (9건)

| # | 내용 | 처리 |
|---|------|------|
| W-1 | §4 영속화 표가 D6(2026-05-17) 로 폐기된 `output.messages` 경로 SoT 참조 | §4 의 `output.messages` → `output.result.messages` 갱신 |
| W-2 | WebSocket §4.4.6 가 chip "권장" 유지 — §9.2 "3중 강제" 와 상충 | §4.4.6 갱신 (planner 단계에서 일부 처리됨 — 검증) |
| W-3 | §1.4 표 4열 확장 CHANGELOG 미기록 | CHANGELOG 보강 |
| W-4 | §1.2 `text` 의미 반전 CHANGELOG 미기록 | CHANGELOG 보강 (이미 2026-05-18 2건 행 추가됨 — 표현 명시 확인) |
| W-5 | §1.2 `data?` 가 node-output §4.5 내용 인라인 중복 | shape 인라인 제거, 링크 위임 |
| W-6 | agent-session-restore plan parseHistoryMessages strip 검증 누락 | Follow-up 항목 추가 |
| W-7 | ai-thread-source-mark Phase 2 §1.5 정정 미반영 | Phase 2 체크박스 주석 추가 |
| W-8 | node-output-redesign 의 information/text-classifier 가 §2.3 v2 미참조 | 해당 plan 에 주석 추가 |
| W-9 | §9.3 실행 이력 행이 14-execution-history §EH-DETAIL-06 와 책임 중복 | 역참조 추가 |

---

## INFO 15건 — 별도 plan 으로 트래킹

I-1 ~ I-15 — 자세한 내용은 checker 파일.

---

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| Plan Coherence | HIGH (C-2·C-3) |
| Rationale Continuity | MEDIUM (C-1) |
| Cross-Spec | MEDIUM (W-1·W-2·W-9) |
| Convention Compliance | LOW |
| Naming Collision | LOW |

---

## Checker별 상세

- [cross_spec.md](./cross_spec.md) — ISSUES=6
- [rationale_continuity.md](./rationale_continuity.md) — ISSUES=5
- [convention_compliance.md](./convention_compliance.md) — ISSUES=7
- [plan_coherence.md](./plan_coherence.md) — ISSUES=7
- [naming_collision.md](./naming_collision.md) — ISSUES=6
