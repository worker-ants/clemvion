# Requirement Review — canary-readme-recheck-test

## 검증 방법

리뷰 대상 파일 4개 중 실질 코드/문서 변경은 파일 1(`codebase/backend/README.md`)과 파일 2
(`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`)이고, 파일 3·4는 plan
트래커 문서다. 아래 근거로 실제 구현·spec·git 이력을 직접 대조했다:

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 전문
- `codebase/backend/src/common/decorators/workspace.decorator.ts`(grep)
- `codebase/backend/src/common/guards/roles.guard.ts`(grep)
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`transferOwnership`,
  `throwOwnerTransferRequired`, `getMemberRole`)
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`@Roles('owner')` 위치)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (`describe('transferOwnership', …)` 전체 블록)
- `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증"
- `spec/data-flow/12-workspace.md` (owner 요구 라우트 수 서술)
- git log(`5ba95e4b8` #1399, `bcc0402bb` #1400)로 "`remove`에 `@Roles('owner')`가 새로 붙었다"는
  주장 실측

## 발견사항

### README.md — 캐너리 절 정정

- **[INFO]** README 정정 내용은 실제 코드·spec과 line-level로 일치한다.
  - 위치: `codebase/backend/README.md:52-63`
  - 상세: `@WorkspaceId()`/`@WorkspaceParam(...)` 두 판별 합계 0에서만 부팅 거부(`total === 0`,
    `workspace-reflection-canary.ts:149`), 로그가 두 개수를 따로 남긴다는 문구
    (`workspace-reflection-canary.ts:152-155`의 실제 로그 포맷과 정확히 일치),
    "먼저 볼 곳"에 `workspaceParamNamesOf` 추가(두 함수가 `routeArgEntriesMatching` 골격을
    공유함을 `workspace.decorator.ts`에서 확인) — 모두 코드와 정합한다. 또한 이 캐너리의
    "두 팩토리를 센다" 확장은 `spec/5-system/1-auth.md:798-836`에 2026-09-25 자로 이미 반영돼
    있어 README-spec-code 삼자가 모두 일치한다(SPEC-DRIFT 아님).
  - 제안: 없음(정정 정확).

### workspaces.service.spec.ts — 트랜잭션 재검사 분기 테스트

- **[INFO]** 새 `it.each` 테스트가 실제 재검사 분기(`workspaces.service.ts:756-762`)의 OR 두
  갈래(강등 `role !== 'owner'`, 멤버십 소멸 `!requesterMembership`)를 정확히 겨냥한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('transferOwnership', …)` 내 `it.each([...])` 블록(무락 선행 owner → 락 재검사 admin/null)
  - 상세: mock의 `opts.lock` 유무로 무락 선행(`getMemberRole`, `workspaces.service.ts:116-118`,
    lock 없음)과 트랜잭션 내 재검사(`workspaces.service.ts:756-758`, lock 있음)를 구분하는
    방식이 실제 호출 인자와 정확히 대응한다. 기대값(`OWNER_REQUIRED` 코드·
    `'owner 이양은 현재 owner 만 수행할 수 있습니다.'` 메시지)은
    `throwOwnerTransferRequired`(`workspaces.service.ts:939-944`)와 문자 그대로 일치한다.
    `requesterReads`를 `where.userId === requesterId`로 필터링해 `[null, {mode:
    'pessimistic_write'}]` 순서를 단언하는 부분도 실제 호출 순서(무락 선행 1회 → 트랜잭션 내
    재검사 1회)와 맞는다. `memberRepo.save`/`workspaceRepo.save` 미호출 단언도 예외가 두 save
    이전에 던져지는 실제 흐름과 일치한다.
  - 제안: 없음.

### plan 트래커 문서(파일 3·4) — 처분 절차 및 사실관계

- **[INFO]** 트래커에 기록된 사실 주장("`@Roles('owner')`는 현재 2곳〈`remove`·
  `transferOwnership`〉, `#1399` 직전은 1곳")을 git 이력으로 재검증했다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:222,268`(현재
    `@Roles('owner')` 2곳), 커밋 `5ba95e4b8`(#1399) diff에서 `remove`에 `@Roles('owner')`가
    `+` 라인으로 신규 추가된 것을 확인.
  - 상세: `spec/data-flow/12-workspace.md:368,416`도 "Owner 요구 2곳(`remove`·
    `transferOwnership`)", "경로 라우트에 … `owner` 1 을 붙여"라고 이미 서술하고 있어, plan이
    "`--impl-prep` W3는 checker의 오독"이라 판단하고 spec 직접 수정 대신 명확화 문구를
    planner 트래커 항목으로만 등재한 처분(`spec-draft-nullable-notation-followups.md`)이
    CLAUDE.md의 "spec 변경은 project-planner" 경계를 정확히 지켰다.
  - 제안: 없음 — 절차·사실관계 모두 정확.

## 요약

이번 diff는 동작 변경이 없는 문서 정정(backend README의 워크스페이스 reflection 캐너리 절을
`#1399`/`#1400` 이후 실제 코드에 맞춤)과 기존 `transferOwnership` 트랜잭션 내 재검사 분기(동시
강등·멤버십 소멸 OR 두 갈래)를 고정하는 신규 unit 테스트로 구성된다. README의 모든 구체적 서술
(카운트 기준·로그 포맷·에러 메시지·"먼저 볼 곳")을 실제 소스(`workspace-reflection-canary.ts`,
`workspace.decorator.ts`, `roles.guard.ts`)와 대조한 결과 전부 일치했고, 관련 spec
(`spec/5-system/1-auth.md`, `spec/data-flow/12-workspace.md`)도 이미 같은 내용으로 갱신돼 있어
spec-drift도 없다. 신규 테스트는 프로덕션 코드의 실제 조회 순서(무락 선행 → 트랜잭션 내 락
재검사)와 예외 코드·문구·부작용 미발생(save 미호출)을 정확히 검증하며, 트래커에 기록된
"오독" 판정도 git 이력으로 재확인해 근거가 있음을 확인했다. TODO/FIXME, 미완성 분기, 반환값
누락, 데이터 유효성 결함은 발견되지 않았다. Critical/Warning 없음.

## 위험도
NONE
