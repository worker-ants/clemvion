# Cross-Spec 일관성 검토 — 워크플로우 복제가 빈 워크플로우를 만든다

대상: `plan/in-progress/workflow-duplicate-nodes-edges.md`
spec_impact: `spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`

## 검토 방법

프롬프트 번들은 컨텍스트 예산 초과로 `spec/data-flow/11-workflow.md`·`spec/2-navigation/1-workflow-list.md`·
`spec/3-workflow-editor/*.md` 등 본 target 과 가장 밀접한 파일들을 생략했다(번들 하단 "생략된 파일 116개"
목록). 이 파일들을 저장소에서 직접 `Read`/`grep` 해 대조했다:

- `spec/data-flow/11-workflow.md` (target 이 직접 수정하는 spec, §1.5/§2.1 전문)
- `spec/2-navigation/1-workflow-list.md` (target 이 직접 수정하는 spec, 전문)
- `spec/2-navigation/_product-overview.md` (NAV-WF-04 요구사항 ID)
- `spec/3-workflow-editor/3-execution.md` (target Rationale 이 인용하는 :753 선례)
- `spec/3-workflow-editor/5-version-history.md` (`workflow_version` 상태·API)
- `spec/1-data-model.md` (Node/Edge/Trigger/WorkflowTestDataset/ModelConfig/Execution 엔티티 전수)
- `spec/2-navigation/9-user-profile.md` §4.2 (RBAC 매트릭스)
- `spec/4-nodes/2-flow/1-workflow.md` (sub-workflow 노드의 외부 workflowId 참조)
- 전체 `spec/**` 에서 `duplicate`/`복제` grep (엔드포인트·용어 중복 사용처 전수 확인)

## 발견사항

### [INFO] `Trigger` 엔티티(webhook/schedule)와 `WorkflowTestDataset` 의 복제 제외 범위가 target 본문에 명시되지 않음

- **target 위치**: §1.1 TO-BE (`spec/data-flow/11-workflow.md` §1.5 duplicate 행), §2 구현 계획
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger (`workflow_id` FK), §2.13.3 WorkflowTestDataset (`workflow_id` FK CASCADE)
- **상세**: target 의 TO-BE 는 복제 범위를 "메타 + 전체 nodes/edges" 로 명시한다. `Trigger` 엔티티(webhook/
  schedule 자동화 설정, `Node.category='trigger'` 인 **캔버스상의 Manual Trigger 노드와는 별개의 최상위
  테이블**)와 `WorkflowTestDataset`(Mock Input 데이터셋)도 `workflow_id` FK 로 워크플로우에 종속되지만
  target 은 이 둘을 언급하지 않는다. 실제로는 문제가 되지 않는다 — export(`§1.5` 1행)·import(`§1.5` 3행)
  도 이미 이 두 엔티티를 명시적으로 다루지 않고(export 는 "메타+nodes/edges" 만 직렬화, import 도 동일
  범위만 생성), target 이 "import 와 동일 UUID 재매핑 알고리즘" 을 선언적으로 따르겠다고 한 것과
  정확히 같은 스코프이므로 **모순은 없다** — 오히려 기존 export/import 전례와 정확히 일치한다.
  다만 "Manual Trigger 노드"(node.category=trigger)와 "Trigger 엔티티"(webhook/schedule 설정)가 이름이
  겹쳐, 구현자가 "복제가 트리거까지 다 옮긴다"고 오독할 여지가 있다.
- **제안**: §1.1 TO-BE 또는 §1.4 Rationale 에 한 줄 — "Trigger(webhook/schedule) 및 WorkflowTestDataset
  은 복제 범위에 포함되지 않는다 — export/import 와 동일 정책. Trigger 를 복제하면 `endpoint_path` 등
  외부에 노출된 식별자가 충돌하므로 의도적으로 제외." 를 추가하면 향후 구현자·리뷰어의 오독을 막을 수
  있다. unit 체크리스트에도 "Trigger/WorkflowTestDataset row 개수 불변(0 증가)" 단언을 추가하면 좋다.

