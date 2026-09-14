# 동시성(Concurrency) 리뷰

## 발견사항

- **[CRITICAL]** `trigger.config` lost-update 수정이 "네 자리 전부"라고 주장하지만, 같은 클래스의 무보호 `save(trigger)` 자리가 최소 5곳 더 남아 있다 (fail-open 재발 가능)
  - 위치:
    - `codebase/backend/src/modules/triggers/triggers.service.ts:797-828` `normalizeNotificationSecretRef` (827줄 `await this.triggerRepository.save(trigger);`) — `update()` 661줄에서 락 해제 뒤 호출
    - `codebase/backend/src/modules/triggers/triggers.service.ts:1015-1049` `rotateNotificationSecret` (1037줄 `save(trigger)`)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:1059-1094` `revokePerTriggerToken` (1085줄 `save(trigger)`, `trigger.config = {...trigger.config, interaction: updated}`)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:1282-1343` `promoteRotatedNotificationSecrets` (1308·1339줄 `save(trigger)`, 시간당 cron)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:1354-1394` `cleanupRotatedChatChannelTokens` (1390줄 `save(trigger)`, 시간당 cron)
  - 상세: 이 PR 의 핵심 주장(CHANGELOG.md 11~17줄, `trigger-config-lock.ts` JSDoc)은 *"`config` 를 다시 쓰는 네 자리 전부(`update()` · binder 성공/실패 · `rotateBotToken`)를 advisory lock 안으로 넣었다"* 다. 그런데 위 5개 함수는 모두 같은 반증 가능한 패턴을 그대로 갖고 있다 — `findById`(또는 벌크 쿼리)로 락 없이 `trigger` 를 읽고, 그 in-memory 엔티티의 일부 필드만 바꾼 뒤 `triggerRepository.save(trigger)` 로 **행 전체를 다시 쓴다**. TypeORM 의 `save(entity)` 는 로드된 시점의 `config` JSONB 컬럼까지 통째로 함께 쓰므로, 이 읽기와 쓰기 사이에 다른 요청(`update()` 창1 · `setupChatChannel` 성공/실패 경로 · `rotateBotToken`)이 같은 트리거의 `config`(특히 `chatChannel.inboundSigningRef`)를 커밋하면, 그 커밋은 **이 5개 함수의 저장이 조용히 되돌린다**. 이는 정확히 이 PR 이 닫으려는 `ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;` fail-open 과 같은 결함이다.
    - `normalizeNotificationSecretRef` 는 `update()` 안에서 락이 걸린 쓰기가 커밋된 **직후**, 아직 이번 요청의 응답이 나가기 전에 호출된다 — `this.secrets.rotate(...)` (secret store 왕복)를 거친 뒤 저장하므로 다른 요청의 `chatChannel` 커밋이 그 사이에 끼어들 시간 창이 실재한다.
    - `rotateNotificationSecret` 은 `config` 를 아예 건드리지 않지만, `trigger` 엔티티 전체를 `save()` 하므로 `findById` 시점에 읽은 `config` 스냅샷이 그대로 다시 쓰인다 — 이번 PR 이 `hooks.service.ts` 의 `touchLastTriggeredAt` 을 `save(trigger)` → `update({id}, {lastTriggeredAt})` 로 바꾼 것과 **정확히 같은 결함 모양**인데 이 자리는 고쳐지지 않았다.
    - `promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens` 는 시간당 cron 이 `createQueryBuilder(...).getMany()` 로 여러 후보를 한 번에 읽고 **루프 안에서** (secret store·provider revoke 외부 호출을 거쳐) 하나씩 저장한다 — 후보 하나의 스냅샷과 실제 저장 시각 사이의 창이 요청-응답형 자리보다 훨씬 넓다(다른 후보 처리 시간만큼).
  - 제안: 다섯 자리 모두 같은 규율로 닫는다. `config` 를 바꾸는 자리(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·두 cron)는 `rewriteTriggerConfigLocked` 로, `config` 를 안 바꾸는 자리(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens` 의 컬럼 갱신)는 `hooks.service.ts` 의 `touchLastTriggeredAt` 처럼 컬럼 한정 `update()` 로 바꾼다. 최소한 CHANGELOG·JSDoc 의 "네 자리 전부" 서술을 정정하고 잔여 5곳을 후속 작업으로 명시해야 한다 — 지금 그대로 두면 "이 클래스는 닫혔다" 는 문서가 구현보다 넓게 말한다.

