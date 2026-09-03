# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 재확인

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- target 문서: `spec/5-system/` — **이 스코프의 spec 델타는 0개 파일** (실측: `git diff origin/main...HEAD --stat -- spec/5-system` 무출력, HEAD 워킹트리 기준). spec 이 새로 도입한 식별자는 없다.
- 실제 구현 diff: `git diff origin/main...HEAD -- codebase/` = 10개 파일 / 152줄 (프롬프트 번들과 라인 수 일치 확인). 내용은 `entity-nullable-column-type-mismatch` 플랜의 "배치 3" — TypeORM 엔티티 컬럼·DTO 필드·컨트롤러 캐스트의 타입을 실제 nullable 현실에 맞춰 `T` → `T | null` 로 넓히는 작업과, 그에 따른 spec 테스트의 불필요한 `as unknown as T` 캐스트 제거다.

변경 파일 목록:

- `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts` — `ipAddress: string` → `string | null`
- `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `ipWhitelist: string[]` → `string[] | null` (optional)
- `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts` — `ipWhitelist`, `lastUsedAt` nullable 화
- `codebase/backend/src/modules/auth/auth.service.spec.ts` — `lockedUntil: null as unknown as Date` → `null`
- `codebase/backend/src/modules/edges/entities/edge.entity.ts` — `condition` nullable 화
- `codebase/backend/src/modules/folders/entities/folder.entity.ts` — `parentId`, `parent` nullable 화
- `codebase/backend/src/modules/folders/folders.controller.ts` — 불필요해진 `Folder` import·`as Partial<Folder>` 캐스트 제거
- `codebase/backend/src/modules/folders/folders.service.spec.ts` — `parentId: null as unknown as string` → `null`
- `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts` — `changeSummary` nullable 화
- `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts` — `joinedAt` nullable 화

## 신규 식별자 도입 여부 점검

`git diff origin/main...HEAD --name-status -- codebase/` 결과 전량 `M`(수정) — 신규 파일 없음. 추가된 라인(`git diff ... | grep '^+'`)을 전수 확인한 결과, 모두 **기존 필드의 타입 어노테이션 변경**(`T` → `T | null`) 또는 **기존 테스트 리터럴의 캐스트 제거**이며, 다음 어떤 범주에도 새 식별자가 없다:

1. **요구사항 ID** — 신규 ID 없음 (spec 델타 0).
2. **엔티티/타입명** — `AuditLog`, `AuthConfig`, `AuthConfigDto`, `Edge`, `Folder`, `WorkflowVersion`, `WorkspaceMember` 모두 기존 클래스. 새 클래스·DTO·인터페이스 없음. 필드명(`ipAddress`, `ipWhitelist`, `lastUsedAt`, `condition`, `parentId`, `parent`, `changeSummary`, `joinedAt`)도 전부 기존 필드이며 이름 변경 없음(타입만 nullable 로 확장).
3. **API endpoint** — 신규 라우트 없음. `folders.controller.ts` 변경은 기존 `PATCH` 핸들러 내부의 캐스트·import 정리일 뿐 method/path 불변.
4. **이벤트/메시지명** — 해당 diff 에 webhook·queue·SSE 이벤트 관련 변경 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** — 신규 파일 생성 없음(전량 기존 파일 수정). spec 파일 경로 변경도 없음.

## 발견사항

없음.

## 요약

이번 diff(10개 파일/152줄)는 `entity-nullable-column-type-mismatch` 플랜의 배치 3으로, 기존 TypeORM 엔티티·DTO 필드의 타입을 실제 DB nullable 현실에 맞춰 `T` → `T | null` 로 넓히고 그에 따른 테스트 캐스트를 정리하는 순수 타입 정합화 작업이다. 새 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 이벤트명, 새 환경변수·설정키, 새 파일 경로 중 어느 것도 도입되지 않았으며, `spec/5-system/` 자체도 이번 브랜치에서 변경되지 않았다(델타 0). 따라서 신규 식별자 충돌의 관점에서 검토할 대상이 존재하지 않는다.

## 위험도

NONE
