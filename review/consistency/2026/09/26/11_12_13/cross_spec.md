# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-swagger-forbidden-codes.md`

## 검토 대상
- target: `plan/in-progress/spec-draft-swagger-forbidden-codes.md` (spec draft, `--spec` 모드)
- 반영 대상: `spec/conventions/swagger.md` §5-4 (frontmatter `code:` + 403 체크리스트 항목 + Rationale 신설 절)
- 대조: `spec/data-flow/12-workspace.md`(§Rationale "멤버십 검증은 가드 1곳에서" · "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드"), `spec/5-system/1-auth.md §3.2`, `spec/5-system/3-error-handling.md §1.2~§1.3`, 실제 코드(`common/constants/workspace-roles.ts`, `common/guards/roles.guard.ts`, `common/swagger/`, `repo-guards/__tests__/`)

## 발견사항

검토 관점 1~6 을 전부 적용했으나 **CRITICAL·WARNING 급 충돌은 발견되지 않았다.** 이 draft 는 새 개념·새 엔드포인트·새 상태 머신·새 RBAC 규칙을 도입하지 않고, 이미 `spec/data-flow/12-workspace.md`(2026-09-25 결정 "가드 거부의 오류 코드")에 채택되고 코드로 구현된 규칙(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`, `common/constants/workspace-roles.ts` 확인됨)을 `spec/conventions/swagger.md` §5-4 의 문서화 문구에 뒤늦게 반영하는 **문서-구현 동기화**다. 검증한 항목:

- **데이터 모델**: 신규 엔티티·필드 없음. 해당 없음.
- **API 계약**: 변경 대상은 `@ApiForbiddenResponse` **설명 텍스트**뿐이며 status code(403)·엔드포인트·request/response shape 는 그대로다. 코드값 자체(`NOT_A_MEMBER` 등)는 이미 `spec/5-system/3-error-handling.md` §1.2 카탈로그와 `common/constants/workspace-roles.ts` 런타임 값에 등재·구현돼 있어 draft 가 새로 발명하는 값이 없다. draft 가 인용하는 앵커(`../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25`)는 실제 헤딩과 일치하며, 현재 swagger.md §5-4 의 기존 링크와 동일한 앵커라 끊어지지 않는다.
- **요구사항 ID**: 신규 ID 부여 없음.
- **상태 전이**: 해당 없음(설명 문구·가드 등재뿐, 상태 머신 변경 없음).
- **RBAC 모델**: draft 의 "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" 규칙은 `data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"(2026-09-25, 채택안 (나))와 정확히 일치하고, `spec/5-system/1-auth.md §3.2`·`3-error-handling.md` 의 역할 계층(`viewer<editor<admin<owner`)과도 충돌하지 않는다. `viewer` 를 "멤버십과 같다(`ROLE_REQUIRED.viewer === NOT_A_MEMBER`)"로 서술한 부분도 실제 상수 정의(`workspace-roles.ts`)와 일치.
- **계층 책임**: 신규 저장소 가드 경로 `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts` 는 기존 `repo-guards/__tests__/` 명명(`http-status-advertised-guard.ts`·`param-uuid-pipe-guard.ts`·`workspace-param-binding-guard.ts` 등)과 이름이 겹치지 않는다. `code:` frontmatter 를 `swagger.md`(Swagger 문서-코드 짝 검증 담당)에 두는 것은 기존 관례와 일치 — `data-flow/12-workspace.md` 는애초 YAML frontmatter/`code:` 필드를 쓰지 않는 문서(“코드 진입점” 산문 나열 방식)이므로 이 가드의 SoT 를 swagger.md 에 두는 것에 계층 충돌이 없다.

### [INFO] 같은 주제에 두 개의 다른 모집단 수치가 근접 위치
- target 위치: draft "## Rationale (이 draft 의)" 아래 신설 절 — "가드가 403 을 낼 수 있는 라우트 157곳 중 129곳"
- 충돌 대상: `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" — "`@Roles()` 가 붙은 **모든** 라우트 … 합 88"
- 상세: 두 숫자는 서로 다른 모집단이다(157 = `@Roles()` 또는 `@WorkspaceId()`/`@WorkspaceParam()` 소비 라우트 전체, 88 = 그중 `@Roles()` 가 붙은 라우트만). 각 문서가 자신의 모집단 정의를 명시하고 있어 논리적 모순은 아니지만, 두 숫자가 같은 §5-4/워크스페이스 가드 주제를 다루며 서로 다른 문서에 근접 인용돼 있어 향후 독자가 "157" 과 "88" 을 같은 대상으로 오인할 여지가 있다.
- 제안: 필수 수정 아님. 원한다면 draft 의 Rationale 신설 절에 "88(=@Roles() 라우트, data-flow §Rationale 참조)과는 다른 모집단" 이라는 한 줄 각주를 붙여 예방할 수 있다. 없어도 BLOCK 사유 아님.

## 요약
target 은 이미 채택·구현된 RBAC 가드 거부 코드 규칙(`data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드", 2026-09-25)을 `swagger.md` §5-4 문서 문구와 `code:` 시행 목록에 사후 동기화하는 draft로, 새 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 규칙을 도입하지 않는다. 인용 앵커·코드값·역할 계층·가드 파일 명명 전부 기존 spec/코드와 정합했고, 발견된 유일한 사항은 문서 가독성 수준의 INFO(모집단 수치 병기)뿐이다.

## 위험도
NONE
