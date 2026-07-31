# Plan 정합성 검토 — `plan/in-progress/workflow-duplicate-nodes-edges.md`

## 검토 방법

프롬프트에 포함된 11개 plan 문서 + 컨텍스트 예산 초과로 프롬프트에서 생략된 47개 plan 문서
전부(`node-output-redesign/*` 30개 포함)를 `grep`으로 독립 재확인했다. 키워드:
`duplicate`, `복제`, `workflow_version`/`current_version`/`restoreVersion`, `importWorkflow`/
`exportWorkflow`/`applyConfigDefaults`, `workflows.service.ts`, `container_id`/`tool_owner_id`,
`llmConfigId`/`기본 LLM 주입`, `saveCanvas`/"정확히 1개", `data-flow/11-workflow.md`,
`2-navigation/1-workflow-list.md`. (근거: `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
가 이 저장소에서 프롬프트 예산 초과로 인한 침묵 누락을 실제 결함 클래스로 기록하고 있어, 생략
목록을 신뢰하지 않고 직접 대조했다.)

## 발견사항

없음. target 이 손대는 표면(`WorkflowsService.duplicate()`, `spec/data-flow/11-workflow.md` §1.5/§2.1,
`spec/2-navigation/1-workflow-list.md` §2.6)을 언급하거나 그와 충돌할 수 있는 미해결 결정을 쥔
`plan/in-progress/**` 문서가 없다.

확인한 근접 후보와 비저촉 판단 근거:

- **`marketplace-and-plugin-sdk.md` Phase A** — "설치(기존 워크플로 import 재사용)"라고 명시해
  `importWorkflow()` 를 재사용 대상으로 지목하며 `duplicate()` 는 언급하지 않는다. 같은 문서가
  `spec/2-navigation/1-workflow-list.md` 에 대해 이미 `pending_plans:` 로 걸려 있으나, 그 근거는
  **§2.7**(빈 상태 마켓 추천 링크) 이고 target 이 편집하는 **§2.6**(더보기 메뉴 복제 행)과는
  다른 절이라 충돌하지 않는다.
- **`node-output-redesign/README.md`** — "workflow" 노드(Sub-Workflow 호출)의 async
  `output.workflowId`/`output.status` 중복 제거 항목이 링크를 `spec/data-flow/11-workflow.md`
  로 걸고 있으나, 실제로 그 파일에는 해당 서술이 없다(직접 대조 확인 — `Sub-Workflow`/
  `workflowId` async 출력 내용 0건). 이 plan 자체의 사전 존재하던 mislink 로 보이며 target 의
  변경(§1.5/§2.1/Rationale, 전부 workflow **entity** CRUD 흐름)과는 무관한 절이다. target 이
  유발하거나 악화시키지 않았으므로 지금 조치가 필요한 사안은 아니다(단순 관측).
- **`ai-agent-tool-connection-rewrite.md`** — "도구 등록 모델" 미결(a/b/c) 이 열려 있지만,
  target 은 `tool_owner_id` 재매핑 규칙을 새로 정의하지 않는다. `importWorkflow()` 가 이미
  갖고 있던 기존 remap 패턴을 그대로 재사용할 뿐이라 이 미결 결정을 우회·선점하지 않는다.
  실제로 `codebase/backend/src/nodes/flow/workflow/workflow.schema.ts` 의 `config.workflowId`
  (다른 워크플로우를 가리키는 cross-workflow 참조) 는 `container_id`/`tool_owner_id`/엣지
  endpoint 재매핑 범위 밖의 opaque `config` 필드라 그대로 복사되는 것이 맞는 동작이고, 이 역시
  기존 `importWorkflow()` 패턴이 이미 다루는 방식과 동일하다.
- **`exec-intake-followups.md`** — `ImportWorkflowDto.settings` opaque 비대칭 후속 항목이 있으나,
  duplicate 는 API DTO 입력이 아니라 이미 검증된 DB row(`original.settings`)를 그대로 복사하므로
  이 후속과 무관하다.
- **workflow 버전 이력**(`workflow_version`/`current_version`/`restoreVersion`) — 이 개념을
  다루는 다른 in-progress plan 없음. target 의 "버전 이력 미승계" 결정과 충돌 없음.
- **"Manual Trigger 정확히 1개" 불변식** — 이 불변식을 변경 중인 다른 plan 없음.

## 요약

target(`workflow-duplicate-nodes-edges.md`)이 수정하는 코드·spec 표면은 다른 in-progress plan
어디와도 실질적으로 겹치지 않는다. 근접해 보이는 3건(marketplace 의 workflow-list.md
`pending_plans`, node-output-redesign 의 11-workflow.md 링크, ai-agent-tool-connection-rewrite
의 tool 등록 미결)을 각각 대조한 결과 모두 다른 절/다른 메커니즘을 가리키거나, target 이 기존
패턴을 그대로 재사용할 뿐이라 미해결 결정을 침해하지 않는다. target 이 "결정 필요"로 남긴 항목도
없다(구현 계획·Rationale 이 이미 대안 기각까지 자기완결적으로 정리됨). 컨텍스트 예산으로
프롬프트에서 생략됐던 47개 plan 파일도 전수 grep 으로 별도 대조해 동일한 결론을 얻었다.

## 위험도

NONE