### [INFO] `spec/2-navigation/1-workflow-list.md` §3 API 표의 duplicate 행이 갱신 대상에서 빠짐

- **target 위치**: §1.2 TO-BE (동일 문서 §2.6 더보기 메뉴 행만 갱신 대상으로 명시)
- **충돌 대상**: 동일 파일 §3 API 표 124행 — `POST /api/workflows/:id/duplicate \| 워크플로우 복제`
- **상세**: target 의 체크리스트("spec 3곳 반영: §1.1/§1.2/§1.3")는 `1-workflow-list.md` 내에서 §2.6(더보기
  메뉴 설명)만 갱신 대상으로 잡았다. 같은 문서 §3 API 표의 동일 엔드포인트 설명("워크플로우 복제")은
  그대로 남는다. 이 자체가 거짓이 되는 것은 아니라서 **모순은 아니다** — 다만 §2.6 TO-BE 는 새로
  "데이터 흐름은 data-flow §1.5 참조" 링크를 붙이는데, §3 표는 그 링크가 없어 같은 문서 안에서
  상세도가 비대칭해진다.
- **제안**: 필수는 아니나, §3 표 124행에도 동일한 각주/링크(`→ data-flow §1.5`)를 붙이면 한 문서 내
  두 서술 지점의 정보량이 맞춰진다.

## 확인했으나 충돌 없음 (근거 포함)

아래는 충돌 가능성이 있어 보여 대조했지만 실제로는 target 이 기존 spec 과 정합적임을 확인한 항목이다
(발견사항이 아니라, 검토 완결성을 위해 기록):

- **데이터 모델**: TO-BE 가 언급하는 `container_id`/`tool_owner_id`/엣지 endpoint 재매핑은
  `spec/1-data-model.md` §2.6 Node·§2.7 Edge 의 필드 정의·제약(`chk_node_placement`, cycle 금지)과
  정확히 일치. `llmConfigId` 원본 유지 결정도 data-model §2.16 "AI 노드 `config.llmConfigId`(JSONB,
  **FK 없음**)" 과 부합 — DB 단에서부터 애초에 검증 대상이 아니므로 duplicate 가 이를 재검증하지
  않아도 무결성 위반이 아니다.
- **API 계약**: 라우트(`POST /api/workflows/:id/duplicate`)·응답 타입(`Promise<Workflow>`)을 바꾸지
  않는다. `spec/2-navigation/1-workflow-list.md` §3 API 표와 라우트 자체는 그대로 일치.
- **요구사항 ID**: 새 ID 를 만들지 않고 기존 `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`,
  "워크플로우 생성/복제/삭제 기능", 필수, ✅)만 인용 — 재확인 결과 실제로 그 줄에 그 텍스트로 존재.
  ID 충돌 없음.
- **상태 전이**: `workflow.is_active` 는 duplicate 후에도 `false` 로 시작 — `data-flow/11-workflow.md`
  §3.1 상태 다이어그램(`[*] --> Inactive: INSERT (default false)`)과 일치. `current_version=1` 로
  시작하는 것도 `POST /api/workflows` 최초 생성 시퀀스(§1.1, `current_version=1`)와 동일한 "새
  워크플로우의 초기값" 규약을 재사용한 것이라 새로운 상태 값 체계를 만들지 않는다. `Execution` 엔티티
  (§2.13)는 `workflow_version` 을 참조하는 FK 가 없어 "버전 이력 미승계" 결정이 실행 이력 조회를
  깨뜨리지 않는다.
- **버전 이력 정책 대칭성**: `spec/3-workflow-editor/5-version-history.md` 는 복원(`restore`)이 항상
  "새 버전으로 forward 기록" 이라는 정책만 규정하고 duplicate 와의 상호작용은 언급하지 않는다 —
  target 의 "사본은 `current_version=1` 로 독립적으로 새로 시작, 원본 이력 비참조" 결정과 충돌 지점이
  없다.
