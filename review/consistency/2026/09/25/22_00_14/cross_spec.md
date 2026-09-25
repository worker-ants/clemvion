# Cross-Spec 일관성 검토 — spec-draft-integration-personal-owner-assistant

## 검토 대상
`plan/in-progress/spec-draft-integration-personal-owner-assistant.md` — `spec/3-workflow-editor/4-ai-assistant.md` 세 자리(§4.2 `list_integrations` 행 · §4.3.1 `integration-selector`/`mcp-server-selector` 후보 필터 표 · Rationale ED-AI-39 "구현자가 기억해야 할 계약" 1번)에 `spec/2-navigation/4-integration.md §8` 「Personal 소유자 판정 규칙」참조를 삽입하는 보강 draft.

## 대조한 문서
- `spec/3-workflow-editor/4-ai-assistant.md` (§4.1/4.2/4.3.1, Rationale ED-AI-39 전문 통독)
- `spec/2-navigation/4-integration.md §8` 권한 규칙(판정 규칙 불릿 전문) · §9(API) · §14.2(워크플로우 에디터 연관 동작)
- `spec/1-data-model.md §2.10` Integration (`created_by`, `scope` 필드 확인)
- `plan/in-progress/integration-personal-owner.md` (구현 plan, 아직 미착수) — 요구 1번 항목
- 선행 검토 `review/consistency/2026/09/25/21_49_24/SUMMARY.md` WARNING 1·3

## 발견사항

없음 — CRITICAL·WARNING 없음.

검증한 정합 포인트:

1. **범위 스코프가 정확하다.** §4.3.1 후보 필터 표는 5개 widget(`integration-selector`/`mcp-server-selector`/`llm-config-selector`/`kb-selector`/`workflow-selector`) 을 정의하는데, draft 는 `Integration` 을 조회하는 두 행(`integration-selector`, `mcp-server-selector`)만 수정하고 나머지 세 행(LLM Config/KB/Workflow)은 손대지 않는다. `§8` 판정 규칙은 `Integration` 엔티티에만 적용되는 규칙이므로 이 스코핑은 맞다. Rationale ED-AI-39 항목(3)의 문구도 "Integration 은 거기에 더해"로 명시적으로 한정해 다른 3개 repo(`llmConfigRepo`/`kbRepo`/`workflowRepo`)까지 번지지 않도록 정확히 괄호로 격리했다.
2. **§8 자체와 인용 방향이 맞다.** `integration.md §8` 의 "표에 없는 조회성 경로는 «조회» 행을 따른다 — … 워크플로우 어시스턴트의 통합 목록 도구와 노드 후보 제시" 라는 문장이 정확히 이 draft 가 고치려는 두 표면(§4.2 `list_integrations`, §4.3.1 candidate 필터)을 가리키고 있다 — 참조가 엉뚱한 절을 향하지 않는다.
3. **용어·앵커가 기존 관례와 일치한다.** "남의 personal" 표현은 `4-integration.md §8`("남의 personal 은 없는 통합과 같다") 과 §9.2 precheck 두 행("충돌 행이 남의 personal 이면…")에서 이미 쓰인 어휘를 그대로 재사용한다. 앵커 `#8-권한-규칙` 도 같은 파일의 §9.2 precheck 두 행이 이미 쓰고 있는 형식과 동일해 깨진 링크가 아니다.
4. **데이터 모델과 모순 없음.** §8 판정이 전제하는 `created_by` 필드는 `spec/1-data-model.md §2.10 Integration` 에 실재한다(`FK → User`). `scope` Enum(personal/organization) 도 동일 절에 정의돼 있어 draft 가 참조하는 개념이 존재하지 않는 필드를 가리키지 않는다.
5. **다른 UI 표면(§14.2 워크플로우 에디터의 `IntegrationSelector` 노드 설정 패널)과 혼동하지 않는다.** `4-integration.md §14.2` 는 AI 어시스턴트가 아닌 일반 Node Settings Panel 의 selector 를 서술하는데, §8 의 "아직 강제되지 않는 것" 목록의 "«워크플로우 노드에서 사용» 행"이 이 표면을 이미 별도로 다루고 있다. draft 는 이 표면을 건드리지 않아 두 UI 경로(AI 어시스턴트 candidate picker vs 일반 노드 설정 selector)를 뒤섞지 않는다.
6. **구현 plan 과 방향이 일치한다.** 같은 PR 의 구현 plan `plan/in-progress/integration-personal-owner.md` 요구 1번이 "워크플로우 어시스턴트 — `list_integrations` 도구 · 노드 후보(integration-selector · mcp-server-selector)" 를 명시적으로 스코프에 포함하고 있어, 이 spec 보강이 가리키는 구현 범위와 실제 구현 예정 범위가 서로 다른 것을 약속하지 않는다.
7. **요구사항 ID 충돌 없음.** draft 는 새 ID 를 발급하지 않고 기존 `ED-AI-39` 를 그대로 참조만 한다.

## 참고 (INFO, 비차단)

- **문구 미세 불일치** — (1) 위치는 "남의 personal 은 빠진다"(동사형), (2)·(3) 위치는 "남의 personal 제외"(명사형)로 같은 의미를 다른 어투로 쓴다. 의미 충돌은 아니며 셋 다 동일 판정을 가리키므로 정정을 요구할 수준은 아니다.
- **자매 plan 의 `spec_impact` 범위** — 구현 plan `plan/in-progress/integration-personal-owner.md` 의 frontmatter `spec_impact` 는 `spec/2-navigation/4-integration.md` 만 나열하고 있다. 그 plan의 요구 1번 마지막 불릿(워크플로우 어시스턴트 표면)이 실제로는 `spec/3-workflow-editor/4-ai-assistant.md` 가 소유한 코드 표면(`codebase/backend/src/modules/workflow-assistant/**`)을 건드리므로, 이 target draft 가 반영된 뒤에는 그 plan 의 `spec_impact` 에도 `4-ai-assistant.md` 를 추가하는 편이 추후 `--impl-done` 스코프 산정에서 일관적이다. 다만 이는 plan 메타데이터 이슈로 cross_spec(데이터 모델/API/요구사항ID/상태전이/RBAC/계층 책임) 범주보다는 plan_coherence 범주에 더 가깝다.

## 요약
target 이 제안하는 세 자리 수정은 모두 이미 반영된 `spec/2-navigation/4-integration.md §8` 판정 규칙을 정확한 범위(Integration 엔티티, 두 개 candidate widget, 하나의 조회 도구)로만 가리키며, 기존 용어·앵커·데이터 모델 필드·인접 구현 plan 의 스코프와 모순 없이 정합한다. 다른 UI 표면(§14.2 일반 노드 설정 selector)이나 다른 widget(LLM Config/KB/Workflow selector)로 스코프가 번지는 과잉 확장도 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 여섯 관점 어디에서도 CRITICAL 또는 WARNING 수준의 충돌을 발견하지 못했다.

## 위험도
NONE
