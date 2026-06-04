# 요구사항(Requirement) Review

## 리뷰 대상
- 파일: `spec/conventions/conversation-thread.md`
- 변경 유형: frontmatter `pending_plans` 포인터 갱신
- 변경 내용: `plan/in-progress/ai-context-memory-auto.md` → `plan/in-progress/ai-context-memory-followup-v2.md`

---

## 발견사항

### **[INFO]** frontmatter `pending_plans` 포인터 교체 — 정합성 확인
- 위치: `spec/conventions/conversation-thread.md` frontmatter lines 13-14
- 상세: 변경 전 포인터인 `ai-context-memory-auto.md` 는 Phase B~F 가 모두 완료(`[x]`)된 상태이며, Phase G(REVIEW) 만 남아 있다. 변경 후 포인터인 `ai-context-memory-followup-v2.md` 는 `related_plan: plan/in-progress/ai-context-memory-auto.md` 를 frontmatter 에 명시하고, `conversation-thread.md §2.3·§7` 의 v2 로드맵 항목들(`text_classifier / information_extractor contextScope 확장`, `provider tokenizer-exact`, `메모리 가시화 UI` 등) 을 체크리스트로 보유한 **신규 후속 plan** 이다.
- `spec/conventions/conversation-thread.md` 의 `status: partial` 과 `pending_plans:` 의 단일 진실 규약(`spec-impl-evidence.md §2, R-5`)에 따르면, `partial` spec 은 미구현 surface 를 책임지는 **실존하는** plan 경로를 가리켜야 한다. `ai-context-memory-followup-v2.md` 는 `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/plan/in-progress/` 에 실존하며, 해당 파일이 `conversation-thread.md §2.3·§7` 의 v2 미구현 surface 를 직접 체크리스트로 포함하고 있다. 따라서 포인터 교체는 **spec-impl-evidence.md §4 의 `spec-pending-plan-existence.test.ts` 가드를 통과** 한다.
- 제안: 조치 불필요.

### **[INFO]** `ai-context-memory-auto.md` 는 아직 `plan/in-progress/` 에 잔존
- 위치: `plan/in-progress/ai-context-memory-auto.md`
- 상세: 이 plan 의 Phase G(REVIEW)가 미완료이므로 `plan/complete/` 이동은 아직 정상 미실시이다. `spec-status-lifecycle.test.ts` 가드는 `pending_plans` 가 모두 `complete/` 로 이동했을 때만 `implemented` 승격을 강제하므로, 현재 상태에서는 가드 위반이 없다. `ai-context-memory-auto.md` 는 더 이상 `conversation-thread.md` 의 `pending_plans` 에 등록되어 있지 않으므로, 해당 plan 의 완료 후 `complete/` 이동은 `conversation-thread.md` spec 상태 승격과 **직접 연동되지 않는다** — `ai-context-memory-followup-v2.md` 가 현재의 책임 plan.
- 제안: Phase G(REVIEW) 완료 후 `ai-context-memory-auto.md` 를 `plan/complete/` 로 이동하는 것은 plan lifecycle 규칙에 따른 별도 단계이며, 본 spec 변경과 독립적으로 처리 가능.

### **[INFO]** `1-ai-agent.md` 및 `0-common.md` 의 `pending_plans` 정합성
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter, `spec/4-nodes/3-ai/0-common.md` frontmatter
- 상세: 두 파일 모두 `pending_plans:` 에 `plan/in-progress/ai-context-memory-followup-v2.md` 를 가리키고 있으며, `ai-context-memory-auto.md` 참조를 유지하지 않는다. `conversation-thread.md` 와 동일한 교체 패턴이 일관되게 적용된 상태. 세 spec 파일 모두 동일 후속 plan 을 가리켜 cross-spec 정합성 유지.
- 제안: 조치 불필요.

---

## 요약

이번 변경은 `spec/conventions/conversation-thread.md` frontmatter 의 `pending_plans` 포인터를 구현이 거의 완료된 Phase plan(`ai-context-memory-auto.md`)에서 v2 미구현 surface 를 담당하는 후속 plan(`ai-context-memory-followup-v2.md`)으로 교체한 단 1줄의 메타데이터 수정이다. 새 포인터 파일은 `plan/in-progress/` 에 실존하고, `conversation-thread.md §2.3·§7` 의 로드맵 항목들을 직접 체크리스트로 포함하고 있어 `spec-impl-evidence.md` R-5 + `spec-pending-plan-existence.test.ts` 가드 요건을 충족한다. 기능 구현 코드에 대한 변경은 없으며, 관련 spec 본문도 수정되지 않아 spec fidelity 측면에서 검토할 내용이 없다. 요구사항 충족 관점에서 완전히 올바른 변경이다.

## 위험도
NONE
