# 동시성(Concurrency) Review — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리)

## 발견사항

- **[INFO]** 핵심 수정 — 동일 credential 대상 동시 DELETE 경합을 `affected === 0` 명시 비교 + `userId` 스코프 조건절로 정확히 닫음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567` (`deleteCredential`)
  - 상세: 무락(unlocked) `findOne`(538-543행) 뒤에 원자적 단일 SQL `DELETE ... WHERE id=$1 AND user_id=$2` 를 최종 판정 지점으로 두고, 그 반환값 `affected` 를 `=== 0` 으로 명시 비교해 진 쪽을 404(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)로 분기한다. `findOne`→`delete` 사이의 TOCTOU 는 여전히 존재하지만, 진짜 소유권·존재 게이트는 DB 레벨의 `DELETE WHERE` 절 자체이므로 결과에 영향이 없다(형제 8건과 동일 패턴). `!affected` 로 됐다면 드라이버가 `undefined`/`null` 을 반환하는 정상 케이스(`affected` 미보고)까지 404 로 뒤집혔을 텐데, 이를 `null`/`undefined` 대조군(`webauthn.service.spec.ts:550-561`, `it.each([[undefined],[null]])`)이 정확히 막는다 — 형제 #1371 에서 이 대조군 부재로 32개 뮤턴트가 통과했던 재발을 방지한 형태다.
  - 제안: 조치 불요.

- **[INFO]** 진 쪽이 404 로 종료 → 후속 복합 연산(count/NULL화)이 아예 실행되지 않아 그 경로의 원자성 문제 자체가 발생하지 않음
  - 위치: `webauthn.service.ts:565-567`(진 쪽 조기 return/throw), 회귀 테스트 `webauthn.service.spec.ts:529-542`
  - 상세: `affected === 0` 이면 `throwCredentialNotFound()` 로 즉시 예외를 던지므로 아래 `countCredentials`·`usersService.update` 블록(569-573행)과 컨트롤러의 감사 기록(`webauthn.controller.ts:338-350`, 이번 diff 밖)에 진 쪽이 도달하지 않는다. 단위 테스트가 `credentialRepo.count`/`usersService.update` 가 호출되지 않았음을 명시적으로 단언해(540-541행) 이 분기의 조기-return 성격을 반증 가능한 형태로 고정했다.
  - 제안: 조치 불요.

- **[INFO]** `delete → count → conditional update` 시퀀스는 여전히 비원자적이지만, 서로 다른 credential 동시 삭제 시 "둘 다 remaining 오판" 시나리오는 순서 논증 + 락 기반 e2e 캐너리로 반증됨(직전 라운드 WARNING #4, 이번 diff 에서 해소)
  - 위치: `webauthn.service.ts:569-573`(`countCredentials`+`usersService.update`), 검증: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it`("서로 다른 credential 두 개를 동시 삭제해도 복구 코드는 NULL 로 수렴한다")
  - 상세: `deleteCredential` 은 트랜잭션으로 감싸지 않으므로(코드베이스 전체에서 request-scope 전역 트랜잭션 wrapper — `typeorm-transactional`/`TransactionInterceptor` 유사 패턴 — 부재를 확인함) TypeORM 의 `delete()`/`count()`/`update()` 호출은 각각 독립된 autocommit 트랜잭션이다. 두 동시 요청 R1(delete A, 커밋 t1)·R2(delete B, 커밋 t3) 에서 각자의 `count()` 는 자기 delete 커밋 뒤(t2>t1, t4>t3)에 실행되고, Postgres 커밋은 WAL 상 전순서이므로 WLOG t1<t3 라면 R2 의 count(t4>t3>t1) 는 두 delete 가 모두 커밋된 뒤라 반드시 `remaining=0` 을 본다 — 즉 **"나중에 커밋한" 요청은 항상 정확한 0 을 관측**한다(N-way 로 일반화해도, 전역에서 가장 늦게 커밋되는 delete 의 count 는 정의상 모든 delete 이후에 실행되므로 이 성질이 유지된다). 따라서 "둘 다 1로 오판해 NULL화가 완전히 누락"되는 경우는 존재하지 않고, 최악의 경우도 두 count 모두 0 을 관측해 `usersService.update` 가 중복 호출되는 정도인데 이는 멱등 연산(`webauthnRecoveryCodes: null`)이라 무해하다. 이 논증은 e2e 에서 `locker` 커넥션이 대상 두 행을 `SELECT ... FOR UPDATE` 로 잠가 두 요청의 무락 `findOne` 은 통과시키고 `DELETE` 시점에만 강제로 겹치게 만든 뒤(공허성 가드로 겹침을 관측 후 커밋), `webauthn_recovery_codes` 가 `NULL` 로 수렴함을 직접 조회로 확인해 실증됐다. 다만 이 결론은 "비트랜잭션·즉시 커밋"이라는 전제에 의존하므로, 향후 이 메서드를 트랜잭션으로 감싸는 리팩터가 있으면 이 e2e 가 캐너리로 RED 가 될 것이라는 점은 인지해 둘 필요가 있다(diff 자체에도 이 취지의 주석이 있음).
  - 제안: 조치 불요 — 향후 `deleteCredential` 을 트랜잭션으로 감싸는 변경이 있으면 이 e2e 캐너리(WARNING #4 반증 테스트)를 함께 재검토할 것.

- **[INFO]** e2e 동시성 하네스 — 잠금 기반 강제 인터리빙 + 공허성(vacuity) 가드가 두 케이스 모두에 일관 적용됨
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:52-118`(첫 번째 `it`), `150-227`(두 번째 `it`)
  - 상세: 서비스 자체는 락을 걸지 않으므로, 별도 `locker` 커넥션이 대상 행(들)에 `FOR UPDATE` 를 걸어 두 HTTP 요청의 `credentialRepo.delete()` 가 Postgres 행 락 대기에서 실제로 겹치도록 강제한다. `Promise.race` 로 만든 공허성 가드(1.5초 내 미완료를 요구)가 락 해제 전 두 요청이 아직 `pending` 임을 먼저 단언해, 겹침이 실제로 만들어지지 않은 채 우연히 순차 처리돼 테스트가 위양성으로 통과하는 경로를 차단한다. `finally` 에서 `ROLLBACK` 후 `pending` 을 `.catch(() => undefined)` 로 흡수해 두어, 단언 실패 시에도 대기 중이던 두 요청이 unhandled rejection 을 남기지 않도록 정리한다.
  - 제안: 조치 불요.

- **[INFO]** 순수 리팩터(404 헬퍼 추출)는 동시성에 영향 없음, `renameCredential` 은 이번 PR 스코프 밖에서 TOCTOU 잔존
  - 위치: `webauthn.service.ts:517-522`(`private throwCredentialNotFound(): never`), `webauthn.service.ts:486-504`(`renameCredential`)
  - 상세: 헬퍼는 인스턴스 상태를 갖지 않는 순수 throw 함수로 호출부 4곳(`renameCredential` 2곳, `deleteCredential` 2곳)의 동작을 바꾸지 않는다. `renameCredential` 은 여전히 무락 `findOne`+`save` 로 TOCTOU 가 있으나(동시 rename 경합 시 마지막 `save` 가 이기는 lost-update 가능성), 이는 이번 diff 가 만든 갭이 아니며 "동시 DELETE 감사 중복" 결함 클래스와 축이 달라 스코프 밖이다.
  - 제안: 조치 불요(별도 스코프).

## 요약

이번 diff 의 핵심은 `WebAuthnService.deleteCredential()` 에서 동일 credential 대상 동시 DELETE 두 건 중 진 쪽을 `credentialRepo.delete()` 의 `affected === 0` 명시 비교로 걸러 404 로 되돌리는 것이며, 무락 `findOne` 뒤 단일 원자적 DELETE 문(`WHERE id=$1 AND user_id=$2`)을 최종 판정 지점으로 삼는 설계는 이미 여덟 차례 검증된 형제 패턴과 동일하고, 반증 가능한 대조군(단위: `affected` undefined/null 케이스, e2e: 락 기반 강제 인터리빙 + 공허성 가드)으로 뒷받침된다. 직전 라운드에서 제기됐던 "서로 다른 credential 동시 삭제 시 `remaining` 오판" 우려(WARNING #4)는 커밋 전순서에 기반한 순서 논증(N-way 로도 일반화됨을 본 리뷰에서 재확인)과 락 기반 e2e 캐너리로 반증·해소됐음을 독립적으로 검증했다. 새로 도입된 코드에서 경쟁 조건·데드락·비원자적 판정·async/await 누락 등 신규 결함은 발견되지 않았으며, 이전 두 차례 동시성 리뷰(`review/code/2026/09/21/18_03_54/concurrency.md`, `18_31_57/concurrency.md`)의 LOW 결론과 본 라운드의 독립 분석이 수렴한다.

## 위험도

LOW
