# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `PROJECT.md` §e2e 테스트 작성 가이드가 신규 공용 헬퍼 `raceUnderHeldLock()` 을 언급하지 않는다
  - 위치: `PROJECT.md:315-336` (특히 "Backend e2e 패턴 (supertest)" 절, 335-336번 줄) — 이 파일은 이번 diff 대상이 아니라서 누락이다.
  - 상세: `PROJECT.md` §"언제 e2e 를 작성하는가"(321번 줄)는 "멀티 액터 · 동시성 · 트랜잭션 일관성 (race condition, 트랜잭션 격리)" 을 e2e 작성 트리거로 명시하고, 바로 아래 §"Backend e2e 패턴 (supertest)"(335-336번 줄)는 재사용 가능한 헬퍼를 이름과 함수까지 콕 집어 안내한다 (`helpers/db.ts` 의 `createDbClient()`/`uniqueEmail`/`uniqueName`, `helpers/auth.ts` 의 `registerAndLogin`·`createTeamWorkspace`·`inviteAndAccept`·`extractRefreshCookie`). 이번 PR 이 정확히 그 "동시성/race condition" 범주를 위해 만든 `raceUnderHeldLock()`(`codebase/backend/test/helpers/concurrency.ts`)는 이 목록에 없다. `plan/in-progress/e2e-race-helper.md` §A 자체가 "열 번째를 쓰는 사람이 또 빠뜨릴 수 있다" 는 위험을 이 리팩터의 존재 이유로 명시하는데, 그 "열 번째 사람"이 실제로 참고하는 문서(`PROJECT.md`)에는 헬퍼가 나타나지 않는다. 코드 계층(9개 spec 파일에 실제로 쓰인 예)에서는 발견 가능하지만, 신규 작성자가 처음 진입하는 가이드 문서에는 반영되지 않아 재발 방지 목적이 가이드 레벨에서는 아직 완결되지 않았다.
  - 제안: `helpers/db.ts`/`helpers/auth.ts` 를 소개하는 문장 옆에 한 줄 추가 — 예: "동시성/race condition 검증: `helpers/concurrency.ts` 의 `raceUnderHeldLock(locker, lock, fires)` — 별도 커넥션으로 락을 쥐어 겹침을 강제하고 공허성 가드까지 대신 검증한다." plan 체크리스트의 "트래커 항목 해소" 마무리 커밋에서 함께 반영 가능.

- **[INFO]** `raceUnderHeldLock()` 의 `@throws` 가 두 throw 경로 중 하나만 문서화
  - 위치: `codebase/backend/test/helpers/concurrency.ts:28` (`@throws` 줄) vs 실제 두 번째 throw 지점 `codebase/backend/test/helpers/concurrency.ts:43-48`
  - 상세: JSDoc `@throws` 는 "공허성 가드 실패 시"만 서술한다. 그러나 함수는 `fires.length < 2` 일 때도 명시적으로 `throw new Error(...)` 한다(43-48번 줄). 두 조건 모두 호출자 입장에서 "이 함수가 실패할 수 있는 경우"이므로 `@throws` 에 함께 나열하는 것이 API 계약을 더 정확히 전달한다.
  - 제안: `@throws` 를 두 항목으로 나누거나("thunk 가 2개 미만이면 즉시 던진다" / "공허성 가드 실패 시 …") 한 문장에 병기.

- **[INFO]** `VACUITY_GUARD_MS`(1.5초) 선택 근거 주석이 두 곳에 중복 서술되고, 프레이밍이 "트리거 삭제 경로"로 좁게 고정됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:60-63`(함수 본문 인라인 주석) 와 `codebase/backend/test/helpers/concurrency.ts:83-86`(상수 선언부 JSDoc)
  - 상세: 두 주석 모두 "트리거 삭제 경로의 `lock_timeout` 이 5초"라는 같은 근거를 반복한다. 내용은 정확하지만(스케줄 삭제도 같은 트리거 advisory lock 을 재사용하므로 이 제약을 물려받음), 이 상수는 이제 9개 파일 11개 블록 전부가 공유하는데 그중 실제로 `lock_timeout` 제약이 있는 것은 트리거·스케줄 삭제 두 경로뿐이다. 다른 7개 호출부를 다루는 사람이 이 주석만 보면 "왜 내 파일과 무관한 트리거 얘기가 나오지" 라고 혼동할 소지가 있다(치명적이진 않음 — 상수가 안전한 상한을 택한 이유 설명일 뿐, 실제 동작에 영향 없음).
  - 제안: 필수는 아니나, 상수 선언부 JSDoc 한 곳에만 근거를 남기고 인라인 쪽은 "선택 근거는 아래 `VACUITY_GUARD_MS` 참고"로 축약해 중복을 줄이거나, "이 상수는 9개 delete-concurrency 스위트가 공유하며, 그중 트리거/스케줄 경로의 5초 제약이 가장 타이트해 그 값을 기준으로 삼았다"로 범위를 명시하면 더 정확하다.

## 요약
핵심 산출물인 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 은 모듈 목적("왜 헬퍼인가")·겹침을 만드는 방법·`@param`/`@returns`/`@throws`/`@example` 을 갖춘 모범적인 JSDoc 을 갖고 있고, 9개 e2e spec 파일의 리팩터도 기존 인라인 주석("무락 조회를 통과한 뒤 이 락을 기다린다" 류)을 정확히 보존하면서 헬퍼 위임을 알리는 새 주석을 일관되게 추가해 오래된 주석·불일치가 없다. `plan/in-progress/e2e-race-helper.md` 도 실측 기반 근거(§B 대상 블록 수·락 형태·발사 형태 표, §C 음성 대조군 예측/실측)를 갖춰 결정의 배경을 잘 남겼다. 유일한 실질적 공백은 `PROJECT.md` 의 e2e 작성 가이드가 이 신규 공용 헬퍼를 언급하지 않는다는 점인데, 이는 이 리팩터가 막으려는 "열 번째 작성자가 또 손으로 복제한다"는 바로 그 위험을 가이드 레벨에서 재현할 수 있어 WARNING 으로 평가한다. 나머지는 JSDoc 완전성·중복에 관한 경미한 INFO 수준이다.

## 위험도
LOW
