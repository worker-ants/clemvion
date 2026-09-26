# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 요약

`--impl-prep` 스코프의 target 은 `spec/3-workflow-editor/4-ai-assistant.md` (status: `implemented`, 기존 파일)
전문이 번들된 것이며, 실제 착수 예정 작업은 `plan/in-progress/assistant-e2e-contract-gaps.md`
("workflow-assistant e2e 의 남은 계약 대조 세 칸")다. 그 plan 은 `spec_impact: none` 을 명시하고,
"테스트만 바뀐다 — 제품 코드 · spec 변경 없음" 이라고 밝힌다. 즉 이번 착수로 **새로 도입되는
요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로는 없다** — plan 의 세 칸(처방 1~3)은 모두
기존에 이미 정의된 필드(`data: null`, `AssistantSessionDto`/`AssistantSessionDetailDto`,
`planStepId`/`planStepIds`/`signature`/`result`)를 e2e 테스트가 대조하도록 채우는 작업이다.

## 발견사항

- **[INFO]** 엔티티 표기 `AssistantSession`/`AssistantMessage` (data-model.md) vs `WorkflowAssistantSession`/`WorkflowAssistantMessage` (실제 코드·후속 spec 섹션) — 이번 작업과 무관한 기존 drift
  - target 신규 식별자: 없음 (이번 plan 이 새로 도입하는 이름 아님)
  - 기존 사용처:
    - `spec/1-data-model.md` §2.20/§2.22 (라인 788, 844) 및 다이어그램(라인 51-52) — 엔티티 이름을 `AssistantSession`/`AssistantMessage` 로 정의
    - `spec/1-data-model.md` 라인 1172, 1183 — 같은 문서 안에서 실제 테이블명 `workflow_assistant_session` 을 언급
    - `spec/3-workflow-editor/4-ai-assistant.md` 라인 825/836/840 ("확정된 결정 사항" 절) — `AssistantSession`/`AssistantMessage` 사용(= data-model.md 와 일치)
    - 같은 파일 라인 596/1293/1302/1387/1389 (후속 "Follow-up" 절) — `WorkflowAssistantMessage` 사용
    - 실제 코드: `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:34` `export class WorkflowAssistantSession`, `workflow-assistant-message.entity.ts:101` `export class WorkflowAssistantMessage` (테이블 `workflow_assistant_session`/`workflow_assistant_message`)
  - 상세: 동일 엔티티 두 개(Session·Message)에 대해 SoT 인 `spec/1-data-model.md` 의 정의 이름(`AssistantSession`/`AssistantMessage`)과 실제 TypeORM 클래스명(`WorkflowAssistantSession`/`WorkflowAssistantMessage`)이 서로 다르다. `spec/3-workflow-editor/4-ai-assistant.md` 자체도 초기 설계 절에서는 data-model.md 이름을, 후속 Follow-up 절에서는 코드 이름을 섞어 쓴다. 이름이 다른 두 이름이 "같은 엔티티" 를 가리킨다는 명시적 매핑(Rationale)이 어느 문서에도 없어, 처음 읽는 사람은 두 개의 별개 엔티티가 있다고 오인하거나(예: 새로 `AssistantSession` 클래스를 만들어 실제 `WorkflowAssistantSession` 과 충돌) 검색으로 "AssistantSession" 을 찾다가 실제 클래스를 놓칠 수 있다. 다만 DTO 계층(`AssistantSessionDto`/`AssistantSessionDetailDto`, `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts`)과 프론트 타입(`AssistantSessionData`/`AssistantMessageData`, `codebase/frontend/src/lib/api/assistant.ts`)은 `Workflow` 접두어 없이 일관되게 쓰이므로, "접두어 없는 Assistant*" 자체는 DTO/타입 레이어에서는 이미 정착된 명명이다 — 문제는 **엔티티 레이어만** data-model.md 표기와 엇갈린다는 점이다.
  - 제안: 이번 e2e 세 칸 작업의 범위(`spec_impact: none`)와는 무관하므로 차단 사유 아님. 다음에 `spec/1-data-model.md` §2.20/§2.22 를 만질 일이 생기면 엔티티명을 실제 클래스명(`WorkflowAssistantSession`/`WorkflowAssistantMessage`)으로 갱신하거나, DTO/entity 이름 차이를 의도적 설계로 명시하는 한 줄(예: "entity 는 `Workflow` 접두, DTO/프론트 타입은 컨텍스트가 이미 workflow-assistant 모듈이라 생략")을 Rationale 에 추가할 것을 권장.

## 요약

이번 `--impl-prep` 스코프의 실제 착수 대상(plan `assistant-e2e-contract-gaps`)은 `spec_impact: none` 이 명시하듯 e2e 테스트 파일만 수정하며, 모두 이미 정의된 DTO 필드·엔티티 필드를 재사용한다. 번들된 target 문서(`spec/3-workflow-editor/4-ai-assistant.md`) 안에서 요구사항 ID(`ED-AI-01~40`), 엔티티, REST endpoint(`GET/POST/PATCH/DELETE /workflow-assistant/sessions[...]`), tool 이름(`add_node`/`propose_plan`/`get_execution_details` 등), 에러 코드(`ASSISTANT_TOO_MANY_TOOL_CALLS`, `PORT_NOT_FOUND` 등)를 전수 대조한 결과 신규 도입 시 기존 사용처와 다른 의미로 충돌하는 사례는 없었다 — 모두 `_product-overview.md`·`data-model.md`·다른 노드 spec 에서 같은 의미로 일관되게 상호 참조된다. 유일하게 눈에 띈 것은 이번 작업과 무관한 기존 drift(엔티티 표기 `AssistantSession`/`AssistantMessage` vs 실제 클래스 `WorkflowAssistantSession`/`WorkflowAssistantMessage`)이며, 이는 INFO 로 남긴다.

## 위험도

NONE
