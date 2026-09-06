# 신규 식별자 충돌 검토

대상 브랜치(`user-entity-column-defense`)는 `spec/5-system/**` 를 변경하지 않는다(scope 델타 0, 정상 — 코드 전용 PR). 신규 식별자는 전부 구현 diff(`codebase/backend/src/repo-guards/__tests__/**` · `codebase/backend/src/shared/testing/**` · `workflow-versions.service.ts` · `workspace-response.dto.ts` · `spec/conventions/review-citations.md` · `spec/conventions/spec-impl-evidence.md`)에서 도입된다. 아래는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 절대경로로 직접 열어 `git diff origin/main...HEAD -- codebase/ spec/` 전수 대조한 결과다. 이전 라운드(`review/consistency/2026/09/06/{11_55_37,12_28_03,12_53_29}/naming_collision.md`)의 결론도 재검증했다.

## 발견사항

- **[WARNING]** 신규 `WorkflowVersionDetail` 타입명이 프론트엔드에 이미 동일 이름으로 존재 — 이전 3라운드가 전부 "저장소 전역 grep 0건/유일 정의"로 오판했다
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:47` 의 `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` 의 `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }` — 이 파일은 이 브랜치가 건드리지 않았고 `origin/main`(및 그 이전, `6a939b770` 등)부터 존재한다 (`git diff origin/main...HEAD -- codebase/frontend/...` 무출력으로 확인).
  - 상세: 두 정의는 **같은 endpoint**(`GET /api/workflows/:wfId/versions/:versionId`)의 같은 개념(버전 상세: id·workflowId·version·changeSummary·createdBy·createdAt·creator·snapshot)을 가리키므로 "다른 의미로 충돌"은 아니다 — 오히려 자연스러운 계층 간 수렴이다. 다만 **완전히 동일한 이름**이 백엔드 내부 서비스 반환 타입과 프론트엔드 API 클라이언트 타입 양쪽에 **독립적으로** 선언돼 있고, 필드 optionality 가 이미 미묘하게 갈렸다 — 프론트 `creator?: {...} | null`(옵셔널, 필드도 `name?`/`email?` 옵셔널) vs 백엔드 신규 타입 `creator: ProjectedCreator`(`Pick<User,'id'|'name'|'email'>`, 전부 필수). 실제 wire 계약(`WorkflowVersionDto.creator?: WorkflowVersionCreatorDto | null`)은 옵셔널을 유지하므로 지금 당장 계약 위반은 아니지만, 두 `WorkflowVersionDetail` 이 공유 SoT 없이 각자 진화하면 한쪽만 넓어지는 drift 를 grep 으로 잡기 어려워진다(동명이라 "다른 파일의 같은 이름"이라는 신호 자체가 사라짐).
  - 제안: 이름 충돌 자체를 급히 바꿀 필요는 없다(빌드 단위가 분리돼 있어 컴파일 충돌은 없음). 다만 (a) 백엔드 신규 타입에 JSDoc으로 "프론트 `lib/api/workflows.ts` 의 동명 인터페이스와는 별도 선언(수동 동기화 필요)"이라는 언급을 남기거나, (b) 향후 `WorkflowVersionDetail` 을 grep 할 때 두 파일이 함께 걸린다는 점을 리뷰 체크리스트에 남길 것. 근본 해결은 이 PR 범위 밖(공유 타입 패키지 부재는 이 저장소 전반의 기존 패턴).
  - 참고: 이전 라운드의 오판 원인은 검색 스코프가 실질적으로 `codebase/backend` (또는 diff 파일 목록)로 좁혀져 프론트엔드 트리를 놓친 것으로 보인다 — `plan_coherence`/`cross_spec` 리뷰어가 "3라운드 연속 같은 오판" 사실 자체를 별도로 기록할 가치가 있다.

## 조사했으나 충돌 없음으로 판정한 항목 (근거 기록)

- **이전 라운드(12_53_29)가 지적했던 `isResponseDtoFile` 중복 정의는 이번 diff 에서 이미 해소됨**: 현재 `dto-jsdoc-citation-guard.ts` 는 `import { isResponseDtoFile } from './swagger-dto-contract-guard'; export { isResponseDtoFile };` 로 재수출만 하고 로컬 재구현을 두지 않는다(파일 내 주석이 `review/consistency/2026/09/06/12_53_29 W4` 를 명시적으로 인용). 재확인 완료 — 재-flag 불요.
- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets` (`shared/testing/user-secret-absence.ts`) — `codebase/backend`·`codebase/frontend`·`codebase/packages` 전역에서 이 파일 외 정의 없음. 값 목록(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 `user.entity.ts` 실제 컬럼명과 `spec/5-system/1-auth.md` §1.1/§1.1.B/§1.4.1 이 이미 쓰는 표기(`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`·`user.totp_recovery_codes`·`user.webauthn_recovery_codes`)와 정확히 일치 — 신규 도입이지만 기존 spec 용어와 충돌 없이 정렬됨.
- `UserRelationLoad` / `findEagerUserRelations` / `collectUserRelationNames` / `findUserRelationLoads` / `SRC_ROOT`(`user-entity-exposure-guard.ts`) — 프론트엔드·패키지 전역 grep 0건. `SRC_ROOT` 는 `nullable-type-lie-cast-guard.ts`·`dto-jsdoc-citation-guard.ts` 등에도 동명 export const 가 있으나 각 파일이 독립 모듈이고 각 `.spec.ts` 가 자기 파일에서만 import 하는, 이 브랜치 이전부터의 기존 관례(가드마다 독립 `SRC_ROOT`) — 실질 충돌 없음.
- `CREATOR_PROJECTION` / `ProjectedCreator` / `UnloadedRelations` (`workflow-versions.service.ts`) — 저장소 전체(프론트 포함)에서 이 파일 외 정의 없음. `WorkflowVersionCreatorDto`(참조만, 정의는 이 브랜치 이전부터 `workflow-version-response.dto.ts` 존재)와 필드 집합(`id`/`name`/`email`)이 `workflow-versions.service.spec.ts` 로 대조되어 있어 의미 충돌 없음.
- `WorkspaceMemberDto.joinedAt` (신규 DTO 필드) — DB 컬럼 `joined_at`·엔티티 `WorkspaceMember.joinedAt`·`workspaces.service.ts`/`workspace-invitations.service.ts` 의 기존 `joinedAt` 과 이름·의미 정확히 일치. 신규 wire 노출이지만 식별자 충돌 아님.
- 신규 e2e 테스트 라벨 `H`(`workflow-crud.e2e-spec.ts`, 기존 A~G 다음)·`J`(`workspace-rbac.e2e-spec.ts`, 기존 A~I 다음) — 각 파일 내 다음 순차 문자와 일치, 중복 라벨 없음.
- 신규 e2e 가 때리는 endpoint(`GET /api/workflows/:wfId/versions/:versionId`, `GET /api/workspaces/:id/members`, `GET /api/audit-logs`) — 전부 기존 엔드포인트에 대한 **추가 단언**이며, 신규 endpoint·webhook·이벤트·ENV 식별자는 이 diff 에 도입되지 않았다.
- fixture 내부 `declare class User { id: string }` (`fixtures/user-eager-relation.fixture.ts`) — 실제 `User` 엔티티 import 없이 이름만 재현한 test-only 로컬 선언. 대상 guard 가 "속성 타입 텍스트"만 비교하는 설계임을 파일 자체가 명시하고, 프로덕션 스캔 범위(`src/modules/**/*.entity.ts`) 밖이라 베이스라인에도 안 걸림 — 의도된 설계.
- `spec/conventions/review-citations.md`/`spec-impl-evidence.md` 편집 — 신규 spec 파일 생성 없음(기존 두 문서의 본문 정정 + `code:` frontmatter 항목 1개 추가). 새 파일 경로/명명 컨벤션 충돌 대상 자체가 없음.

## 요약

이번 브랜치가 새로 도입하는 식별자(가드 파일명·함수명·타입명·DTO 필드명·상수)는 대체로 기존 `repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션과 `USER_SECRET_KEYS` 등 spec 이 이미 쓰는 컬럼명 표기를 정확히 따르며, 다른 의미로 이미 쓰이던 이름과 충돌하는 CRITICAL 사례는 발견되지 않았다. 다만 신규 백엔드 타입 `WorkflowVersionDetail` 이 이 PR 이 건드리지 않은 기존 프론트엔드 파일(`codebase/frontend/src/lib/api/workflows.ts`)의 동명 인터페이스와 완전히 같은 이름으로 겹치는 것을 확인했다 — 의미는 같은 개념의 계층 간 수렴이라 CRITICAL 은 아니지만, 이전 3라운드가 이를 "유일 정의"로 오판했던 것을 이번 라운드에서 정정하며 WARNING 으로 등재한다. 12_53_29 라운드가 지적했던 `isResponseDtoFile` 중복 정의 WARNING 은 이번 diff 에서 재수출 방식으로 이미 해소됐음을 재확인했다.

## 위험도

LOW
