# Security Review — V-04 folder depth/cycle guard

리뷰 대상: `codebase/backend/src/modules/folders/{folders.controller.ts, folders.service.ts, folders.service.spec.ts}`, 관련 spec 문서(`spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`), 그리고 `review/consistency/**` 산출물(문서 파일, 코드 아님).

## 발견사항

- **[INFO]** DoS 관점의 무한루프/과다 쿼리 방지 로직이 적절히 도입됨
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `getDepth()` (L84-97), `collectSubtree()` (L109-129)
  - 상세: 기존 `getDepth()`는 손상된(cycle) parent 체인 데이터가 있으면 무한루프에 빠질 수 있었다(가용성 리스크 — 단일 malformed row 로 요청 스레드/DB 커넥션을 영구 점유). 이번 변경은 `visited` Set 과 `depth > MAX_NESTING_DEPTH + 1` 상한 가드를 추가해 종료를 보장한다. 신규 `collectSubtree()` 도 BFS 에 `height <= MAX_NESTING_DEPTH` 상한을 둬 동일한 보호를 적용했다. 정상적인 정합 데이터에서는 애초에 cycle 이 생기지 않아야 하지만(신규 코드가 `validateParentChange`로 이를 차단), 과거 데이터 손상이나 race condition으로 인한 기존 cycle 에 대한 방어적 가드로서 타당하다.
  - 제안: 없음 (현재 구현으로 충분).

- **[INFO]** 멀티테넌시(workspace) 스코핑이 신규 코드 전 경로에서 일관되게 적용됨
  - 위치: `folders.service.ts` `validateParentChange()` L119-122 (`findOne({ where: { id: newParentId, workspaceId } })`), `collectSubtree()` L112-113 (`find({ where: frontier.map((pid) => ({ parentId: pid, workspaceId })) })`)
  - 상세: 신규 parent 조회·서브트리 수집 쿼리 모두 컨트롤러에서 전달되는 `workspaceId`(인증된 사용자의 워크스페이스, `@WorkspaceId()` 데코레이터로 주입, 사용자 입력이 아님)로 필터링된다. 이로써 "다른 워크스페이스의 폴더를 parentId로 지정해 크로스 테넌트 참조/정보 노출을 시도"하는 IDOR 류 공격이 `RESOURCE_NOT_FOUND` 유사 처리(사실은 400 VALIDATION_ERROR "Parent folder not found in this workspace")로 정상 차단된다. 존재 여부와 무관하게 동일한 에러 메시지("Parent folder not found in this workspace")를 반환하므로, 다른 워크스페이스에 해당 UUID가 실제로 존재하는지 여부를 오라클처럼 구분해 알려주지 않는다(존재/비존재 모두 400 동일 메시지) — 이 부분은 양호.
  - 제안: 없음.

- **[INFO]** 입력 검증(`parentId`)이 컨트롤러 계층에서 UUID 형식으로 강제됨
  - 위치: `codebase/backend/src/modules/folders/dto/update-folder.dto.ts` `@IsUUID()` on `parentId`, 전역 `CustomValidationPipe`(`whitelist: true, forbidNonWhitelisted: true`, `codebase/backend/src/common/pipes/validation.pipe.ts`)
  - 상세: `parentId`는 `@IsUUID()`로 형식이 강제되고, 전역 파이프의 `forbidNonWhitelisted: true`로 인해 DTO에 선언되지 않은 필드(예: `workspaceId` 직접 지정 시도)는 400으로 거부된다. 따라서 서비스의 `Object.assign(folder, data as Partial<Folder>)`(컨트롤러에서의 캐스팅)에도 불구하고 mass-assignment 로 `workspaceId`, `id` 등 민감 필드를 덮어쓸 경로는 없다. 리뷰 대상 diff 자체가 이 방어선을 변경하지 않았음을 확인.
  - 제안: 없음. (참고: `dto as Partial<Folder>` 캐스팅은 타입 안전성 관점에서 다소 느슨하나 이는 이번 diff 범위 밖의 기존 코드이며, whitelist 검증이 실질적 방어를 제공하므로 보안 임계도는 낮음.)

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `validateParentChange()`의 각 `BadRequestException` 호출 (L104-108, L110-114, L124-128, L131-135)
  - 상세: 모든 에러가 정적 메시지("A folder cannot be its own parent", "Parent folder not found in this workspace" 등)이며 SQL 오류, 스택 트레이스, 내부 경로, 타 사용자 데이터 등을 포함하지 않는다. `code: 'VALIDATION_ERROR'`로 일관되어 있어 (naming_collision 체커가 지적했듯) 신규 에러 코드를 도입하지 않고 기존 `create()` 패턴을 재사용한 점도 공격자에게 내부 구현 추정 단서를 추가로 주지 않는 방향이라 안전 측.
  - 제안: 없음.

- **[INFO]** 테스트 코드(`folders.service.spec.ts`)는 신규 검증 로직·무한루프 가드에 대한 유닛 커버리지를 제공하며, 자체적으로 보안 취약점을 유발하지 않음
  - 위치: `folders.service.spec.ts` L450-598 (신규 `describe('update — parentId 재검증 (V-04)')` 블록)
  - 상세: 하드코딩된 시크릿·자격증명 없음(모두 목업 UUID 문자열 `f1`, `p1`, `ws-uuid-1` 등). cycle 데이터를 이용한 무한루프 가드 회귀 테스트(`getDepth terminates on cyclic parent chain`)가 포함되어 있어 이번 가용성 방어가 회귀되지 않도록 보장한다.
  - 제안: 없음.

- **[INFO]** 리뷰 대상에 포함된 `review/consistency/**` 산출물 및 spec 문서 변경은 정적 마크다운/JSON 문서로, 실행되는 코드나 시크릿을 포함하지 않음
  - 위치: `review/consistency/2026/07/05/14_08_56/*.md`, `_retry_state.json`, `meta.json`, `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`
  - 상세: grep 결과 API 키/토큰/자격증명 패턴 없음. 리뷰 대상 자체가 보안 검토 프로세스의 산출물이며 코드 변경에 대응하는 문서화이다.
  - 제안: 없음.

## 요약
이번 변경(V-04: 폴더 `update()` 시 parentId 재검증 — 워크스페이스 일치·비순환·최대 깊이 5 강제, 그리고 `getDepth()`/신규 `collectSubtree()`의 방문 가드)은 순수하게 방어적 성격의 개선이다. 모든 신규 DB 조회가 인증된 컨텍스트의 `workspaceId`로 스코핑되어 있어 크로스 테넌트 참조나 IDOR 가능성이 없고, 입력은 기존 전역 `class-validator` 파이프(`whitelist`+`forbidNonWhitelisted`)와 `@IsUUID()`로 검증되며, 에러 메시지는 민감 정보를 노출하지 않고 기존 에러 코드 체계를 재사용한다. 손상 데이터로 인한 parent-chain cycle에서의 무한루프(가용성/DoS 리스크)를 `visited` Set과 깊이 상한으로 방지한 점이 이번 변경의 핵심 보안 가치이며, 새로 도입된 취약점은 발견되지 않았다.

## 위험도
NONE
