# 동시성(Concurrency) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리)

## 발견사항

- **[INFO]** 핵심 수정 — 동일 credential 대상 동시 DELETE 경합을 `affected === 0` 명시 비교 + `userId` 스코프 조건절로 정확히 닫음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567` (`deleteCredential`)
  - 상세: 무락(unlocked) `findOne`(538-540행) 뒤에 원자적 단일 SQL `DELETE ... WHERE id=$1 AND "userId"=$2` 를 최종 판정 지점으로 삼고, 그 반환값 `affected` 를 `=== 0` 으로 명시 비교해 진 쪽을 404(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)로 분기한다(565-567행). `findOne`→`delete` 사이의 TOCTOU 창은 여전히 존재하지만, 실제 소유권·존재 게이트는 애플리케이션 레이어가 아니라 DB 가 단일 문으로 보장하는 행 락이므로 두 트랜잭션 중 정확히 하나만 성공한다 — 형제 8건(#1369~#1375)과 동일한 검증된 패턴이다. `!affected` 로 판정했다면 드라이버가 `undefined`/`null` 을 반환하는 정상 케이스(미보고)까지 404 로 뒤집혔을 것인데, 이를 대조군(`webauthn.service.spec.ts:550-561`, `it.each([[undefined],[null]])`)이 정확히 막는다.
  - 제안: 없음.

- **[INFO]** 진 쪽이 404 로 조기 종료 → 후속 복합 연산(count/NULL화) 자체가 실행되지 않아 그 경로의 비원자성이 이번 결함 클래스와는 무관해짐
  - 위치: `webauthn.service.ts:565-567`(조기 throw), 회귀 테스트 `webauthn.service.spec.ts:529-542`
  - 상세: `affected === 0` 이면 즉시 예외가 던져지므로 아래 `countCredentials`·`usersService.update` 블록(569-573행)과 컨트롤러의 감사 기록에 진 쪽이 도달하지 않는다. 단위 테스트가 `credentialRepo.count`/`usersService.update` 가 호출되지 않았음을 명시적으로 단언(540-541행)해 이 조기-return 성격을 반증 가능한 형태로 고정했다.
  - 제안: 없음.

- **[INFO]** `delete → count → conditional update` 시퀀스는 여전히 비원자적이지만, "서로 다른 credential 동시 삭제 시 둘 다 remaining 오판" 시나리오는 순서 논증 + 락 기반 e2e 캐너리로 반증됨(직전 라운드 WARNING #4, 이번 diff 에서 해소)
  - 위치: `webauthn.service.ts:569-573`(`countCredentials`+`usersService.update`), 검증: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it`(150-227행, "서로 다른 credential 두 개를 동시 삭제해도 복구 코드는 NULL 로 수렴한다")
  - 상세: `deleteCredential` 은 트랜잭션으로 감싸지 않으므로 `delete()`/`count()`/`update()` 각각이 독립 autocommit 이다. 두 동시 요청 R1(delete A, 커밋 t1)·R2(delete B, 커밋 t3) 에서 각자의 `count()` 는 자기 delete 커밋 뒤(t2>t1, t4>t3)에 실행되고, Postgres 커밋은 WAL 상 전순서이므로 WLOG t1<t3 라면 R2 의 count(t4>t3>t1) 는 두 delete 가 모두 커밋된 뒤라 반드시 `remaining=0` 을 본다 — 즉 나중에 커밋하는 쪽은 항상 정확한 0 을 본다. "둘 다 1 로 오판"은 `t1<t3<t4<t1` 모순을 요구하므로 발생할 수 없다. 이 e2e 는 `locker` 커넥션이 두 대상 행을 각각 `SELECT ... FOR UPDATE` 로 잠가 두 요청의 무락 `findOne` 은 통과시키고 `DELETE` 시점에서만 실제로 겹치게 강제한 뒤(공허성 가드로 pending 상태 확인 후 커밋), `webauthn_recovery_codes` 가 `NULL` 로 수렴함을 직접 조회로 확인해 이 논증을 실증한다. 다만 이 결론은 "비트랜잭션·즉시 커밋" 전제에 의존하므로, 향후 `deleteCredential` 을 트랜잭션으로 감싸는 리팩터가 있으면 이 e2e 가 캐너리로 RED 가 될 것이라는 점은 유효하게 남는다(코드 주석에도 이 취지가 명시돼 있음, `webauthn.service.ts:544-560`).
  - 제안: 없음(향후 트랜잭션 래핑 시 이 e2e 캐너리를 함께 재검토).

