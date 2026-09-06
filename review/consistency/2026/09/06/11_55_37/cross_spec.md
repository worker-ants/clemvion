# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

`spec/5-system/` 자체의 델타는 이번 라운드도 0개 파일이다(코드 전용 PR). 프롬프트에
포함된 diff 는 예산 초과로 완전히 생략돼 있어, 지시에 따라 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`, HEAD)에서
`git diff origin/main...HEAD -- codebase/ CHANGELOG.md plan/` 로 실제 변경분(13개 파일,
1,471줄)을 직접 열어 확인했다. 이번 세션의 최신 커밋(`01b078379`, 11:55:29 — 이 리뷰 시작
1초 전 랜딩)까지 반영된 상태를 대상으로 했다.

이 브랜치는 직전 3라운드(`10_13_23`→`10_53_50`→`11_27_54`)에 걸쳐 같은 작업(`User` 엔티티
컬럼 노출 방어)을 반복 정제해 왔다. 최신 커밋(`01b078379`)의 커밋 메시지 자체가 "`11_27_54`
consistency WARNING 2 는 3차 재확인된 planner 항목이라 코드 변경 없음" 이라고 명시한다 —
즉 이번 라운드에서 cross-spec 관점의 상태 변화가 있는지가 핵심 질문이다. 직접 diff 를 대조한
결과, `01b078379` 은 가드 로직 정밀화(`select:{creator:true}` boolean 배제, eager 관계
축 신설, 타입 좁히기)만 담고 있고 spec 문서·API 계약·데이터 모델에 닿는 변경은 없다.

## 발견사항

- **[WARNING]** 신규 `User` 노출 방어 가드 2벌이 관련 spec 어디의 `code:` 에도 미등재 (3차 재확인 — 미해소)
  - target 위치: (코드) `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `.../user-entity-exposure.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`,
    `.../user-secret-absence.spec.ts`
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 「검증 층」("그 자리를 **두
    검증자**가 나눠 맡는다" — `swagger-dto-contract-guard.ts`/`response-contract.ts` 만
    명시), `spec/conventions/swagger.md` §5-1(같은 두 검증자만 등재), `spec/1-data-model.md`
    frontmatter `code:`(User 엔티티 자체)
  - 상세: 새 가드 2벌(`user-entity-exposure-guard.ts` = 구조 축, `user-secret-absence.ts` =
    이름 축)은 §5.4 「검증 층」이 이미 이름 붙여 설명하는 것과 같은 종류의 역할("엔티티를
    그대로 노출하지 말 것" 축, swagger §5-1 위임)을 `User` 특정 사례에 대해 수행하지만, 세
    문서(`1-data-model.md`/`2-api-convention.md`/`swagger.md`) 어디의 `code:` glob 도
    `user-entity-exposure*`/`user-secret-absence*` 를 매칭하지 않는다(`grep -rn
    "user-entity-exposure\|user-secret-absence" spec/` → 0건, 4개 신규 파일 전부 재확인).
    이 저장소는 하루 전 같은 실패(응답-계약 검증자를 한쪽 문서에만 등재)를 실측으로 겪고
    양쪽에 등재하는 관례(§5.4 "그 검증자는 **양쪽 문서의 `code:` 에 모두 등재**돼 있다")를
    세웠는데, 지금 신규 가드 2벌은 그 관례가 적용되기 **전** 상태다. 실무적 영향:
    `review_guard._spec_linked_changes()` 관점에서 이 4개 파일은 spec-linked 가 아니므로,
    이후 이 가드가 약화·삭제돼도 `--impl-done` 게이트가 그 변경을 spec 재검토 대상으로 못
    잡는다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
    담당 항목으로 등재돼 있다(`review/consistency/2026/09/06/10_13_23` W1 최초 식별,
    `10_53_50`·`11_27_54`·이번 라운드까지 4차 연속 재확인). **developer 권한 밖**(spec 본문·
    frontmatter 수정)이라 이번 커밋이 코드 변경 없이 넘긴 것은 CLAUDE.md 규약과 부합한다.
    다음 planner 턴에서: §5.4 「검증 층」 표에 구조 축/이름 축 두 행 추가 + 세 문서
    frontmatter `code:` 에 신규 파일 패턴 등재.

- **[WARNING]** `User` 민감 7컬럼의 "응답 비노출" 불변식이 spec 문장이 아니라 코드에만 존재 (3차 재확인 — 미해소)
  - target 위치: (코드) `codebase/backend/src/shared/testing/user-secret-absence.ts` 의
    `USER_SECRET_KEYS`(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
    `webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken` — 7개.
    `codebase/backend/src/modules/users/entities/user.entity.ts` 의 실제 컬럼과 1:1 대조
    완료, 누락·초과 없음)
  - 충돌 대상: `spec/1-data-model.md §2.1 User`(동일 7컬럼을 `password_hash` 등으로
    문서화하지만 노출 금지 문장 없음) vs `spec/conventions/secret-store.md §1.1 "비대상
    필드도 응답 바디에는 나가지 않는다"`(Trigger/AuthConfig 인접 필드에 대해 대칭적인
    규범을 이미 신설해 둠, 2026-08-31~09-05)
  - 상세: `secret-store.md §1.1` 은 정확히 같은 종류의 요구("이 필드가 응답에 나가면 안
    된다")를 Trigger·AuthConfig 도메인에 대해 정규 문장으로 세워 뒀다. `User` 는 같은 강도의
    요구가 있어야 할 이유가 이번 diff 로 오히려 강해졌다 — 실제로
    `WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 유출한 사고
    (`review/code/2026/09/06/10_13_22` Critical 1)를 겪었는데도, `1-auth.md`·
    `1-data-model.md` 어디에도 "User 의 이 7컬럼은 응답에 실려선 안 된다" 는 대응 문장이
    없다. 그 불변식의 유일한 SoT 는 코드 상수(`USER_SECRET_KEYS`)뿐이다.
  - 제안: 이미 같은 plan 파일에 planner 담당 W2 로 등재돼 있다
    (`review/consistency/2026/09/06/10_13_23` W2, 4차 연속 재확인). `1-data-model.md §2.1`
    또는 `secret-store.md` 와 나란히 새 절에 "User 의 7컬럼은 응답 DTO 에 선언되어서도,
    응답 바디에 실려서도 안 된다" 는 규범 문장을 추가하고 두 가드를 근거로 링크.

## 검토했으나 충돌 없음으로 판정한 항목 (참고용)

- `WorkspaceMemberDto.joinedAt: string | null` 신규 필드 — `1-data-model.md §2.3
  WorkspaceMember` 의 `joined_at Timestamp?` 와 타입 일치. `@ApiProperty({nullable:
  true})` 선언도 `2-api-convention.md §5.4` "기본형"(상시 존재 + null) 규칙과 정확히
  부합하며, JSDoc 에 실측 근거("네 자리가 전부 즉시 채운다")까지 명시했다. 충돌 없음.
- `WorkflowVersionsService.findOne` 이 `relations: ['creator']`(무투영) → `select:
  CREATOR_PROJECTION`(3필드 투영)으로 좁혀진 것 — `WorkflowVersionCreatorDto` 기존 계약
  (id/name/email)에 실제 쿼리를 맞춘 정합화이며 자매 메서드 `findByWorkflow` 와도 이제
  일치한다. 충돌 없음.
- `ProjectedCreator = Pick<User,'id'|'name'|'email'>` 로 `WorkflowVersionListItem`/
  `WorkflowVersionDetail` 반환 타입을 좁힌 것 — 순수 TS 타입 정밀화, 어떤 spec 계약도
  변경하지 않는다. 충돌 없음.
- `findEagerUserRelations`(eager 관계 0건 고정) 신설 — 현재 저장소에 `User` 를 가리키는
  eager 관계가 실제로 0건임을 확인(`grep -n "eager:\s*true" codebase/backend/src/modules/**/*.entity.ts`
  범위에서 `User` 참조 없음). 어떤 spec 문서도 eager 로딩을 요구하지 않으므로 충돌 없음.
- `Execution.executor: User | null` 관계(가드 파생 목록에서 발견) — spec 상 컬럼명은
  `executed_by`(`1-data-model.md §2.13`)이고 TS 관계 프로퍼티명은 `executor` 다. TypeORM
  FK 컬럼명과 관계 프로퍼티명이 다른 것은 이 저장소의 일반적 패턴(`@JoinColumn({name:
  'executed_by'})`)이라 명명 불일치이지 데이터 모델 모순은 아니다. (명명 표기 자체는
  naming-collision 검토 범위로 넘김.)
- `01b078379`(최신 커밋)이 추가한 `select:{creator:true}` boolean 배제 로직 · fixture
  12번째 위반 케이스 · 이름 있는 상수 투영 대조군 — 전부 가드 내부 판정 정밀도 개선이며
  spec 표면에 닿지 않는다. 충돌 없음.

## 요약

이번 라운드의 실제 diff(13개 파일, `WorkflowVersionsService.findOne` 투영 수정·
`WorkspaceMemberDto.joinedAt` 노출·`User` 노출 검출 가드 2벌 신설과 그 정밀화)는 관련된
모든 spec 영역(`1-data-model.md`, `3-workflow-editor/5-version-history.md`,
`5-system/1-auth.md`, `5-system/2-api-convention.md`)의 기존 계약과 직접 모순되지 않으며,
오히려 문서화된 계약에 구현을 정합시키는 방향이다(CRITICAL 없음). 다만 이 작업이 낳은 새
검출 코드가 어느 spec 의 `code:` 에도 걸리지 않는 점, 그리고 `User` 민감 컬럼 비노출이라는
불변식이 대칭 도메인(`secret-store.md §1.1`)과 달리 규범 문장으로 존재하지 않는 점은 실질적인
cross-spec 정합성 공백으로 4라운드 연속(10_13_23→10_53_50→11_27_54→이번) 재확인됐다. 두
항목 모두 이번 라운드에 새로 발생한 것이 아니라 이미 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 담당으로 등재돼 있고, 최신 커밋은
그 범위(developer 권한 밖, spec 본문·frontmatter 변경)를 침범하지 않고 코드 정밀화만
수행했다 — CLAUDE.md 의 "developer 는 spec 변경 필요 시 planner 위임" 규약과 부합하는
처신이다.

## 위험도

MEDIUM — 활성 모순(CRITICAL)은 없다. 두 WARNING 은 "보안 경계를 검출하는 코드가 spec
게이트 사각지대에 있다"는 동일 성격의 반복이며, 4라운드 연속 미해소로 방치 기간이 늘고
있다. 이미 plan 에 추적 중이고 이번 diff 가 그 범위를 정확히 지켰으므로 이 PR 자체를
즉시 차단할 사안은 아니나, 다음 planner 턴에서 우선 처리를 권고한다.
