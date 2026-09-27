# 보안(Security) 리뷰 — folders-contract-e2e (2R)

## 검토 범위

이번 diff 는 이전 라운드(`review/code/2026/09/27/11_53_51`)의 W1(헬퍼 추출)·W2(트래커 링크) 조치 커밋과, 그 이전 라운드의
리뷰/컨시스턴시 산출물 자체가 저장소에 커밋되어 diff 에 포함된 것이다. 실제 런타임 로직이 있는 파일은 다음 다섯이다:

- `codebase/backend/src/common/utils/omit-undefined.ts` (신규 — 공용 헬퍼)
- `codebase/backend/src/modules/folders/folders.service.ts` (`update()` 가 인라인 필터 대신 헬퍼 호출)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (동일 — 인라인 필터를 헬퍼 호출로 치환, 동작 불변 리팩터)
- `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts` (`parentId` 선언 변경, 1R 이전 변경분)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (래칫 배열에서 1행 제거)

나머지(CHANGELOG·plan 문서·`review/**` 산출물·각 `*.spec.ts`)는 문서 또는 테스트다.

`folders.controller.ts`(diff 밖)·`update-folder.dto.ts`(diff 밖)·전역 `CustomValidationPipe`(`app.module.ts`,
`common/pipes/validation.pipe.ts`)·`triggers.controller.ts`(diff 밖)를 직접 `Read` 로 열어 인가·검증 경로를 대조했다.
저장소 트리에 뮤테이션은 가하지 않았다 (`git status --short` 로 확인 — 세션 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `omitUndefined()` 로 필터링된 객체를 `Object.assign(folder, ...)` 로 병합하는 관용구는 키 화이트리스트를 자체적으로 걸지 않는다 — "타입이 있는 DTO 로만 호출된다"는 caller-side 전제에 의존한다.
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `update()` (게이트 61~76행, 특히 75행) · `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 622행 부근
  - 상세: 헬퍼 자체(`omit-undefined.ts`)는 `undefined` 값만 걸러내고 키 집합은 그대로 통과시킨다. 실제 호출부를 대조한 결과 두 곳 모두 안전하다 — `FoldersController.update()` 는 `@Body() dto: UpdateFolderDto`(클래스 DTO, `name`/`parentId`/`sortOrder` 3필드만 선언), `TriggersController.update()` 는 `@Body() dto: UpdateTriggerDto`(클래스 DTO)로만 호출되고, 전역 `APP_PIPE = CustomValidationPipe`(`app.module.ts:202`)가 `whitelist: true` + `forbidNonWhitelisted: true` 로 실제 검증을 수행한다(`validation.pipe.ts`). `UNVALIDATED_METATYPES`(String/Boolean/Number/Array/Object) 에 두 DTO 모두 해당하지 않으므로 우회 경로가 없다 — 검증됨. 이번 diff 는 필터 구현을 한 곳(`omit-undefined.ts`)으로 합친 것뿐이고 호출부·계약을 바꾸지 않아 새 공격면이 아니다. plan 이 예고한 후속 세 곳(`workflows`·`nodes`·`auth-configs` 의 `update()`)에도 같은 전제가 성립하는지는 이 PR 범위 밖 — plan 트래커(`spec-draft-nullable-notation-followups.md`)에 "컨트롤러 `@Body()` 가 타입 있는 DTO 인지 확인" 항목이 이미 등재돼 있음을 확인했다.
  - 제안: 신규 조치 불요(현재 호출 경로 둘 다 안전, 실측 완료). 후속 PR 착수 때 위 트래커 항목의 체크만 유지.

- **[INFO]** `FoldersService` 가 `FolderDto` 매핑 없이 TypeORM `Folder` 엔티티를 그대로 반환한다(entity passthrough).
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` 전체(`findAll`/`findById`/`create`/`update`) — 이번 diff 가 도입한 구조가 아니며 변경 범위 밖.
  - 상세: `Folder` 엔티티(`entities/folder.entity.ts`)를 직접 확인 — 비밀·인증 관련 컬럼은 없고(`id`/`workspaceId`/`name`/`parentId`/`sortOrder`/타임스탬프), `find`/`findOne` 어디에도 `relations`/`eager` 가 없어 `workspace`/`parent` 연관 엔티티가 로드되지 않는다. 즉시 유출은 없음을 재확인했다. 기존 `review/consistency/2026/09/27/10_39_26/convention_compliance.md` 가 이미 같은 사실을 INFO 로 추적 중이라 중복 등재하지 않는다.
  - 제안: 조치 불요(추적 중). `relations` 옵션이 추가되면 재검토.

- **[INFO]** `FolderDto.parentId` 선언 변경(`@ApiPropertyOptional({ nullable: true })` → `@ApiProperty({ type: String, format: 'uuid', nullable: true })`)은 OpenAPI 문서를 실제 런타임 형태(항상 키 존재)에 맞추는 방향이라 보안 관점에서 중립~긍정적이다. `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 해당 행을 제거한 것도 허용된 드리프트를 줄이는 같은 방향이다.
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts`(게이트 17~21행) · `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(삭제된 줄이라 게이트 없음 — `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열의 `folder-response.dto.ts:FolderDto.parentId` 항목)

- **[INFO]** 신설 e2e(`folder-crud.e2e-spec.ts`)는 `registerAndLogin`/`createTeamWorkspace` 헬퍼로 실제 테스트 계정을 만들고 `Authorization: Bearer <token>` 헤더로 인증한다 — 하드코딩된 자격증명·시크릿은 없다. `BASE_URL` 기본값(`http://backend-e2e:3011`)도 로컬 docker 서비스명일 뿐 실 엔드포인트나 시크릿이 아니다.

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지 정보 노출, 취약 의존성 도입 등
CRITICAL/WARNING 급 항목은 이번 라운드에서도 발견하지 못했다. `folders.controller.ts`·`triggers.controller.ts` 의 `@Roles('editor')` 가드와
`WorkspaceId` 스코핑은 이번 diff 가 건드리지 않는다.

## 요약

이번 diff 의 실질 변경은 (1) PATCH 부분 본문에서 `undefined` 필드를 거르는 관용구를 트리거·폴더 두 사본에서 공용 헬퍼
`omitUndefined()` 하나로 합친 리팩터(동작 불변)와, (2) `FolderDto.parentId` 의 OpenAPI 선언을 실제 응답 형태에 맞게 좁힌 것,
그리고 나머지는 그 결함을 고정하는 테스트·문서다. 두 서비스의 `update()` 모두 타입이 있는 DTO 클래스로만 호출되고 전역
`CustomValidationPipe`(whitelist + forbidNonWhitelisted)가 실질적으로 mass-assignment 를 방어함을 컨트롤러·DTO·파이프
소스를 직접 열어 확인했다. entity passthrough 는 기존 구조이고 관계 미로드로 즉시 유출이 없음도 재확인했다. 인가 가드·스코핑은
이번 diff 범위 밖이며 변경되지 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE
