# 신규 식별자 충돌 검토 — spec/4-nodes/6-presentation

## 사전 확인: target 문서는 본 diff 에서 변경되지 않음

`git diff origin/main -- spec/4-nodes/6-presentation/` (워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`) 결과가
**0 라인**이다. `git log origin/main..HEAD -- spec/4-nodes/6-presentation/` 도 0 커밋.
즉 이번 PR(브랜치 `resumable-handler-generic-typing`, 실제 코드 diff는
`codebase/frontend/src/components/editor/run-results/output-shape.ts` 및 그
테스트 — `isConversationOutput`/`endReason` 관련)은 `spec/4-nodes/6-presentation/*`
를 **전혀 건드리지 않았다**. 페이로드에 담긴 target 본문(0-common/1-carousel/2-table,
`status: implemented`)은 이미 main 에 존재하는 기존 문서 그대로다.

"신규 식별자 충돌" 검토는 target 이 **새로 도입**하는 식별자를 대상으로 하는데,
이번 diff 기준으로는 target 문서가 새로 도입한 것이 없다(문서 자체가 unchanged).
따라서 이번 검토에서 CRITICAL/WARNING 대상이 될 "신규 식별자"가 존재하지 않는다 —
이 결과 자체가 이번 배치의 1차 발견사항이다(아래 INFO).

## 발견사항

- **[INFO]** target 문서가 diff 범위에서 변경 없음 — 신규 식별자 충돌 검토 대상 부재
  - target 신규 식별자: (없음 — `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md` 는 origin/main 대비 diff 0)
  - 기존 사용처: 해당 없음
  - 상세: 이번 세션의 실제 코드 변경은 `output-shape.ts`(`isConversationOutput`/`endReason` fallback) 영역이며 presentation 노드 spec 과 무관하다. orchestrator 가 이번 배치의 target 으로 `spec/4-nodes/6-presentation` 을 지목했으나, 그 문서는 이미 `status: implemented` 로 병합되어 있고 이번 diff 로 신규·변경된 부분이 없다. 즉 이 체크는 "새 식별자 vs 기존 사용처" 비교 대상 자체가 없는 vacuous pass 다.
  - 제안: 조치 불요. 다음 배치에서 orchestrator 의 target 산정(diff-scoped spec 목록)이 실제 변경 파일과 정합하는지 한 번 확인 권장(§ orchestrator followup, 코드 변경 없음).

- **[INFO]** 문서 내부에 이미 "동명이의(same-name-different-meaning)" 식별자가 있으나 corpus 에 이미 명문화되어 해소됨
  - target 신규 식별자: `interactionType` (target §10.6 `meta.interactionType: 'ai_form_render'`, §Rationale 등에서 사용)
  - 기존 사용처: `spec/1-data-model.md` §2.14 NodeExecution `interaction_data` 필드 설명 — "여기의 `interactionType` 은 **수행된 user action 의 기록** enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`, `interaction-type-registry`) 과 **이름만 같고 별개 enum**이다"
  - 상세: 같은 문자열 `interactionType` 이 두 군데서 다른 shape(하나는 사용자 액션 기록 enum, 하나는 노드 대기 상태 분류 enum)로 쓰이지만, 이는 target 이 새로 만든 충돌이 아니라 **corpus(data-model.md)가 이미 명시적으로 구분·문서화**해 둔 기존 상태다. 값 자체(`form`/`buttons`/`ai_conversation`/`ai_form_render`)도 target 이 §10.6 에서 쓰는 `ai_form_render` 와 일치한다.
  - 제안: 조치 불요(이미 해소됨). 신규 spec 작성 시 `interactionType` 이라는 이름을 또 다른 세 번째 의미로 재사용하지 않도록 계속 주의만 유지.

- **[INFO]** `render_*` / `tool_*` 접두사 잠재 충돌도 이미 별도 plan 문서에서 직교 판정됨
  - target 신규 식별자: `render_table` / `render_chart` / `render_carousel` / `render_template` / `render_form` (target §10.1~10.2, AI Agent `presentationTools[]` 가상 도구명)
  - 기존 사용처: `plan/in-progress/ai-agent-tool-connection-rewrite.md` 상단 주석 — "`ai-presentation-tools.md` — `render_*` 표현 도구 가족 추가. 본 plan 의 `tool_*` 재작성과 **직교**(의도·schema 출처 모두 다름) … 도구 이름 충돌 없음(`tool_*` 와 `render_*` prefix 다름)"
  - 상세: 향후 재설계 예정인 일반 도구 연결(`tool_*` 접두사 부활 검토 중, plan §3)과 이미 구현된 `render_*` presentation 도구 가족이 같은 AI Agent 노드의 tool-calling 네임스페이스를 공유하지만, 두 prefix 가 다르고 plan 이 이를 명시적으로 인지·기록해 둔 상태라 실질 충돌이 아니다.
  - 제안: 조치 불요. `ai-agent-tool-connection-rewrite.md` §1 "도구 등록 모델" 결정 시 최종적으로 `tool_*` 를 채택하면 그 시점에 dispatcher 순서 표(`cond_* → kb_* → mcp_* → render_* → tool_*`)와 함께 재검증(이미 plan §관련 문서에 해당 액션 아이템 존재).

## 요약

이번 검토 대상으로 지정된 `spec/4-nodes/6-presentation`(0-common/1-carousel/2-table) 은 `origin/main` 대비 diff 가 0 — 즉 이번 PR 이 실제로 변경한 파일이 아니다(실제 diff 는 `output-shape.ts` `isConversationOutput`/`endReason` 관련 frontend 코드). 따라서 "target 이 새로 도입하는 식별자"의 충돌을 판정할 대상 자체가 없다. 문서 본문에서 발견되는 유일한 두 개의 동명(same-name) 패턴 — ① `interactionType` 이 NodeExecution.interaction_data 기록 enum 과 노드 대기상태 `WaitingInteractionType` 을 동시에 지칭, ② `render_*` 와 (계획 중인) `tool_*` AI 도구 prefix 공존 — 은 둘 다 corpus 문서(`spec/1-data-model.md`, `plan/in-progress/ai-agent-tool-connection-rewrite.md`)가 이미 명시적으로 "별개 개념"·"직교"로 문서화해 실질적 혼선 위험이 없다. 요구사항 ID, endpoint, ENV/설정키, 파일 경로 관점에서도 target 문서 프런트매터 `id: presentation-common/carousel/table` 등은 spec 전역에서 유일하며 신규 충돌이 확인되지 않았다.

## 위험도
NONE
