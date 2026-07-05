# Cross-Spec 일관성 검토 — target: spec/2-navigation/ (V-04 folder depth/cycle guard)

## 검토 대상 요약

- diff-base `origin/main` 대비 변경: `codebase/backend/src/modules/folders/folders.service.ts`(+87), `folders.controller.ts`(Swagger 설명 갱신), `folders.service.spec.ts`(+201, 신규 unit), `spec/1-data-model.md`(§2.5 Folder 제약 3줄 보강), `spec/2-navigation/1-workflow-list.md`(§3.1 PATCH /api/folders/:id 설명 보강).
- 내용: `PATCH /api/folders/:id` 의 `parentId` 변경(재부모화) 시 create() 와 동일한 계층 무결성 검증(같은 워크스페이스 소속, 자기·자손 비순환, 최대 깊이 5)을 신규 적용. 위반 시 기존 `VALIDATION_ERROR`(400)를 재사용. `getDepth`/`collectSubtree` 에 방문 가드를 추가해 손상 데이터(cycle)에서도 무한루프 방지.
- target 문서(`spec/2-navigation/1-workflow-list.md` §3.1)는 `spec/1-data-model.md §2.5 Folder` 를 엔티티·제약의 SoT 로 명시 참조하는 구조를 유지한 채, 두 문서를 동시에 갱신했다.

## 발견사항

### 데이터 모델 정합성 — 문제 없음

`spec/1-data-model.md` §2.5 의 제약 문구(`중첩 깊이 제한: 최대 5단계 (생성·부모 변경 모두에 적용)`, `parent_id 는 같은 워크스페이스의 폴더만 가리킨다`, `계층은 비순환`)와 `spec/2-navigation/1-workflow-list.md` §3.1 의 PATCH 엔드포인트 설명(`새 부모가 같은 워크스페이스에 없거나, 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 VALIDATION_ERROR`)이 1:1 대응한다. 두 문서가 같은 커밋에서 함께 갱신되어 SoT(데이터 모델) ↔ API 설명(내비게이션) 간 stale drift 가 없다.

코드(`folders.service.ts` `validateParentChange`/`collectSubtree`/`getDepth`)도 위 문구와 정확히 일치 — `newParentId === id` 자기참조 차단, 타 워크스페이스 조회(`where: { id: newParentId, workspaceId }`)로 교차 워크스페이스 차단, `collectSubtree` 로 자손 이동 차단, `parentDepth + height > MAX_NESTING_DEPTH` 로 깊이 5 초과 차단. spec-코드 간 괴리 없음.

### 에러 코드 재사용 — 신규 코드 미도입, 충돌 없음 (검증됨)

target 은 신규 에러 코드를 만들지 않고 기존 `VALIDATION_ERROR`(400, `spec/5-system/3-error-handling.md:54`)를 재사용한다. 코드 주석(`folders.service.ts` validateParentChange docstring)에서도 "신규 cycle 코드를 도입하지 않아 `CONTAINER_CYCLE`(노드 컨테이너, `spec/3-workflow-editor/0-canvas.md`/`spec/data-flow/11-workflow.md`)·`CYCLE_DETECTED`(워크플로우 그래프, `spec/5-system/3-error-handling.md:79`)와의 혼동을 피한다"고 명시적으로 근거를 남겼다. 세 도메인(폴더 계층 / 컨테이너 중첩 / 그래프 순환)이 이름이 비슷한 자체 순환 개념을 각각 가지고 있으나, 코드 네임스페이스가 겹치지 않도록 의도적으로 설계되어 있어 요구사항 ID·에러 코드 충돌 없음.

### RBAC — 기존 규칙과 일치

폴더 생성/수정/삭제는 기존과 동일하게 `editor+` 권한을 요구하며(`spec/2-navigation/1-workflow-list.md` §3.1, 코드 `@Roles('editor')` 변경 없음), 이번 변경은 검증 로직만 추가했을 뿐 RBAC 경계를 건드리지 않는다. 다른 영역(`spec/5-system/17-agent-memory.md` 등)의 `editor+` 관례와도 일치.

### 계층 책임 — 변경 없음

검증 로직은 `folders.service.ts` 내부(백엔드 서비스 계층)에 그대로 유지되고, 프론트엔드는 여전히 이 API 를 소비하지 않는다(§3.1 "미구현 (Planned)" 문구 유지). 계층 책임 분할에 변화 없음.

### [INFO] 프론트엔드 폴더 UI 미구현 상태와의 관계 — 정보성, 조치 불요

`spec/2-navigation/1-workflow-list.md` §3.1 은 폴더 API 전체가 "백엔드 구현 완료, 프론트엔드 미소비" 상태임을 명시하고 있고, 이번 target 변경도 순수 백엔드 검증 강화라 이 상태 설명과 모순되지 않는다. 향후 프론트엔드가 폴더 이동 UI 를 붙일 때 이 400 에러(자기참조/타워크스페이스/깊이초과)를 사용자 메시지로 매핑해야 한다는 점만 참고용으로 남긴다 — 현재 target 범위에서 조치 불필요.

## 요약

target(`spec/2-navigation/1-workflow-list.md` §3.1 PATCH `/api/folders/:id` 및 `spec/1-data-model.md` §2.5 Folder)은 같은 커밋에서 데이터 모델 제약과 API 설명을 동기화했고, 코드(`folders.service.ts`)도 정확히 그 문구를 구현한다. 신규 에러 코드를 만들지 않고 기존 `VALIDATION_ERROR` 를 재사용했으며, 이름이 유사한 다른 도메인의 순환 에러 코드(`CONTAINER_CYCLE`, `CYCLE_DETECTED`)와 의도적으로 구분해 혼동을 피했다는 근거까지 코드 주석에 남겨져 있다. RBAC(`editor+`)·계층 책임 분할 모두 기존 결정과 일치한다. Cross-spec 관점에서 검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 어느 것도 다른 spec 영역과 모순되지 않는다.

## 위험도

NONE
