# 동시성(Concurrency) 리뷰 — trigger-config-lost-update

## 대상 요약

`trigger.config` 에 대한 동시 PATCH lost-update(특히 `chatChannel.inboundSigningRef` 유실 →
인입 서명 검증 fail-open) 를 고치는 변경이다. 핵심 수정은 신규
`trigger-config-lock.ts::rewriteTriggerConfigLocked` — `pg_advisory_xact_lock(hashtext(triggerId))`
로 트리거 단위 직렬화 + 락 획득 후 행을 다시 읽어 그 위에 머지 — 이고, 세 호출부
(`chat-channel-binder.service.ts` 성공/실패 경로, `triggers.service.ts::rotateBotToken`) 가 기존의
"읽은 시점 in-memory 스냅샷으로 `config` 를 통째로 재구성" 방식을 대체한다.

## 발견사항

- **[INFO]** advisory lock 이 보호하는 것은 `config` 뿐, `chatChannelHealth`/`chatChannelLastError`
  등 상태 컬럼은 이 락 밖에서도 갱신될 수 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`columns` 파라미터,
    JSDoc `@param columns` 및 `patch` 구성부) — 호출부는
    `chat-channel-binder.service.ts:263-267`(성공)·`:300-303`(실패),
    `triggers.service.ts:1124-1129`(`rotateBotToken`)
  - 상세: `rewriteTriggerConfigLocked` 는 `config` 재읽기+머지만 lost-update 로부터 보호한다.
    같은 행의 `chatChannelHealth`/`chatChannelSetupAt`/`chatChannelLastError`/
    `chatChannelRotatedAt`/`chatChannelTokenV2` 컬럼은 이 diff 범위 밖의 다른 코드 경로
    (`chat-channel.dispatcher.ts`, `hooks.service.ts`, `notification-webhook.processor.ts` 등, 이번
    변경에 포함되지 않음)에서 `repository.update({id}, {chatChannelHealth: …})` 형태로 같은 락을
    거치지 않고 동시에 쓸 수 있다. `config` 자체는 잃지 않지만 헬스/에러 상태 컬럼끼리는 여전히
    "나중에 커밋된 쪽이 이긴다" 식 단순 덮어쓰기라 관측성(health/lastError) 관점의 lost-update 는
    남아 있다. 보안 유의미(서명 fail-open)한 값이 아니라 심각도는 낮다.
  - 제안: 새 결함으로 다루기보다, plan `§D` 후속 목록(19건 write-site 전수 열거)에 "health 상태
    컬럼도 config 와 같은 락을 타야 하는가" 항목으로 명시적으로 편입해 두면 다음 사람이 스코프를
    재확인하지 않아도 된다.

