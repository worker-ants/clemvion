# 동시성(Concurrency) 리뷰

## 검토 범위

이번 변경셋의 실제 diff 파일은 다음 4종류로 구성된다.

1. `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 설명을 `@WorkspaceId()`/`@WorkspaceParam(...)` 두 판별로 확장한 **문서 수정**. 코드 변경 없음.
2. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership()` 의 트랜잭션 내부 "락 재검사(recheck)" 분기를 고정하는 **단위 테스트 추가**(`it.each` 2케이스: 강등/멤버십 소멸). 프로덕션 코드 변경 없음.
3. `plan/in-progress/canary-readme-recheck-test.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 문서.
4. `review/code/2026/09/25/20_20_00/**`, `review/consistency/2026/09/25/20_01_21/**` — 이전 라운드 리뷰 산출물(read-only 아카이브 성격의 마크다운).

동시성/병렬 처리 관점에서 실질적으로 의미가 있는 것은 2번 파일뿐이므로, 여기에 한해 대상 프로덕션 로직(`codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `transferOwnership`)까지 함께 확인했다.

## 확인 내용 (참고, 결함 아님)

`transferOwnership()` 은 이미 다음 패턴으로 구현되어 있다 (이번 diff 로 신규 도입된 코드는 아니며, 테스트가 이를 뒤늦게 고정한 것):

- 트랜잭션 밖에서 무락(non-locking) 선행 인가 검사(`getMemberRole`)를 한 번 수행하고,
- 트랜잭션 안에서 워크스페이스 → 요청자 멤버십 → 대상 멤버십 순으로 `pessimistic_write` 락을 잡은 뒤 **요청자가 여전히 owner 인지 재검사**한다(`workspaces.service.ts:760`).

추가된 테스트는 이 재검사 분기의 OR 두 조건(`role !== 'owner'`, `!requesterMembership`)을 각각 고정한다. `memberRepo.findOne` mock 이 `opts.lock` 유무로 선행/재검사 응답을 분기하고, 마지막에 `requesterReads` 배열로 "무락 1회 → `{mode:'pessimistic_write'}` 1회" 순서를 단언해 재검사 분기가 실제로 실행됐음을 확인한다 — TOCTOU(선행 인가 통과 후 락 잡기 전에 다른 트랜잭션이 owner 를 바꾸는 경합) 방지 로직에 대한 회귀 방지로 타당하다.

락 순서(워크스페이스 → 멤버십)는 `assertWorkspaceDeletable` 등 다른 메서드와 일관되게 유지되고 있고(주석에 명시), 워크스페이스 행 락이 동일 workspaceId 에 대한 동시 `transferOwnership` 호출을 직렬화하므로 요청자/대상 멤버십 락 순서가 요청마다 뒤바뀌어도 (A→B, B→A) 데드락 소지는 낮다 — 워크스페이스 락이 임계구역 전체를 이미 직렬화한다.

## 발견사항

없음. 이번 diff 는 테스트 커버리지 보강과 문서 수정뿐이며, 신규 동시성 위험을 도입하는 프로덕션 코드 변경이 없다.

## 요약

변경셋 중 동시성과 관련된 부분은 `workspaces.service.spec.ts` 에 `transferOwnership()` 의 락 재검사 분기(OR 두 조건)를 고정하는 테스트를 추가한 것뿐이며, 대상 프로덕션 로직 자체는 이미 무락 선행검사 + 트랜잭션 내 `pessimistic_write` 락 재검사로 TOCTOU 를 방지하고 있고 이번 diff 로 변경되지 않았다. README 수정은 그 판별(`@WorkspaceId()`/`@WorkspaceParam(...)`) 설명을 보강한 문서 변경일 뿐이다. 나머지 파일(plan, 이전 리뷰 산출물)은 동시성과 무관하다. 새로 도입된 경쟁 조건, 데드락, 동기화 누락, async/await 오용 등은 발견되지 않았다.

## 위험도

NONE
