# 동시성(Concurrency) 코드 리뷰

## 발견사항

해당 없음.

검토한 diff(파일 1~11: `CHANGELOG.md`, `uuid.ts`/`uuid.spec.ts`, `login-history.service.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`, 두 e2e-spec, plan 문서 2건)는 keyset 커서의 `id` 성분에
대한 **동기(synchronous) 정규식 기반 형태 검증**(`isUuidShaped`)을 두 `decodeCursor` 함수 입구에
추가하는 변경이다. 다음을 확인했다.

- `isUuidShaped`/`isValidUuid` 는 순수 함수이고 내부적으로 `RegExp.test()` 만 호출한다. 두 패턴
  모두 `g`/`y` 플래그가 없어(`uuid.ts:10`, `uuid.ts` 신설 `UUID_SHAPE_PATTERN`) `lastIndex` 상태를
  공유하지 않는다 — Node.js 단일 스레드 모델에서도 동시 호출 간 경쟁이 생길 수 있는 유일한
  전형적 함정인데, 여기 해당하지 않는다.
- `login-history.service.ts` `decodeCursor`(`isUuidShaped(id)` 추가, 함수명: `decodeCursor`)와
  `background-runs.service.ts` `decodeCursor`(`isUuidShaped(parsed.i)` 추가, 함수명:
  `decodeCursor`)는 둘 다 **동기 함수**이며 `await`/Promise 를 전혀 포함하지 않는다. 새로 추가된
  분기도 동기 조건문 하나뿐이라 async/await 오용이나 원자성 문제가 들어설 자리가 없다.
- `background-runs.service.ts` 의 `getBackgroundRun`(전체 파일 컨텍스트 기준 `Promise.all` 사용,
  `fetchBodyPage`/`aggregateBodyStatus`/`fetchNotifications` 병렬 실행)과 `decodeCursor` 의 호출
  순서(`resolveLimit` → `decodeCursor` → `verifyExecutionAccess`)는 **이번 diff 가 만든 것이
  아니라 기존 코드**다(diff 는 `decodeCursor` 내부에 검증 한 줄만 추가). plan 문서
  (`plan/in-progress/keyset-cursor-uuid-validation.md` §"호출 순서 주의")도 이 순서가 *기존
  관행*임을 명시하고 있어 새로운 동시성 표면이 아니다.
- 테스트 변경(`login-history.service.spec.ts`, `background-runs.service.spec.ts`, 두 e2e-spec)은
  전부 `async/await` 형태로 순차 실행되며, 공유 mutable 상태(mock 객체)는 각 `beforeEach`/
  `describe` 스코프에서 새로 생성돼 테스트 간 경쟁 조건 소지가 없다.
- DB 커넥션 풀·스레드 풀 크기 변경, 신규 lock/mutex/semaphore 도입, 신규 백그라운드 워커·큐
  배선은 이 diff 에 없다.

결론적으로 이 변경은 입력 검증(정규식 매칭) 로직 추가에 국한되며 동시성/병렬 처리 관점에서
검토할 대상이 없다.

## 요약

이번 diff 는 keyset 커서의 `id` 성분을 검증하지 않아 Postgres SQLSTATE 22P02 가 500 으로
마스킹되던 결함을 두 `decodeCursor` 동기 함수에 정규식 검증을 추가해 막는 변경이며, 관련 파일도
그 검증에 대한 테스트·문서·plan 갱신뿐이다. 새로운 공유 자원 접근, 락, async 흐름, 리소스 풀
변경이 전혀 없어 동시성 관점에서 지적할 사항이 없다.

## 위험도

NONE
