# 동시성(Concurrency) 리뷰 — trigger 삭제 중복 감사 수정

## 대상
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 에 락 안 재확인(`fresh` findOne) + `NotFoundException` passthrough 추가
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 위 분기를 검증하는 unit 테스트 추가
- `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` — 신규 e2e (advisory lock 을 별도 커넥션이 쥐어 두 DELETE 를 실제로 겹치게 함)

## 분석 요약

`remove()` 는 잠금 없는 선조회(`findById`)로 트리거를 읽고, 되돌릴 수 없는 외부 자원 해제(`releaseExternal`)를 락 밖에서 먼저 끝낸 뒤, `acquireTriggerConfigLock` 로 advisory lock(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`)을 잡는다. 이번 변경은 그 락을 잡은 **뒤** `m.findOne(Trigger, { select:{id:true}, where:{id, workspaceId} })` 로 행이 여전히 있는지 재확인하고, 없으면 `NotFoundException` 을 던지도록 했다 — 이전에는 `m.remove(trigger)` 가 0행이어도 조용히 성공해 진 쪽도 `trigger.deleted` 감사를 남겼다.

- **정합성 확인**: advisory lock 은 두 트랜잭션을 줄 세우기만 하고 READ COMMITTED 하의 새 SELECT 문은 매번 새 스냅샷을 본다. 따라서 락을 먼저 얻은 트랜잭션이 커밋(행 삭제)한 뒤 두 번째 트랜잭션이 락을 얻어 실행하는 `fresh` SELECT 는 삭제된 상태를 정확히 관측한다 — 재조회 자리가 정확하다(락 취득 **이후**, `m.remove` **이전**).
- **예외 전파 확인**: `throwTriggerNotFound()` 는 `m.transaction(async (m) => {...})` 콜백 안에서 동기적으로 throw 하므로 TypeORM 이 ROLLBACK 을 수행하고 advisory lock(xact 스코프)이 해제된다. 이어지는 `.catch((err) => { if (err instanceof NotFoundException) throw err; ...log...; throw err; })` 가 `NotFoundException` 만 로그 없이 재던지므로, 진 쪽 요청은 "반쯤 삭제" 거짓 경보 없이 404 로 끝나고 이어지는 `releaseSecretsAfterCommit`/`recordAudit` 호출도 건너뛴다(둘 다 `remove()` 본문에서 트랜잭션 `await` 뒤에 위치).
- **테스트 대역 신뢰성**: `withTransactionMock` 의 `m.findOne` 은 `options.freshFindOne` 이 지정되면 그것으로, 아니면 바깥 `repo.findOne` 으로 위임하도록 분리돼 있어 "바깥 조회 == 락 안 재조회" 로 뭉뚱그려지는 함정을 피한다. 신규 unit 테스트(`makeService([() => null])`)는 바깥 `findOne` 은 유효한 행을 주고 락 안 재조회만 `null` 을 주도록 정확히 분리해 이 분기를 검증한다.
- **e2e 설계**: 별도 커넥션(`locker`)이 같은 advisory key 로 트랜잭션을 열어 두 실제 HTTP DELETE 를 advisory lock 대기열에 묶고, `Promise.race` 로 "락을 풀기 전엔 둘 다 미완료" 를 먼저 확인한 뒤(공허성 가드) 커밋해 겹침을 실제로 재현한다. `TRIGGER_DELETE_LOCK_TIMEOUT_MS=5000ms` 보다 짧은 1.5초만 락을 쥐어 상한에 걸려 "둘 다 실패" 로 오염되는 것도 피했다.

세 파일 모두 락 취득 순서·트랜잭션 경계·예외 전파가 서로 일관되고, 새로 추가된 재확인 지점이 실제로 경쟁을 닫는 위치(락 취득 직후, 부수효과 직전)에 있다. 이 diff 범위 안에서 새로 도입된 경쟁 조건·데드락·비동기 오용은 찾지 못했다.

## 참고용 인접 관찰 (이 diff 의 결함은 아님 — 정보 제공)

- **[INFO]** `releaseExternal(trigger)` 는 advisory lock 취득 **전**, `findById` 직후 무조건 실행된다(`triggers.service.ts` 의 `remove()` 본문, 이번 diff 로 추가된 재확인보다 앞선 기존 코드). 즉 동시 DELETE 두 건 모두 스케줄 job 해제·chat-channel provider teardown·listener unregister 를 한 번씩(총 두 번) 시도한 뒤에야 락 대기열에 들어간다. 이번 diff 가 닫은 것은 DB 행/감사의 이중 처리뿐이고, 외부 부수효과의 중복 실행 자체는 여전히 남는다.
  - 확인 결과 위험은 낮다: BullMQ `removeJobScheduler`(`node_modules/.pnpm/bullmq@5.81.2/.../job-scheduler.js:131-133`)는 Lua 스크립트 결과(카운트)를 돌려줄 뿐 대상이 없어도 throw 하지 않고, `teardownChatChannel` 은 주석대로 best-effort 로 실패를 삼킨다. 따라서 두 번째(진) 요청이 이 중복 호출 때문에 500 으로 튀거나 재확인 로직 전에 멈추는 경로는 확인되지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`remove()`, 이번 diff 범위 밖 — `this.resourceReleaser.releaseExternal(trigger)` 호출부, 락 취득보다 앞)

## 뮤테이션 검증

가설 확인을 위해 코드를 고쳐 재현하지 않았다 — 정적 분석(락 순서·트랜잭션 콜백의 throw 전파·mock 위임 경로)과 BullMQ 소스 확인만으로 결론에 도달했다. 저장소 파일은 읽기만 했고 아무것도 쓰거나 되돌리지 않았다(`git status --short` 기준 무변경).

## 위험도

LOW — 이번 diff 는 실제로 존재했던 경쟁(advisory lock 취득과 행 존재 확인의 분리)을 올바른 지점에서 닫았고, 회귀를 막을 unit + e2e 테스트를 갖췄다. 새로 도입된 동시성 결함은 없음. 위 INFO 는 diff 범위 밖의 기존 동작에 대한 참고 사항이다.
