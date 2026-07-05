# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

## 검토 모드
구현 착수 전 검토 (`--impl-prep`, scope=`spec/2-navigation/`)

## 구현 컨텍스트 (orchestrator 제공)
`FoldersService.update()` (parentId 변경 경로) 에 깊이/순환(cycle)/워크스페이스 검증을 추가하고, `getDepth()` 에 방문 노드 visited-set 가드를 추가해 무한 루프를 방지한다. `spec/1-data-model.md §2.5 Folder` 는 "최대 중첩 깊이 5" 를 명시하고, `spec/2-navigation/1-workflow-list.md §3.1` PATCH 엔드포인트는 parent 변경을 허용한다. spec-code-cross-audit **V-04** 를 닫는 작업이며, cycle/workspace 가드는 code-only(spec 문서 변경 의도 없음) 로 명시됨.

target 문서(`spec/2-navigation/` 영역, 특히 `0-dashboard.md` / `1-workflow-list.md` / `10-auth-flow.md` 등)는 이번 검토 draft 로 제공됐으나, 실질적으로 이번 구현이 건드리는 범위는 `1-workflow-list.md §3.1 폴더 관리 API` 한 곳이며 코드 변경은 spec 변경을 동반하지 않는다고 명시되어 있다. 아래는 이 변경이 다른 영역 spec 과 충돌하는지에 대한 분석이다.

---

## 코드 현황 확인 (구현 착수 전 baseline)

`codebase/backend/src/modules/folders/folders.service.ts` 를 직접 확인한 결과, 현재 `update()` 는 아래와 같이 `parentId` 변경 시 어떤 검증도 수행하지 않는다:

```ts
async update(
  id: string,
  workspaceId: string,
  data: Partial<Folder>,
): Promise<Folder> {
  const folder = await this.findById(id, workspaceId);
  Object.assign(folder, data);
  return this.folderRepository.save(folder);
}
```

- 깊이 검증 없음 (`create()` 에는 있으나 `update()` 에는 없음 — `MAX_NESTING_DEPTH = 5` 미적용).
- 순환(cycle) 검증 없음 — `parentId` 를 자기 자신의 자손으로 재설정해도 차단되지 않음.
- 워크스페이스 검증 없음 — `parentId` 가 다른 workspace 소속 Folder 를 가리켜도 차단 안 됨(현재 `getDepth()` 내부 조회는 `workspaceId` 로 필터링하므로 다른 workspace 의 folder 를 parent 로 지정하면 `getDepth` 순회가 즉시 끊겨 깊이를 과소평가하거나, cross-workspace FK 참조가 그대로 저장될 위험).
- `getDepth()` 는 `while (currentId)` 루프에 방문 집합이 없어, `parentId` 체인에 순환이 생기면 무한 루프(또는 매우 긴 순회)로 이어진다.

이는 orchestrator 가 제공한 구현 컨텍스트와 정확히 일치하며, target 변경은 기존 spec 문언(§2.5 "최대 중첩 깊이 5", §3.1 PATCH 허용)을 **구현으로 뒤늦게 충족**시키는 것이지 spec 의미를 바꾸는 것이 아니다.

---

## 발견사항

### [INFO] PATCH 엔드포인트의 400 사유가 POST 대비 API 문서·Swagger 상 불명확
- target 위치: `spec/2-navigation/1-workflow-list.md §3.1` 표 — `PATCH /api/folders/:id` 행 ("이름·부모·정렬 순서 부분 수정")
- 충돌 대상: 같은 §3.1 의 `POST /api/folders` 행 ("깊이 5 초과 시 400 `VALIDATION_ERROR`, ... 409 `RESOURCE_CONFLICT`") 및 `codebase/backend/src/modules/folders/folders.controller.ts` 의 Swagger 데코레이터(`create()` 는 `@ApiBadRequestResponse({ description: '입력값 검증 실패 또는 중첩 깊이 초과' })`, `update()` 는 `@ApiBadRequestResponse({ description: '입력값 검증 실패' })` 로 깊이/순환 사유가 빠져 있음)
- 상세: spec §3.1 표는 POST 행에서만 "깊이 5 초과 시 400" 을 명시하고, PATCH 행은 단순히 "부분 수정" 이라고만 적는다. 이번 구현으로 PATCH 에도 깊이/순환/workspace 위반 시 400 `VALIDATION_ERROR` 가 추가되면, spec 표와 컨트롤러 Swagger 문서 모두 실제 동작(POST 와 대칭적으로 PATCH 도 깊이/순환 검증)을 반영하지 못하게 된다. 데이터 모델(§2.5)의 "최대 중첩 깊이 5" 제약은 엔티티 레벨 불변식이므로 create/update 양쪽에 동일하게 적용되어야 자연스럽고, 이번 구현은 그 해석과 일치한다 — 다만 문서가 POST 에만 명시되어 있어 "PATCH 는 깊이 제한을 적용하지 않는다" 는 오독의 여지가 있었다(V-04 자체가 이 갭을 지적).
- 제안: 구현과 함께(또는 직후) `spec/2-navigation/1-workflow-list.md §3.1` PATCH 행에 "부모 변경 시 깊이 5 초과·순환 참조·타 workspace 폴더 지정 시 400 `VALIDATION_ERROR`" 문구를 POST 행과 대칭으로 추가할 것을 권장. 컨트롤러의 `@ApiBadRequestResponse` 설명도 `create()` 와 동일하게 갱신 권장. 다만 오케스트레이터가 "spec 변경 없음" 으로 스코프를 명시했으므로, 이 갱신은 이번 PR 의 필수 차단 사유는 아니며 별도 문서 동기화 후속으로 처리 가능.

