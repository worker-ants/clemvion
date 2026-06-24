# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [INFO] 2-A explicit 파일 추가가 `ai-agent-tool-connection-rewrite.md` §3 Spec 편집과 간접 중첩
- **target 위치**: §2-A — `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` / `ai-memory-manager.ts` / `ai-turn-executor.ts` 3줄 명시 추가
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 Spec 작성 (미착수 — 결정 기록 모두 TBD) — 해당 plan 이 "tool_* 모델 확정 시 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a dispatcher 분류 순서 표를 갱신해야 한다"고 명시
- **상세**: target 은 frontmatter `code:` 수정과 §6.1 step 3a 구현 참조 1줄 교체(2-B)만 한다. `ai-agent-tool-connection-rewrite.md` 는 `§6.1 step 3a 순서 표`를 별도로 갱신할 미해결 의도를 보유하나, target 이 건드리는 영역(`classifyToolCalls` 구현 참조 표기 정정)과 `tool_*` 분류 순서 표 갱신은 서로 다른 열(행위자 표기 vs 분류 순서)이어서 직접 충돌은 없다. 그러나 `ai-agent-tool-connection-rewrite.md` 가 추후 §6.1 step 3a 를 수정할 때 target 의 편집이 merge conflict 후보가 될 수 있다는 점을 추적 메모로 남기는 것이 바람직하다.
- **제안**: target 또는 `ai-agent-tool-connection-rewrite.md` 어느 쪽도 수정 불요. target 적용 후 `ai-agent-tool-connection-rewrite.md` §3 의 cross-ref 주석에 "step 3a 구현 참조 표기는 spec-draft-m3-m1-ai-assistant-sync 에서 이미 정정됨" 한 줄 추가를 권장.

### [INFO] 2-C Rationale 삽입 위치 grep 미확정 — 적용 단계에서 해소 예정
- **target 위치**: §2-C — `spec/4-nodes/3-ai/1-ai-agent.md` `## Rationale` 삽입 위치를 "grep 으로 확정 필요"로 명시
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — `1-ai-agent.md §12.12 / §12.13 / §7` 등 Rationale 영역 편집이 이미 완료됨(모두 체크박스 완료 상태)
- **상세**: target 이 삽입 위치를 확인 필요 항목(§확인 필요 항목 2번)으로 열어 두었으나, `ai-context-memory-followup-v2.md` 가 이미 해당 Rationale 영역을 편집한 상태라 grep 시 선행 맥락이 있다. 선행 편집이 완료돼 충돌 우려는 없으나, 삽입 위치 결정 시 기존 §12.12~12.14 메모와의 인접 배치 여부를 확인하는 것이 좋다.
- **제안**: 추적 메모 수준. 적용 단계에서 grep 확정 시 §12.x 이후 기존 리팩터 메모 인접 위치 우선 검토 권장(target 에 이미 "기존 리팩터 메모 인접 우선"으로 명시됨 — 충분).

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` `pending_plans` 목록에 본 doc-sync 완료 후 plan 참조 누락
- **target 위치**: 전체 — target 은 `1-ai-agent.md` frontmatter `code:` 와 본문을 편집하지만, 동 파일의 `pending_plans:` 목록 갱신을 명시하지 않음
- **관련 plan**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans:` 에 `plan/in-progress/ai-agent-tool-connection-rewrite.md` / `ai-context-memory-followup-v2.md` / `exec-park-durable-resume.md` 3개 등재 (현행). M-1 완료에 대응하는 `spec-draft-m3-m1-ai-assistant-sync.md` 자체는 미등재
- **상세**: `pending_plans:` 는 미해결 plan 이 해당 spec 을 수정 예정임을 추적하는 필드다. target 이 M-1/M-3 doc-sync 를 완료하면 기존 pending_plans 중 M-1 관련 항목은 충족되나, spec 파일 자체의 `pending_plans` 목록을 target 이 건드리지 않아 상태가 stale 하게 남을 수 있다. 단, target 의 종류(spec-sync-edit-list, behavior-invariant)와 `plan-lifecycle.md` 규약을 보면 pending_plans 정리는 plan 완료 이동 시 플래너 책임이므로 target 자체에서 해소 필수는 아니다.
- **제안**: INFO 수준. target 적용 후 plan 이 complete 로 이동될 때 `1-ai-agent.md` `pending_plans:` 에서 M-1 분할 항목 정리 여부를 플래너가 검토하도록 추적 메모 권장.

---

## 요약

`plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md` 는 이미 머지된 M-3/M-1 리팩터를 근거로 spec 3개 파일을 behavior-invariant 방식으로 동기화하는 편집 목록이다. 검토한 in-progress plan 중 M-1·M-3 자체는 `plan/in-progress/refactor/02-architecture.md` 에서 전부 완료(체크박스 완료) 상태이며, target 이 "결정 필요" 항목을 일방적으로 우회하거나 미해결 선행 조건을 무시하는 CRITICAL/WARNING 수준의 충돌은 발견되지 않았다. `ai-agent-tool-connection-rewrite.md` 의 미착수 tool_* 설계 결정이 `1-ai-agent.md §6.1` 을 향후 편집할 예정이지만, target 의 편집 범위(classifyToolCalls 구현 참조 표기 정정·frontmatter 3줄 추가·Rationale 삽입)는 해당 미해결 결정과 직접 충돌하지 않는다. 발견 사항은 모두 INFO 등급의 추적 메모 수준이다.

## 위험도

NONE
