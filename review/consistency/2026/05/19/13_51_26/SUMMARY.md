# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 3건 (draft 갱신으로 해소 후 진행).

검토 대상: `plan/in-progress/spec-draft-conversation-ui-contract.md`
검토 일시: 2026-05-19
검토 모드: spec draft 검토 (--spec)
체커: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision (전원 성공)

---

## 전체 위험도

**HIGH** (1차 BLOCK 시점) → **draft 갱신 후 해소** — Critical 3건 (절 번호 체계 충돌 1건, 구현-spec 위치 불일치 1건, 구현 선행으로 인한 reverse-spec 필요 1건) + Warning 5건 + Info 16건.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | 해소 |
|---|---------|------|------|
| C-1 | convention_compliance · naming_collision | `§9.A` 알파벳 suffix 절 번호가 기존 숫자 절 체계와 충돌 + §2 표의 "§10 CHANGELOG" 표기 모호 | `§9.A` → `§9.11` 로 변경. §2 표의 "최상위 §10 (기존)" / "신설 §9.10" 구분 표기 |
| C-2 | plan_coherence · naming_collision | `isAssistantContentBlank` 가 `conversation-inspector.tsx` 에 있는데 spec 은 SoT 함수로 격상 + 테스트 경로는 `conversation-utils.test.ts` 가정 | spec §9.8 에 "구현 위치: `conversation-utils.ts` 로 이전·export 필수" 명시. 본 PR 내 codebase 부가 산출물로 이전 작업 동반 |
| C-3 | plan_coherence | `toolcall-tree-rendering` worktree (PR #214, 미머지) 가 §9.6/§9.7/§9.8/§9.11 의 핵심 구현 보유 — spec-first 위배 | draft 본문 최상단에 "reverse-spec 위상" 명시. spec write 시 PR #214 구현과 1:1 일치 검증 의무 |

---

## 경고 (WARNING)

| # | Checker | 위배 | 해소 |
|---|---------|------|------|
| W-1 | rationale_continuity | `ai_message` REPLACE + carry-over 정책이 기존 `3-execution.md §10.8` "권위적 재구성" 과 긴장 관계 | §9.7 에 carry-over Rationale 주석 추가 (권위적 재구성의 conversation UI 레이어 명문화 명시) |
| W-2 | convention_compliance | §9.10 표가 codebase 절대 경로 직접 명시 — 리팩토링 시 stale | 경로를 파일명 수준 (`conversation-utils.test.ts`) 으로 완화 + "구현 단계에서 확정" 노트 |
| W-3 | plan_coherence | `ai-agent-tool-connection-rewrite.md` 의 stale worktree 참조 | 후속 정리 (plan §7) 로 이관 |
| W-4 | plan_coherence | §9.10 시나리오가 PR #214 worktree 의 기존 테스트와 중복 가능 | C-3 해소 후 §9.10 "기존 테스트로 충족" 표시 (후속 정리) |
| W-5 | naming_collision | `§9.A` 알파벳 suffix — C-1 동일 근본 | C-1 해소로 함께 처리 |

---

## 참고 (INFO)

총 16건. spec write 시 spec 본문에 반영:

| ID | 반영 위치 |
|---|---|
| I-1 (WS 이벤트명 prefix 축약) | §9.7 표 헤더 주석 "(`execution.*` 생략)" 추가 |
| I-2 (form/buttons interactionType) | §9.7 표에 행 추가 |
| I-3 (`parseHistoryMessages` 누락) | §9.11 사용처 컬럼에 추가 |
| I-4 (`assistantToolCalls.length` 출처) | §9.6 에 wire (`turn.toolCalls`) vs store (`item.assistantToolCalls`) 명시 |
| I-5 (carry-over 필드 스키마 귀속) | §9.7 에 "store 내부 runtime 필드, wire 스키마 확장 아님" 주석 |
| I-6 (mermaid 의 conversationThread optional) | §9 prologue 다이어그램 caption 에 "(conversationThread: optional)" 명시 |
| I-7 (extended_thinking 입력 출처) | §9.8 에 "입력은 `turn.text`, extended_thinking 별 처리" 주석 |
| I-8 (§9.1 ai_assistant 행 분기) | §9.1 ai_assistant 행에 "blank + toolCalls 면 §9.6 parent chip" 비고 |
| I-9 (ai_tool status badge 확장) | §9.1 ai_tool 행 badge 표기를 "pending/success/error" 로 확장 |
| I-10 (storybook 도입 기각의 §7 반영) | §7 v2 로드맵에 "시각 회귀 인프라" 항목 추가 |
| I-11 (§8 에 §9.11 cross-ref) | §8.2 신설 — UI 계약 SoT 격상 결정 + 대안 비교 |
| I-12 (§9.3 → §9.7 cross-link) | §9.3 비고에 "mutation 계약은 §9.7" 추가 |
| I-13 (plan 인입 시 0-unimplemented-overview.md 갱신) | 후속 작업 |
| I-14 (`mergeOrphanToolItems` §9.5 등재) | §9.5 진입점 목록에 추가 |
| I-15 (`Inv-N` 명명) | §9.9 서두에 "본 §9.9 스코프 한정 레이블" 명시 |
| I-16 (`S1`~`S7` 도메인 prefix) | `CT-S1`~`CT-S7` 로 변경 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INFO 8건. 기존 spec 과 근본 모순 없음. |
| rationale_continuity | LOW | WARNING 1건 (carry-over vs 권위적 재구성), INFO 4건. 기각 결정 재도입 없음. |
| convention_compliance | MEDIUM | CRITICAL 1건 (§9.A), WARNING 2건. Frontmatter / 3섹션 구조는 준수. |
| plan_coherence | HIGH | CRITICAL 2건 (PR #214 구현 선행, isAssistantContentBlank 위치), WARNING 3건. 병렬 구현 worktree 충돌이 최대 위험. |
| naming_collision | LOW | WARNING 1건 (§9.A), INFO 5건. 의미 충돌 없음. |

---

## 권장 조치 — 실제 적용

1. ✅ **C-1 해소**: `§9.A` → `§9.11`. §2 표 표기 분리.
2. ✅ **C-2 해소**: `isAssistantContentBlank` 구현 위치 spec 명시 + plan §5 부가 산출물로 이전 작업 추가.
3. ✅ **C-3 해소**: draft 최상단에 reverse-spec 위상 명시. spec write 시 PR #214 구현과 1:1 일치 검증.
4. ✅ **W-1 ~ W-2 / W-5 해소**: 각각 §9.7 / §9.10 / §9.A 갱신으로 반영.
5. ↪ **W-3 / W-4 이관**: plan §7 후속 정리 항목.
6. ✅ **Info 일괄 반영**: I-1 ~ I-16 모두 spec write 단계에서 본문에 반영.

재검토 생략 사유: 위 변경은 모두 명료화 (라벨 변경, 행 추가, 주석 보강) 이며 새 충돌 도입 가능성이 없음.

STATUS: OK (Critical 해소 후)
