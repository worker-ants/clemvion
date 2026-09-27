# 보안(Security) 리뷰 — folders-contract-e2e

## 검토 범위

`codebase/backend/src/modules/folders/**`(DTO·service·spec), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(래칫 1행 축소), 신설 e2e `codebase/backend/test/folder-crud.e2e-spec.ts`, `CHANGELOG.md`, plan/review 문서(`plan/in-progress/*.md`, `review/consistency/2026/09/27/10_39_26/**`). 실제 런타임 로직 변경은 `folders.service.ts` `update()` 와 `folder-response.dto.ts` `parentId` 선언 두 곳뿐이며, 나머지는 테스트·문서·래칫 데이터다.

핵심 변경(`folders.service.ts` `update()`, `folders.controller.ts`, `update-folder.dto.ts`)의 인가·검증 경로를 diff 밖 파일까지 `Read`로 열어 대조했다(전역 `CustomValidationPipe`의 whitelist 설정 확인 포함). 저장소 트리에 뮤테이션은 가하지 않았다.

## 발견사항

- **[INFO]** `update()` 의 `Object.assign(folder, defined)` 은 `data` 의 모든 own-property 키를 필터 없이 엔티티에 병합한다 — mass-assignment/prototype-pollution 형태의 패턴 자체는 방어적으로 보이지 않는다.
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:77-80` (diff 게이트 기준)
  - 상세: 이 서비스 메서드는 컨트롤러에서 타입이 명시된 `UpdateFolderDto` 를 통해서만 호출된다(`folders.controller.ts` `update()` — `@Body() dto: UpdateFolderDto`). 이 DTO 는 클래스 타입이므로 전역 `APP_PIPE = CustomValidationPipe`(`codebase/backend/src/app.module.ts:202`)가 `whitelist + forbidNonWhitelisted` 검증을 실제로 수행해 `name`·`parentId`·`sortOrder` 외 키(`workspaceId`, `id`, `__proto__` 등)는 요청 단계에서 걸러지거나 400 으로 거부된다 — 확인 결과 이번 변경으로 새로 열린 공격면은 아니다. 다만 `Object.fromEntries(Object.entries(data).filter(...))` → `Object.assign` 관용구 자체는 "타입이 막아 준다" 는 전제에 의존하므로, 이 서비스 메서드가 whitelist 가 적용되지 않는 경로(예: 내부 호출·다른 컨트롤러의 인라인 객체 타입 파라미터)에서 재사용되면 방어가 없다는 점만 INFO 로 남긴다. plan 이 예고한 동형 패치 대상(`workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts`)에도 같은 전제(타입이 있는 DTO 로만 호출됨)가 성립하는지는 그 PR 에서 개별 확인이 필요하다.
  - 제안: 신규 조치 불요(현재 호출 경로는 안전). 후속 PR 에서 같은 관용구를 적용할 때 그 컨트롤러의 `@Body()` 파라미터가 **타입이 있는 DTO 클래스**인지(인라인 객체 타입이면 `CustomValidationPipe` 가 검증을 건너뛴다는 사실은 이 저장소의 기존 관례 주석에도 여러 번 명시돼 있다) 확인하는 한 줄을 그 plan 뮤턴트 표에 추가할 것을 권장.

- **[INFO]** `FoldersService` 가 `FolderDto` 를 광고하면서 TypeORM `Folder` 엔티티를 매핑 없이 그대로 반환한다(entity passthrough).
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` 전체(`findAll`/`findById`/`create`/`update`) — 이번 diff 가 도입한 것이 아니라 기존 구조이며 이번 PR 의 변경 범위 밖.
  - 상세: 이미 `review/consistency/2026/09/27/10_39_26/convention_compliance.md` 가 같은 사실을 INFO 로 적시했고(`spec/conventions/swagger.md` §5-1 이 경고하는 실패 패턴과 동일 구조), 현재는 `find`/`findOne` 에 `relations` 옵션이 없어 즉시 유출은 없다고 기록돼 있다. 재확인 결과도 동일 — `relations`/`eager` 미사용으로 `workspace`/`parent` 연관 로드가 없어 이번 스코프에서 새로 유출되는 필드는 없다. 중복 플래깅 방지를 위해 새 항목으로 등재하지 않고 참고만 남긴다.
  - 제안: 조치 불요(기존 tracker 가 이미 추적). 향후 `relations` 옵션이 추가되면 즉시 재검토 필요.

- **[INFO]** DTO 선언 변경(`@ApiPropertyOptional({ nullable: true })` → `@ApiProperty({ type: String, format: 'uuid', nullable: true })`)은 OpenAPI 문서가 실제 응답 형태(항상 키 존재)와 일치하도록 좁히는 방향이라 보안 관점에서는 중립~긍정적이다. `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 해당 항목을 제거한 것도 동일한 방향(허용된 드리프트 축소)이며 새로운 위험을 만들지 않는다.
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts:20-21`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:381`(게이트 기준, 삭제된 줄이라 이전 줄 번호 380 참고)

- **[INFO]** 신설 e2e(`folder-crud.e2e-spec.ts`)는 `registerAndLogin`/`createTeamWorkspace` 헬퍼로 실제 계정을 만들고 `Authorization: Bearer <token>` 헤더로 인증한다 — 하드코딩된 자격증명·시크릿은 없고, `BASE_URL` 도 `process.env.E2E_BASE_URL` 기본값(`http://backend-e2e:3011`, 로컬 docker 서비스명)일 뿐 실제 엔드포인트/시크릿 노출이 아니다.

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지 정보 노출, 취약 의존성 도입 등 CRITICAL/WARNING 급 항목은 발견하지 못했다. `UpdateFolderDto` 는 `parentId`/`sortOrder`/`name` 만 화이트리스트로 받고, 컨트롤러 라우트는 기존 `@Roles('editor')` 가드·`WorkspaceId` 스코핑을 그대로 유지한다(이번 diff 가 그 부분을 건드리지 않음).

## 요약

이번 변경은 `PATCH /folders/:id` 응답에서 보내지 않은 필드가 사라지거나 거짓 `null` 로 실리던 **응답 정확성 결함**을 고치는 작업이며, 도입된 코드(`Object.fromEntries` 필터 + `Object.assign`, DTO 선언 정정)는 인가·검증 경로를 바꾸지 않는다. `update()` 의 mass-assignment 유사 패턴은 전역 `CustomValidationPipe` 의 whitelist/forbidNonWhitelisted 가 타입이 있는 DTO 를 통해 실질적으로 방어하고 있음을 직접 확인했고, 기존에 알려진 entity-passthrough 이슈는 이번 diff 의 산물이 아니며 이미 별도 tracker 가 인지하고 있다. CRITICAL/WARNING 은 없다.

## 위험도

NONE
