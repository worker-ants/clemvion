# 신규 식별자 충돌 검토

## 검토 범위 확인

`spec/5-system` scope 델타는 0개 파일(이 브랜치는 spec 을 변경하지 않는다). 구현 diff 는
5개 파일(`codebase/backend/src/modules/workspaces/workspaces.service.ts`,
`workspaces.service.spec.ts`, `test/helpers/concurrency.ts`,
`test/integration-rotate-concurrency.e2e-spec.ts`,
`test/member-remove-concurrency.e2e-spec.ts`)이며, 워킹트리(`origin/main` 대비)에서
직접 diff 를 산출해 확인했다. 이 PR 이 새로 도입하는 식별자는 다음 둘뿐이다:

1. `private throwCannotRemoveOwner(): never` — `WorkspacesService` 의 신규 private 메서드
2. `export const VACUITY_GUARD_MS = 1_500` — 기존에 파일-scope 로만 있던 상수를 export 로 승격

API endpoint·webhook/queue/sse 이벤트명·환경변수·config key·spec 파일 경로는 이 diff 에
전혀 새로 추가되지 않았다(`CANNOT_REMOVE_OWNER` 에러 코드는 기존 인라인 리터럴을 헬퍼로
추출한 것일 뿐 신규 코드가 아니며, `spec/5-system/1-auth.md`§3.2·각주에 이미 등재돼 있다).

## 발견사항

충돌 없음. 개별 확인 내역:

- **`throwCannotRemoveOwner`**: `git grep` 결과 `workspaces.service.ts` 세 곳(정의 + 호출부
  2군데)에만 존재하며, 다른 모듈·spec 어디에도 동명 식별자가 없다. 같은 클래스의 기존
  `throwMemberNotFound()` 와 같은 명명 패턴(`throw<Reason>`)을 따르고 있어 충돌은 물론
  네이밍 컨벤션 이탈도 없다.
- **`VACUITY_GUARD_MS`**: `git grep` 결과 정의(`test/helpers/concurrency.ts`)와 사용처
  3곳(같은 파일 + `integration-rotate-concurrency.e2e-spec.ts` +
  `member-remove-concurrency.e2e-spec.ts`)뿐이며, 동일 이름의 다른 상수·타입과 충돌하지
  않는다. 이전에는 `integration-rotate-concurrency.e2e-spec.ts` 내부에 매직 넘버
  `1_500` 이 중복돼 있던 것을 단일 export 상수로 합친 것이라 오히려 식별자 분산을 줄였다.
- **`CANNOT_REMOVE_OWNER`**: 신규 아님. `spec/5-system/1-auth.md:378, 553` 에 이미 정의된
  에러 코드이며, 코드 쪽 리터럴 위치만 인라인 → 헬퍼 함수로 이동했다. 의미·값 모두 불변.

## 요약

이 PR 은 `removeMember` 의 owner 보호 TOCTOU 를 닫는 백엔드 버그픽스로, spec/5-system 문서
변경이 없고 구현 diff 도 5개 파일에 국한된다. 새로 도입된 식별자는 private 헬퍼 메서드
`throwCannotRemoveOwner` 와 테스트 상수 `VACUITY_GUARD_MS` 둘뿐이며, 둘 다 전체 코드베이스에서
유일하고 기존 명명 관례(형제 헬퍼 `throwMemberNotFound`, 기존 가드 상수 패턴)를 그대로 따른다.
새 API endpoint·이벤트명·환경변수·config key·spec 파일 경로도 없다. 신규 식별자 충돌 관점에서
지적할 사항이 없다.

## 위험도

NONE
