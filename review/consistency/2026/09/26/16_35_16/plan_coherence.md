# Plan 정합성 검토 — `spec/3-workflow-editor/4-ai-assistant.md`

## 검토 배경

`--impl-prep` 대상 작업은 `plan/in-progress/assistant-e2e-contract-gaps.md` (`codebase/backend/test/workflow-assistant.e2e-spec.ts` 의
세 칸 보강 — `spec_impact: none`, 제품 코드·spec 변경 없음). 번들된 target 은 그 e2e 가 대조하는 도메인의 상세 spec
`4-ai-assistant.md` 전문이다. `plan/in-progress/**` 전체에서 `ai-assistant`/`workflow-assistant`/`ASSISTANT_` 를 언급하는
파일을 전수 확인했다: `ai-agent-tool-connection-rewrite.md`, `assistant-e2e-contract-gaps.md`, `spec-draft-ed-ai-19-status.md`,
`spec-sync-external-interaction-api-gaps.md`, `spec-draft-nullable-notation-followups.md`.

## 발견사항

- **[INFO]** target 의 기존 결함이 이미 트래커에 등재돼 있음 — 신규 아님
  - target 위치: frontmatter `status: implemented` vs 본문 §7 · §10 · §12.2 의 "(계획) 미구현" 서술, §6 REST API 표에 `GET
    /workflow-assistant/sessions/latest` 누락
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 5139행 "`4-ai-assistant.md` 규약 위생 다섯 칸"
    항목(①frontmatter/본문 불일치, ⑤`0-overview.md`·`4-nodes/3-ai/_product-overview.md` 의 "전체 구현 완료" 서술과의 정합)과
    5154행 "§6 REST API 표에 `sessions/latest` 없음" 항목
  - 상세: 두 갭 모두 이번 세션(`802bd61d5` 및 그 직전 `--impl-prep`/`--spec` 라운드)에 실측·등재됐고 "착수 조건: 없음(여유
    있을 때)" 로 명시적으로 defer 됐다. target 의 현재 상태(frontmatter 불일치·누락 유지)는 그 defer 결정과 정합하며,
    금번 e2e-only 작업(`assistant-e2e-contract-gaps`)이 새로 만들거나 우회하는 결정이 아니다.
  - 제안: 조치 불필요. 두 항목 모두 이미 정확한 트래커 항목·착수 조건을 갖고 있어 별도 갱신 대상이 아니다.

- **[INFO]** `spec-draft-ed-ai-19-status.md` 가 완료된 변경을 기록한 채 `plan/in-progress/` 에 남아 있음
  - target 위치: 해당 없음 (plan 자체의 lifecycle 상태)
  - 관련 plan: `plan/in-progress/spec-draft-ed-ai-19-status.md` (frontmatter `status: in-progress`, `worktree:
    assistant-e2e-contract-gaps`) — 이 문서가 제안한 PRD 한 줄 정정은 `802bd61d5` 로 이미 `spec/3-workflow-editor/_product-overview.md`
    §10.4 ED-AI-19 행에 반영·커밋됐다. 같은 커밋에서 함께 쓰인 `spec-draft-nullable-notation-followups.md` 5151행은 이
    draft 를 이미 `plan/complete/spec-draft-ed-ai-19-status.md` 로 **선참조**한다("1·5 는 ED-AI-19 표기 정정
    (`plan/complete/spec-draft-ed-ai-19-status.md`)과 같은 뿌리다") — 그러나 실제로는 아직 `in-progress/` 에 있다.
  - 상세: target 문서와의 직접 충돌은 아니다 — target(§12.2, §4.1.1)과 PRD(§10.4)는 이미 같은 상태("미구현 — 계획")를
    가리키도록 정렬됐다. 다만 두 plan 파일이 같은 worktree(`assistant-e2e-contract-gaps`)를 공유하므로, 이 PR 이 마무리될
    때 `spec-draft-ed-ai-19-status.md` 의 체크와 `complete/` 이동이 함께 수행되지 않으면 트래커의 선참조 경로가 계속
    어긋난 채로 남는다.
  - 제안: 이 PR(또는 그 마무리 커밋)에서 `spec-draft-ed-ai-19-status.md` 의 완료 표시(`status: complete`) + `plan/complete/`
    이동을 함께 처리할 것. e2e 세 칸 작업 자체의 완료 조건은 아니지만, 같은 worktree 를 공유하는 두 plan 이 한쪽만
    마무리되지 않도록 마감 체크리스트에 추가하는 편이 안전하다.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미결 설계 결정은 target 과 현재 충돌하지 않음
  - target 위치: §4.1 탐색 도구 표의 `ai_agent.conditions` dynamic-ports fallback id 서술 (편집 tool 인자 관례 문단)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정(사용자 합의 필요)" — 도구 등록
    모델(a/b/c) 전부 `TBD`, §3 체크리스트 71행 "`4-ai-assistant.md` — Workflow AI Assistant가 새 도구 연결 모델을 인식·편집할
    수 있는지 정합화" (미착수, `worktree: (unstarted)`)
  - 상세: 이 plan 은 AI Agent 의 **일반 도구(`tool_*`) 연결** 재설계를 다루며, 조건 도구(`cond_*`)·KB(`kb_*`)·MCP(`mcp_*`)는
    "영향 없고 정상 동작" 이라고 명시한다. target 이 언급하는 `ai_agent.conditions` 는 `cond_*` 계열이라 이 plan 의 영향
    범위 밖이다. target 은 이 plan 의 TBD 결정을 선점하거나 우회하지 않는다.
  - 제안: 조치 불필요. 향후 `ai-agent-tool-connection-rewrite.md` 의 도구 등록 모델이 결정되면 그 plan 자신의 71행
    체크리스트가 `4-ai-assistant.md` 갱신을 이미 추적하고 있으므로, 이번 e2e 작업 완료 시점에 별도로 반영할 필요는 없다.

## 요약

금번 target(`spec/3-workflow-editor/4-ai-assistant.md`)은 `assistant-e2e-contract-gaps` 의 e2e-only 작업(spec 변경 없음)과
plan 관점에서 충돌하지 않는다. target 문서 자체가 안고 있는 기존 결함(frontmatter `status: implemented` vs 본문 "(계획)"
서술, §6 REST API 표 누락)은 이미 `spec-draft-nullable-notation-followups.md` 에 정확한 항목·착수 조건으로 등재돼 새로
발견할 사항이 없다. `ai-agent-tool-connection-rewrite.md` 의 미결 설계 결정(도구 등록 모델 TBD)은 target 의 `cond_*` 서술과
겹치지 않아 선점 문제가 없다. 유일하게 주목할 점은 `spec-draft-ed-ai-19-status.md` 가 이미 커밋된 변경을 기록한 채
`plan/in-progress/` 에 남아 있고, 같은 트래커가 이를 `plan/complete/` 경로로 선참조하고 있다는 점 — 이 PR 마무리 시
함께 정리하는 것을 권한다. 세 항목 모두 CRITICAL/WARNING 급 신규 충돌은 아니다.

## 위험도

NONE
