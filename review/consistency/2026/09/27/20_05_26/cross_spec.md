# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-cross-workspace-refs.md`

## 검토 범위

target draft(`spec-draft-cross-workspace-refs.md`)와 그것이 고치는 5개 spec 파일의 **현재 본문**
(`spec/1-data-model.md` §1·§2.1~§2.9·§2.25, `spec/2-navigation/1-workflow-list.md`,
`spec/data-flow/11-workflow.md`, `spec/data-flow/12-workspace.md`, `spec/3-workflow-editor/0-canvas.md`),
그리고 근거로 삼는 규약(`spec/5-system/3-error-handling.md` §1.3·§1.11, `spec/5-system/2-api-convention.md` §5.3,
`spec/conventions/error-codes.md`, `spec/4-nodes/2-flow/1-workflow.md` W-6)과 "건드리지 않는다"고 명시한
API 문서(`2-trigger-list.md`·`3-schedule.md`·`5-knowledge-base.md`·`9-user-profile.md`·`4-ai-assistant.md`)를
대조했다.

## 발견사항

- **[WARNING]** 새 §1.1 규칙 표가 커버를 선언한 AlertRule.`workflow_id` 가 변경 목록(A2~A6)에서 빠짐
  - target 위치: draft `### A. spec/1-data-model.md` §A1 신설 표 — "알림 규칙 생성 `workflowId`" 행(Workflow · 워크스페이스 스코프로 명시 등재), 그리고 변경 항목 A2(Workflow.folder_id)·A5(Trigger.workflow_id)·A6(Schedule)
  - 충돌 대상: `spec/1-data-model.md` §2.25 AlertRule (`workflow_id UUID? | FK → Workflow (CASCADE). NULL = 워크스페이스 전역 규칙`) — 이 draft 가 건드리지 않는 자리
  - 상세: §1.1 신설 표는 "알림 규칙 생성 `workflowId`"를 Workflow 엔티티·워크스페이스 스코프의 대상으로 명시적으로 포함시켰고, 실측 섹션도 "거부를 기대한 18케이스"에 "알림 규칙의 `workflowId`"를 포함해 이 필드가 실제 구현 수정 대상임을 밝힌다. 그런데 변경안 A 는 Workflow(§2.4)·Node(§2.6)·Edge(§2.7)·Trigger(§2.8)·Schedule(§2.9) 5개 엔티티 절에는 각각 "같은 워크스페이스의 워크플로만(§1.1)" 류의 주석을 붙이면서, 같은 §1.1 표가 스코프에 넣은 AlertRule(§2.25)의 `workflow_id` 행에는 대응 주석이 없다. 패치 적용 직후 `1-data-model.md` 안에서 "§1.1 이 커버하는 필드" 목록(§1.1 표)과 "§1.1 을 실제로 인용하는 엔티티 필드"(§2.4/§2.6~§2.9) 사이에 AlertRule 하나만 누락되는 비대칭이 생긴다 — 같은 문서 내부의 완결성 문제이지만, `data-flow/9-observability.md` §2.1(`alert_rule` CRUD 행)·`2-navigation/9-user-profile.md` §5.4(`POST /api/alerts` 의 `workflowId?` 필드)처럼 §2.25 를 SoT 로 인용하는 다른 영역 문서가 이 갭을 그대로 물려받는다.
  - 제안: A 시리즈에 A7(가칭)을 추가해 §2.25 AlertRule `workflow_id` 행에 `같은 워크스페이스의 워크플로만(§1.1). NULL = 워크스페이스 전역 규칙` 주석을 붙인다. (구현 plan 의 18케이스 목록에는 이미 포함돼 있으므로 spec 쪽 등재만 누락된 상태.)

