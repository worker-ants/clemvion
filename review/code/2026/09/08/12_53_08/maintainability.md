# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 거의 동형인 `it()` 블록 두 벌 — 파라미터화하지 않아 세 번째가 또 붙을 구조
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:59-64`(`repo-guards 는 빌드 대상이 아니다`) 와 `:78-83`(신규 `` `__test-utils__` 는 빌드 대상이 아니다 ``)
  - 상세: 두 테스트는 `resolveBuildFileNames(backendDir).filter((f) => f.includes(...)).map((f) => toPosixRelative(backendDir, f))` → `expect(inBuild).toEqual([])` 형태가 완전히 동일하고, 필터링에 쓰는 디렉터리 이름(`repo-guards` / `__test-utils__`)만 다르다. 이 파일·`tsconfig.build.json` 의 주석 자신이 "같은 이유의 세 번째 자리"·"경로를 열거하면 네 번째 자리가 또 생긴다" 고 이 패턴이 반복될 것을 이미 예견하고 있어, 다음에 네 번째 제외 디렉터리(`src/shared/testing` 등)가 같은 축으로 테스트를 요구하면 동일한 4~5줄 블록이 또 복붙될 가능성이 높다.
  - 제안: `it.each(['repo-guards', '__test-utils__'] as const)('%s 는 빌드 대상이 아니다', (dirName) => { ... })` 또는 작은 헬퍼 `expectExcludedFromBuild(dirName: string)` 로 추출. 이 파일 안에서도 `it.each` 패턴은 이미 프로젝트 관례로 쓰이고 있어(예: `workspaces.service.spec.ts`) 컨벤션 이탈이 아니다. 확장 비용을 O(1) 로 낮춘다.

- **[INFO]** 타입 선언 대비 과대한 rationale 산문 — 스캔 가독성 저하 가능성(기존 관례와 일치하므로 참고용)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetailProjection` 선언 바로 위 JSDoc(대략 라인 46-68, 실제 타입 본문은 라인 69-72 4줄)
  - 상세: 개명 배경을 설명하는 문단이 20줄을 넘어, 실제 타입 정의(4줄)의 5배 분량이다. 이 저장소는 결정 근거를 코드 옆에 남기는 관례가 확고해 이 자체가 새로운 결함은 아니고, 이번 diff 도 그 관례를 일관되게 따른다(동일 패턴이 `workspaces.service.ts`·`user-entity-exposure.spec.ts`·`workflows.ts`(frontend)에도 반복). 다만 이런 이력 주석이 서비스 파일마다 누적되면, 그 파일을 처음 여는 사람이 "무엇이 실제 선언인가"를 찾기까지 스크롤해야 하는 문서 대 코드 비율이 계속 커진다.
  - 제안: 지금 당장 조치 불요. 다음에 이 타입 주변을 다시 만질 기회가 있으면, 역사적 배경(왜 개명했는가, 과거 W3/W5 지적)은 plan/`review/**` 링크 한 줄로 축약하고 "현재 유효한 계약"만 JSDoc 에 남기는 것을 고려할 만하다.

## 요약

이번 배치는 8개 독립 항목(B-1~B-8)이 각각 작고 목적이 분명한 diff 로 나뉘어 있고, 리팩터링(`pgErrorConstraint`/`isPostgresUniqueViolation` SoT 재사용, `http-exception.filter.ts` 의 로컬 중복 함수 제거)은 오히려 중복을 줄이는 방향이다. 새로 추가된 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 기존 형제 가드(`user-entity-exposure-guard.ts`, `swagger-dto-contract-guard.ts`)와 동일한 구조·네이밍·문서화 규율을 따르고 있어 코드베이스 일관성이 높으며, 매직 넘버는 상수(`CONFLICT_WRAPPER`, `TRIGGER_REPOSITORY`)로 미리 방어돼 있다. 함수 길이·중첩 깊이·순환 복잡도 모두 정상 범위이며 새로 도입된 함수(`enclosingMethodName`, `isWrappedByConflictCatch`, `findTriggerRepositorySaves`)는 20~40줄 내외로 단일 책임을 유지한다. 실질적으로 지적할 만한 것은 `production-build-devdep.spec.ts` 의 파라미터화되지 않은 반복 `it()` 블록(추후 세 번째 사례가 예견됨) 정도이며, 그 외에는 이 저장소가 이미 확립한 "결정 근거를 코드 옆에 남긴다"는 문서화 관례를 일관되게 따르고 있어 새로운 유지보수성 리스크를 추가하지 않는다.

## 위험도

LOW
