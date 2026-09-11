# 동시성(Concurrency) 리뷰 — `impl-chat-channel-binder-t2`

## 개요

이 변경은 `TriggersService` 의 `setupChatChannel` / `teardownChatChannel` (+ `buildCallbackUrl`)
private 메서드를 `ChatChannelBinderService` / `buildTriggerCallbackUrl` 로 **그대로 옮긴 것**이다
(plan 자체가 "단언 diff 0줄"을 증거로 내세우는 순수 이동). 새 lock/mutex/세마포어, 새로운
Promise 조합(`Promise.all` 등), 새 스레드풀·커넥션풀 설정은 도입되지 않았다. 따라서 동시성
관점에서 **새로 만들어진 결함은 없다** — 다만 이동된 코드 자체에 존재하던 논-원자적 쓰기 패턴이
이제 서비스 경계를 넘어 호출되므로, 그 성격을 재확인해 아래에 기록한다.

## 발견사항

- **[INFO]** `trigger.config` 에 대한 read‑merge‑write 가 여러 개의 독립된 `await` 경계를 넘어
  이뤄져, 동일 `trigger.id` 에 대한 동시 PATCH 요청 사이에서 **application-level lost update**
  가 가능하다 (사전 존재 — 이 PR 이 만든 것이 아님).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:226-238`
    (`setupChatChannel` 성공 경로의 `const newConfig = { ...(trigger.config ?? {}), chatChannel: mergedChannel }; await this.triggerRepository.update({ id: trigger.id }, { config: newConfig, ... })`)
    및 `chat-channel-binder.service.ts:258-269` (실패 경로의 동일 패턴).
  - 상세: `newConfig`/`fallbackConfig` 는 호출자(`TriggersService.create()`/`update()`)가 애초에
    읽어 둔 `trigger` 스냅샷을 기준으로 메모리에서 조립된다. `setupChannel` adapter 호출(외부
    I/O, 지연 발생 가능)과 `secrets.rotate()` 호출들이 그 사이에 여러 번 `await` 되므로, 같은
    `trigger.id` 에 대한 두 번째 PATCH(또는 재시도)가 그 구간 동안 끼어들어 자신의 스냅샷으로
    먼저 `triggerRepository.update()` 를 완료하면, 나중에 끝나는 첫 호출이 그 갱신을 **통째로
    덮어쓴다** (`config` 컬럼은 절대값으로 SET 되며 DB 레벨 병합이 아니다). row-level lock
    (`SELECT ... FOR UPDATE`)이나 낙관적 버전 컬럼, DB 트랜잭션 경계가 없다.
  - 이 자체는 **이 PR 이 새로 만든 결함이 아니다** — `TriggersService` 내부에 있던 원본
    private 메서드에도 동일한 패턴이 있었고, 그대로 복사됐다(동작 보존이 이 PR 의 명시적
    목표). `plan/in-progress/impl-chat-channel-binder-t2.md` 의 `--impl-prep` 결과표 "INFO 3"
    항목이 바로 이 lost-update 후속 트래커 항목을 이미 인지하고 있으며, "T2 완료 시 호출이
    서비스 경계를 건넌다"는 각주만 추가하기로 명시적으로 처분했다. 즉 **이미 별도로 추적 중인
    기존 리스크**다.
  - 제안: 이 PR 범위에서 조치는 불필요(이미 별도 항목으로 유예됨). 다만 그 후속 항목을 처리할
    때 이번 이동으로 쓰기 지점이 `ChatChannelBinderService` 로 옮겨갔다는 사실을 반영해야 한다
    (수정 위치가 더 이상 `TriggersService` 안이 아님).

- **[INFO]** `ChannelListenerRegistry.register()` (동기 호출, `chat-channel-binder.service.ts:241`)
  은 `triggerRepository.update()` 완료 **직후**에만 호출되고 그 사이 별도 락은 없다. DB 커밋과
  인메모리 registry 갱신 사이의 원자성은 보장되지 않지만(프로세스 크래시 시 불일치 가능), 이는
  단일 프로세스 내 순차 코드일 뿐 이 PR 이 만든 새 레이스는 아니며 원본 그대로다. 재확인 결과
  순서·조건(success path 전용, catch 경로에서는 register 되지 않음)도 이동 전후 동일하다.

- **[정보 없음/해당 없음]** 나머지 관점(데드락, 명시적 동기화 primitive, 스레드 안전성 —
  Node.js 이벤트 루프 단일 스레드 환경이고 클래스는 인스턴스 상태를 갖지 않는 stateless
  singleton, 리소스 풀링)에 대해서는 이번 diff 에서 유의미하게 새로 만들어지거나 변경된 코드가
  없다. `async/await` 사용은 전부 올바르며 누락된 `await` 는 없다(`setupChannel`, `secrets.rotate`,
  `triggerRepository.update`, `adapter.teardownChannel` 모두 `await` 됨). `ConfigService` ·
  `Repository<Trigger>` 는 Nest 기본 스코프(싱글턴)이므로 새 provider(`ChatChannelBinderService`)
  로 옮겨도 동시 요청 간 공유 상태 성격은 변하지 않는다.

## 요약

이 변경은 두 메서드(`setupChatChannel`/`teardownChatChannel`)와 헬퍼 함수(`buildTriggerCallbackUrl`)
를 `TriggersService` 에서 새 `ChatChannelBinderService`/`trigger-callback-url.ts` 로 그대로
옮긴 리팩터링이며, 동시성 관점에서 새로 도입된 락·세마포어·Promise 조합·스레드풀 변경은 없고
`async/await` 사용도 올바르다. 이동된 코드 안에 이미 존재하던 `trigger.config` 에 대한
비원자적 read-merge-write(동시 PATCH 시 lost-update 가능)는 이 PR 로 새로 생긴 것이 아니라
원본 그대로 복사됐고, plan 자체가 `--impl-prep` 단계에서 이를 인지해 별도 후속 트래커 항목으로
명시적으로 유예 처분했다. 따라서 이 diff 만 놓고 볼 때 신규 동시성 결함은 없다.

## 위험도

LOW