- **[WARNING]** 캔버스 저장의 다중 위반에 단수 `details: { field, code }` 를 쓰는 것이 API 컨벤션의 배열 선택 기준과 어긋남
  - target 위치: draft `### A.` §A1 "**거부 응답**" 문단(`details: { field, code: 'INVALID_FIELD' }`, 괄호 안 "캔버스 저장은 `nodes[i].id` 처럼 파이프와 같은 경로 표기"), `### D.` D1(`details.field` 예: `nodes[2].containerId`)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 "`details` 의 형태는 두 가지" 표 — "배열 `details: [{field, message, code}]` | 여러 항목이 각각 실패할 수 있을 때 (ValidationPipe 다중 필드)" 및 같은 문서가 이미 참조하는 `spec/5-system/3-error-handling.md` §1.3 `RESERVED_VARIABLE_NAME` 행의 `details.offenders[]` 선례
  - 상세: 캔버스 저장(`POST /:id/save`)은 한 페이로드 안에 여러 노드·엣지가 동시에 존재하고, 그중 다수가 동시에 잘못된 `containerId`/`toolOwnerId`/엣지 끝점/새 노드 id 충돌을 가질 수 있는 전형적인 "여러 항목이 각각 실패할 수 있는" 경우다. api-convention.md §5.3 은 바로 이 경우에 배열 `details: [{field, message, code}]` 를 쓰라고 명시하고, 같은 문서가 참조하는 `RESERVED_VARIABLE_NAME` 코드는 정확히 같은 성격(캔버스 저장 시 여러 노드의 예약어 위반)의 다중 위반을 `details.offenders[]` 배열로 이미 보고한다. 그런데 draft 는 단수 객체 `{ field, code }` 를 캔버스 저장에도 그대로 적용하면서, 이것이 "첫 위반만 보고"인지 "여러 위반을 배열로 모아 보고"인지, 왜 단수를 택했는지 근거를 남기지 않는다. `AUTH_CONFIG_NOT_FOUND` 선례(트리거 단일 필드 `authConfigId` 하나뿐이라 단수가 자연스러움)를 캔버스 저장(다중 필드 가능)에 그대로 유추한 것으로 보인다.
  - 제안: 캔버스 저장 케이스는 `details: [{ field, code: 'INVALID_FIELD' }, ...]` 배열로 명시하거나, 단수(첫 위반만 보고)를 의도적으로 택했다면 그 근거(예: "첫 위반에서 fail-fast, 전수 수집 없음")를 `## Rationale` 에 추가한다. 현재 문구로는 구현자가 배열/단수 중 무엇을 만들어야 하는지 API 컨벤션만 봐서는 판별할 수 없다.

- **[INFO]** "파이프" 용어가 링크 없이 쓰여 참조 대상이 불명확
  - target 위치: draft §A1 "(캔버스 저장은 `nodes[i].id` 처럼 파이프와 같은 경로 표기)"
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 "`field` 는 중첩 경로(`nodes[3].type`)를 유지한다" 문장, `spec/data-flow/12-workspace.md` "가드는 파이프보다 먼저 돈다"(Nest `ParseUUIDPipe` 를 가리키는 별개 용법)
  - 상세: 이 저장소에서 "파이프"는 `data-flow/12-workspace.md` 에서 이미 Nest `ValidationPipe`/`ParseUUIDPipe` 를 가리키는 용어로 쓰인다. draft 의 문장은 문맥상 api-convention.md §5.3 의 "중첩 경로 유지" 관례를 가리키는 것으로 읽히지만 명시적 링크가 없어, 독자가 두 용법 중 어느 쪽을 가리키는지 추론해야 한다.
  - 제안: `spec/5-system/2-api-convention.md#53-에러-응답` 로 직접 링크하거나 "중첩 경로 표기"로 바꿔 쓴다.

## 요약

target draft 는 `--impl-prep`(BLOCK: YES)이 짚은 두 문장(`1-workflow-list.md` §3.1/`## Rationale` §3 의 폴더
생성 서술, `data-flow/11-workflow.md` §1.2 각주의 "검증 없이 저장" 서술)을 정확히 겨냥해 데이터 모델 §1.1 단일
규칙으로 수렴시키고, Folder/Edge/Trigger 의 기존 "같은 워크스페이스"·"같은 workflow_id" 제약과 정합하게
새 규칙을 얹었다. 트리거 `authConfigId`·모델 설정 참조의 기존 400/404 분기, W-6 실행 시점 격리와의 계층 구분,
`5-system/3-error-handling.md`/`2-api-convention.md` 의 에러 코드·envelope 관례도 대체로 정확히 인용한다.
다만 (1) 새 §1.1 규칙이 스코프에 넣은 AlertRule `workflow_id` 가 정작 데이터 모델 변경 목록에서 빠져 같은
문서 안에서 완결성이 깨지고, (2) 캔버스 저장처럼 한 요청에 다중 위반이 가능한 자리에 단수 `details` 형태를
쓰면서 API 컨벤션이 그런 경우에 요구하는 배열 형태·선례(`RESERVED_VARIABLE_NAME.details.offenders[]`)와의
관계를 설명하지 않는다. 두 항목 모두 스펙을 그대로 채택해도 당장 다른 영역이 "작동 불가"가 되는 직접 모순은
아니므로 CRITICAL 이 아니라 WARNING 이다.

## 위험도

LOW
