# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep: `cross-workspace-refs`)

검토 모드: `--impl-prep`, scope=`spec/2-navigation/`. 연계 plan: `plan/in-progress/cross-workspace-refs.md`
(요청 본문 참조 id 의 교차 워크스페이스/교차 워크플로 저장 전 검사 신설 — `spec_impact: none`).
target 번들에서 `spec/1-data-model.md` 등 다수 관련 spec 이 컨텍스트 예산 초과로 본문 생략돼(절단 고지),
실제 리포지토리의 해당 파일을 직접 읽어 대조했다.

## 발견사항

- **[CRITICAL]** 폴더 생성 API 문서가 실제로 없는 "같은 워크스페이스" 검증을 있다고 주장한다 — data-model 의 무조건 제약과 어긋난 상태를 target 문서가 은폐한다
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 API 표 — `PATCH /api/folders/:id` 행("`parentId` 변경 시 **create 와 동일한 계층 무결성 검증**: 새 부모가 같은 워크스페이스에 없거나...") 및 Rationale §3 "폴더 계층 무결성은 생성·부모 변경 **양쪽에서** 강제"
  - 충돌 대상: (a) `spec/1-data-model.md` §2.5 Folder 제약 조건 — "`parent_id` 는 **같은 워크스페이스**의 폴더만 가리킨다"(경로별 한정 없이 서술, 깊이 제약만 "생성·부모 변경 모두에 적용"이라고 명시적으로 범위를 단 것과 대비). (b) 같은 문서 §3.1 API 표의 `POST /api/folders` 행 자체 — 이 행은 "깊이 5 초과 시 400 / 이름 중복 시 409"만 나열하고 워크스페이스 검사는 언급하지 않는다.
  - 상세: `codebase/backend/src/modules/folders/folders.service.ts` 를 직접 읽어 확인했다 — `create()` 는 `getDepth(data.parentId, workspaceId)` 만 호출하고, `getDepth` 내부 조회가 `{ id: currentId, workspaceId }` 로 스코프돼 있어 `parentId` 가 **다른 워크스페이스**의 폴더면 첫 조회에서 즉시 `undefined` 가 되어 depth=1 로 종료된다(= 통과). 즉 create 경로는 "같은 워크스페이스" 검사를 하지 않는다 — `validateParentChange`(워크스페이스·순환·깊이 3종 모두 검사)는 `update()` 에서만 호출된다. `plan/in-progress/cross-workspace-refs.md` 자신의 전수 조사도 `POST /api/folders` 의 `parentId` 를 검사가 **없는** (D) 그룹으로 분류하며 "PATCH 는 이미 검사한다(spec `1-workflow-list.md` §3.x 는 생성도 같은 검증이라 적는다)"라고 이 불일치를 스스로 적어 두었다. 따라서 `1-workflow-list.md` §3.1 의 PATCH 행·Rationale §3 은 **현재 코드가 만족하지 못하는 보안 속성(교차 워크스페이스 부모 차단)을 이미 있다고 서술**하고 있고, 이는 data-model.md §2.5 가 무조건("생성·부모 변경 모두"라는 한정 없이) 선언한 제약이 실제로는 create 경로에서 위반 가능하다는 뜻이다.
  - 제안: 이번 PR 이 `folders.service.ts create()` 에 워크스페이스 소속 검사를 추가하는 것과 **별개로**, 지금 이 순간 `spec/2-navigation/1-workflow-list.md` 의 PATCH 행·Rationale §3 문구는 사실과 다르다. plan 이 "에러 코드·필드명의 spec 미러링은 planner 몫 → 트래커"로 미루더라도, 이 문장 자체의 부정확성은 이번 구현과 무관하게 이미 존재하는 spec 결함이므로 developer 단독 판단(자기-반증형 소정정 조건도 충족 안 함 — developer 가 쓴 예고 문장이 아니라 2026-07-05 자 확정 서술)으로 고치지 말고, `project-planner` 턴에서 (i) POST 행에 워크스페이스 검사 명시를 더하거나 (ii) 현재 상태를 정확히 반영하도록 문구를 되돌린 뒤, 이번 구현이 착지하면 다시 "생성·부모 변경 양쪽 강제"로 갱신하는 2단계 처리를 권한다.