- **[INFO]** e2e 동시성 하네스 — 잠금 기반 강제 인터리빙 + 공허성(vacuity) 가드가 두 케이스 모두에 일관 적용됨
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:52-118`(첫 번째 `it`), `150-227`(두 번째 `it`)
  - 상세: 서비스 자체는 락을 걸지 않으므로, 별도 `locker` 커넥션이 대상 행(들)에 `FOR UPDATE` 를 걸어 두 HTTP 요청의 `credentialRepo.delete()` 가 Postgres 행 락 대기에서 실제로 겹치도록 강제한다. `Promise.race([pending, timeout(1.5s)])` 로 만든 공허성 가드가 락 해제 전 두 요청이 아직 `pending` 임을 먼저 단언해, 우연히 순차 처리돼 위양성으로 통과하는 경로를 차단한다. `finally` 에서 `ROLLBACK`(에러는 `.catch(() => undefined)`) 후 `pending` 도 `.catch(() => undefined)` 로 흡수해 두어, 단언 실패 시에도 unhandled rejection 을 남기지 않는다. 두 번째 `it` 은 서로 다른 두 행(idA, idB)을 하나의 `SELECT ... FOR UPDATE ... WHERE id = ANY($1::uuid[])` 로 함께 잠그고 각 요청이 자기 행만 건드려, 크로스-락 순서로 인한 데드락 가능성도 구조적으로 없다.
  - 제안: 없음.

- **[INFO]** 순수 리팩터(404 헬퍼 추출)는 동시성에 영향 없음, `renameCredential` 은 이번 PR 스코프 밖에서 TOCTOU 잔존
  - 위치: `webauthn.service.ts:517-522`(`private throwCredentialNotFound(): never`), `webauthn.service.ts:486-504`(`renameCredential`)
  - 상세: 헬퍼는 인스턴스 상태를 갖지 않는 순수 throw 함수로 호출부 4곳(`renameCredential` 2곳, `deleteCredential` 2곳)의 동작을 바꾸지 않는다. `renameCredential` 은 여전히 무락 `findOne`+`save` 로 lost-update 가능성이 있으나, 이는 이번 diff 가 만든 갭이 아니고 "동시 DELETE 감사 중복" 결함 클래스와 축이 달라 이번 리뷰 스코프 밖이다.
  - 제안: 없음(별도 스코프).

- **[INFO]** CHANGELOG.md 변경은 문서 텍스트뿐 — 동시성 관점에서 해당 없음
  - 위치: `CHANGELOG.md` (신규 섹션 + 기존 두 섹션 취소선 정정)
  - 상세: 코드·실행 경로 변경이 없으므로 경쟁 조건·동기화 등 어떤 관점에도 해당하지 않는다.

## 요약

이번 diff 의 핵심은 `WebAuthnService.deleteCredential()` 에서 동일 credential 대상 동시 DELETE 두 건 중 진 쪽을 `credentialRepo.delete()` 의 `affected === 0` 명시 비교로 걸러 404 로 되돌리고, DELETE 조건절에 `userId` 를 추가해 소유권까지 DB 레벨 원자성에 편입시킨 것이다. 무락 `findOne` 뒤 단일 원자적 DELETE 문을 최종 판정 지점으로 삼는 설계는 이미 형제 8건에서 검증된 패턴과 동일하며, 단위 테스트의 `undefined`/`null` 대조군과 e2e 의 `SELECT ... FOR UPDATE` 기반 강제 인터리빙 + 공허성 가드가 판별력을 확보한다. 이전 라운드에서 제기됐던 "서로 다른 credential 동시 삭제 시 `remaining` 오판" 우려는 커밋 전순서 기반 순서 논증과 락 기반 e2e 캐너리로 반증·해소됐음을 이번 리뷰에서도 독립적으로 확인했다. 새로 도입된 코드에서 경쟁 조건·데드락·비원자적 판정·async/await 누락 등 신규 결함은 발견되지 않았으며, 본 라운드 이전 세 차례의 동시성 리뷰(`18_03_54`, `18_31_57`, `18_58_48`)의 LOW 결론과 수렴한다. 저장소 뮤테이션 없이 Read 전용으로 검증했다(`git status --short` 확인, 리뷰 출력 디렉터리 외 변경 없음).

## 위험도

LOW
