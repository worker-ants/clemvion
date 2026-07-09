# Cross-Spec 일관성 검토 — `spec/4-nodes/7-trigger/1-manual-trigger.md` (impl-done)

검토 모드: `--impl-done`, diff-base `origin/main`, 코드 SoT = HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/manual-trigger-default-param-e0d395`).
target spec 문서 자체는 이번 diff 에서 변경되지 않았다(`## 구현 대상 spec 영역 (없음)`) — 이미
`status: implemented` 로 존재하는 `1-manual-trigger.md` 를 그대로 두고 코드만 변경한 PR이므로,
target 문서의 **현재 서술**이 다른 spec 영역과 정합한지를 중심으로 점검했다.

## 발견사항

### [WARNING] 구조 검증(`invalid_schema`)의 "시점/위치" 서술이 execution-engine spec 과 어긋남

- target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 (에러 코드) 표 — `parameters[i].name` 빈 문자열/식별자 위반, 이름 중복, 배열 아님, type enum 불일치 4행 모두 "시점" 컬럼이 `handler.validate (저장 시점)` / `handler.validate` 로 기재됨.
- 충돌 대상: `spec/5-system/4-execution-engine.md` §5.5(590행) · §5.6(636-638행) — `handler.validate(rawConfig)` 는 **실행 dispatch loop 의 노드별 pre-flight 단계(런타임, 노드 진입 직전)**에서 호출되며 실패 시 `INVALID_NODE_CONFIG` 를 던진다고 명시. "저장 시점"이라는 서술이 없다.
- 상세: 실제 코드를 확인하면 두 개의 **서로 다른** 호출부가 존재한다.
  1. `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts` `validate()` — `validateTriggerParameterSchema` 를 호출하지만, 이 메서드 자체는 `execution-engine.service.ts:5254` 의 **실행 dispatch pre-flight**(`runNodeDispatchLoop` → 노드마다 `handler.validate(node.config)`)에서만 불린다. 실패 시 `INVALID_NODE_CONFIG` (execution-engine.md §5.6 과 정확히 일치).
  2. 이번 PR 이 신설한 `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` — `POST /:id/save`(`saveCanvas`) 안에서 **직접** `validateTriggerParameterSchema` 를 호출(핸들러의 `validate()` 를 경유하지 않음). 실패 시 `INVALID_TRIGGER_PARAMETERS`.

  즉 "저장 시점" 구조 검증은 실제로는 `handler.validate` 가 아니라 workflows 모듈의 별도 게이트이고, `handler.validate` 는 여전히 (execution-engine.md 가 서술하는 대로) 실행 시점 전용이다. target §6 표는 이 두 계층(코드 리뷰 관점 #6 "계층 책임")을 하나의 라벨로 뭉뚱그려, 독자가 "handler.validate 가 save 경로에서도 불린다"고 오해하게 만든다.
- 제안: target §6 을 두 행으로 분리 — (a) 저장 시점: `WorkflowsService.validateManualTrigger` → `400 INVALID_TRIGGER_PARAMETERS` (`workflows.service.ts`), (b) 실행 시점 pre-flight(저장을 우회한 legacy row 등 방어): `manualTriggerHandler.validate()` → `INVALID_NODE_CONFIG` (execution-engine.md §5.6 과 교차 링크). 아울러 target 문서 및 `0-common.md` 의 frontmatter `code:` 목록에 `workflows.service.ts` 를 추가해 저장 시점 게이트의 SoT 를 명시하는 편이 좋다(현재 두 문서 모두 `workflows.controller.ts` 만 나열).

### [WARNING] Webhook 트리거 출력 예시(`output.body`/`output.headers` flat)가 target 의 `output.request` 중첩 계약과 불일치

- target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §5.2 (139-144행) — webhook 어댑터 출력은 `output.request: { method, headers, query, body }` 로 **중첩**해서 노출한다고 명시. `spec/4-nodes/7-trigger/0-common.md` §1(36행)도 동일하게 "핸들러는 `output.request: {...}` 로 묶어 노출" 라고 재확인.
- 충돌 대상: `spec/5-system/4-execution-engine.md` §6.1.1 (766-777행) — "Manual Trigger 핸들러의 `execute()` 출력은 항상 다음 형태이다" 라며 보여주는 JSON 예시가

  ```json
  {
    "config": { "parameters": [...] },
    "output": {
      "parameters": { "name": "test", "count": 3 },
      "body": "...(webhook 시)",
      "headers": "...(webhook 시)"
    }
  }
  ```

  로, `body`/`headers` 를 `output` **최상위**에 flat 하게 두고 있다.
- 상세: 실제 구현(`manual-trigger.handler.ts` 128-136행)은 `output.request.{method,headers,query,body}` 로 그룹핑하며 target §5.2·0-common.md §1 과 일치한다(코드가 target 과 정합 — 문제는 execution-engine.md 예시가 stale). 이 PR 이 직접 건드린 diff 는 아니지만, target 이 다루는 정확히 같은 인터페이스(트리거 output shape)에 대한 서로 다른 두 문서의 예시가 상충하므로 cross-spec 관점에서 보고한다. 방치 시 향후 execution-engine.md 예시를 그대로 믿고 구현/문서를 작성하는 회귀 위험이 있다.
- 제안: `spec/5-system/4-execution-engine.md` §6.1.1 의 JSON 예시를 `output.request.{method,headers,query,body}` 형태로 갱신해 target·0-common.md 와 동기화.

### [INFO] `data-flow/11-workflow.md` 의 저장 시 "DTO 사전 검증" 목록이 신규 게이트를 반영하지 않음

- target 위치: (target 문서 자체는 아니지만) target 이 이번에 구현을 완성한 저장 시점 검증 — `workflows.service.ts` `validateManualTrigger` (신규 `INVALID_TRIGGER_PARAMETERS` 구조 검증 분기, `skipParamSchemaValidation` 로 `restoreVersion` 예외 처리 포함).
- 충돌 대상: `spec/data-flow/11-workflow.md` 44-45행 — `POST /api/workflows/:id/save` 시퀀스에 "DTO 사전 검증 — Manual Trigger 정확히 1개(누락/중복 시 400), 노드 label 중복 거부(`DUPLICATE_NODE_LABEL`)" 만 나열하고, 신규 파라미터 스키마 구조 검증(`INVALID_TRIGGER_PARAMETERS`)이나 restore 시 예외(`skipParamSchemaValidation=true`)는 언급이 없다.
- 상세: 모순은 아니지만, 이 문서가 `/save` 엔드포인트의 사전 검증을 명시적으로 열거하는 유일한 data-flow 문서이므로 목록이 불완전해지면 향후 "이 두 개가 전부"라고 오인해 신규 검증을 또 다른 곳에 중복 구현할 위험이 있다.
- 제안: `data-flow/11-workflow.md` §1(또는 해당 시퀀스 노트)에 파라미터 스키마 구조 검증 행 추가.

### [INFO] `spec/1-data-model.md` §2.6 `Node.type` 전체 목록에 `trigger | manual_trigger` 행 누락

- target 위치: (참조 대상 데이터 모델) — target 문서는 `Node.type = 'manual_trigger'` 로 조회하는 것이 정확한 방식이라고 전제(§6 코드 SoT `resolve-trigger-parameters.ts`), 그리고 이번 PR 의 `load-trigger-parameter-schema.ts` 변경도 "실데이터의 `category` 컬럼이 누락/부정확할 수 있어 `type` 기준 조회로 전환"한다고 명시.
- 충돌 대상: `spec/1-data-model.md` §2.6 (151행) — `category` enum 정의에는 `trigger`(§2.6, "Manual Trigger 시작 노드용")가 있지만, 바로 아래 "Node.type 전체 목록" 표(172-201행)는 logic/flow/ai/integration/data/presentation 6개 카테고리의 type 만 나열하고 `trigger | manual_trigger` 행이 빠져 있다(167행 제약조건 설명 텍스트에는 `manual_trigger` 가 예시로 언급되지만 표에는 없음).
- 상세: 이 누락은 이번 PR 이 고치는 버그(신뢰 불가한 `category` 컬럼)와 같은 영역을 가리킨다 — canonical type 레지스트리 표조차 트리거 타입을 등재하지 않은 점이 데이터 모델 문서의 완결성 갭임을 보여준다. 기능적 충돌은 아니다.
- 제안: `spec/1-data-model.md` §2.6 표에 `trigger | manual_trigger | 워크플로우 시작 노드(정확히 1개)` 행 추가.

## 요약

이번 PR 의 코드 변경(재진입 시 `savedExecution.inputData` 사용, `type` 기준 트리거 조회, 저장 시점 파라미터 스키마 게이트, 프런트 인라인 검증)은 `spec/5-system/4-execution-engine.md` §6.1.1(트리거 입력 seeding)·§1387(retry `$input` 미해소 documented limitation)이 이미 약속한 계약과 실제로 잘 정합하며 새로운 충돌을 만들지 않는다. 다만 target 문서(`1-manual-trigger.md` §6)가 신설된 저장 시점 검증 게이트(`workflows.service.ts`)와 기존 실행 시점 `handler.validate` pre-flight(`execution-engine.md` §5.6)를 하나의 서술로 뭉뚱그려, 두 spec 영역의 "검증이 언제·어디서 일어나는가" 서술이 어긋난다(WARNING). 또한 target 이 정의하는 webhook 출력 shape(`output.request` 중첩)과 `execution-engine.md` §6.1.1 의 예시(`output.body`/`output.headers` flat)가 상충한다(WARNING, 이번 diff 가 직접 만든 것은 아니나 target 영역과 정확히 겹침). 두 건 모두 기능을 깨뜨리는 직접 모순은 아니고 문서 정합화가 필요한 수준이며, 추가로 `data-flow/11-workflow.md`·`data-model.md` 의 완결성 갭(INFO 2건)을 발견했다.

## 위험도

MEDIUM
