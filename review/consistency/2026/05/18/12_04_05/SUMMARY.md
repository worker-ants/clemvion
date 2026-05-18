# Consistency Check SUMMARY — spec-draft-conversation-turn-render

**BLOCK: NO** — Critical 발견 없음. spec write 진행 가능.

- **검토 대상**: `plan/in-progress/spec-draft-conversation-turn-render.md`
- **모드**: spec draft 검토 (`--spec`)
- **세션**: `2026-05-18T12:04:05`
- **종합 위험도**: LOW
- **결과**: CRITICAL 0건 · WARNING 5건 (spec write 전 해소 권장) · INFO 10건 (write 시점 또는 후속 plan 단계)

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec + Naming-Collision (통합) | `ConversationTurn.data.fields` 키가 기존 flat map 정의와 구조 불일치 — draft §1.2 가 `form_submitted → fields (Record<string,unknown>)` 를 1급 키로 표현하나, `node-output §4.5` 는 `data` 자체가 flat key→value map (`{ [fieldName]: value }`) 이며 `fields` 래퍼 키가 없음 | draft §1.2 `data?` 보강 표, §1.4 텍스트 변환 표 | `spec/conventions/node-output.md §4.5` | `data` 자체가 flat map 임을 명시하는 형태로 재기술 |
| W2 | Cross-Spec | `system` source UI 강제 매핑이 v1 dead code 경로를 "강제" 규약으로 격상 | draft §11.1 `system` 행 | `conversation-thread.md §1.1` ("예약, v1 자동 push 없음") | "v1 자동 push 없음 — 수동 push 도입 시 활성화" 주석 추가 |
| W3 | Rationale-Continuity | §4.4.6 injected chip "권장"→"필수" 격상 근거가 §8 Rationale 에 없음 — `ai-thread-source-mark` Follow-up 결정 번복 경위 미명문화 | draft §1 결정 D5, §11.2, §8 | `websocket-protocol.md §4.4.6`; `ai-thread-source-mark.md` Follow-up | §8 에 격상 근거 명시 추가 |
| W4 | Naming-Collision | 동일 `button_click` interaction 의 UI 라벨이 D5 표에서는 `buttons`, §11.1 표에서는 `button clicked` 로 draft 내부 불일치 | draft §1 D5 표; §3.1 §11.1 표 | draft 자기 충돌 | `button clicked` 로 단일화 |
| W5 | Plan-Coherence | `ai-thread-source-mark` Phase 2/3(미완료) 와 target draft Phase 2 가 동일 파일군(`processMultiTurnMessageInner` / `mapTurnsToChatMessages` / frontend 변환기) 을 독립 수정 가능 — "동선 통합" 언급만 있고 명시적 이관 없음 | draft §4 Phase 2; §1 D2 | `ai-thread-source-mark.md` Phase 2·3 | 구현 plan 생성 시 Phase 2/3 명시적 흡수/이관 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | §4.4.6 권장→필수 격상 시 기존 bullet 과 신규 문장 과도 공존 위험 | draft §3.2 | spec write 시 기존 bullet 완전 교체 |
| I2 | Cross-Spec + Naming-Collision | §3.4 plan cross-link 경로 표기 일관성 | draft §3.4 | plan 기준 상대 경로로 일관 표기 (실질 오류 아님) |
| I3 | Cross-Spec | §11.3 복원 view 의 `output_data.interaction` JSONB 경로 vs `interaction_data` 컬럼 관계 미명시 | draft §11.3 | 한 줄 명시 |
| I4 | Rationale-Continuity | `ai-thread-source-mark` Open Question "보여주되 카운팅에서만 제외(잠정)" 를 draft 가 실질 번복하면서 §8 에 경위 미기재 | draft §1 D4·D6, §8 | 재검토 경위 한 줄 추가 |
| I5 | Rationale-Continuity + Plan-Coherence | `ai-thread-source-mark.md` Follow-up·Open Question 이 draft 에 의해 결정되었으나 plan 자체는 stale | `ai-thread-source-mark.md` | spec write 동시에 "결정 완료" 표기 + cross-link |
| I6 | Plan-Coherence | `output.messages` source 마커 DB 영속 여부가 `ai-thread-source-mark` plan 에 미결, draft §1.5 직접 확정 안 함 | draft §1.5, §11.3 | 구현 plan Phase 2 에 영속 정책 확정 항목 포함 |
| I7 | Plan-Coherence | Phase 2/3 구현 plan worktree 귀속 미결 | 두 plan frontmatter | 구현 plan 생성 시 worktree 귀속 명확화 |
| I8 | Convention-Compliance | draft §6 일관성 검토 결과 placeholder 미채움 | draft §6 | 본 검토 완료 후 채움 (규약 위반 아님) |
| I9 | Convention-Compliance | draft §3.1 `text` 필드 의미 shift ("UI 1차" → "LLM-facing 1차") | draft §3.1 | "UI 역할은 §11 매핑표로 위임" 명시로 맥락 보존 |
| I10 | Naming-Collision | `spec/1-data-model.md §2.6` 와 신규 `conversation-thread.md §11` 의 동일 섹션 번호 (다른 파일) | `1-data-model.md §2.6` | 경로 명시 현행 관행으로 충분 |

---

## 권장 조치 (순서)

1. **[spec write 전]** W1·W2·W3·W4 4건을 draft 에 반영해 spec write 품질 확보.
2. **[spec write 시]** I1 (§4.4.6 bullet 전면 교체), I5 (`ai-thread-source-mark.md` 동시 갱신), I8 (본 §6 채움) 동시 처리.
3. **[구현 plan 생성 시]** W5·I6·I7 — `conversation-turn-render.md` 작성 시 `ai-thread-source-mark` Phase 2/3 흡수/이관 + worktree 귀속 명확화 + source 마커 영속 정책 결정 항목 포함.

---

## Checker별 상세

- [cross_spec.md](./cross_spec.md) — STATUS=success ISSUES=5
- [rationale_continuity.md](./rationale_continuity.md) — STATUS=success ISSUES=3
- [convention_compliance.md](./convention_compliance.md) — STATUS=success ISSUES=3
- [plan_coherence.md](./plan_coherence.md) — STATUS=success ISSUES=5
- [naming_collision.md](./naming_collision.md) — STATUS=success ISSUES=4
