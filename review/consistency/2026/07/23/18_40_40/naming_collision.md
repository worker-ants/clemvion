# 신규 식별자 충돌 검토 — spec/4-nodes/6-presentation

## 사전 확인: target 문서는 본 diff 에서 변경되지 않음

`git diff origin/main..HEAD -- spec/4-nodes/6-presentation/` (워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`,
HEAD=`e48362e63`, origin/main=`4faf87ee0`) 결과가 **0 라인**이다.
`git log origin/main..HEAD -- spec/4-nodes/6-presentation/` 도 0 커밋.

이번 세션(`origin/main..HEAD`)의 실제 코드/문서 diff 는:
- `codebase/frontend/src/components/editor/run-results/output-shape.ts` 및 그 테스트
  (`isConversationOutput`/`endReason` fallback 관련)
- `plan/complete/output-shape-comment-followups.md` (신규 plan 종결 문서)
- `review/code/**`, `review/consistency/**` 하위 다수의 이전 리뷰/컨시스턴시 산출물

`spec/4-nodes/6-presentation/*` 는 이 목록에 없다. 페이로드에 담긴 target 본문
(0-common/1-carousel/2-table, `status: implemented`)은 이미 main 에 병합되어 존재하는
기존 문서 그대로이며, 이번 브랜치가 새로 작성·수정한 것이 아니다.

"신규 식별자 충돌" 검토는 target 이 **새로 도입**하는 식별자를 대상으로 하는데, 이번
diff 기준으로는 target 문서가 새로 도입한 것이 없다(문서 자체가 unchanged). 따라서
CRITICAL/WARNING 대상이 될 "신규 식별자"가 이번 배치에는 존재하지 않는다 — 이 결과
자체가 발견사항이다(아래 INFO). 이는 동일 세션 앞선 배치(`review/consistency/2026/07/23/15_33_52/naming_collision.md`)의
결론과 동일하며, 그 이후 HEAD 가 이동(`3d0bcd69b` 등 spec/4-nodes/6-presentation 무관 커밋들의
merge)했음에도 target 영역 diff 는 여전히 0 임을 재확인했다.

## 발견사항

- **[INFO]** target 문서가 diff 범위에서 변경 없음 — 신규 식별자 충돌 검토 대상 부재
  - target 신규 식별자: (없음 — `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md` 는 origin/main 대비 diff 0)
  - 기존 사용처: 해당 없음
  - 상세: 이번 세션의 실제 코드 변경은 `output-shape.ts`(`isConversationOutput`/`endReason` fallback) 프런트엔드 영역이며 presentation 노드 spec 과 무관하다. orchestrator 가 이번 배치의 target 으로 `spec/4-nodes/6-presentation` 을 지목했으나, 그 문서는 이미 `status: implemented` 로 병합되어 있고 이번 diff 로 신규·변경된 부분이 없다. 즉 이 체크는 "새 식별자 vs 기존 사용처" 비교 대상 자체가 없는 vacuous pass 다.
  - 제안: 조치 불요. orchestrator 의 target 산정(diff-scoped spec 목록)이 실제 변경 파일과 정합하는지 다음 배치에서 재확인 권장(반복 관찰 — 앞선 15_33_52 배치와 동일 증상).

- **[INFO]** 문서 내부 동명이의(same-name-different-meaning) 식별자는 corpus 에 이미 명문화되어 해소됨 (재확인)
  - target 신규 식별자: `interactionType` (target §10.6 `meta.interactionType: 'ai_form_render'`, §Rationale 등에서 사용)
  - 기존 사용처: `spec/1-data-model.md` §2.14 NodeExecution `interaction_data` 필드 설명 — "여기의 `interactionType` 은 수행된 user action 의 기록 enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`, `interaction-type-registry`) 과 이름만 같고 별개 enum"
  - 상세: 같은 문자열 `interactionType` 이 두 군데서 다른 shape(사용자 액션 기록 enum 대 노드 대기상태 분류 enum)로 쓰이지만, target 이 새로 만든 충돌이 아니라 corpus(`data-model.md`)가 이미 명시적으로 구분·문서화해 둔 기존 상태다.
  - 제안: 조치 불요(기존 해소 상태 유지 확인).

- **[INFO]** `render_*` / `tool_*` 접두사 잠재 충돌도 이미 별도 plan 문서에서 직교 판정됨 (재확인)
  - target 신규 식별자: `render_table` / `render_chart` / `render_carousel` / `render_template` / `render_form` (target §10.1~10.2, AI Agent `presentationTools[]` 가상 도구명)
  - 기존 사용처: `plan/in-progress/ai-agent-tool-connection-rewrite.md` 상단 주석 — "`render_*` 표현 도구 가족" 은 `tool_*` 재작성과 직교(prefix 다름, 도구 이름 충돌 없음)
  - 상세: 향후 재설계 예정인 `tool_*` 접두사 부활 검토와 이미 구현된 `render_*` presentation 도구 가족이 같은 AI Agent 노드 tool-calling 네임스페이스를 공유하지만, plan 이 이를 명시적으로 인지·기록해 둔 상태라 실질 충돌이 아니다.
  - 제안: 조치 불요. `ai-agent-tool-connection-rewrite.md` §1 결정 시 dispatcher 순서 표와 함께 재검증 예정(이미 액션 아이템 존재).

## 요약

이번 검토 대상으로 지정된 `spec/4-nodes/6-presentation`(0-common/1-carousel/2-table) 은 `origin/main`(4faf87ee0) 대비 `HEAD`(e48362e63) diff 가 여전히 0 — 이번 브랜치가 실제로 변경한 파일이 아니다(실제 diff 는 `output-shape.ts` `isConversationOutput`/`endReason` fallback 관련 frontend 코드와 그 테스트, 그리고 완료된 plan/review 산출물). 따라서 "target 이 새로 도입하는 식별자"의 충돌을 판정할 대상 자체가 없다. 문서 본문에서 발견되는 두 개의 동명(same-name) 패턴 — ① `interactionType` 이 NodeExecution.interaction_data 기록 enum 과 노드 대기상태 `WaitingInteractionType` 을 동시에 지칭, ② `render_*` 와 (계획 중인) `tool_*` AI 도구 prefix 공존 — 은 둘 다 corpus 문서(`spec/1-data-model.md`, `plan/in-progress/ai-agent-tool-connection-rewrite.md`)가 이미 명시적으로 "별개 개념"·"직교"로 문서화해 실질적 혼선 위험이 없다. 요구사항 ID, endpoint, ENV/설정키, 파일 경로 관점에서도 target 문서 프런트매터(`id: presentation-common/carousel/table` 등)는 spec 전역에서 유일하며 신규 충돌이 확인되지 않았다. 앞선 15_33_52 배치와 동일한 vacuous-pass 결론이며, 반복되는 orchestrator target-diff 불일치는 harness 후속 검토 항목으로만 남긴다.

## 위험도
NONE
