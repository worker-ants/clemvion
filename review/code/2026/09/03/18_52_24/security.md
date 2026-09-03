# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 `entity-nullable-column-type-mismatch` plan 배치 3 — TypeORM 엔티티 8개 파일의
`nullable: true` DB 컬럼 TS 타입을 `| null` 로 넓히는 순수 타입 정합화, `FoldersController.update()`
의 불필요한 `dto as Partial<Folder>` 캐스트 제거, `AuthConfigDto.ipWhitelist` Swagger 계약 정정,
CHANGELOG/plan 문서 갱신, 그리고 이전 리뷰 세션(`review/code/2026/09/03/18_30_53/**`)의 산출물
(RESOLUTION.md·SUMMARY.md·개별 reviewer 리포트·meta.json·`_retry_state.json`)이 신규 파일로
추가되는 것으로 구성된다. 런타임 로직이 실제로 바뀌는 지점은 `FoldersController.update()` 캐스트
제거 1건뿐이고, 나머지 엔티티 변경은 TS 타입 애너테이션(`Column` 데코레이터 `type:` 명시 포함)이다.

## 발견사항

### 검토했지만 취약점 아님으로 판정한 항목 (직접 코드 대조로 검증)

- **[INFO]** `FoldersController.update()` 의 `dto as Partial<Folder>` → `dto` 캐스트 제거는
  mass-assignment 위험을 새로 만들지 않는다 — 직접 코드 3곳을 열어 재확인.
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:114`
  - 상세: `FoldersService.update()` 는 여전히 `Object.assign(folder, data)` 로 병합한다
    (`codebase/backend/src/modules/folders/folders.service.ts:72`, `data: Partial<Folder>`).
    그런데 컨트롤러에 도달하는 `dto` 는 전역 `APP_PIPE`(`CustomValidationPipe`,
    `codebase/backend/src/common/pipes/validation.pipe.ts:29-32`, `app.module.ts:202` 로
    전역 등록 확인)가 `whitelist: true, forbidNonWhitelisted: true` 로 `plainToInstance`
    하므로 `UpdateFolderDto`(`codebase/backend/src/modules/folders/dto/update-folder.dto.ts`)
    에 선언된 `name?`(`@MaxLength(100)`)/`parentId?`(`@IsUUID`, 빈 문자열→null 변환)/
    `sortOrder?`(`@IsInt`) 세 필드 외에는 이미 바디 검증 단계에서 걸러진다. 캐스트 제거
    전후로 서비스에 전달되는 객체의 실제 형태(허용 필드 집합)는 동일 — 오히려 넓은 타입
    강제(`as Partial<Folder>`)가 사라져 향후 `Folder` 엔티티에 새 필드가 추가돼도 DTO 와
    구조적으로 안 맞으면 컴파일러가 다시 잡을 수 있게 됐다(개선 방향).
  - 제안: 없음 — 정상.

- **[INFO]** 엔티티 nullable 타입 확장 7건(`ipAddress`, `ipWhitelist`, `lastUsedAt`, `condition`,
  `parentId`/`parent`, `changeSummary`, `joinedAt`)은 인증/인가·검증 로직을 변경하지 않는다.
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:43-44`,
    `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:42-43,48-49`,
    `codebase/backend/src/modules/edges/entities/edge.entity.ts:56-57`,
    `codebase/backend/src/modules/folders/entities/folder.entity.ts:29-30,32-34`,
    `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:32-33`,
    `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:39-40`
  - 상세: 전부 TS 타입을 DB 스키마의 실제 `nullable: true` 에 맞추는 어노테이션 변화이며,
    SQL 파라미터 바인딩·raw 쿼리·인증 분기 로직은 손대지 않는다. `AuthConfig.config`
    (webhook bearer token/API key 등 인증 자격증명)는 `encryptedJsonTransformer` 로
    AES-256-GCM 암호화되는 필드인데 이 diff 는 그 필드를 건드리지 않는다.
    `auth_config.ip_whitelist`(webhook IP 화이트리스트 강제 로직 자체)도 nullability
    표기만 바뀌었을 뿐 강제 로직(`auth-configs.service.ts`, diff 밖)은 미변경.
  - 제안: 없음 — 정상.

