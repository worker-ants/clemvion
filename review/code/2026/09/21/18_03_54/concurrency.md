# 동시성(Concurrency) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리)

## 발견사항

- **[INFO]** 수정 자체는 올바른 원자성 강화 패턴 — `affected` 를 판정에 사용
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-558` (`deleteCredential`)
  - 상세: 종전엔 `await this.credentialRepo.delete({ id: credentialUuid })` 의 반환값을 버려서, 무락(unlocked) `findOne` 을 둘 다 통과한 동시 DELETE 두 건이 모두 "성공"으로 처리돼 컨트롤러가 `user.2fa_disabled` 감사를 두 번 남겼다. 수정은 (1) `affected === 0` 을 **명시 비교**로 판정에 사용해 진 쪽을 404 로 되돌리고, (2) DELETE 조건절에 `userId` 를 추가해 소유권 검증을 DB 레벨에서도 원자적으로 건다. 실제 뮤테이션의 원자성은 단일 `DELETE ... WHERE id=$1 AND user_id=$2` 문 자체가 Postgres row-lock 으로 보장하므로, `verifyAuthentication` 처럼 별도 트랜잭션/`SELECT FOR UPDATE` 없이도 안전하다. `null`/`undefined` (드라이버 미보고) 와 `0` (실제 미삭제) 를 구분해 `!affected` 로 되돌리는 회귀를 막은 것도 타당하다(형제 #1371 에서 이 대조군 부재로 32개 뮤턴트가 통과했던 사례의 재발 방지).
  - 제안: 없음 — 현재 형태가 적절하다.

- **[WARNING]** `deleteCredential` 내 삭제 이후 `remaining` 계산·복구 코드 NULL 화는 여전히 비원자적 — 서로 다른 credential 을 동시에 삭제하면 부정확할 수 있음 (이번 diff 로 도입된 것은 아니고 기존부터 있던 인접 갭)
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-565` (`deleteCredential`, 특히 변경되지 않은 560-564행 `countCredentials` / `usersService.update` 블록)
  - 상세: 이번 fix 는 **같은 credential 을 겨냥한 동시 DELETE**(`affected` 경쟁)만 닫는다. 그러나 사용자가 서로 **다른** credential 두 개를 거의 동시에 삭제하면, 각 요청은 자신의 행에 대해 `affected=1` 로 각각 성공한 뒤 별도 statement 로 `countCredentials(userId)` 를 호출한다 — 이 DELETE-두 건 + COUNT-두 건은 하나의 트랜잭션/락으로 묶여 있지 않으므로, 두 COUNT 가 서로 상대방의 커밋 전 스냅샷을 읽으면 둘 다 `remaining === 1` 로 계산해 복구 코드 NULL 화 분기를 둘 다 건너뛸 수 있다. 결과적으로 실제로는 credential 이 0개인데도 `webauthn_recovery_codes` 가 NULL 화되지 않고 남아, `verifyRecoveryCode` 가 여전히 그 코드를 유효한 2FA 우회 수단으로 받아들인다(등록된 인증기가 없어도). 감사 로그의 `remainingCredentials` 도 두 건 모두 실제(0)와 다른 값(1)을 남길 수 있다.
  - 제안: 파일 내 이미 존재하는 패턴(`verifyAuthentication` 의 `dataSource.transaction` + `pessimistic_write` 락)을 참고해, `deleteCredential` 전체를 트랜잭션으로 감싸고 `userId` 스코프의 credential 행 집합에 락을 건 뒤 delete→count→(필요시) NULL화를 원자적으로 수행하는 후속 작업을 고려할 것. 이번 PR 의 범위(동일 credential 이중 삭제)와는 축이 다르므로 별도 plan 항목으로 분리 권장.

- **[INFO]** e2e 동시성 재현 픽스처는 견고함 — 공허성(vacuity) 가드 포함
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:76-105` (`it('두 DELETE 가 겹쳐도...')`)
  - 상세: 별도 `locker` 커넥션이 대상 행에 `SELECT ... FOR UPDATE` 를 걸어 두 애플리케이션 요청의 무락 `findOne` 은 통과시키되 실제 `DELETE` 시점의 row-lock 대기에서 겹치게 만든다. `Promise.race` 로 커밋 전 두 요청이 아직 `pending` 임을 먼저 확인한 뒤(고치기 전 코드도 통과시키지 않도록 하는 판별력 확보) 커밋해 겹침을 실제로 만들었음을 검증한다. Postgres MVCC 특성상 무락 `SELECT`(`findOne`)는 `FOR UPDATE` 락에 막히지 않고, 쓰기(`DELETE`)만 막힌다는 전제도 올바르다. 다만 `raced` 단언이 실패(assertion error)하는 경로에서는 `finally` 가 `ROLLBACK` 후 두 실제 DELETE 요청을 그대로 흘려보내(drain) 실제 DB 부수효과를 남길 수 있으나, 이는 테스트 실패 시에만 발생하는 정리 로직의 부작용으로 프로덕션 동시성과는 무관한 테스트 위생 수준의 사항이다.
  - 제안: 없음(선택적으로 실패 시 대상 행을 재확인/정리하는 것도 고려 가능하나 필수 아님).

- **[INFO]** 단위 테스트가 정확한 인터리빙 시나리오를 모킹 레벨에서 커버
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts:516-562` (`describe('동시 삭제')`)
  - 상세: `delete` 를 `{id, userId}` 로 호출했는지, `affected: 0` 일 때 `count`/`usersService.update` 가 호출되지 않는지, `affected` 가 `undefined`/`null` 일 때는 정상 삭제로 취급되는지를 각각 별도 케이스로 단언해 판정 조건(`affected === 0` 명시 비교)의 반증 가능한 형태를 모두 잠갔다.

## 요약

이번 변경은 동일 credential 을 겨냥한 동시 DELETE 두 건이 `delete()` 반환값(`affected`)을 버려서 둘 다 "성공"으로 처리되고 컨트롤러가 `user.2fa_disabled` 감사를 두 번 남기던 결함을, `affected === 0` 명시 비교 + DELETE 조건절 `userId` 스코프 추가로 정확히 닫는다. 단일 DML 문의 DB 레벨 원자성에 기대는 접근은 이 파일의 다른 동시성 방어(트랜잭션+비관적 락)와 형태는 다르지만 이 케이스에는 충분하고 타당하며, 단위·e2e 테스트 모두 실제 인터리빙(락 기반)과 반증 가능한 판정 조건(대조군 포함)을 검증해 판별력이 높다. 다만 이번 fix 범위 밖의 인접 지점 — 서로 다른 credential 을 동시에 삭제할 때 `remaining` 계산과 복구 코드 NULL 화가 여전히 트랜잭션으로 묶여 있지 않아 발생 가능한 비원자성 — 은 별도 후속 검토가 필요하다.

## 위험도

LOW
