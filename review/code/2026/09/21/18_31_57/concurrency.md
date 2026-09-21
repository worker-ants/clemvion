# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** 핵심 수정(동일 credential 동시 DELETE 경합)은 형제 8건과 동일한 패턴으로 올바르게 구현됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567` (`deleteCredential`)
  - 상세: 무락 `findOne` 뒤 원자적 `credentialRepo.delete({ id, userId })` 단일 SQL 로 최종 게이트를 두고, 그 반환값 `affected` 를 **명시적으로 `=== 0`** 과 비교해 진 쪽을 404 로 분기한다. `!affected` 로 썼다면 드라이버가 `undefined`/`null` 을 반환하는 정상 케이스까지 404 로 뒤집었을 것인데, `it.each([[undefined],[null]])` 대조군(`webauthn.service.spec.ts:550-561`)이 이를 정확히 막는다. `findOne`→`delete` 사이의 TOCTOU 는 있지만 최종 판정이 단일 원자적 SQL 문(`WHERE id=$1 AND user_id=$2`)이라 결과에 영향이 없다 — enumeration 방지용 조기 404 는 정보 노출 최소화 목적일 뿐, 소유권의 진짜 게이트는 DELETE WHERE 절이다.
  - 제안: 조치 불요.

- **[INFO]** e2e 동시성 하네스의 잠금 시뮬레이션 방식이 서비스 코드와 정합함
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` (`locker.query('SELECT id FROM webauthn_credential WHERE id = $1 FOR UPDATE', ...)` 및 첫 번째 `it` 블록)
  - 상세: 서비스는 자체적으로 락을 걸지 않으므로(`findOne` 무락), 테스트가 별도 커넥션(`locker`)으로 대상 행에 `FOR UPDATE` 를 걸어 두 HTTP 요청의 `credentialRepo.delete()` 호출이 Postgres 행 락에서 자연스럽게 블로킹되도록 강제한다. `Promise.race` 로 만든 "공허성 가드"(1.5초 안에 완료되지 않아야 함)가 이 블로킹이 실제로 일어났음을 보장하므로, 락이 걸리지 않아 두 요청이 순차 완료돼 버리는 거짓-양성(고치기 전 코드도 통과) 가능성을 차단한다. `finally` 블록에서 `ROLLBACK` 후 `pending` 을 `catch` 로 흡수해 두어, 어서션 실패 시에도 블로킹된 두 요청이 영구히 매달리지 않고 unhandled rejection 도 남기지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 인접 경합(서로 다른 credential 동시 삭제 시 `remaining` 오판 가능성, 이전 라운드 WARNING #4)은 이번 diff 에서 순서 논증 + e2e 캐너리로 반증됨 — 재지적 대상 아님
  - 위치: `webauthn.service.ts:569-573` (`countCredentials` + `usersService.update`), 검증은 `webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it`(WARNING #4 반증)
  - 상세: `deleteCredential` 은 트랜잭션으로 감싸지 않아 각 요청의 `DELETE` 가 자신의 커넥션에서 즉시 커밋(autocommit)된 뒤에야 프로그램 순서상 같은 요청의 `countCredentials`(신규 쿼리, READ COMMITTED 스냅샷)가 실행된다. 두 커밋은 Postgres WAL 상 전순서이므로, "나중에 커밋한" 쪽의 `count` 는 반드시 두 삭제가 모두 커밋된 뒤에 실행되어 `remaining === 0` 을 정확히 관측한다 — 따라서 "둘 다 `remaining===1`로 오판" 은 논리적으로 불가능(`RESOLUTION.md` 의 모순 논증과 일치). 검증 결과 e2e 도 PASS. 다만 이 시퀀스(`delete` → `count` → conditional `update`) 자체가 비원자적이라는 사실은 남아 있고(같은 세션이 이미 별도 후속 항목으로 분류), 트랜잭션으로 감싸는 리팩터가 이 순서 논증의 전제(비트랜잭션·즉시 커밋)를 깨면 그 e2e 가 캐너리로 RED 가 된다는 점만 인지해 두면 된다.
  - 제안: 조치 불요 — 향후 `deleteCredential` 을 트랜잭션으로 감싸는 리팩터가 있다면 그 캐너리 e2e 를 함께 재검토할 것.

- **[INFO]** 순수 리팩터(404 헬퍼 추출)와 문서(CHANGELOG/JSDoc) 변경은 동시성 영향 없음
  - 위치: `webauthn.service.ts:517-522` (`private throwCredentialNotFound(): never`), `CHANGELOG.md`
  - 상세: 헬퍼는 인스턴스 상태를 갖지 않는 순수 throw 함수이며 호출부 4곳(`renameCredential` 2곳, `deleteCredential` 2곳)의 동작을 바꾸지 않는다. `renameCredential` 은 이번 diff 로 동시성 게이트가 강화되지 않았음(여전히 무락 `findOne`+`save`, TOCTOU 존재)에 유의하되, 이는 이번 PR 이 만든 갭이 아니고 rename 은 "마지막 삭제 시 감사 중복" 결함 클래스와 무관해 스코프 밖이다.
  - 제안: 조치 불요.

## 요약
이번 diff 의 핵심은 `WebAuthnService.deleteCredential()` 에서 동일 credential 에 대한 동시 DELETE 두 건 중 진 쪽을 `affected === 0` 명시 비교로 걸러 404 로 돌리는 것이며, 무락 `findOne` 뒤 원자적 단일 DELETE 문을 최종 판정 지점으로 삼는 설계는 이미 여덟 차례 검증된 형제 패턴과 동일하고 회귀 테스트(단위 대조군 2건 + e2e 공허성 가드)로 뒷받침된다. 인접해서 제기됐던 "서로 다른 credential 동시 삭제 시 `remaining` 오판" 우려는 이번 diff 에 포함된 순서 논증과 e2e 캐너리로 반증되어 해소됐다. 새로 도입된 코드에서 경쟁 조건·데드락·비원자적 복합 연산·async/await 누락 등 신규 결함은 발견되지 않았다.

## 위험도
LOW