- **[INFO]** `AuthConfigDto.ipWhitelist` Swagger 계약이 이번 diff 에서 실제로 정정됐다 —
  이전 리뷰 세션(`18_30_53`)이 WARNING 으로 지적했던 항목이 이 diff 에 반영되어 있음을 확인.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`
  - 상세: `ipWhitelist: string[]`(non-null, `@ApiProperty`) → `ipWhitelist?: string[] | null`
    (`@ApiPropertyOptional({ nullable: true })`) 로 변경됐고, 같은 파일의 `lastUsedAt?: string | null`
    과 동일한 형태다. `AuthConfigsController` 가 엔티티를 별도 DTO 매핑 없이 그대로 반환하는
    구조( `GET /auth-configs` 응답에 실제로 `null` 이 실릴 수 있었던 경로)이므로, 이 정정은
    "클라이언트가 Swagger 를 신뢰해 무가드 배열 메서드를 호출하다 런타임 예외를 만날 위험"을
    실제로 닫는다. 동작(런타임 값) 자체는 이전부터 nullable 이었으므로 wire 변경은 없다.
  - 제안: 없음 — 이전 라운드에서 지적된 결함이 이번 코드에 반영돼 있음.

- **[INFO]** `audit_log.ip_address` 는 평문(`varchar(45)`) 저장 — 이 diff 가 새로 도입한
  설계는 아니다.
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:43`
  - 상세: 감사 로그에 IP 주소를 평문으로 저장하는 기존 설계이며, 이번 diff 는 `type: 'varchar'`
    명시(마이그레이션 `V001__initial_schema.sql:326` `VARCHAR(45)`, 형제 엔티티
    `login-history.entity.ts`·`refresh-token.entity.ts` 와 동일 패턴)와 nullable 타입 반영뿐이라
    신규 노출 표면이 아니다.
  - 제안: 해당 없음(이 diff 범위 밖). 저장 방식 재검토가 필요하다면 별도 spec 논의 대상.

- **[INFO]** `review/code/2026/09/03/18_30_53/**` 신규 파일(RESOLUTION.md·SUMMARY.md·개별
  reviewer 리포트·`meta.json`·`_retry_state.json`)에는 시크릿·자격증명·내부 인프라 정보가
  포함되지 않는다.
  - 상세: 전부 마크다운 리뷰 텍스트와 로컬 절대경로(`/Volumes/project/...worktrees/...`)뿐이며,
    이 경로는 세션 로컬 작업 디렉터리로 시크릿이 아니다. API 키·비밀번호·토큰 패턴 검색 결과
    없음.
  - 제안: 해당 없음.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md`,
  `scripts/backend-typecheck-baseline.json`, `CHANGELOG.md`, `folders.service.spec.ts`/
  `auth.service.spec.ts` 테스트 fixture 캐스트 정리 — 시크릿·인젝션·인증 관련 내용 없음.
  - 제안: 해당 없음.

## 요약

이번 변경은 TypeORM 엔티티 TS 타입을 실제 DB nullable 스키마와 정합시키는 순수 타입 레벨
리팩터링이 중심이며, 새로운 사용자 입력 경로·SQL/커맨드 실행 경로·인증/인가 분기를 추가하지
않는다. 유일한 런타임 동작 변경인 `FoldersController.update()` 캐스트 제거는 전역
`CustomValidationPipe`(`whitelist:true, forbidNonWhitelisted:true`)와 `UpdateFolderDto`
검증 데코레이터, `FoldersService.update()` 의 `Object.assign` 병합 지점을 직접 열어 대조한
결과 mass-assignment 위험을 만들지 않음을 확인했다. 이전 리뷰 라운드(`18_30_53`)에서
WARNING 으로 지적됐던 `AuthConfigDto.ipWhitelist` Swagger nullable 불일치는 이번 diff 에
이미 정정되어 반영돼 있다. 하드코딩된 시크릿, 인젝션 벡터, 암호화 약화, 에러 메시지 정보
노출, 신규 취약 의존성 등은 발견되지 않았다. 저장소 뮤테이션은 없었다(`Read`/`Bash grep` 만
사용, `git status --short` 로 확인 시 리뷰 세션 산출물 외 변경 없음).

## 위험도

NONE