- **RBAC**: target 은 권한 모델을 바꾸지 않는다. `spec/2-navigation/9-user-profile.md` §4.2 매트릭스의
  "워크플로우 생성/수정/삭제 = Owner/Admin/Editor ✅, Viewer ❌" 범주에 복제(신규 워크플로우 생성)가
  자연스럽게 포함되며 target 이 이를 변경하겠다는 서술이 없다.
- **계층 책임**: 변경 범위가 `codebase/backend/src/modules/workflows/workflows.service.ts` 로 완전히
  국한되고, `data-flow/11-workflow.md` "코드 진입점" 목록이 이미 이 파일을 Workflow CRUD 담당으로
  명시하고 있어 계층 경계 위반이 없다. export→import 내부 재사용을 명시적으로 기각한 근거(§Rationale)도
  기존 프로젝트가 반복해 온 "동일 보일러플레이트만 추출, 관심사 발산 시 전체 통합은 지양" 결정 패턴과
  같은 방향이다.
- **3-way spec 불일치의 해소 여부**: target Rationale 이 주장하는 "세 spec 이 서로 다른 것을 말하고
  있다" 는 실측 확인됨 — (1) `data-flow/11-workflow.md:137` AS-IS "nodes/edges 는 복제하지 않는다"
  (2) `2-navigation/1-workflow-list.md:104` "워크플로우 복사본 생성" (노드 제외 언급 없음)
  (3) `3-workflow-editor/3-execution.md:753` "(workflows 의 duplicate 선례와 동일한 '복제 후 자기 소유'
  패턴)" — 이 인용은 duplicate 가 이미 완전한 사본을 만든다는 전제 위에 있어 (1)과 정면으로 어긋난다.
  target 의 계획은 (1)(2)를 고쳐 세 spec 을 (3)이 전제하는 동작으로 수렴시키므로, **새 불일치를
  만드는 것이 아니라 기존 3-way 불일치를 해소**한다. (3)은 별도 수정이 필요 없다 — fix 이후 그 서술이
  비로소 참이 되기 때문.
- **다른 "복제" 개념과의 혼동 없음**: `spec/3-workflow-editor/0-canvas.md` 의 "Ctrl+D 노드 복제"(캔버스
  내 단일 노드 복제, 클라이언트 로컬)와 `spec/3-workflow-editor/3-execution.md:340` 의
  `POST /api/test-datasets/:id/clone` 은 이름은 겹치지만 대상·엔드포인트가 명확히 달라 target 범위와
  섞이지 않는다.

## 요약

target 은 `spec/data-flow/11-workflow.md` §1.5/§2.1 와 `spec/2-navigation/1-workflow-list.md` §2.6 을
수정 대상으로 삼는데, 두 문서를 포함해 데이터 모델(`spec/1-data-model.md`)·버전 이력
(`spec/3-workflow-editor/5-version-history.md`)·RBAC(`spec/2-navigation/9-user-profile.md`)·
요구사항 ID(`NAV-WF-04`)·sub-workflow 노드(`spec/4-nodes/2-flow/1-workflow.md`) 전 영역을 대조한 결과
**직접적인 모순(CRITICAL)이나 우선순위 결정이 필요한 잠재 충돌(WARNING)은 발견되지 않았다**. 오히려
target 자신이 진단한 "3개 spec 이 서로 다른 duplicate 동작을 전제한다" 는 사전 불일치가 실측으로
확인되며, target 의 계획은 이를 새 모순 없이 수렴시킨다. 남은 두 건은 모두 INFO 수준의 문서 완결성
제안(Trigger/WorkflowTestDataset 제외 범위를 명시적으로 서술, API 표 각주 동기화)으로, 구현 착수를
막을 이유가 아니다.

## 위험도
LOW
