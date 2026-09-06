# 신규 식별자 충돌 검토 — `user-entity-column-defense`

검토 대상: `spec/5-system/` scope 델타 0 (spec 변경 없음, 코드 전용 PR). 코드 diff(8파일/681줄)를
`origin/main...HEAD` 로 직접 실측해 신규 식별자를 전수 확인했다.

## 발견사항

- **[WARNING]** e2e 테스트 케이스 레터 `F.` 가 한 파일 안에서 두 번 재사용됨
  - target 신규 식별자: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 에 신규 추가된
    `it('F. GET /:id/members — 멤버 목록에 \`User\` 비밀 컬럼이 실리지 않는다', ...)` (신규 diff, 287행 부근)
  - 기존 사용처: 같은 파일에 이미 `it('F. sole owner 는 leave 불가 — 403 SOLE_OWNER_CANNOT_LEAVE', ...)`
    가 원래부터 존재 (`origin/main` 기준 326행, target 워킹트리에서는 382행으로 밀림).
    이 레터 스킴(`A.`~`I.`)은 `plan/complete/auth-workspace-membership-guard.md`("케이스 I")·
    `plan/complete/spec-draft-workspace-settings-api.md`("G(PATCH Admin+…)")에서 **외부
    추적 포인터로 인용**되고 있어, 단순 テ스트 타이틀이 아니라 사실상 이 파일 안의 케이스
    ID 체계로 쓰이고 있다.
  - 상세: 새 테스트가 기존에 이미 점유된 `F.` 를 재사용해, 같은 파일 안에 의미가 다른 두
    케이스가 동일 레터를 갖게 됐다(`git show origin/main:codebase/backend/test/workspace-rbac.e2e-spec.ts`
    로 대조: 원래 A~I 레터는 유일했다). 실행에는 지장이 없지만(Jest 는 동일 `it()` 타이틀
    중복을 허용), `jest -t "F\."` 같은 이름 기반 필터링을 쓰면 의도치 않게 두 케이스가
    동시에 걸리고, 향후 plan/리뷰 문서가 "워크스페이스 RBAC 케이스 F" 를 인용할 때 어느
    쪽을 가리키는지 모호해진다 — 위 두 plan 문서가 실제로 그런 인용 관례를 쓰고 있다.
  - 제안: 신규 케이스의 레터를 기존에 쓰이지 않은 `J.` (또는 파일 끝 재정렬)로 바꾼다.
    현재 파일의 마지막 레터가 `I.` 이므로 `J.` 가 자연스러운 다음 값이다(`S.` 는 기존에
    이미 알파벳 순서를 벗어나 있던 항목이라 이번 충돌과 무관).

## 그 외 확인했으나 충돌 없음

- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets`
  (`codebase/backend/src/shared/testing/user-secret-absence.ts`) — 저장소 전체에 동명 식별자
  없음. 7개 키(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
  `emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)는
  `codebase/backend/src/modules/users/entities/user.entity.ts` 의 실제 컬럼명과 1:1 일치.
- `UserRelationLoad` / `findUserRelationLoads` / `SRC_ROOT`
  (`codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`) — `SRC_ROOT` 는
  같은 디렉터리의 형제 가드(`nullable-type-lie-cast-guard.ts`, `swagger-dto-contract.spec.ts`)도
  각자 모듈-scope 로 동일 패턴(`path.resolve(__dirname, '..', '..')`)을 반복 export 하는
  기존 컨벤션이며, 전부 같은 디렉터리 깊이라 실제 값도 동일 — 이름은 겹치지만 모듈 경계가
  분리돼 있어 충돌이 아니라 기존 관행의 반복이다. `UserRelationLoad`·`findUserRelationLoads`
  는 신규이고 타 파일에 동명 정의 없음.
- 파일 경로: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` +
  `.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` + `.spec.ts`,
  `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` — 전부
  해당 디렉터리의 기존 `<name>-guard.ts`/`<name>.spec.ts`/`<name>.fixture.ts` 명명 컨벤션과
  일치하고, 동명 기존 파일 없음.
- `EXPECTED_USER_RELATION_LOADS` — 형제 가드의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 와 동일한
  `EXPECTED_*` 네이밍 패턴을 따름. 충돌 없음.
- `WorkspaceMemberDto.joinedAt` 신규 필드 — 새 식별자가 아니라 기존 엔티티 필드
  (`WorkspaceMember.joinedAt`, `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts`)
  와 기존 프론트엔드 소비 코드(`codebase/frontend/src/lib/api/workspaces.ts` 의
  `joinedAt: string | null`)를 뒤늦게 DTO 에 선언한 것 — 의미 충돌 없음(오히려 갭 해소).
- API endpoint·webhook/queue/SSE 이벤트명·환경변수·config key — 이번 diff 는 신규 도입 없음
  (기존 `GET /api/audit-logs`, `GET /api/workspaces/:id/members` 엔드포인트에 대한 검증
  보강뿐).
- `CHANGELOG.md` 신규 `## Unreleased — ...` 헤딩 — 기존에도 다수의 `## Unreleased` 헤딩이
  각기 다른 부제로 공존하는 확립된 컨벤션과 일치. 충돌 아님.

## 요약

이번 PR 은 `spec/5-system/` 을 건드리지 않는 코드 전용 변경으로, 새로 도입한 상수·함수·
인터페이스·파일 경로는 저장소 전체를 통틀어 실제 이름 충돌이 없었다(엔티티 컬럼명과도
정확히 일치). 유일하게 발견된 문제는 스펙 ID 나 API 표면이 아니라 **e2e 테스트 케이스 레터
체계**에서 발생했다 — 신규 테스트가 `workspace-rbac.e2e-spec.ts` 안에서 이미 다른 의미로
쓰이던 `F.` 레터를 재사용해, 외부 plan 문서가 인용하는 케이스 식별자 체계에 모호성을
만들었다. 실행 동작에는 영향이 없어 병합을 막을 사유는 아니지만, 레터를 `J.` 로 바꿔 이
파일의 케이스 ID 유일성을 회복할 것을 권한다.

## 위험도

LOW
