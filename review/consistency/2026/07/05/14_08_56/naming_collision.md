# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-prep, folder-depth-cycle-guard)

## 검토 개요

`--impl-prep` 모드로 전달된 target 은 `spec/2-navigation/` 폴더 전체(`0-dashboard.md` ~ `2-trigger-list.md`) 및 참조 문서(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/*`)의 **현재 baseline** 이며, 신규 spec diff 는 아직 없다. 워크트리명(`folder-depth-cycle-guard`)과 코드 기반 확인 결과, 실제 구현 대상은 `FoldersService.update()`(PATCH `/api/folders/:id`, 재-부모 지정 reparenting)에 대해 현재 `create()` 에만 있는 깊이 검증(`MAX_NESTING_DEPTH=5`)과, 아직 어디에도 없는 **순환(cycle) 가드**를 추가하는 작업으로 판단된다 (`codebase/backend/src/modules/folders/folders.service.ts` 확인).

이 관점에서, target 문서 자체가 새 식별자를 아직 선언하지 않았으므로 "완전히 새로 만들어진 식별자와 기존 식별자의 충돌"은 검출되지 않는다. 대신 구현 착수 시 도입될 것으로 예견되는 식별자(에러 코드 등)가 **기존에 이미 쓰이고 있는 유사 개념의 식별자와 충돌할 위험**을 사전 점검했다.

---

### 발견사항

- **[WARNING]** 폴더 순환(cycle) 에러 코드 신설 시 기존 `CONTAINER_CYCLE` / `CYCLE_DETECTED` 와 네이밍·의미 혼동 가능
  - target 신규 식별자: (미확정) 폴더 `parent_id` 순환 방지를 위해 구현자가 새로 붙일 가능성이 높은 에러 코드 — 예: `CYCLE_DETECTED`, `FOLDER_CYCLE`, `CIRCULAR_REFERENCE` 등
  - 기존 사용처:
    - `spec/5-system/3-error-handling.md` §1.4 — `CYCLE_DETECTED` = "워크플로우 그래프에 순환 감지" (엔진 레벨, 노드/엣지 그래프 스코프)
    - `spec/1-data-model.md` §2.6 Node 제약 조건 — `container_id` 체인 순환 시 `CONTAINER_CYCLE` 에러 (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6196`)
    - `spec/3-workflow-editor/0-canvas.md`, `spec/data-flow/11-workflow.md` 등 다수 문서가 `CONTAINER_CYCLE` 을 참조
  - 상세: 폴더 계층(`Folder.parent_id`)의 순환 방지는 워크플로우 그래프 순환(`CYCLE_DETECTED`)이나 컨테이너 노드 체인 순환(`CONTAINER_CYCLE`)과 도메인이 완전히 다르다(폴더 조직 구조 vs 실행 그래프). 만약 구현자가 이름을 그대로 `CYCLE_DETECTED` 로 재사용하면 — 같은 코드값이 "워크플로우 그래프 순환"과 "폴더 계층 순환"이라는 서로 다른 의미로 응답 envelope 에 나타나 클라이언트가 오분기할 수 있다(에러 코드는 의미로 분기하는 계약, [`conventions/error-codes.md` §1](../../../../spec/conventions/error-codes.md)). `CONTAINER_CYCLE` 을 그대로 차용해도 마찬가지로 "container_id 체인"이라는 이름의 의미가 거짓이 된다.
  - 제안: 폴더 전용 신규 코드를 신설한다(예: `FOLDER_CYCLE` 또는 `FOLDER_HIERARCHY_CYCLE`, `<DOMAIN>_<CONDITION>` 컨벤션 준수, [`conventions/error-codes.md` §1](../../../../spec/conventions/error-codes.md)). 폴더 생성(POST) 이 깊이 초과에 이미 `VALIDATION_ERROR`(범용 코드, prefix 없음)를 쓰고 있으므로, PATCH 재-부모 지정의 순환 검증도 **generic `VALIDATION_ERROR`(400) 재사용**을 우선 검토하되(현재 depth-exceeded 와 동일 패턴 유지), 클라이언트가 "깊이 초과"와 "순환"을 구분해 안내해야 한다면 `FOLDER_CYCLE` 같은 전용 코드를 신설하고 `spec/5-system/3-error-handling.md` §1.3 유효성 검증 에러 표에 등재한다. `CONTAINER_CYCLE`/`CYCLE_DETECTED` 재사용은 피할 것.

- **[INFO]** PATCH `/api/folders/:id` 재-부모 지정 시 깊이·순환 가드가 spec 본문에 아직 명시되지 않음
  - target 신규 식별자: 해당 없음(아직 미도입) — 다만 `spec/2-navigation/1-workflow-list.md` §3.1 "폴더 관리 API" PATCH 행은 "이름·부모·정렬 순서 부분 수정"만 언급하고 깊이/순환 검증 언급이 없다
  - 기존 사용처: `spec/1-data-model.md` §2.5 Folder "제약 조건" — "중첩 깊이 제한: 최대 5단계"만 기술, PATCH 시나리오(재-부모 지정으로 인한 깊이 재계산·순환 발생)는 spec 문면에 없음. 코드도 `create()` 만 깊이 검사(`getDepth`), `update()` 는 `Object.assign` 후 그대로 저장(깊이·순환 미검증) — `codebase/backend/src/modules/folders/folders.service.ts:60-68`
  - 상세: 이는 identifier 충돌이 아니라 spec-impl 갭이지만, 향후 신규 식별자(에러 코드·검증 로직 이름)가 도입될 지점이므로 명명 검토 시점에 인지해 둘 필요가 있다. 구현 착수 전 `spec/2-navigation/1-workflow-list.md` §3.1 PATCH 행 또는 `spec/1-data-model.md` §2.5 제약 조건에 "재-부모 지정 시 깊이 재계산·순환 검사" 문구를 먼저 추가하는 편이, 코드부터 작성 후 소급 문서화하는 것보다 이번 project 의 SDD 규약에 부합한다.
  - 제안: 구현 착수 전에 spec 을 먼저 갱신(project-planner 영역)해 어떤 에러 코드·HTTP status 를 쓸지 명문화한 뒤 구현. 신규 코드가 필요하면 위 WARNING 제안(`FOLDER_CYCLE` 등)을 그 시점에 확정.

- **[INFO]** 폴더 엔티티/DTO 명은 기존 영역과 충돌 없음
  - target 신규 식별자: `Folder`, `FoldersService`, `CreateFolderDto`, `UpdateFolderDto`, `FolderResponseDto` (기존 이미 존재, 신규 아님)
  - 기존 사용처: `codebase/backend/src/modules/folders/**`, `spec/1-data-model.md` §2.5
  - 상세: `Folder` 라는 이름이 다른 도메인(예: 파일 스토리지 폴더, KnowledgeBase 문서 폴더 등)에서 이미 다른 의미로 쓰이는지 확인했으나, `spec/1-data-model.md` 전체에서 `Folder` 엔티티는 워크플로우 조직용 단일 정의로만 존재한다(§2.4 Workflow.folder_id 참조, §2.12 Document/KnowledgeBase 는 별도 계층 없음). 충돌 없음.
  - 제안: 해당 없음 — 현행 유지.

---

### 요약

target(`spec/2-navigation/`)은 아직 신규 spec 변경을 담고 있지 않아 이번 검토 시점에는 확정적인 신규 식별자 충돌이 존재하지 않는다. 다만 폴더-깊이-순환-가드(`folder-depth-cycle-guard`) 구현이 임박한 정황(코드에 `create()` 만 깊이 검증하고 `update()` 는 무검증인 갭 존재)을 근거로, 구현 시 도입될 가능성이 높은 "순환 감지" 에러 코드가 기존 `CONTAINER_CYCLE`(노드 컨테이너 체인)·`CYCLE_DETECTED`(워크플로우 그래프)와 이름·의미가 겹치지 않도록 사전 주의가 필요하다(WARNING 1건). 이는 target 문서 자체의 결함이라기보다 향후 구현·spec 갱신 단계에서 지켜야 할 가드레일이며, 즉각적인 차단 사유는 아니다.

### 위험도

LOW
