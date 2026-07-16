# Cross-Spec 일관성 검토 — spec/4-nodes/3-ai/ (impl-done)

## 검토 방법 메모

target 으로 제공된 `spec/4-nodes/3-ai/0-common.md`·`1-ai-agent.md` 전체 본문과, 첨부된 `spec/0-overview.md`·`spec/1-data-model.md` 발췌를 우선 검토했다. 이번 구현 diff(`origin/main...HEAD`)의 실제 변경 범위는 spec 상으로는 `spec/4-nodes/3-ai/1-ai-agent.md`(§4.2/§10 "도구 정의 payload 예산 경고" 상태 Planned→구현됨) 와 `spec/conventions/cross-node-warning-rules.md`(status `partial`→`implemented`, `ai_agent:tool-payload-budget` 규칙 서술 갱신) 2개 파일에 국한되며, 코드 diff(`workflows.service.ts`/`.controller.ts`, `tool-payload-save-warning.ts`, cafe24/makeshop MCP tool provider, `backend-labels.ts`, `.env.example`, CHANGELOG)와 함께 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`)에서 직접 대조했다. 이 좁은 diff 를 중심으로 관련 spec 영역(`spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/i18n-userguide.md`, `spec/data-flow/11-workflow.md`)과의 정합을 대조했고, target 문서 전체(캔버스 요약·Multi-turn·Presentation Tool Family 등 이번 diff 밖 기존 서술)도 다른 영역과의 참조 정합을 표본 점검했다.

## 발견사항

- **[INFO]** `spec/data-flow/11-workflow.md §1.2` 의 Tool Area 배치 서술이 "제거됨(재작성 예정)" 상태를 반영하지 않음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` 박스("⚠ 도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)") 및 §4("⚠ 재작성 예정 (현재 제거됨)")
  - 충돌 대상: `spec/data-flow/11-workflow.md §1.2` "노드 컨테이너 / Tool Area 배치" 표의 "AI Agent 의 Tool Area 에 노드 배치 → `tool.tool_owner_id = aiAgent.id`" 행과 §1.4(export), 노드 CRUD 표(§1행 근방)의 `tool_owner_id` 서술
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md`·`spec/4-nodes/_product-overview.md`(ND-AG-06/10/21)·`spec/3-workflow-editor/0-canvas.md §12` 는 모두 Tool Area UX 와 `toolNodeIds`/`toolOverrides` config 필드가 현재 비활성(재작성 예정)임을 명시적으로 주석 처리했다. 그러나 `spec/data-flow/11-workflow.md` 는 같은 `tool_owner_id` 컬럼·Tool Area 배치를 현재형으로만 서술하고 비활성 상태 주석이 없어, 이 문서만 읽는 독자는 Tool Area 드래그 배치가 여전히 유효한 것으로 오해할 수 있다. 이 gap 은 이번 diff 로 생긴 것은 아니며, 동일 패턴이 2026-06-23 Cross-Spec 검토(`review/consistency/2026/06/23/00_33_41/cross_spec.md`)에서 canvas/edge/data-model 조합으로 이미 INFO 보고된 바 있다 — 이번 검토는 그 목록에 `spec/data-flow/11-workflow.md` 도 같은 결이라는 점을 추가 확인한 것.
  - 제안: `spec/data-flow/11-workflow.md §1.2` 의 Tool Area 행에 canvas §12·ai-agent §1 와 동일한 "현재 비활성 — 재작성 예정" 각주를 추가 (DB 컬럼·CHECK 제약 자체는 유효하므로 삭제가 아니라 "UI 입력 경로만 비활성" 명확화). 이번 작업 범위 밖이라 즉시 조치는 불필요하나, Tool Area 재설계 plan 착수 시 함께 정리 권장.

## 검증 완료 항목 (충돌 없음 확인)

이번 diff 의 핵심 변경(신규 backend-only graph warning `ai_agent:tool-payload-budget` 구현)에 대해 다음을 대조 확인했고 모두 정합했다:

- **API 계약**: `GET /workflows/:id/graph-warnings`(`@Roles('viewer')`) 의 응답 계약("별도 응답 필드 신설 없음", `getGraphWarnings` 가 결과 배열에 append)이 `spec/conventions/cross-node-warning-rules.md §5`(3중 가드 서술) 및 `spec/data-flow/11-workflow.md`(saveCanvas 트랜잭션 시퀀스의 `GRAPH_VALIDATION_FAILED` 각주)와 일치. 코드(`workflows.controller.ts`)의 `@Roles('viewer')` 데코레이터도 spec 의 "REST, viewer 이상" 서술과 일치.
- **데이터 모델**: `service_type ∈ ('mcp','cafe24','makeshop')` 이 `spec/1-data-model.md` Integration 엔티티 서술과 일치. config-time 재현이 "connected cafe24/makeshop 정적 카탈로그만" 사용한다는 target 서술은 `spec/2-navigation/4-integration.md` 의 Integration 상태 머신("`pending_install`/`expired`/`error` 상태는 노드·AI Agent 에서 사용 불가 — MCP bridge 가 미연결 통합의 tool 을 노출하지 않음")과 부합하며, 실제 구현(`loadIntegrationsForBudget` 의 `status !== 'connected'` skip)도 이를 준수.
- **RBAC/테넌트 격리**: `getGraphWarnings(workflowId, workspaceId)` 신규 파라미터가 Integration 조회 `where` 절에 `workspaceId` 를 포함해 테넌트 경계를 유지 — 다른 워크스페이스 통합을 배치 조회에 포함시키는 cross-tenant 누출 없음.
- **요구사항 ID**: ND-AG-06/10/21(제거됨) 과 ND-AG-15~20·22(영향 없음) 표기가 `spec/4-nodes/_product-overview.md` 및 `spec/4-nodes/3-ai/_product-overview.md` 양쪽에서 동일하게 유지됨 — 신규 ID 충돌 없음.
- **i18n 컨벤션**: 신규 `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 항목이 `spec/conventions/i18n-userguide.md` P3-C-1 "backend-only rule 은 자동 스캔 밖이라 수동 등록 필요" 규칙과 `spec/conventions/cross-node-warning-rules.md §5` 의 backend-only 예외 서술을 정확히 따름.
- **env 문서**: `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 의 `.env.example` 설명과 CHANGELOG 서술이 target 문서(§4.2/§10)의 표·문구와 문구 수준까지 일치.

## 요약

이번 구현(diff)의 실질 spec 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2/§10 의 "도구 정의 payload 예산 경고" 를 Planned 에서 구현 완료로 전환하고 `spec/conventions/cross-node-warning-rules.md` 의 상태를 승격한 것으로, API 계약(`GET /workflows/:id/graph-warnings` RBAC·응답 형식)·데이터 모델(Integration `service_type`/`connected` 상태)·i18n 컨벤션·env 문서 전반에서 다른 spec 영역과 CRITICAL/WARNING 급 모순이 발견되지 않았다. 코드(`workflows.service.ts` 등)도 테넌트 격리·RBAC 데코레이터 측면에서 spec 서술과 정확히 일치한다. 유일한 발견사항은 이번 diff 와 무관한 기존(pre-existing) INFO 수준 문서 drift — `spec/data-flow/11-workflow.md` 의 Tool Area 배치 서술이 다른 영역(canvas·product-overview·ai-agent)의 "재작성 예정(현재 제거됨)" 주석을 아직 반영하지 않은 것이며, 이는 2026-06-23 검토에서 이미 유사 패턴으로 보고된 known gap 의 연장선이다.

## 위험도

LOW
