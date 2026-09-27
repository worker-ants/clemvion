# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` 전체 번들(워크플로우 목록·트리거 목록·스케줄 등)이며, 프롬프트 예산 초과로
`4-integration.md`·`6-config.md`·`_layout.md` 등 15개 파일과 `5-system/1-auth.md`·`3-error-handling.md` 등
다수의 "관련 spec" 파일 본문이 번들에서 절단되어 있었다. 절단된 파일은 부재를 "문제 없음"의 근거로 삼지 않고
`Read` 로 직접 열어 확인했다 (`spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/_product-overview.md`, `spec/data-flow/11-workflow.md`).

이번 리뷰 라운드의 실질 초점은 최근 커밋(`docs(plan): folders-contract-e2e — §5.4 스윕 2차 폴더 모듈`)과
`plan/in-progress/folders-contract-e2e.md` 가 가리키는 **Folder 모듈**이므로, Folder 엔티티·API·RBAC 를
중심으로 다른 `spec/**` 영역과의 정합성을 집중 대조했다.

---

## 발견사항

### [WARNING] Folder 가 RBAC 리소스별 권한 매트릭스(§3.2)에 없다

- **target 위치**: `spec/2-navigation/1-workflow-list.md` §3.1 "폴더 관리 API" — `POST /api/folders`·
  `PATCH /api/folders/:id`·`DELETE /api/folders/:id` 를 각각 `(editor+)` 로 인라인 표기.
- **충돌 대상**: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (표에 Workspace 설정·멤버 관리·Workflow·
  Trigger·Schedule·Integration·Knowledge Base·Auth Config·Model Config·Statistics·System Status·
  Marketplace·Audit Log 는 행이 있으나 **Folder 행이 없다**). `spec/5-system/_product-overview.md` NF-SC-02
  는 "RBAC ... ✅ (Workflows·Triggers·Schedules·Integrations·Model Config·KB·Auth Configs·**Folders** 가드
  적용)" 이라고 Folder 가드 적용을 명시적으로 선언한다.
