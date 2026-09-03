# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 TypeORM 엔티티 8개 파일의 nullable 컬럼 TS 타입을 `| null` 로
넓히는 배치(`entity-nullable-column-type-mismatch.md` §배치3), `FoldersController`
에서 불필요한 타입 캐스트 제거, 테스트 fixture 정리, 그리고 `plan/` 문서와
`scripts/backend-typecheck-baseline.json` 갱신으로 구성된다. 런타임 로직 변경은
`FoldersController.update()` 의 `dto as Partial<Folder>` → `dto` 캐스트 제거
1건뿐이고, 나머지는 순수 타입 어노테이션(`Column` 데코레이터의 `type:` 명시
포함)이다.

## 발견사항

### 검토했지만 취약점 아님으로 판정한 항목

- **[INFO]** `FoldersController.update()` 의 `dto as Partial<Folder>` 캐스트 제거는 mass-assignment 위험을 새로 만들지 않는다
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:114`
  - 상세: `FoldersService.update(id, workspaceId, data: Partial<Folder>)` 내부는
    여전히 `Object.assign(folder, data)` 로 병합한다(`codebase/backend/src/modules/folders/folders.service.ts`).
    다만 컨트롤러로 들어오는 `dto` 는 전역 `APP_PIPE`(`CustomValidationPipe`,
    `codebase/backend/src/common/pipes/validation.pipe.ts`)가
    `whitelist: true, forbidNonWhitelisted: true` 로 `plainToInstance` 하므로
    `UpdateFolderDto` 에 선언된 `name?`/`parentId?`/`sortOrder?` 외 필드는 이미
    바디 단계에서 제거된다. 캐스트 제거 전후로 런타임에 전달되는 객체 형태는
    동일 — 오히려 `as Partial<Folder>` 라는 넓은 타입 강제가 사라져 향후 DTO 필드
    추가 시 구조적 비호환을 컴파일러가 다시 잡을 수 있게 됐다(개선 방향).
  - 제안: 없음 — 정상.
- **[INFO]** 엔티티 nullable 타입 확장(`ipAddress`, `ipWhitelist`, `condition`, `parentId`, `changeSummary`, `joinedAt`, `lastUsedAt`)은 검증·인가 로직을 변경하지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:43-44`,
    `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:42-43,48-49`,
    `codebase/backend/src/modules/edges/entities/edge.entity.ts:56-57`,
    `codebase/backend/src/modules/folders/entities/folder.entity.ts:29-30,32-34`,
    `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:32-33`,
    `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:39-40`
  - 상세: 전부 TS 타입을 DB 스키마의 실제 `nullable: true` 와 맞추는 어노테이션
    변화이며, 데이터 흐름·인증/인가 분기·SQL 파라미터 바인딩 방식에는 영향이
    없다. `AuthConfig.config` 필드는 `encryptedJsonTransformer` 로 이미 AES-256-GCM
    암호화되고 있고 이번 diff 는 그 필드를 건드리지 않는다.
    `auth-config.entity.ts:42` 의 `ipWhitelist` 는 IP 화이트리스트 자체이므로
    민감도가 있으나, 이 diff 는 필드의 nullability 표기만 바꿀 뿐 whitelist 강제
    로직(diff 밖의 `auth-configs.service.ts`)은 손대지 않는다.
  - 제안: 없음 — 정상. (참고: `auth-configs.service.ts:356` 의 `ac.ipWhitelist?.length`
    소비 코드는 이미 null 을 다루고 있었다고 plan 문서가 실측을 남겨 뒀다.)
- **[INFO]** `audit_log.ip_address` 컬럼은 평문 저장 — 이 diff 가 도입한 설계는 아님
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:43`
  - 상세: 감사 로그에 IP 주소가 평문(`varchar(45)`)으로 저장되는 기존 설계다.
    이번 diff 는 `type: 'varchar'` 명시와 nullable 타입 반영뿐이라 신규 노출
    표면이 아니다. 저장 자체를 재검토하려면 별도 spec 논의가 필요한 영역이다.
  - 제안: 해당 없음(이 diff 범위 밖).
- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md`, `scripts/backend-typecheck-baseline.json`, `folders.service.spec.ts` 캐스트 정리
  - 상세: 문서·baseline·테스트 fixture 변경으로 시크릿·인젝션·인증 관련 내용
    없음.
  - 제안: 해당 없음.

## 요약

이번 변경은 TypeORM 엔티티의 TS 타입을 실제 DB nullable 스키마와 정합시키는
순수 타입-레벨 리팩터링과, `FoldersController` 의 불필요한 타입 캐스트 제거로
구성되며 새로운 사용자 입력 경로·SQL/커맨드 실행 경로·인증/인가 분기를 추가하지
않는다. `FoldersController.update()` 의 캐스트 제거는 전역 `CustomValidationPipe`
(`whitelist:true, forbidNonWhitelisted:true`)가 이미 DTO 필드만 통과시키므로
mass-assignment 위험을 새로 열지 않으며, 오히려 타입 안전성을 강화하는 방향이다.
하드코딩된 시크릿, 인젝션 벡터, 암호화 약화, 에러 메시지 정보 노출, 신규
의존성 등은 발견되지 않았다.

## 위험도

NONE
