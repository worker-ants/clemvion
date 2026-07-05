# 문서화(Documentation) Review — V-04 folder depth/cycle guard

## 발견사항

- **[INFO] CHANGELOG.md 미갱신**
  - 위치: `CHANGELOG.md` (repo root)
  - 상세: 이 저장소는 유사 스코프의 최근 변경들(workflow settings DTO 강화, orphan pending backstop 등)에 대해 `CHANGELOG.md`에 "Unreleased — ..." 섹션을 꾸준히 추가해 왔다. 이번 V-04(폴더 `update()` 계층 무결성 가드 추가 — 신규 400 실패 케이스 도입)도 API 소비자 관점에서 관찰 가능한 동작 변경(종전에는 통과하던 부모 변경 요청이 이제 400으로 거부될 수 있음)이라 동일한 카테고리에 해당하지만 CHANGELOG 항목이 추가되지 않았다.
  - 제안: `CHANGELOG.md`에 "PATCH /api/folders/:id 가 이제 parentId 변경 시 create()와 동일한 깊이/순환/workspace 검증을 강제한다"는 취지의 Unreleased 항목을 추가할지 검토. 다만 이 프로젝트는 PLAN 커밋 메시지 자체가 상세 rationale을 담는 관행(위 커밋 26abaf425 메시지 참고)이 있어 필수는 아닐 수 있음 — 팀 관례 확인 필요.

