# Cross-Spec 일관성 검토 — Personal 통합 소유자 강제 (`spec/2-navigation/4-integration.md §8`)

## 검토 대상

- 신규 §8 «판정 규칙» 블록 + Rationale (`spec/2-navigation/4-integration.md`, 커밋 `f47069564`)
- 동반 변경: `spec/5-system/3-error-handling.md §1.2`(`ADMIN_REQUIRED` 발행처 추가), `spec/4-nodes/4-integration/_product-overview.md`(INT-MG-07), `spec/data-flow/5-integration.md`(precheck Rationale 정정)
- 구현 예정 코드 스코프: `modules/integrations/**`, `modules/workflow-assistant/tools/**`(explore-tools · candidate-lookup · assistant-tool-router · assistant-finish-guard), `workflow-assistant-stream.service.ts`

## 발견사항

- **[WARNING]** `list_integrations` 도구 · `integration-selector`/`mcp-server-selector` 노드 후보의 SoT 문서(`3-workflow-editor/4-ai-assistant.md`)가 신규 소유자 필터를 반영하지 않음
  - target 위치: `spec/2-navigation/4-integration.md §8` 판정 규칙 블록, "표에 없는 조회성 경로는 «조회» 행을 따른다 — 연결 테스트 · 사용처 · 활동, 그리고 **워크플로우 어시스턴트의 통합 목록 도구와 노드 후보 제시**." (라인 812-813). 구현 plan(`plan/in-progress/integration-personal-owner.md` 요구 1)도 이 경로를 명시적 구현 범위에 포함한다: "워크플로우 어시스턴트 — `list_integrations` 도구 · 노드 후보(integration-selector · mcp-server-selector)". plan 의 코드 스코프도 `modules/workflow-assistant/tools/`(explore-tools · candidate-lookup · assistant-tool-router)를 명시한다.
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` (`status: implemented`) — 이 두 표면을 실제로 정의하는 도메인 spec.
    - 라인 201: `list_integrations` 도구 결과를 "현재 워크스페이스에 등록된 Integration 목록"으로만 서술 — 소유자 필터 언급 없음.
    - §4.3.1 "widget 별 후보 조회 범위" 표(라인 371-372): `integration-selector` / `mcp-server-selector` 의 필터를 `workspace_id 일치 + status='connected'` (+ service_type 힌트)로만 정의 — `created_by` 검사 없음.
  - 상세: §8 의 새 규칙은 "남의 personal 은 없는 통합과 같다"는 원칙을 이 두 표면에도 적용하라고 명시하지만, 그 표면의 실제 계약(요청 파라미터·응답 shape·필터 조건)을 정의하는 문서는 `ai-assistant.md` 이지 `4-integration.md` 가 아니다. `ai-assistant.md` §4.3.1 표와 §4.2 `list_integrations` 행은 이번 draft 의 "변경안 — 다른 spec" 목록에도, 동반 산출물 `integration-personal-owner-followup.md`(§8 "아직 강제되지 않는 것" 목록 — 노드 실행 시점 · pending 재사용 · Viewer 라우트 가드 · 상세 화면 버튼 숨김만 나열)에도 등장하지 않는다. 즉 이 PR 이 계획대로 `candidate-lookup`/`explore-tools` 코드에 소유자 필터를 넣으면, `ai-assistant.md`(status: implemented)의 필터 표는 실제 동작보다 좁게(=구현되지 않은 것처럼) 말하는 것이 아니라 **실제보다 넓게(=필터가 없는 것처럼) 말하는 상태**로 남아 두 spec 이 같은 API 표면에 대해 다른 필터 조건을 주장하게 된다.
  - 제안: 이번 PR 의 "변경안 — 다른 spec" 및 구현 plan `spec_impact` 에 `spec/3-workflow-editor/4-ai-assistant.md` 를 추가하고, §4.3.1 `integration-selector`/`mcp-server-selector` 행과 §4.2 `list_integrations` 행에 "남의 personal 제외([통합 관리 §8](../2-navigation/4-integration.md#8-권한-규칙))" 를 명시. 최소한 followup plan 의 "아직 강제되지 않는 것" 목록에 이 갭을 추가해 `pending_plans` 로 추적할 것 — 현재는 어느 목록에도 없어 누락 상태다.

## 확인했으나 충돌 없음 (참고)

- `spec/5-system/1-auth.md §3.2` RBAC 표(`Integration (Personal) | 자기 것 ×4`), `spec/0-overview.md` "워크스페이스 단위 Integration 공유·RBAC" 행(이미 §8·§4.2 를 SoT 로 위임하는 문구 보유), `spec/2-navigation/9-user-profile.md §4.2`, `spec/data-flow/5-integration.md` precheck Rationale, `spec/4-nodes/4-integration/_product-overview.md` INT-MG-07, `spec/5-system/3-error-handling.md §1.2` `ADMIN_REQUIRED` 행 — draft 가 주장한 대로 이미 반영되어 있거나 변경 불요 상태였음을 실제 파일에서 확인.
- `spec/4-nodes/4-integration/0-common.md`, `5-makeshop.md` — personal 소유자 관련 서술 없음(그대로 두어도 모순 생기지 않음, 노드 실행 시점 검사는 followup 범위로 이미 명시).
- `spec/2-navigation/4-integration.md §14.2`(캔버스 `IntegrationSelector` 드롭다운) — 소유자 필터 미언급이지만 이는 `GET /api/integrations` 목록 API 를 그대로 소비하는 경로로 추정되어 목록단 필터링에 자동 편입되며, 설령 별도 경로라도 followup 항목 "«워크플로우 노드에서 사용» 행"(노드 설정 저장 시점 검증)에 이미 포괄돼 있어 별도 지적 불필요.
- 요구사항 ID 충돌 없음 — 이번 draft 는 신규 요구사항 ID 를 발급하지 않고 기존 INT-MG-07 문구만 보강.
- 상태 전이(§6) · RBAC 역할 정의(§3.1) 자체는 변경되지 않았고, "Personal 에 역할 우위 없음" 원칙은 §3.2 표(자기 것 ×4)와 이미 정합.

## 요약

이번 draft 는 `spec/2-navigation/4-integration.md §8`·`5-system/3-error-handling.md`·`4-nodes/4-integration/_product-overview.md`·`data-flow/5-integration.md` 4개 문서를 실제로 동기화했고 교차검증 결과 그 부분은 일관적이다. 다만 §8 판정 규칙이 명시적으로 관할을 주장하는 두 표면(워크플로우 어시스턴트의 `list_integrations` 도구, `integration-selector`/`mcp-server-selector` 노드 후보)의 실제 계약 정의서인 `3-workflow-editor/4-ai-assistant.md` 는 이번 PR 의 spec 변경 범위·followup 추적 목록 어디에도 포함되지 않았다. 같은 PR 의 구현 코드 스코프가 바로 이 표면(`workflow-assistant/tools/candidate-lookup`, `explore-tools`)을 건드리므로, spec 변경 없이 구현만 진행되면 "구현 완료" 상태의 `ai-assistant.md` 가 실제 필터 동작보다 좁은(더 허용적인) 계약을 계속 주장하는 spec-vs-spec 불일치가 남는다. 구현 착수 전에 해당 문서를 변경안·`spec_impact`(또는 최소 followup 의 "아직 강제되지 않는 것" 목록)에 추가할 것을 권한다.

## 위험도

MEDIUM
