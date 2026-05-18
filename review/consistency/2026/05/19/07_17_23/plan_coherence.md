# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope: `spec/4-nodes/3-ai/`)
Target: `spec/4-nodes/3-ai/` (0-common.md §11, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)
관련 Plan: `plan/in-progress/impl-ai-timezone-context.md` (worktree: `ai-timezone-context-9c8e2f`)

---

## 발견사항

- **[INFO]** `ai-agent-tool-connection-rewrite.md` — frontmatter 부재, 영역 참조 겹침 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §"작업 단위" §3 (spec 작성 항목)
  - 상세: `ai-agent-tool-connection-rewrite.md` 는 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 손댈 미래 spec 작업을 포함한다. 단, 그 plan 은 디자인 결정 미완료 상태(`worktree` frontmatter 없음, 착수 전)이고, 본 변경이 건드리는 영역(`includeSystemContext`/`systemContextSections` 신규 필드 추가)과 그 plan 이 예상하는 영역(`toolNodeIds`/`toolOverrides` 복원, Tool Area UX 재설계)은 서로 분리된 필드 집합이다. 현재 두 plan이 동시에 같은 파일을 수정 중인 worktree 경합 상태는 아니다 — `ai-agent-tool-connection-rewrite.md` 는 아직 worktree가 할당되지 않은 대기 상태.
  - 제안: 충돌 위험 없음. `ai-agent-tool-connection-rewrite.md` 가 실제 착수 시 §1 표의 `includeSystemContext`/`systemContextSections` 두 필드가 이미 존재함을 인지하도록 해당 plan 의 "순서 의존성" 메모에 한 줄 추가 권장.

- **[INFO]** `node-output-redesign` plan 과의 관계 — spec §1 config 표 수정 영역 겹침, 단 충돌 없음
  - target 위치: `spec/4-nodes/3-ai/{1-ai-agent,2-text-classifier,3-information-extractor}.md` §1 config 표
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md`, `text-classifier.md`, `information-extractor.md`
  - 상세: `node-output-redesign` 의 Phase 2 잔여 항목(ai-agent error builder, information-extractor ConversationThread v2 등)은 출력 구조(`§5`/`§7`)와 handler 구현에 집중하며, §1 config 표에 대한 spec 변경은 남아 있지 않다. 본 target 의 §1 config 표 추가(`includeSystemContext`/`systemContextSections`)는 별개 필드 영역이다. `node-output-redesign` 은 worktree가 별도 할당되지 않고 per-item TBD 상태이므로 동시 worktree 경합 없음.
  - 제안: 이상 없음. 추적용 메모.

- **[INFO]** `impl-ai-timezone-context.md` Phase B 착수 시 i18n/유저가이드 하네스 plan 과의 연동 필요
  - target 위치: `plan/in-progress/impl-ai-timezone-context.md` §B-2 (frontend UI — Config 패널)
  - 관련 plan: `plan/in-progress/harness-i18n-userguide-gap.md` (worktree: `harness-i18n-userguide-cded87`)
  - 상세: Phase B-2 의 frontend UI 작업 ("System Context" 토글 + 섹션 multi-select, 3 노드 공통 패턴)은 신규 UI 문자열과 노드 설정 레이블을 생성할 것이다. `harness-i18n-userguide-gap.md` 는 i18n dict 갱신 누락 방지 하네스를 다루는데, Phase B-2 PR 에서 ko/en dict 갱신 및 유저가이드 반영 여부가 누락될 가능성이 있다. `impl-ai-timezone-context.md` 의 Phase B 체크리스트에는 i18n 갱신 항목이 명시되어 있지 않다.
  - 제안: `impl-ai-timezone-context.md` §B-2 에 i18n dict 갱신 체크박스를 추가 권장 (하네스 plan 의 점검 항목 1번과 정합).

---

## 요약

`impl-ai-timezone-context.md` (Phase A spec 개정 완료, Phase B 구현 대기)의 target spec — `spec/4-nodes/3-ai/` 4개 파일 — 은 현재 진행 중인 다른 plan 들과 CRITICAL 또는 WARNING 수준의 충돌이 없다. 동시 worktree 경합 위험이 있는 plan 은 식별되지 않았다. 가장 인접한 plan 인 `ai-agent-tool-connection-rewrite.md` 와 `node-output-redesign` 은 모두 worktree 미할당 대기 상태이거나 spec §1 config 이외의 영역을 다루므로 직접 충돌을 일으키지 않는다. 단, Phase B-2 의 frontend UI 작업에서 i18n dict 갱신이 체크리스트에서 누락된 점은 `harness-i18n-userguide-gap.md` plan 과의 후속 연동이 필요한 INFO 수준 항목으로 확인된다. 선행 조건(spec 개정 완료, consistency-check BLOCK: NO)은 이미 충족 상태이며, Phase B 착수를 막을 plan 정합성 이슈는 없다.

---

## 위험도

LOW