- **[CRITICAL]** 이번 plan 의 처방(캔버스 저장에 `containerId`/`toolOwnerId` 소속 검증 추가)이 `data-flow/11-workflow.md` 가 명시한 "무검증" 계약과 정면 충돌한다
  - target 위치: `plan/in-progress/cross-workspace-refs.md` §처방 — "`containerId`·`toolOwnerId`·엣지 끝점은 **이번 페이로드의 노드 id 집합** 안이어야 한다" (scope 는 `spec/2-navigation/` 로 지정됐으나 이 변경이 실제로 건드리는 코드 경계는 캔버스 저장 — `codebase/backend/src/modules/workflows/workflows.service.ts` 의 `saveCanvas`)
  - 충돌 대상: `spec/data-flow/11-workflow.md` §1.2 "노드 컨테이너 / Tool Area 배치" — "저장 경로(`saveCanvas`)는 `container_id`/`tool_owner_id` 를 **검증 없이 그대로 저장**하며, 편집 시점의 DB 단 강제는 CHECK `chk_node_placement`(둘 다 set 금지) 뿐이다." 및 §2.1 Schema 매핑 표 "`node` | 컨테이너 / Tool Area 배치 | UPDATE `container_id` 또는 `tool_owner_id` | cycle 검사는 런타임·Assistant ShadowWorkflow 에서"
  - 상세: `data-flow/11-workflow.md` 는 `containerId`/`toolOwnerId` 관련 무결성 검사(타입·자기참조·순환 포함)를 **의도적으로** 저장 시점이 아니라 실행 엔진·Assistant `ShadowWorkflow` 로 미룬 설계라고 명시적으로 못박고 있다(`spec/3-workflow-editor/0-canvas.md` §11.2.1/§11.2.2 도 동일 — `containerId` 는 엣지 기반 순수 함수로 클라이언트가 계산하고, `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 은 "실행 시" 거부라고 적는다). plan 의 처방은 검사 종류(교차-워크플로 참조 vs 순환/타입)는 다르지만, "저장 경로는 검증 없이 그대로 저장한다"는 문장을 문자 그대로 반증하는 **새 검증을 그 동일 경로에 추가**하는 결정이다. `spec_impact: none` 으로 시작했고, plan 본문에도 이 파일에 대한 언급이 없다 — 구현이 착지하면 `data-flow/11-workflow.md` §1.2/§2.1 은 즉시 거짓 서술이 된다.
  - 제안: CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙이 적용되는 사례다. 자기-반증형 소정정 예외(조건 2 "예고·트리거"만 해당, 데이터 계약/API 계약은 명시적으로 배제)에도 해당하지 않는다 — `§1.2` 는 예고 문장이 아니라 확정된 API 계약 서술이다. `--impl-prep` 통과 전에 `project-planner` 로 `spec/data-flow/11-workflow.md` §1.2·§2.1(및 `spec/3-workflow-editor/0-canvas.md` §11.2.1 각주)을 "저장 시점에 교차-워크플로 참조만 거부하고, 타입/순환 검증은 여전히 런타임·ShadowWorkflow 몫"으로 갱신하는 spec PR 을 선행하거나, 최소한 plan 의 `spec_impact` 를 `none` 에서 이 파일들로 바꿔 구현과 동일 PR 에 spec 갱신을 동봉해야 한다.

- **[WARNING]** `spec/1-data-model.md` 의 Trigger(§2.8)/Schedule(§2.9) 항목에는 Folder(§2.5)와 대칭되는 "같은 워크스페이스" 제약 문구가 없다
  - target 위치: (신설 예정) `plan/in-progress/cross-workspace-refs.md` 처방의 트리거/스케줄 `workflowId` 검사
  - 충돌 대상: `spec/1-data-model.md` §2.5 Folder "**제약 조건**" 블록(명시적 워크스페이스 제약 서술) vs §2.8 Trigger / §2.9 Schedule (`workflow_id` 를 "FK → Workflow (CASCADE)"로만 서술, 워크스페이스 스코프 불변식 없음)
  - 상세: 이번 구현이 끝나면 "트리거/스케줄의 `workflowId` 는 같은 워크스페이스의 워크플로만 가리킨다"는 새 불변식이 생기는데, Folder 는 이런 불변식을 데이터 모델 문서의 "제약 조건" 절에 1급 시민으로 등재하는 선례가 있다(§2.5). 같은 선례를 따르지 않으면 다음 사람이 Folder 만 특별 취급되는 예외로 오독할 수 있다.
  - 제안: 이번 기능의 `spec_impact` 가 `none` 을 벗어나게 되면(위 두 CRITICAL 항목 참고), `1-data-model.md` §2.8/§2.9 에도 Folder §2.5 와 같은 형식의 "`workflow_id` 는 같은 워크스페이스의 Workflow 만 가리킨다" 제약 문구를 함께 추가할 것.

- **[INFO]** 동형 문제에 이미 다른 이름의 선례가 있다 — `WORKFLOW_FORBIDDEN_WORKSPACE`
  - target 위치: `plan/in-progress/cross-workspace-refs.md` §처방 — "(X)·(D) 전부 저장 전에 거부한다 — 400 `VALIDATION_ERROR` + `details: { field, code: 'INVALID_FIELD' }`"
  - 충돌 대상: `spec/4-nodes/2-flow/1-workflow.md` §2 W-6 / §6, `spec/5-system/4-execution-engine.md` "sub-workflow workspace 격리 fail-closed" — Sub-Workflow 노드의 교차 워크스페이스 워크플로 참조를 막는 기존 장치는 `assertSameWorkspace` → typed `WorkflowForbiddenWorkspaceError` → `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` (실행 엔진 런타임, error 포트로 표면화)라는 **별도의, 이미 확립된 코드 계열**을 쓴다.
  - 상세: 두 문제(REST 쓰기 시점 입력 검증 vs 런타임 서브워크플로 실행)는 계층이 달라 같은 코드를 강제할 필요는 없다 — 이미 폴더 `parentId`·트리거 `authConfigId` 도 REST 계층에서는 일관되게 generic `VALIDATION_ERROR`/전용 400 코드를 쓰고 있어 plan 의 선택 자체는 REST 계층 선례와 정합한다. 다만 "교차 워크스페이스 참조 차단"이라는 같은 제품 개념이 spec 전체에서 최소 두 개의 다른 이름(`WORKFLOW_FORBIDDEN_WORKSPACE` vs 신설 `VALIDATION_ERROR`/`INVALID_FIELD`)으로 흩어지는 셈이라, 향후 에러 코드 카탈로그(`conventions/error-codes.md`) 갱신 시 "왜 같은 개념이 다른 이름인가"를 한 줄로 정당화해 두는 편이 좋다.
  - 제안: 차단 사유는 아니며, `spec_impact` 반영 시(WARNING 항목과 같은 타이밍) 두 계열의 관계를 `error-handling.md` 나 `conventions/error-codes.md` 에 한 줄 각주로 남길 것을 권장.

## 요약

`spec/2-navigation/` 자체는 내부적으로는 대체로 정합적이나, 이번 impl-prep 의 실질 대상인 `plan/in-progress/cross-workspace-refs.md`(교차 워크스페이스 참조 저장 전 검사)를 놓고 보면 두 건의 CRITICAL 이 나온다. 하나는 이미 존재하던 결함으로, `1-workflow-list.md` 가 폴더 생성 시 "같은 워크스페이스" 검증이 이미 있다고 (`data-model.md §2.5` 의 무조건 제약을 근거로) 서술하지만 실제 코드는 검증하지 않는다 — 이번 PR 이 고치려는 바로 그 결함을 spec 이 이미 "고쳐졌다"고 잘못 말하고 있다. 다른 하나는 이번 PR 이 새로 만들 결함으로, `data-flow/11-workflow.md` 가 캔버스 저장은 `containerId`/`toolOwnerId` 를 검증 없이 저장한다고 명시적으로 선언해 둔 자리에 plan 이 새 검증을 추가하려 하면서 `spec_impact: none` 으로 시작해, 착지 즉시 그 문장을 거짓으로 만든다. 두 건 모두 "developer 는 spec 계약을 바꾸려면 project-planner 로 멈춘다"는 이 저장소의 게이트가 정확히 겨냥하는 상황이며, 자기-반증형 소정정의 좁은 예외에도 해당하지 않는다. Trigger/Schedule 워크스페이스 제약의 data-model 미등재(WARNING), 에러 코드 계열 분기(INFO)는 후속 정비 항목이다.

## 위험도

CRITICAL
