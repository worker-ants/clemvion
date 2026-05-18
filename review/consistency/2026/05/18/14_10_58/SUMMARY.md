# Consistency Check SUMMARY — spec/conventions/conversation-thread.md (재검증)

**BLOCK: NO** — Critical 0건. spec 채택 가능.

- **모드**: `--spec`
- **세션**: `2026-05-18T14:10:58`
- **위험도**: MEDIUM (남은 WARNING 은 spec 본문 미세 정정 또는 별 plan 영역)
- **결과**: CRITICAL 0 · WARNING 9 · INFO 15

이전 세션 (`13_51_05`) Critical 3건 (C-1·C-2·C-3) 모두 해소 확인:
- C-1 (§1.2 자기 충돌) — §1.2 `text` 행 재진술로 해소.
- C-2 (Open Question 강제 종료) — `ai-thread-source-mark.md` Open Questions 갱신 + Phase 2/3/4 흡수 표기로 해소.
- C-3 (chip Follow-up 충돌) — Follow-up 항목 "정식 spec 화 완료" 갱신으로 해소.

---

## 남은 WARNING 처리 매핑

| # | 내용 | 처리 |
|---|------|------|
| W-1 | WebSocket §4.4.6 동반 개정 | **이미 처리됨** — §4.4.6 두 번째 bullet 이 "필수" 격상 명시 (Phase 1 docs commit). checker false positive — 헤더 "권장 동작" 단어 발견했으나 본문은 "필수" 명시 |
| W-2 | EH-DETAIL-06 위임 대상 부재 | Follow-up — 별 plan (`spec/2-navigation/14-execution-history.md` 갱신 plan). 본 작업 범위 외 |
| W-3 | §1.6 `output.messages[].content` → `output.result.messages[].content` | **정정 완료** |
| W-4 | §2.5 위치 역전 (§3 뒤) | 기존 quirk (옛 작업에서 승계). 본 작업 범위 외 — 별 housekeeping plan |
| W-5 | §8 Rationale 위치 (§9 앞) | 기존 conventions/ 파일 패턴 (Overview 없는 컨벤션 문서). 본 작업 범위 외 |
| W-6 | §1.4 ai_user marker 명시 | **정정 완료** — ai_user 는 marker wrap 없음 (`appendAiUserMessage` 가 `renderInteractionText` 거치지 않음) 명시. §1.6 "(presentation_user 한정)" 부속 |
| W-7 | ai-thread-source-mark Open Question 갱신 | **이미 처리됨** (C-2 와 동일 영역) |
| W-8 | ai-thread-source-mark Phase 3 범위 갱신 | **이미 처리됨** — Phase 3 항목을 conversation-turn-render Phase 1 흡수로 [x] 처리 |
| W-9 | chip Follow-up 흡수 미반영 | **이미 처리됨** (C-3 와 동일 영역) |

추가 정정: I-1 (§1.4 `§11` → `§9.1`) 도 정정 완료.

---

## INFO 15건

I-2 ~ I-15 — 인지·후속 사항 (별 plan / 코드 리뷰 단계 처리). 본 SUMMARY 에서 트래킹.

---

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| cross_spec | MEDIUM (W-2 EH-DETAIL-06 부재) |
| rationale_continuity | LOW |
| convention_compliance | LOW (W-4·W-5 구조 quirk) |
| plan_coherence | MEDIUM → 해소됨 (W-7·W-8·W-9 이미 plan 갱신) |
| naming_collision | LOW |

---

## Checker별 상세

- [cross_spec.md](./cross_spec.md) — ISSUES=6
- [rationale_continuity.md](./rationale_continuity.md) — ISSUES=3
- [convention_compliance.md](./convention_compliance.md) — ISSUES=6
- [plan_coherence.md](./plan_coherence.md) — ISSUES=5
- [naming_collision.md](./naming_collision.md) — ISSUES=6
