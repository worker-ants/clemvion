# 신규 식별자 충돌 검토

## 검토 범위 확인

- scope(`spec/5-system/`) 델타: **0개 파일** — 이 브랜치(`claude/entity-nullable-batch1`)는 spec 을 변경하지 않았다. 따라서 신규 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV 키·spec 파일 경로는 spec 레벨에서 전혀 도입되지 않았다.
- 구현 diff: 14개 파일 (`git diff origin/main...HEAD -- codebase/` 로 재확인, 546줄 변경). 내용은 `User`/`Schedule` 엔티티 컬럼 타입을 `nullable: true` 에 맞춰 `X | null` 로 넓히고, `null as unknown as X` 이중 캐스트를 걷어내며, 그 회귀를 막는 신규 repo-guard 를 추가한 것이다. 순수 버그 수정 + 내부 테스트 하네스 추가이며 spec 표면(요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV 변수)을 새로 정의하지 않는다.
- diff 가 실제로 도입하는 새 "식별자"는 아래 코드 레벨 심볼·파일 뿐이다. 전부 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)에서 직접 확인했다.

## 신규 식별자 목록 및 충돌 검사

| 신규 식별자 | 위치 | 충돌 검사 결과 |
|---|---|---|
| `countNullAsUnknownAsCasts`, `hasNullAsUnknownAsCast` (함수) | `codebase/backend/src/common/__test-utils__/source-scan.ts` | `git grep` 으로 동일 모듈 내 기존 export(`countCalls`, `countRawUpdateReturning`, `hasRawUpdateReturning`) 및 저장소 전체와 대조 — 이름 충돌 없음 |
| `CastOffender`, `UntypedNullableColumn` (interface) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (신규 파일) | 저장소 전체 `git grep` — 다른 의미로 쓰이는 동일 이름 없음 |
| `collectScanTargets`, `findCastOffenders`, `findUntypedNullableColumns`, `joinColumnNames`, `SRC_ROOT`, `COLUMN_DECL`, `COLUMN_NAME` (함수/상수) | 위 동일 파일 | 저장소 전체 `git grep` — 충돌 없음 |
| `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` / `nullable-type-lie-cast.spec.ts` (신규 파일 경로) | — | `repo-guards/__tests__/` 디렉터리 전체 나열 확인. 기존 파일과 겹치지 않고, `<이름>-guard.ts` + `<이름>.spec.ts` 형제 쌍 컨벤션(예: `masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts`, `eslint-unicorn-peer-guard.ts`/`eslint-unicorn-peer.spec.ts`)을 그대로 따른다 — 컨벤션 위반 없음 |
| `plan/in-progress/entity-nullable-column-type-mismatch.md` (plan 파일 경로, diff 주석이 참조) | `plan/in-progress/` | 디렉터리 나열 확인 — 동명의 기존 파일 없음, `<name>.md` 단일 파일 컨벤션 준수 |

엔티티 컬럼 타입 변경(`User.passwordHash`, `twoFactorSecret`, `emailVerifyToken`, `emailVerifyExpiresAt`, `passwordResetToken`, `passwordResetExpiresAt`, `lockedUntil`, `Schedule.nextRunAt` → `X | null`)은 **기존** 필드명을 그대로 쓰며 타입만 실제 DB `nullable: true` 제약에 맞춘 것이다. 새 필드명·새 컬럼명을 도입하지 않았으므로 엔티티/필드명 충돌 대상이 아니다.

## 발견사항

없음. 검사한 6개 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로) 모두에서 신규 식별자 충돌이 발견되지 않았다.

## 요약

이 PR 은 spec 을 변경하지 않는 순수 구현 수정(nullable 컬럼 타입 정합화 + `null as unknown as X` 캐스트 제거 + 회귀 방지용 신규 repo-guard)이며, 신규로 도입되는 모든 코드 레벨 식별자(함수·인터페이스·파일 경로)를 저장소 전체와 대조한 결과 기존 사용처와의 의미 충돌이 없다. 새 파일 두 개(`nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts`)는 `repo-guards/__tests__/` 의 기존 guard/spec 형제 쌍 명명 컨벤션을 그대로 따른다. 요구사항 ID·API endpoint·이벤트명·ENV 변수 등 spec 표면 식별자는 이번 변경으로 전혀 신설되지 않았다.

## 위험도

NONE
