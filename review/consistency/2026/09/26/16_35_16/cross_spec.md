# Cross-Spec 일관성 검토 — workflow-assistant e2e 계약 대조 (impl-prep)

## 배경

본 impl-prep scope 는 `plan/in-progress/assistant-e2e-contract-gaps.md` 가 가리키는 작업 — `codebase/backend/test/workflow-assistant.e2e-spec.ts` 에 세 칸(빈 `sessions/latest` 응답 · 테스트 F 상태 단언 · 도구 호출 선택 키 생략)을 추가하는 **테스트 전용** 변경(`spec_impact: none`) — 때문에 bundling 되었다. `code:` frontmatter 연결로 `spec/3-workflow-editor/4-ai-assistant.md` 전체와 관련 spec 들이 묶였을 뿐, target 문서 자체는 수정되지 않는다. 따라서 본 리뷰는 "draft 변경이 다른 영역과 충돌하는가" 가 아니라 "이번에 손대는 코드 표면을 규정하는 기존 spec(`4-ai-assistant.md`)이 인접 spec 영역과 이미 어긋나 있지 않은가" 를 확인하는 형태로 수행했다.

컨텍스트 예산상 번들에는 target 문서(`4-ai-assistant.md`) · `5-system/2-api-convention.md` · `3-workflow-editor/_product-overview.md` 만 전문이 실렸고 나머지 111개 관련 spec 은 절단되어, 실제 저장소의 `spec/**` 파일을 직접 `Read`/`grep` 하여 대조했다.

## 점검한 교차 참조 (모두 정합 확인됨)

- **RBAC**: §5.1/§6 "Role: `editor` 이상" ↔ `spec/5-system/1-auth.md` 의 `@Roles('editor')` 패턴(§Model Config 근거 문단) — 일치.
- **데이터 모델**: §1/Rationale 이 가리키는 `spec/1-data-model.md` §2.20 `AssistantSession` / §2.22 `AssistantMessage` 필드(특히 `status: active/archived`, `tool_calls[].kind: 'explore'|'plan'|'edit'`) — 문서 본문과 정합. `tool_calls` JSONB 의 `kind='plan'` 값은 §5.3.1 SSE `tool_call.data.kind`(`'explore'|'edit'`만 존재)와 표면적으로 어휘가 다르지만, 실제로는 서로 다른 계층을 기술한다 — `propose_plan` 호출은 SSE 상 별도 `event: plan` 으로 나가고(§5.3, §5.3.1 각주), 영속 계층(`AssistantMessage.tool_calls`)에서만 `kind:'plan'` 로 분류된다. `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (`kind === 'plan'` 분기) 와 `dto/responses/assistant-session-response.dto.ts` 의 `TOOL_CALL_KINDS = ['explore','plan','edit']` 가 이 3-값 분류를 실측으로 뒷받침해 **충돌 아님**으로 정리.
- **상태 전이 / cross-ref 번호**: §12.1 "§11.2.1 container 전파 규칙" ↔ `spec/3-workflow-editor/0-canvas.md` §11.2.1 "자동 containerId 동기화" — 번호·내용 일치.
- **Re-run 비트리거 (G1/RR-PL-07)**: §4.1.2 ↔ `spec/5-system/13-replay-rerun.md` (RR-PL-07 정의·§13 상세·i18n 키 `history.rerun.assistantBlocked`) ↔ `spec/2-navigation/14-execution-history.md` §3.7 Re-run 버튼 — 3개 문서가 동일한 정책·문구·경로를 가리켜 일치.
- **딥링크 경로**: §4.1.2 의 `/w/<slug>/workflows/:workflowId/executions/:executionId` ↔ `spec/2-navigation/_layout.md` §2.2 (슬러그 라우팅 phase 2 편입 서술) — 일치.
- **MCP selector 화이트리스트**: §4.3.1 `mcp-server-selector` 힌트 화이트리스트 `['mcp','cafe24','makeshop']` ↔ `spec/2-navigation/4-integration.md` §14.2 동일 배열 ↔ `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge — 3자 일치.
- **I/O 규약 인용**: §8 "I/O 규약" 이 인용하는 `conventions/node-output.md` Principle 0 / 1.1 / 2 / 8 — 모두 실재하는 절 번호.
- **감사 로그 MVP 예외**: §9 "메시지·도구 호출은 AuditLog 대상이 아님" ↔ `spec/data-flow/1-audit.md` §1.1 커버리지 표(SoT 로 명시) — workflow-assistant 는 표에 없고, audit.md 자체도 "모든 mutating 액션이 대상" 이라 주장하지 않아 상충 없음. (최근 커밋 이력의 감사 로그 유출 수정(#1288)은 별도 표면 대상이었고 본 spec 의 MVP 예외 서술과 무관.)
- **실행 중 편집 차단 미구현**: §12.2 "(계획) `ASSISTANT_WORKFLOW_RUNNING` 미구현" ↔ `spec/3-workflow-editor/3-execution.md` — 해당 가드의 존재를 전제하는 서술 없음. 일치.

## 발견사항

- **[INFO]** `GET /sessions/latest` 가 target 문서 §6 REST API 표에 없음
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 (REST API 표, 6개 엔드포인트만 나열)
  - 충돌 대상: 없음 (다른 spec 영역과의 충돌이 아니라 같은 문서 내 self-completeness 갭)
  - 상세: 이번 작업이 대조하는 실제 컨트롤러(`codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`)에는 `@Get('sessions/latest')` 가 `sessions/:id` 보다 먼저 선언되어 있고, plan 문서(`assistant-e2e-contract-gaps.md`)도 이를 기정 동작(`findLatestActive`)으로 다룬다. 그런데 target spec §6 표에는 6개 엔드포인트(`GET /sessions`, `POST /sessions`, `GET /sessions/{id}`, `PATCH`, `DELETE`, `POST .../messages`)만 있고 `latest` 는 빠져 있다. Cross-spec 충돌은 아니지만(다른 영역이 이 엔드포인트를 다르게 정의하고 있지 않음), spec 자체의 API 계약 표가 구현보다 좁다.
  - 제안: 순수 cross-spec 스코프 밖이므로 이번 테스트-전용 PR 을 막을 사유는 아니다. 다만 `4-ai-assistant.md` §6 표에 `GET /sessions/latest — 워크플로 기준 최신 active 세션 단건 (없으면 `{data: null}`)` 행을 추가하는 별도 spec 갱신을 `project-planner` 트랙에 남겨 두는 것을 권한다.

## 요약

이번 target 은 실제로는 draft 가 아니라 테스트-전용 변경이 딸려 온 기존 구현 완료 spec(`4-ai-assistant.md`)이며, 문서가 인용하는 데이터 모델(§1-data-model §2.20/§2.22)·RBAC(`editor` 이상)·상태 전이(container 전파 §11.2.1)·Re-run 비트리거 정책(RR-PL-07)·MCP selector 화이트리스트·I/O 컨벤션·감사 로그 예외 등 주요 교차 참조를 실제 spec 파일과 대조한 결과 전부 정합했다. 유일하게 눈에 띈 것은 cross-spec 영역이 아니라 문서 자기 완결성 갭(`sessions/latest` 미기재)으로, 이번 e2e 테스트 추가 작업의 진행을 막을 이유가 되지 않는다.

## 위험도

NONE