- **[INFO]** e2e 테스트에서 assertion 실패 시 advisory lock 보유 커넥션과 대기 중인 Promise 가
  정리되지 않고 `afterAll` 까지 남는다
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:134-148`
    (`waitForWindowOneCommit`), `:182-196` (`bPromise` 생성)
  - 상세: `waitForWindowOneCommit` 이 타임아웃으로 던지거나 그 사이의 `expect` 가 실패하면,
    `lockDb` 는 `BEGIN` 상태로 advisory lock 을 쥔 채 남고 `bPromise`(supertest PATCH 요청 B)는
    그 락이 풀릴 때까지 미해결 상태로 방치된다. `afterAll` 의 `lockDb.end()` 가 트랜잭션을
    암묵적으로 롤백해 락은 해제되지만, `bPromise` 자체는 어디서도 await/catch 되지 않아 실패
    경로에서 unhandled rejection 경고나 Jest "did not exit" 경고로 이어질 수 있다.
  - 제안: 실패 시에도 `bPromise` 를 안전하게 정리(`.catch(() => undefined)` 부착 등)하거나,
    `try/finally` 로 `lockDb` 트랜잭션을 명시적으로 `ROLLBACK` 하는 정리 경로를 두면 실패 시
    노이즈가 줄어든다. 판별 로직 자체(락을 테스트가 직접 쥐어 겹침을 강제)는 견고하다.

- **[INFO]** advisory lock 키 공간(`pg_advisory_xact_lock(hashtext(...))`, 32비트)을 서로 다른
  네임스페이스(`trigger-config:*`, `execution-engine.service.ts` 의 `exec-cap:*`)가 접두어만
  다르게 공유
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18`
    (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `hashtext` 충돌 시 서로 무관한 트리거/워크스페이스 자원이 우연히 같은 락을 공유해
    불필요하게 직렬화될 수 있다(정확성 버그는 아니고 과잉 직렬화 — 데드락도 아니다, 각 트랜잭션이
    잡는 락이 하나뿐이라 lock-ordering 데드락 조건 자체가 성립하지 않는다). 이미
    `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 등재돼 있어 새 발견은
    아니다 — 동시성 관점에서도 같은 결론(허용 가능한 리스크)임을 재확인한다.
  - 제안: 별도 조치 불필요, 기존 등재로 충분.

## 검증한 것 (문제 없음으로 판정)

- **락 배치와 외부 호출 분리**: 세 호출부 모두 `adapter.setupChannel`(외부 HTTP)을 락 **밖**에서
  끝낸 뒤 `rewriteTriggerConfigLocked` 를 부른다 — 커넥션/락 점유 시간이 「읽기+머지+쓰기」로만
  좁혀져 있다(Cafe24 advisory-lock 기각 선례가 지적한 "HTTP 를 트랜잭션에 묶는" 문제를 피함).
- **presence 게이트 재계산**: `survivesWithFresh(freshConfig)` 가 `inboundSigningRefSurvives`(락
  이전 상태) 와 `freshConfig.chatChannel?.inboundSigningRef`(락 안에서 다시 읽은 최신 상태) 를
  OR 로 묶어, 컨테이너만 재읽고 값 자체는 옛 계산을 그대로 쓰는 재발 패턴(consistency-check
  rationale_continuity W1 이 지적했던 바로 그 결함)을 실제로 닫았다. 성공/실패 두 경로가 같은
  술어(`buildMergedChannel`/`buildFallbackChannel`)를 공유해 갈라지지 않는다.
- **격리 수준 의존**: `manager.transaction()` 에 isolation level 을 명시하지 않아 Postgres 기본값
  READ COMMITTED 를 쓴다 — 이 설계가 성립하려면 필수 전제다(REPEATABLE READ/SERIALIZABLE 이면
  advisory lock 획득 대기 이후에도 트랜잭션 스냅샷이 락 획득 *이전* 시점에 고정될 수 있어, 락 안
  재읽기가 동시 커밋을 못 볼 위험이 있다). 이 저장소의 다른 자리(`workflows.service.ts`,
  `executions.service.ts`)는 REPEATABLE READ 를 명시적으로 쓰는 사례가 있지만, 여기서는 명시하지
  않아 기본값에 의존한다 — 현재는 올바르게 동작하지만 향후 누군가 전역 기본 isolation level 을
  바꾸거나 이 호출에 isolation level 인자를 실수로 추가하면 조용히 재발할 수 있는 암묵적 전제다.
  다만 이는 가정형 미래 리스크이고 현재 코드에는 결함이 없어 별도 항목으로 올리지 않는다.
- **데드락**: 각 트랜잭션이 잡는 advisory lock 은 하나뿐이고(트리거 단위), 중첩 트랜잭션·순서가
  다른 복수 락 획득이 없어 lock-ordering 데드락 조건이 성립하지 않는다. 상위 요청 핸들러가 별도
  트랜잭션으로 이 흐름을 감싸는 곳도 없어(searched: `typeorm-transactional`/`cls-hooked`/
  `@Transactional` 미사용) 같은 세션 안에서 advisory lock 을 이중 획득해 자기 자신과 교착할
  가능성도 없다.
- **원자성/best-effort 반환값**: 재읽은 행이 삭제됐으면 `false` 를 반환하고 쓰기를 skip —
  예외를 던지지 않아 세 호출부(모두 best-effort 경로)에서 unhandled rejection 없이 안전하게
  무시된다.
- **테스트 배선**: `triggers.service.spec.ts` 의 `withTransactionMock` 이 `manager.transaction`
  콜백을 실제로 실행하고 안쪽 `query`/`findOne`/`update` 를 기존 repo mock 으로 위임한다 — no-op
  mock 이었다면 13개 케이스가 조용히 vacuous 해졌을 것을 뮤테이션으로 실측 확인했다는 주석이
  근거를 남긴다. e2e 는 advisory lock 을 테스트가 직접 쥐어 인터리빙을 우연이 아니라 강제로
  만들고, 두 인터리빙(성공경로가 먼저/나중)을 각각 다른 단언으로 커버한다 — "분기를 못 가르는
  fixture" 함정을 피했다.

## 요약

새로 추가된 `rewriteTriggerConfigLocked` 는 advisory lock 을 외부 HTTP 호출 밖에 두고 락 안에서
행을 다시 읽어 머지하는 정석적인 lost-update 방지 패턴이며, 표적 결함(`inboundSigningRef` 의
presence 게이트가 락 밖 스냅샷에 고정돼 재발하는 문제)까지 `survivesWithFresh` 로 닫았다. 락
배치·격리수준 의존·데드락 가능성을 확인한 결과 CRITICAL/WARNING 급 결함은 없다. 남는 것은 이번
diff 범위 밖의 health 상태 컬럼 레이스, e2e 실패 경로의 리소스 정리, 그리고 이미 등재된 advisory
lock 키 공간 공유 — 셋 다 INFO 수준이며 둘은 plan/consistency 산출물에 이미 추적되고 있다.

## 위험도

LOW
