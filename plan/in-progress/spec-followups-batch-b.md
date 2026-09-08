---
title: 배치 B — 타입체크 사각 봉인 · pg-error SoT 단일화 · listMembers 투영 · 트리거 409 e2e
worktree: spec-followups-batch-b-7c31ad
started: 2026-09-08
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/2-navigation/2-trigger-list.md
---

# 배치 B — developer 턴

`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 **developer/harness 항목 8건**.
배치 A(`#1299`, `ee96a90de`)가 머지돼 harness 권한 조항이 `origin/main` 에 있으므로 B-1·B-2 의
차단이 풀렸다 — 실측: `git show origin/main:CLAUDE.md | grep harness` 로 확인.

**착수 전 재판정 (2026-09-08)**: `origin/main` = `ee96a90de`(#1299). 배치 A 이후 다른 세션의
머지 **0건**. 8건 모두 유효.

---

## B-1. `run-test.sh` 4단계가 타입체크 ratchet 을 안 돈다 (harness)

`#1292` 가 14라운드 로컬 검증을 전부 통과하고 **CI 에서 처음** 걸렸다
(`src/shared/testing/pg-error-fixtures.ts: 0 → 1`, TS2739).

**원리적으로 못 보는 자리다** — `run-test.sh build` 는 `tsconfig.build.json` 을 쓰는데 그 파일이
`src/shared/testing/**` 를 exclude 하고, jest 는 타입을 strip 한다. frontend 는 원인이 다르지만
같은 사각이다(`tsconfig.json` 자신이 테스트 경로를 exclude, `vitest run` 이 타입 strip).

> **`PROJECT.md` 가 이 갭을 이미 문서화하고 있다** — *"wrapper 4단계 밖의 CI 게이트 …
> `run-test.sh` 는 lint/unit/build/e2e 고정이라 아래는 포함되지 않는다"*. 즉 **미문서화 결함이
> 아니라 문서화된 결함**이다. 그러니 이 변경은 그 문장을 **함께 고쳐야** 한다 — 안 고치면
> `PROJECT.md` 가 거짓이 된다.

→ `.claude/test-stages.sh` 의 `cmd_build()` 안에서 두 ratchet 을 함께 돌린다.
   `PROJECT.md` 의 「wrapper 4단계 밖의 CI 게이트」 표에서 두 행을 옮기고, 남은 두 행
   (deps-security · harness)은 그대로 둔다.

**왜 build 단계인가**: 두 ratchet 이 대조하는 대상이 정확히 *"build 가 exclude 한 자리"* 다.
같은 단계에 두면 *"이 단계는 타입을 본다"* 가 한 자리에 모인다.

## B-2. `src/common/__test-utils__/` 5파일이 dist 로 나간다 (developer)

`tsconfig.build.json` 의 exclude 는 `*spec.ts` · `src/repo-guards/**` · `src/shared/testing/**`
셋이라 `__test-utils__` 가 어디에도 안 걸린다.

**지금은 지뢰가 아니다** — 전 파일의 import 가 node 내장 + 로컬뿐이라 exclude 목록 주석이
경고하는 형태(devDependency 지뢰)는 없다. **죽은 코드가 dist 에 실릴 뿐**이다.

→ exclude 에 `**/__test-utils__/**` 를 더한다. **경로가 아니라 디렉터리 이름 규약**으로 막아야
   다음에 어디에 만들어도 걸린다.

## B-3. 전역 예외 필터가 `pg-error.ts` SoT 를 안 쓴다 (developer)

`http-exception.filter.ts` 의 로컬 `isUniqueViolation` 이 **`err instanceof QueryFailedError` 를
먼저 요구**한다. 그래서 raw(`err.code`) 표면으로 올라온 23505 는 409 가 아니라 **500** 이 된다.
`pg-error.ts` 를 SoT 로 세운 이유가 정확히 그 표면 분기인데, **국소 처리가 없는 대다수 서비스가
지나는 fallback 에는 좁은 판이 그대로 남았다.**

**blast radius 는 지금 ~0** — 우리 스키마를 치는 raw query 가 요청 경로에 없다. 즉 **구조적
불일치이지 현재 버그는 아니다.** 그래도 *"가장 넓은 fallback 이 가장 좁다"* 는 형태가 남는다.

→ `isPostgresUniqueViolation(err)` 로 교체. `QueryFailedError` import 도 함께 사라진다(그 파일
   안에서 다른 용처가 없음을 확인).

## B-4. `listMembers` 를 DB 레벨 투영으로 (developer)

지금은 `relations: ['user']` 로 `User` 전 컬럼을 싣고 **JS 단 수동 매핑**으로 좁힌다.
`user-entity-exposure-guard` 는 **로드 형태**만 보므로 이 자리는 보호 범위 밖이고, 방어가
**검출**이지 **강제**가 아니다.

→ `select` 투영으로 전환. **완료의 기계적 증거는 화이트리스트에서 이 항목이 빠지는 것**이다 —
   래칫이 양방향이라 목록에 남겨 두면 실패한다.

> **가드가 `select` 투영을 인정하는 형태를 미리 확인했다**: `hasProjectionFor` 는 같은 옵션
> 객체의 `select` 에서 관계 이름 키를 찾아 **값이 불리언이 아니면** 투영으로 본다
> (`select: { user: true }` 는 투영이 아니다 — 그것이 이 가드가 막는 결함 클래스다).

## B-5. `integration-oauth.service.ts` 의 손-작성 constraint 추출 2곳 (developer)

신설한 `pgErrorConstraint()` 가 정확히 대체할 패턴이 남아 있다. 실측: 2곳(cafe24·makeshop 설치
경로), 각각 4줄. 둘 다 이미 `isPostgresUniqueViolation` 을 import 해 쓰므로 치환은 import 한 줄
+ 표현 2개다.

**동작이 옳고**(같은 두 표면을 본다) 위험이 없다 — 남은 것은 중복뿐이다.

## B-6. `endpointPath` 를 쓰는 다음 `save()` 가 충돌 래핑을 빠뜨릴 수 있다 (developer)

`TriggersService` 의 `triggerRepository.save()` 는 **8곳**인데 `rethrowEndpointPathConflict` 로
감싼 것은 `create`/`update` **둘뿐**이다. 나머지 여섯은 `endpointPath` 를 건드리지 않으므로
**지금은 옳다.**

**비대칭이 남는다** — 앞으로 `endpointPath` 를 쓰는 `save()` 가 새로 생기면 그 경로만 미가공
500 이 되고, **아무도 알려 주지 않는다.**

→ AST 래칫: *"`endpointPath` 를 대입·갱신하는 메서드의 `save()` 는 래핑돼야 한다"*.
   화이트리스트가 비대칭을 문서가 아니라 **테스트로** 들고 있게 된다.

## B-7. 트리거 `endpoint_path` 409 충돌에 e2e 가 없다 (developer)

단위 mock 검증은 촘촘한데 **실 DB 유니크 제약을 타는 경로**가 없다. 같은 PR 의 다른 두 갈래
(`WorkflowVersions`·`WorkspaceMember`)는 e2e 를 보강했으므로 형평이 어긋난다.

→ 중복 `endpointPath` 생성 1건 — 409 + `code` + `details` 두 키 단언.
   **단위가 mock 하는 드라이버 에러 형태가 실제와 같은지는 이 케이스만 확인할 수 있다.**

## B-8. `WorkflowVersionDetail` 동명 미러 (developer)

백엔드 `workflow-versions.service.ts` 와 프런트엔드 `lib/api/workflows.ts` 가 같은 이름의
**손-미러** 타입을 각자 선언한다. **이름이 같아서 한 세션에서 3라운드 연속 "유일 정의" 오판이
났다** — grep 이 두 자리를 같은 것으로 보여 준다.

→ **백엔드를 개명한다** (`WorkflowVersionDetailProjection`). 공유 패키지 승격은 하지 않는다 —
   두 타입은 실제로 형태가 다르다(`createdAt` Date vs string, `creator` 고정 3필드 vs
   옵셔널·nullable, `snapshot` 엔티티 타입 vs `VersionSnapshot`). 억지로 합치면 wire 계약을
   건드리게 되고, 이 항목이 고치려는 것은 **형태 불일치가 아니라 이름 충돌**이다.
   프런트 소비처 2곳은 프런트 타입을 쓰므로 영향 없다.

---

## 체크리스트

- [ ] `--impl-prep` 게이트 통과
- [ ] B-1 `.claude/test-stages.sh` + `PROJECT.md` 동반 갱신
- [ ] B-2 `tsconfig.build.json` exclude (디렉터리 이름 규약)
- [ ] B-3 필터 → `isPostgresUniqueViolation` + 최상위 표면 회귀 테스트
- [ ] B-4 `listMembers` 투영 + **화이트리스트에서 항목 제거**
- [ ] B-5 `pgErrorConstraint()` 치환 2곳
- [ ] B-6 `endpointPath` save() 래핑 래칫
- [ ] B-7 트리거 409 e2e 1건
- [ ] B-8 백엔드 타입 개명 + 양쪽 JSDoc 갱신
- [ ] TEST WORKFLOW (lint / unit / build / e2e)
- [ ] **두 타입체크 ratchet 직접 실행** (B-1 이 4단계에 넣더라도 이번 PR 은 그 변경 자체를 검증해야 한다)
- [ ] `python3 -m pytest .claude/tests -q` (B-1 이 harness 를 건드린다)
- [ ] `/ai-review` + Critical/Warning fix
- [ ] `--impl-done`
- [ ] 자매 트래커 체크박스 플립 (개별 열거로 확인)