- **[WARNING]** `rotateBotToken` 의 `rewriteTriggerConfigLocked` 머지 함수가 `chatChannel` 을 필드 단위로 병합하지 않고 락 이전 스냅샷으로 통째로 교체한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken` 내 `mergedChannel` 구성부(1192·1211~1216줄)와 그것을 쓰는 `rewriteTriggerConfigLocked` 호출 `(freshConfig) => ({ ...freshConfig, chatChannel: mergedChannel })` (1236~1246줄 부근)
  - 상세: `mergedConfig`/`mergedChannel` 은 `rotateBotToken` 진입 시점(락 획득·`adapter.setupChannel` 호출보다 전)에 읽은 `chatChannelCfg` 를 베이스로 만들어진다. 락 안에서 `freshConfig` 를 다시 읽지만, 병합 콜백은 `freshConfig.chatChannel` 의 필드를 보지 않고 `chatChannel: mergedChannel` 로 **완전 교체**한다. `botTokenRef`·`inboundSigningRef` 는 이 함수가 항상 강제로 다시 실어서 안전하지만, 그 둘을 제외한 `chatChannel` 의 다른 필드(예: provider 별 부가 설정)를 동시 PATCH 가 그 사이에 바꿨다면 `rotateBotToken` 의 이 쓰기가 그 변경을 조용히 되돌린다 — `update()` 의 창1이 `baseConfig`/`fresh?.config` 를 재읽어 병합하는 것과 대칭이 맞지 않는다.
  - 제안: `chat-channel-binder.service.ts` 의 `buildChannel(freshConfig, setupResult)` 처럼, `rotateBotToken` 도 `freshConfig.chatChannel` 을 베이스로 `botTokenRef`/`inboundSigningRef`/`configUpdates` 만 위에 덮어쓰는 형태로 바꿔 재발 가능성을 없앤다. (심각도를 WARNING 으로 매긴 이유: 위 CRITICAL 항목과 달리 보안 핵심 필드인 `inboundSigningRef` 자체는 항상 보존되므로 fail-open 재발은 아니고, 부가 필드 유실에 그친다.)

## 검증

저장소 파일은 읽기만 했고 뮤테이션·임시 파일 작성은 하지 않았다 (`git status --short` 확인 불필요 — 트리 변경 없음).

새로 도입된 `pg_advisory_xact_lock` 기반 직렬화(`trigger-config-lock.ts`) 자체는 견고하다: 락은 항상 하나의 트리거 키만 잡고(중첩 락 없음 → 락 순서 역전으로 인한 데드락 경로 없음), `manager.transaction` 안에서만 호출되도록 강제되어 있으며, 삭제 경로만 `SET LOCAL lock_timeout` 으로 상한을 둔 것도 (그 상한이 같은 트랜잭션의 다른 락 대기에도 적용된다는 부작용까지 포함해) JSDoc 에 이미 스스로 인지·문서화돼 있다. `rewriteTriggerConfigLocked` 는 락 획득 → 재조회 → 병합 → 쓰기 순서가 코드·유닛테스트(`trigger-config-lock.spec.ts`) 양쪽에서 명시적으로 검증된다. e2e (`trigger-config-lost-update.e2e-spec.ts`) 는 별도 커넥션으로 advisory lock 을 쥐어 두 요청의 겹침을 우연이 아니라 강제로 재현하는 방식이라 신뢰할 만하다. `hooks.service.ts` 의 인입 hot path 두 곳도 `save(trigger)` → 컬럼 한정 `update()` 로 정확히 고쳐졌고 두 호출부 모두 회귀 테스트를 갖췄다.

다만 이번 리뷰에서 실측한 대로, 이 PR 이 다루지 않은 **같은 파일 안의 5개 함수**가 여전히 "락 없이 읽은 엔티티를 통째로 `save()`" 패턴을 유지하고 있어, 이 PR 이 명시적으로 닫았다고 주장하는 결함 클래스가 다른 진입점으로 살아있다. 이것이 이번 리뷰의 핵심 지적이다.

## 요약

새로 추가된 advisory-lock 기반 직렬화 메커니즘(`trigger-config-lock.ts`)과 그것을 사용하는 네 자리(`TriggersService.update()`·`ChatChannelBinderService.setupChatChannel` 성공/실패·`rotateBotToken`)는 락 순서·재조회·삭제 경쟁까지 꼼꼼히 다뤄져 있고 e2e 로 실제 인터리빙까지 검증됐다. 그러나 같은 `triggers.service.ts` 안에 `config`(또는 `config` 를 포함한 엔티티 전체)를 락 없이 읽어 `save()` 로 되쓰는 5개 함수(`normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`)가 남아 있어, 이 PR 이 닫으려는 `chatChannel.inboundSigningRef` fail-open 이 다른 엔드포인트/cron 경로를 통해 재현될 수 있다. 또한 `rotateBotToken` 의 `chatChannel` 병합이 필드 단위가 아니라 락 이전 스냅샷 기반 전체 교체라 부가 필드 유실 가능성이 남아 있다. 두 지적 모두 이 PR 이 스스로 세운 "config 재작성은 항상 락 안에서, 항상 재읽은 값 위에 병합" 원칙을 완전히 관철하지 못한 잔여 사례다.

## 위험도

CRITICAL
