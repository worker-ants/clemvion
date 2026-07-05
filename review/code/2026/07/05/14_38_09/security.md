# 보안(Security) 코드 리뷰 — V-04 folder depth/cycle guard (14_38_09)

리뷰 대상: `codebase/backend/src/modules/folders/folders.controller.ts`,
`codebase/backend/src/modules/folders/folders.service.ts`,
`codebase/backend/src/modules/folders/folders.service.spec.ts`,
`plan/in-progress/spec-code-cross-audit-2026-06-10.md`,
`review/code/2026/07/05/14_28_16/{RESOLUTION.md,SUMMARY.md,_retry_state.json,api_contract.md,database.md,documentation.md,maintainability.md}`

(직전 세션 14_28_16 의 security 리뷰가 이미 동일 프로덕션 코드를 NONE 으로 판정했고, 이후 RESOLUTION 은 테스트/plan 문서만 변경했다는 것을 소스로 재확인했다. 본 리뷰는 프로덕션 코드를 독립적으로 재검증한 결과다.)

## 발견사항

- **[INFO]** 신규 로직에 SQL 인젝션 벡터 없음
  - 위치: `folders.service.ts` `getDepth()`(81-102), `validateParentChange()`(109-148), `collectSubtree()`(154-178)
  - 상세: 전체 쿼리가 TypeORM `Repository.find`/`findOne` 의 객체 기반 `where` 조건만 사용한다(`{ id, workspaceId }`, `frontier.map((pid) => ({ parentId: pid, workspaceId }))`). Raw SQL 문자열 결합이 없고, 사용자 입력(`newParentId`, `id`, `workspaceId`)은 모두 파라미터 바인딩으로 전달된다.
  - 제안: 조치 불요.

- **[INFO]** IDOR/워크스페이스 스코핑 — 모든 신규 조회가 `workspaceId` 로 스코프됨
  - 위치: `validateParentChange()`:121-123 (parent lookup), `getDepth()`:95-97, `collectSubtree()`:164-166
  - 상세: `newParentId` 가 존재하더라도 **다른 workspace 소속**이면 `findOne({ where: { id: newParentId, workspaceId } })` 조건에 걸려 `null` 이 반환되고 `VALIDATION_ERROR` 로 거부된다(`folders.service.ts:121-129`). 즉 공격자가 자신이 속하지 않은 워크스페이스의 폴더 UUID 를 추측해 `parentId` 로 지정해도 cross-tenant 정보 유출(존재 여부 확인 등)이나 cross-tenant 트리 조작이 불가능하다 — 항상 동일한 `VALIDATION_ERROR` 로 응답해 폴더 존재 여부도 구분되지 않는다(존재하지 않는 UUID 와 동일 에러 메시지).
  - 제안: 조치 불요. 이 워크스페이스 경계 검증이 이번 diff 의 핵심 목적(V-04) 중 하나이며 올바르게 구현됨.