- **상세**: `2-trigger-list.md` §4.1 은 Trigger 삭제 권한을 "API 게이트는 [Spec 인증 §3.2 리소스별 권한
  매트릭스](../5-system/1-auth.md#3-인가-authorization) 의 Trigger CRUD 권한(역할 기반)으로 보호되며..." 라고
  **§3.2 를 SoT 로 명시 인용**한다. 반면 `1-workflow-list.md` §3.1 의 Folder API 는 같은 위치를 인용하지 않고
  `editor+` 를 그 자리에서 바로 선언한다. Trigger·Schedule 은 Workflow 와 마찬가지로 §3.2 표에 자기 행을 갖는데,
  같은 계층(워크스페이스 스코프 리소스, 독립 `/api/folders` top-level 엔드포인트, editor+ 게이트)의 Folder 만
  표에서 빠져 있다. NF-SC-02 가 "Folders 가드 적용" 을 이미 체크(✅)했다는 것은 §3.2 갱신이 애초에 예정돼 있었을
  가능성을 시사하며, 지금 상태로는 **RBAC 의 단일 진실 표에 구멍이 난 채로 다른 두 문서가 Folder RBAC 를
  전제**하고 있다.
- **제안**: `spec/5-system/1-auth.md` §3.2 표에 `Folder | CRUD | CRUD | CRUD | R` (Workflow/Trigger/Schedule
  과 동일 패턴) 행을 추가하거나, 최소한 Integration(Personal) 처럼 "SoT 는 `2-navigation/1-workflow-list.md`
  §3.1" 이라는 각주를 남겨 표가 Folder RBAC 를 의도적으로 다른 문서에 위임했음을 명시한다. `project-planner`
  가 `spec/5-system/1-auth.md` 를 함께 갱신하는 편이 맞다 (target 은 `2-navigation/` 스코프라 auth.md 를 직접
  건드리지 않는다).

### [INFO] Folder 목록 API 의 응답 envelope(페이지네이션 여부) 미기술 — 단, target 특유의 문제는 아님

- **target 위치**: `spec/2-navigation/1-workflow-list.md` §3.1 `GET /api/folders`.
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.2 "목록 응답" — 표준 목록 응답은
  `{ data: [...], pagination: {...} }` 이고, "비-페이징 고정 컬렉션" 예외는 `{ data: { items: [...] } }` 형태로
  **"활성 세션 목록, WebAuthn credential 목록"** 만 명시적으로 열거한다.
- **상세**: 같은 문서의 Workflow/Trigger/Schedule 목록 API 는 각각 "페이지네이션 응답 형식은 API 규약 §5.2
  준수" 를 명시 인용하는데, Folder 목록 API 는 `page`/`limit` 쿼리 파라미터 자체가 없고 §5.2 인용도 없다.
  실제 구현(`folders.controller.ts`)은 `ApiOkWrappedArrayResponse`(순수 배열 `{ data: [...] }`, `pagination`
  도 `items` 래핑도 없음)를 쓰는데, 이는 §5.2 가 정의하는 두 형태 중 어디에도 정확히 속하지 않는다. 다만 같은
  패턴(`ApiOkWrappedArrayResponse`)이 `nodes`·`edges`·`alerts`·`llm-model-config`·`workspaces` 등 다수
  컨트롤러에서 이미 repo 전역적으로 쓰이고 있어, 이는 **Folder 모듈이 새로 만든 이격이 아니라 §5.2 문서가
  실제 구현 관행을 전부 포착하지 못하고 있는 기존 격차**다. Folder 하나만 좁혀 고치는 것은 문제의 일부만
  덮는다.
- **제안**: 이번 target PR 범위에서 액션 불필요(기존 패턴을 그대로 따름). 다만 `spec/5-system/2-api-convention.md`
  §5.2 의 "비-페이징 고정 컬렉션" 예외 목록을 넓히거나 세 번째 형태로 문서화하는 별도 스윕이 필요하면
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 류 트래커에 얹는 편이 적절하다.

### 검증 후 충돌 없음으로 확인한 항목 (기록용)

- **Folder 데이터 모델** — `1-workflow-list.md` §3.1 의 `(workspace_id, parent_id, name)` UNIQUE·최대 깊이 5·
  `parent_id` CASCADE·같은 워크스페이스 한정·비순환 제약은 `spec/1-data-model.md` §2.5 Folder 정의와
  정확히 일치한다. `Workflow.folder_id` 의 SET NULL 동작(폴더 삭제 시 워크플로우는 루트로 이동)도 데이터
  모델의 `folder_id | UUID? | FK → Folder (SET NULL · 정리용)` 과 일치한다.
- **요구사항 ID** — `NAV-WF-07` 은 `_product-overview.md` 와 `1-workflow-list.md` Rationale §1 양쪽에서
  동일한 의미("팀 워크스페이스에서 공유된 워크플로우 구분 표시")로만 쓰인다. 다른 영역에서 재사용된 흔적 없음.
  Chat Channel·EIA 계열 rationale ID(R-CC-10, R-15 등)도 `2-trigger-list.md` 안에서 참조 방향이 일관됨.
- **§5.4 부재 표현 규약과 Folder `parentId`** — `plan/in-progress/folders-contract-e2e.md` 가 지적하는
  `FolderDto.parentId` 의 optional+nullable 이중 선언(§5.4 금지 조합)은 이미 알려진 버그이며, target spec
  본문(§3.1)이 이에 대해 침묵하는 것은 `spec/5-system/2-api-convention.md` §5.4 의 "기본은 `null`, 사유가
  있을 때만 문서화된 키 생략" 규칙과 **부합**한다(별도 key-omission 사유를 적을 필요가 없는 기본 케이스이므로
  spec 변경 불필요, plan 의 `spec_impact: none` 판단과 정합).
- **워크플로우 복제와 폴더 승계** — target §2.6/§3 은 "버전 이력·트리거·테스트 데이터셋은 승계하지 않는다"
  고만 말하고 폴더 승계 여부를 언급하지 않는다. `spec/data-flow/11-workflow.md` §1.5 는 복제 시 `folder_id`
  를 원본값 그대로 승계한다고 명시하는데, target 은 이 세부사항을 데이터 흐름 문서로 위임("데이터 흐름은
  data-flow §1.5 참고")하고 있어 침묵이 곧 모순은 아니다.

---

## 요약

target(`spec/2-navigation/`) 의 데이터 모델·API 계약·요구사항 ID 는 `spec/1-data-model.md`·
`spec/data-flow/11-workflow.md` 등 하위 데이터 흐름 문서와 정확히 맞아떨어진다. 유일한 실질적 간극은
Folder 리소스가 RBAC 의 단일 진실 표(`spec/5-system/1-auth.md` §3.2)에 등재되지 않은 채 두 문서
(`_product-overview.md` NF-SC-02, target 자신의 §3.1)가 Folder RBAC 적용을 이미 전제하고 있다는 점이다 —
직접적인 기능 마비를 일으키는 모순은 아니지만, RBAC 의 SoT 가 실제로 강제하는 리소스 목록보다 좁게
문서화되어 있어 명시적 동기화가 필요하다. 목록 응답 envelope 미기술은 Folder 고유 문제가 아니라 기존
repo 전역 관행과 `api-convention.md` §5.2 사이의 선재 격차이므로 이번 PR 범위 밖으로 분류했다.

## 위험도

LOW