### [INFO] "순환 참조 차단"·"타 workspace 부모 금지" 가 §2.5 제약 조건 목록에 명시적으로 나열되어 있지 않음
- target 위치: `spec/1-data-model.md §2.5 Folder` — "제약 조건" 불릿 목록 (`(workspace_id, parent_id, name)` UNIQUE, 중첩 깊이 5)
- 충돌 대상: 없음 (직접 모순은 아님) — 다만 이번 구현이 강제하려는 두 불변식(같은 workspace 소속만 parent 가능, 순환 금지)이 §2.5 문언에는 암묵적으로만 함의되어 있다.
- 상세: `parent_id | UUID? | FK → Folder` 표기와 `workspace_id UNIQUE` 제약으로부터 "parent 는 같은 workspace 소속이어야 한다"·"parent 체인은 acyclic 해야 한다"는 상식적으로 유추 가능하지만, 다른 엔티티(예: `spec/1-data-model.md` 의 여러 FK) 처럼 "정책"으로 명문화되어 있지는 않다. 이는 spec 과 모순되는 것이 아니라 **spec 이 코드가 강제하려는 불변식을 완전히 텍스트화하지 않은 상태**이며, 향후 유사한 spec-code-cross-audit 재발을 막으려면 문서화가 유용하다.
- 제안: 필수는 아니나, `spec/1-data-model.md §2.5` 제약 조건 목록에 "parent_id 는 동일 workspace_id 소속 Folder 만 참조 가능(cross-workspace 금지)", "parent 체인은 비순환(acyclic)이어야 함" 두 항목을 추가하면 데이터 모델 문서가 실제 불변식을 완전히 반영하게 된다. 이번 구현 스코프(code-only)와는 독립적으로 project-planner 트랙에서 처리 가능.

### [INFO] RBAC 등급(`editor`+) 은 이번 변경과 충돌 없음 — 확인만
- target 위치: `spec/2-navigation/1-workflow-list.md §3.1` PATCH 행 — "폴더 수정 (`editor`+)"
- 충돌 대상: `codebase/backend/src/modules/folders/folders.controller.ts` `@Roles('editor')` on `update()`, `spec/5-system/_product-overview.md` NF-SC-02 (Folders 가드 적용 명시)
- 상세: 이번에 추가되는 것은 `FoldersService.update()` 내부의 데이터 무결성 검증(깊이/순환/workspace)이며, 컨트롤러 레벨의 `@Roles('editor')` 가드에는 변경이 없다. RBAC 관점 충돌 없음 — 정보성으로만 기록.
- 제안: 없음(변경 불필요).

---

## 요약

이번 구현(`FoldersService.update()` 의 depth/cycle/workspace 검증 + `getDepth()` visited-set 가드)은 `spec/1-data-model.md §2.5 Folder` 의 "최대 중첩 깊이 5" 제약과 `spec/2-navigation/1-workflow-list.md §3.1` 의 PATCH 계약을 **위반하지 않고 오히려 기존에 문서화된 불변식을 코드로 뒤늦게 충족**시키는 변경이다. 코드 현황을 직접 확인한 결과 `update()` 는 현재 어떤 검증도 없어 구현 컨텍스트가 정확하며, RBAC(`editor`+ 가드)·데이터 모델 엔티티 정의·다른 API 계약과 직접 모순되는 지점은 없다. 다만 spec §3.1 표가 POST 행에만 깊이 초과 400 사유를 명시하고 PATCH 행에는 명시하지 않아 문서-코드 대칭성이 다소 아쉬우며, §2.5 제약 조건 목록도 "동일 workspace 소속 parent"·"비순환" 불변식을 텍스트로 완전히 박아두지 않았다 — 둘 다 CRITICAL/WARNING 급 충돌이 아닌 INFO 수준의 문서 동기화 권고이며, 오케스트레이터가 명시한 "spec 변경 없음" 스코프와도 상충하지 않으므로 이번 구현 착수를 차단할 사유는 없다.

## 위험도
LOW