- **[INFO] Swagger `@ApiBadRequestResponse` 설명이 실패 사유를 나열하지 않아 `create()`와 비대칭**
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts` `update()` 메서드의 `@ApiBadRequestResponse({ description: '입력값 검증 실패' })`
  - 상세: `create()`의 동일 데코레이터는 `'입력값 검증 실패 또는 중첩 깊이 초과'`로 구체적 사유를 명시하는 반면, 이번에 갱신된 `update()`의 `@ApiOperation.description`은 상세 사유(깊이/순환/workspace)를 풍부하게 서술했지만 `@ApiBadRequestResponse`의 `description`은 갱신되지 않고 그대로 남아있다. Swagger UI에서 400 응답 블록만 보는 소비자는 구체적 실패 사유를 놓칠 수 있다. (이 항목은 이미 사전 consistency-check `convention_compliance.md`에서 INFO로 포착되어 있으나, 실제 커밋에서 코드 반영이 됐는지 재확인 차 기록.)
  - 상세 확인: 실제 diff를 보면 `@ApiOperation.description`만 갱신되고 `@ApiBadRequestResponse.description`은 변경되지 않았음(`folders.controller.ts` diff 라인 31-42 참조) — pre-existing 리뷰가 지적한 갭이 이번 구현에서도 그대로 남아있다.
  - 제안: `@ApiBadRequestResponse({ description: '입력값 검증 실패, 중첩 깊이 초과, 또는 순환/타 workspace parent' })` 등으로 `update()`의 400 응답 설명도 갱신해 `@ApiOperation.description`과 정합시킬 것을 권장 (낮은 비용의 후속 fix).

- **[INFO] `collectSubtree`의 `height` 정의가 JSDoc과 호출부 주석 사이에서 약간의 해석 차이 여지**
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `collectSubtree()` JSDoc (`rootId 레벨 = 1`) vs `validateParentChange()` 내 호출 시 인라인 주석(`서브트리 높이 확보`)
  - 상세: JSDoc은 "`rootId` 서브트리의 자손 id 집합과 높이(rootId 레벨 = 1)를 BFS로 수집한다"라고 설명한다. 실제 구현에서 `height`는 `rootId` 자신을 포함해 첫 순회(`height=1`)에서 자식이 없으면 leaf일 때도 1이 되고(테스트 `allows a valid shallow reparent`, `getDepth(p1)=1`이고 leaf `height=1`이라 `1+1=2≤5` 통과), `frontier`가 소진될 때까지 계속 증가하는 구조다. 코드 자체는 정확하지만, JSDoc의 "rootId 레벨 = 1"이라는 표현만으로는 "자손이 없는 leaf가 왜 height=1인지"(자기 자신도 카운트되는지, 자손이 추가될 때마다 +1되는지)가 즉시 명확하지 않다. 실제로는 while 루프가 `frontier`가 비기 전까지 매 iteration마다 `height++`을 먼저 수행하므로, `rootId`에 자손이 전혀 없어도 최소 1회 순회로 height=1이 된다.
  - 제안: 정확성 문제는 아니며 우선순위 낮음. 다만 `parentDepth + height > MAX_NESTING_DEPTH` 비교가 "새 부모의 깊이"와 "이동할 서브트리의 높이"를 합산하는 이유(즉 "새 부모 depth + 서브트리 height ≤ 5"가 정확히 무엇을 의미하는지 — 예: depth=부모까지의 경로 길이, height=서브트리 최심 노드까지 추가 단계 수)를 한 줄 예시로 덧붙이면 향후 유지보수자의 이해를 도울 수 있다 (예: "예: parent가 depth 3이고 이동할 서브트리 height가 2면 최심 노드는 depth 5로 허용 한계").

- **[INFO] `_product-overview.md` NAV-WF-06 상태 불일치는 이번 변경 스코프 밖(기록만)**
  - 위치: `spec/2-navigation/_product-overview.md` §3 (해당 diff 파일 목록에는 없으나 사전 consistency-check `convention_compliance.md`에서 WARNING으로 지적됨)
  - 상세: 이 이슈는 folder UI(V-05류)와 관련된 것으로, 이번 V-04(backend 계층 무결성 가드) 변경과는 무관하다고 `SUMMARY.md`/`convention_compliance.md`에 이미 명시적으로 스코프 아웃 처리되어 있다. 문서화 리뷰 관점에서도 이번 diff 세트에 해당 파일이 포함되지 않았으므로 이번 PR의 책임 범위가 아니다.
  - 제안: 조치 불필요 (기록용 확인).

## 준수 확인 (긍정적 사항)

- **Swagger `@ApiOperation.description` 갱신**: `PATCH /api/folders/:id`의 description이 새 검증 규칙(같은 workspace·비순환·최대 깊이 5, 위반 시 400 `VALIDATION_ERROR`)을 정확히 반영하도록 갱신되어 코드와 API 문서가 일치한다.
- **spec 동기화**: `spec/1-data-model.md §2.5`(제약 조건에 "생성·부모 변경 모두에 적용", "같은 워크스페이스", "비순환" 추가)와 `spec/2-navigation/1-workflow-list.md §3.1`(PATCH row에 검증 규칙·에러코드 명시)이 코드 변경과 같은 커밋에서 함께 갱신되어, spec-code 정합성이 구현 시점에 확보되었다. 이는 사전 consistency-check(`convention_compliance.md` WARNING (i))가 지적한 갭을 정확히 해소한 것이다.
- **인라인 주석 품질**: `folders.service.ts`의 신규 코드(`update()`, `getDepth()`, `validateParentChange()`, `collectSubtree()`)는 모두 "왜"를 설명하는 주석을 갖췄다 — 예: `update()`의 재검증 필요 이유(create만 깊이 검사, update는 종전 무검증), `getDepth()`의 visited-set 가드 이유(손상 데이터 cycle 방지), `validateParentChange()`의 JSDoc이 에러 코드 재사용 이유(`CONTAINER_CYCLE`/`CYCLE_DETECTED`와의 혼동 회피)까지 근거를 남겼다. 이는 오래된/부정확한 주석이 아니라 실제 코드와 완전히 일치하는 최신 주석이다.
- **테스트가 곧 실행 가능한 예제 역할**: `folders.service.spec.ts`에 추가된 8개 테스트 케이스(`update — parentId 재검증 (V-04)`)가 각 실패/성공 시나리오(자기 자신, 자손, 타 workspace, 깊이 초과, 루트 이동, 정상 reparent, cyclic 데이터 무한루프 미발생)를 구체적 mock 시퀀스와 함께 문서화해, 사용법·엣지케이스를 보여주는 예제 코드 역할을 겸한다.
- **에러 코드 명명 규약 준수**: 신규 cycle 에러에 별도 코드를 만들지 않고 기존 `VALIDATION_ERROR`를 재사용한 결정과 그 근거(`CONTAINER_CYCLE`/`CYCLE_DETECTED`와의 레이어 혼동 회피)가 JSDoc에 명시되어, 향후 리뷰어나 유지보수자가 "왜 새 코드를 안 만들었는지" 재질문할 필요가 없다.
- **커밋 메시지 자체가 상세 rationale 문서 역할**: 커밋 26abaf425의 메시지가 문제 상황(cycle이 무한루프/DoS 유발 가능), 해결 방법, spec 동기화 내용, 테스트 커버리지, consistency-check 결과까지 포괄적으로 기록해 별도 CHANGELOG 없이도 변경 이력 추적이 가능한 수준이다.

## 요약

이번 변경은 문서화 관점에서 매우 모범적이다. spec(`data-model.md`, `1-workflow-list.md`)과 Swagger(`@ApiOperation.description`)가 코드 변경과 같은 커밋에서 동시에 갱신되어 spec-code 정합성 갭이 남지 않았고, 신규 private 메서드(`validateParentChange`, `collectSubtree`)에는 "무엇을" 뿐 아니라 "왜"(에러 코드 재사용 이유, 가드 순서 이유)를 설명하는 JSDoc/인라인 주석이 충실히 달려 있으며, 사전 consistency-check가 지적한 두 WARNING(update 미검증, 에러 코드 네이밍 충돌 위험)이 정확히 해소됐다. 유일하게 남은 소소한 갭은 `@ApiBadRequestResponse`의 description이 `@ApiOperation.description`만큼 구체적으로 갱신되지 않아 `create()`와 비대칭이라는 점(사전 리뷰에서도 INFO로 이미 포착된 기지 갭)과, 이 저장소의 최근 관행(CHANGELOG.md Unreleased 섹션 추가)에 비춰 이번 변경도 CHANGELOG 항목을 남길지 검토할 여지가 있다는 점 정도이며, 둘 다 CRITICAL/WARNING 수준이 아닌 INFO다.

## 위험도

LOW
