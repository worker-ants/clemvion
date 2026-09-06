# 정식 규약 준수 검토 — spec/5-system/ (user-entity-column-defense)

## 검토 조건 요약

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **scope 델타: 0개 파일** — 이 브랜치는 `spec/5-system/` 을 변경하지 않았다. 코드 전용 PR 이므로 정상이며, 델타 0 자체를 CRITICAL 근거로 쓰지 않는다(프롬프트 명시 지침 준수).
- 프롬프트 번들의 diff 본문은 예산으로 잘려 있어, 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`, 세션 CWD 와 동일)에서 `git diff origin/main --stat -- codebase/ plan/` 을 직접 실행해 실제 변경분(12개 파일, codebase 11 + plan 1)을 확인했다.
- 이 세션은 동일 브랜치의 세 번째 라운드다(`10_13_23` → `10_53_50` → 본 라운드). 코드 diff 는 `10_53_50` 시점과 **동일**(신규 커밋 없음, `review/code/2026/09/06/11_27_53/` 는 프롬프트만 생성되고 아직 산출물 없음) — 따라서 본 라운드의 결론은 직전 라운드의 재확인 성격이 강하다.

## 검증 방법

1. `spec/5-system/1-auth.md`(전문)·`2-api-convention.md`(전문, 특히 §5.4)·`3-error-handling.md`(부분)를 실제 `spec/conventions/*.md` 원문과 대조.
2. 이번 PR 이 건드린 코드 변경분을 직접 열람해 spec 이 정한 출력 포맷·DTO 규약과 대조:
   - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`joinedAt` 필드 신설)
   - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`CREATOR_PROJECTION` 추출 + `findOne` 투영 추가)
   - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `user-entity-exposure.spec.ts`
   - `codebase/backend/src/shared/testing/user-secret-absence.ts`, `user-secret-absence.spec.ts`
   - `codebase/backend/test/{audit-logs,workflow-crud,workspace-rbac}.e2e-spec.ts` 의 신규 케이스
3. `USER_SECRET_KEYS`(7개)를 `spec/1-data-model.md §2.1 User` 및 `codebase/backend/src/modules/users/entities/user.entity.ts` 와 1:1 대조.
4. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 diff(+107줄)를 읽어, 직전 라운드가 지적한 항목의 등재·미해소 상태를 재확인.

## 발견사항

- **[WARNING]** §5.4 "두 검증자" 서술이 신규 검증자 도입 후 실측과 어긋남 (재확인 — 신규 아님)
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층"(표 2행 + 본문 "그 자리를 **두 검증자**가 나눠 맡는다") · `spec/conventions/swagger.md` §5-1("**두 검증자**의 경계는 … 이 소유한다")
  - 위반 규약: 두 문서 모두 자기 자신(정식 규약/spec 본문)이 "검증자는 정확히 둘"이라고 개수를 못 박고 있는데, 이번 PR 이 `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축) 두 개의 신규 검증자를 추가해 실제로는 네 축이 됐다. `spec/conventions/swagger.md` frontmatter `code:`(4~11행)도 `swagger-dto-contract*.ts`·`response-contract*.ts`·`swagger-probe*.ts` 만 등재해 신규 4개 파일과 매칭되지 않는다.
  - 상세: `review_guard._spec_linked_changes()` 로 직접 확인해도(직전 라운드 인용) 신규 4파일은 spec-linked 판정 0건이다 — 즉 이 가드를 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 잡지 못한다. §5.4 자신이 경고한 "한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다" 실패 모드가 그대로 재현된 사례다. 다만 이 지적은 **신규가 아니다** — `10_13_23`(5개 checker 중 4개 독립 보고) → `10_53_50`(3개 checker 재확인) → 본 라운드로 이어지는 동일 항목이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재"(planner 담당, 미체크 `- [ ]`)로 정식 등재돼 있다. developer 는 `spec/` 쓰기 권한이 없어(CLAUDE.md write-boundary) 이 브랜치에서 직접 고칠 수 없고, planner 후속으로 넘긴 처분은 프로젝트 관례와 정확히 일치한다.
  - 제안: 이번 라운드에서 새로 요구할 조치는 없음(이미 올바르게 처분됨). planner 턴에서 §5.4 표에 행을 추가하고 두 문서 `code:` 를 갱신할 때, plan 항목이 이미 못 박아 둔 대로 **"두 검증자" 같은 개수 표현 대신 표로 나열**하는 형태로 고쳐야 축이 늘 때마다 문장이 다시 낡는 것을 막는다(같은 실패가 이미 2회 반복됐다는 지적을 plan 이 포함하고 있다).

- **[INFO]** 인접 파일의 사전 존재 `optional+nullable` DTO 조합 — 이번 PR 범위 밖
  - target 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`WorkflowVersionCreatorDto`/`creator?: WorkflowVersionCreatorDto | null`, `@ApiPropertyOptional({ nullable: true })`) — 이번 diff 가 건드리지 않은 파일(마지막 변경 `#593`, 오래전)
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언 형태" — *"키를 생략하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)"*. `WorkflowVersion.creator`(`@ManyToOne(() => User)`)와 `created_by`(NOT NULL, FK `ON DELETE` 절 없음 = 참조 무결성상 항상 해소 가능)를 보면 로드됐을 때 `creator` 가 실제로 `null` 이 되는 경로는 없다 — "관계 미로드 시 키 생략"만 있고 "로드했는데 값이 null" 인 경우는 없으므로, 정확한 선언은 `@ApiPropertyOptional()` + `creator?: WorkflowVersionCreatorDto`(`| null` 없이)여야 한다.
  - 상세: 이 PR 이 새로 추가한 e2e(`workflow-crud.e2e-spec.ts` "H." 케이스)가 바로 이 `creator` 필드를 `assertMatchesContract(WorkflowVersionDto)` 로 계약 대조하지만, 값이 존재하는 양성 케이스만 검증하므로 이 선언 형태 문제(옵셔널인데 `nullable`까지 선언)는 걸리지 않는다. 다만 동일 패턴(`@ApiPropertyOptional` + `nullable: true`)이 `codebase/backend/src/modules/**/dto/responses/*.ts` **21개 파일**에 광범위하게 존재해, 이번 PR 이 만든 드리프트가 아니라 훨씬 이전부터의 레포 전역 관행으로 보인다. 필드별로 "진짜 nullable" 인지 "옵셔널뿐" 인지 구분하려면 각 필드의 도메인 로직을 개별 확인해야 하므로 이번 리뷰의 diff 스코프 밖이다.
  - 제안: 이번 PR 을 막을 사유는 아님. 다음에 `swagger-dto-contract-guard.ts` 를 확장할 기회가 있으면 "선언 자기모순"(현재 검증 대상)뿐 아니라 "옵셔널+nullable 동시 선언"(§5.4 가 금지한 조합)도 정적으로 잡는 축을 추가하는 것을 고려할 만하다 — 별도 planner/developer 티켓 사안.

- **[INFO]** `## Overview (제품 정의)` 제목 표기 불일치 (이전 라운드부터 이월, 변경 없음)
  - target 위치: `spec/5-system/2-api-convention.md` (`## Overview (제품 정의)`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale)" 명명 관례 — 동일 폴더의 `1-auth.md`·`3-error-handling.md` 는 순수 `## Overview` 를 쓴다.
  - 상세: 기능적 영향 없음. 이번 PR 이 만든 드리프트가 아니며 `10_53_50` 라운드에서도 동일하게 INFO 로 보고됐다.
  - 제안: 다음에 이 문서를 편집할 기회가 있을 때 정리. 이번 PR 로 인한 신규 항목 생성은 불필요.

## 준수 확인 (긍정 항목)

- `WorkspaceMemberDto.joinedAt: string | null` + `@ApiProperty({ format: 'date-time', nullable: true, type: String })` 신설은 §5.4 **기본형**(상시 존재 + `nullable: true`) 규칙에 정확히 부합한다. `spec/1-data-model.md §2.1 WorkspaceMember` 의 `joined_at: Timestamp?` 와도 일치하고, DTO 주석이 "스키마를 따른 것이지 현재 도달 가능한 상태는 아니다" 라고 실측(2026-09-06)까지 정확히 명시했다.
- `USER_SECRET_KEYS`(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`, 7개)는 `spec/1-data-model.md §2.1 User` 의 토큰/시크릿 컬럼 7개 및 `user.entity.ts` 실제 프로퍼티명과 정확히 1:1 대응한다. camelCase↔snake_case 양쪽을 모두 방어(`snakeCase()` 헬퍼)하는 것도 raw 쿼리 결과 경로까지 고려한 설계다.
- `user-entity-exposure-guard.ts` 는 파일 헤더에서 스스로 "파서 순수 로직과 소비 spec 분리 규약은 형제 가드 `nullable-type-lie-cast-guard.ts`·`swagger-dto-contract-guard.ts` 와 동일" 이라 명시했고, 실제로 두 형제 파일이 같은 폴더에 존재해 이 명명·구조 관례를 정확히 따르고 있다.
- `WorkflowVersionsService` 의 `CREATOR_PROJECTION` 상수화(→ `findOne`/`findByWorkflow` 공유)는 `spec/conventions/swagger.md §5-1`("엔티티를 그대로 노출하지 말 것")이 지목하는 사각지대(컨트롤러가 엔티티 패스스루)를 정확히 겨냥해 닫는 수정이며, `WorkflowVersionCreatorDto` 가 광고하는 필드 집합(`id`/`name`/`email`)과 일치한다(유닛 테스트로 강제).

## 요약

이번 PR 은 `spec/5-system/` 을 변경하지 않는 코드 전용 변경(User 엔티티 컬럼 노출 방어 2종 신설 + `WorkflowVersionsService.findOne` 의 살아있는 `User` 전체 컬럼 유출 수정 + `WorkspaceMemberDto.joinedAt` 필드 추가)이다. 신규로 추가된 DTO 필드·비밀 컬럼 목록·검증자 명명 패턴은 모두 `spec/5-system/2-api-convention.md §5.4`·`spec/1-data-model.md §2.1`·`spec/conventions/swagger.md §5-1` 과 정확히 부합한다. 유일하게 남은 실질적 이슈(§5.4 "두 검증자" 서술이 이제 네 축을 가리키게 된 것과 `code:` frontmatter 미등재)는 이번 라운드가 새로 발견한 것이 아니라 `10_13_23` 라운드부터 세 라운드 연속 확인된 항목으로, `spec/` 쓰기 권한이 없는 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목(미체크)으로 정확히 위임해 두었다 — 프로젝트 write-boundary 관례를 그대로 따른 정당한 처분이다. 그 외 발견한 INFO 2건(사전 존재 optional+nullable DTO 조합 21개 파일 — PR 범위 밖, Overview 제목 표기 불일치 — 이월)도 이번 PR 이 유발한 드리프트가 아니다. 새로 도입된 conventions 직접 위반은 없다.

## 위험도

LOW