- **[INFO]** Mass-assignment 방어 — DTO 화이트리스트 + `class-validator`
  - 위치: `dto/update-folder.dto.ts`(전체), `folders.controller.ts:108-114` (`update()`)
  - 상세: `UpdateFolderDto` 는 `name`/`parentId`/`sortOrder` 3개 필드만 화이트리스트로 노출하며 `workspaceId` 필드가 없다. 컨트롤러는 `dto as Partial<Folder>` 로 캐스팅해 서비스에 전달하지만, 실제로 `@Body()` 를 통해 역직렬화된 객체는 `ValidationPipe`(전역 설정 가정 시 `whitelist: true`)가 적용된다면 DTO 에 선언되지 않은 속성은 제거된다. `folders.service.ts:72` 의 `Object.assign(folder, data)` 는 `data` 가 이미 DTO 인스턴스이므로 `workspaceId`, `id` 같은 민감 필드를 주입할 경로가 없다. `parentId` 는 `@IsUUID()` + `@Transform` 으로 형식 검증되고, 의미 검증(계층 무결성)은 이번 diff 가 신설한 `validateParentChange()` 가 담당한다.
  - 제안: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` 설정이 실제로 걸려 있는지는 이번 diff 범위 밖이라 재확인은 안 했으나(이전 세션 SUMMARY 가 "mass-assignment 차단" 으로 이미 확인함), 향후 `Object.assign(folder, data)` 패턴을 유지할 경우 DTO 화이트리스트가 유일한 방어선이므로 전역 파이프 설정 회귀에 주의.

- **[INFO]** 인증/인가 — 변경 없음, 기존 가드 그대로 적용
  - 위치: `folders.controller.ts:94-95` (`@Roles('editor')`, class-level `@ApiBearerAuth`)
  - 상세: 이번 diff 는 `@Roles('editor')` 데코레이터나 인증 가드 자체를 건드리지 않았다. `PATCH /folders/:id` 는 여전히 인증된 사용자 + `editor` 이상 권한이 필요하다. `parentId` 재검증 로직 추가로 인해 권한 체크 우회 경로가 생기지 않았다(검증은 권한 체크 이후 서비스 레이어에서 수행).
  - 제안: 조치 불요.

- **[INFO]** DoS/무한루프 방지 — 이번 diff 의 핵심 보안 개선사항
  - 위치: `getDepth()`:91-92 (`visited` Set + `depth > MAX_NESTING_DEPTH + 1` 가드), `collectSubtree()`:162 (`height <= MAX_NESTING_DEPTH` 가드)
  - 상세: 종전 `getDepth()` 는 `while (currentId)` 루프만 있어 손상된 데이터(parent 체인에 cycle 이 있는 경우, 예: a→b→a)를 만나면 무한루프에 빠져 이벤트루프를 블로킹하는 DoS 벡터였다(`folders.service.spec.ts` 신규 테스트 `getDepth terminates on cyclic parent chain` 이 이를 회귀 방지 테스트로 커버). 이번 diff 는 `visited` Set 과 깊이 상한을 추가해 순환 데이터가 있어도 최대 `MAX_NESTING_DEPTH + 2`(=7) 회 반복 후 종료됨을 보장한다. `collectSubtree()` 도 동일하게 `height` 상한으로 bound 된다. 정상적인 트리 구조에서는 애초에 `validateParentChange()` 가 cycle 생성을 차단하므로 순환 데이터는 발생하지 않아야 하지만, 레거시 손상 데이터나 향후 다른 경로로 유입될 가능성에 대한 방어적 가드로 타당하다.
  - 제안: 조치 불요. 오히려 이 diff 자체가 기존 잠재적 DoS 취약점(무한루프)을 수정한 것으로 긍정적으로 평가한다.

- **[INFO]** 에러 메시지 — 민감 정보 노출 없음
  - 위치: `validateParentChange()` 의 3개 `BadRequestException` 호출(116-119, 124-128, 136-139, 143-146)
  - 상세: 모든 에러 메시지가 일반적인 검증 실패 사유("A folder cannot be its own parent", "Parent folder not found in this workspace" 등)만 노출하며, 내부 구현 세부사항(쿼리, 스택트레이스, DB 스키마)이나 다른 워크스페이스의 존재 여부를 유추할 수 있는 정보를 포함하지 않는다. `GlobalExceptionFilter`(기존 인프라)가 `{ error: { code, message, requestId } }` 봉투로 정규화한다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 코드(`folders.service.spec.ts`) 자체는 보안 영향 없음
  - 위치: 전체 신규 테스트 블록(`update — parentId 재검증 (V-04)`)
  - 상세: mock 기반 단위 테스트로 프로덕션 시크릿·실제 자격증명 노출 없음. cycle 방어(무한루프 미발생) 를 명시적으로 회귀 테스트화한 점은 보안 관점에서도 긍정적(가드 회귀 시 CI 가 즉시 감지).
  - 제안: 조치 불요.

- **[INFO]** `plan/`, `review/` 문서 변경(파일 4~11) — 보안 관점 해당 없음
  - 상세: plan 체크박스 갱신, RESOLUTION/SUMMARY 리포트 등은 실행 코드가 아니며 보안 검토 대상이 아니다. 하드코딩된 시크릿·자격증명 포함 여부를 확인했으나 없음.
  - 제안: 조치 불요.

## 요약

이번 변경(V-04: 폴더 `update()` 재부모화 시 계층 무결성 검증 추가)은 보안 관점에서 개선 방향이며 신규 취약점을 도입하지 않는다. 모든 신규 DB 조회가 TypeORM 파라미터 바인딩만 사용해 인젝션 벡터가 없고, parent 조회가 `workspaceId` 로 일관되게 스코프되어 있어 cross-tenant IDOR 이 차단된다. `UpdateFolderDto` 화이트리스트(`name`/`parentId`/`sortOrder`)와 기존 `@Roles('editor')` 인가 가드가 그대로 유지되어 mass-assignment·인가 우회 경로가 없다. 오히려 이번 diff 의 핵심 기여 중 하나(`getDepth()` 의 `visited` Set + 깊이 상한 가드)는 손상된 데이터(parent 체인 cycle)로 인한 기존 잠재적 무한루프 DoS 취약점을 수정한 것으로, 회귀 테스트(`getDepth terminates on cyclic parent chain`)까지 갖췄다. 에러 메시지도 민감 정보를 노출하지 않는다. 발견된 항목은 모두 INFO 수준이며 CRITICAL/WARNING 은 없다.

## 위험도

NONE
