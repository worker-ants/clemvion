# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 트리거 단위 advisory lock 대기에 상한(timeout)이 없다 — 새로 도입된 공유 블로킹 자원
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:64-67` (`rewriteTriggerConfigLocked` 내부 `SELECT pg_advisory_xact_lock(hashtext($1))`)
  - 상세: 이 PR 은 같은 `triggerId` 에 대한 `chatChannel` 쓰기를 `pg_advisory_xact_lock` 으로 직렬화한다. 이 락은 트랜잭션 종료 시에만 자동 해제되고, `SELECT pg_advisory_xact_lock(...)` 자체에는 `lock_timeout`/`statement_timeout` 이 걸려 있지 않아 대기 시간이 무한하다. 이전에는 `chat-channel-binder.service.ts`/`triggers.service.ts` 의 config 쓰기가 락 없는 단순 `update()` 였으므로 같은 트리거에 대한 동시 PATCH/rotate 요청끼리 서로를 블로킹하는 일이 없었다 — 이 변경으로 **같은 트리거를 대상으로 한 요청들이 서로를 대기시키는 새로운 공유 자원(전역 advisory lock 네임스페이스 `trigger-config:<id>`)** 이 생겼다. 한 요청이 이 구간(락 획득 이후 read-merge-write)에서 비정상적으로 오래 걸리면(예: DB 부하, 커넥션 풀 고갈, 예기치 못한 예외로 인한 재시도 루프 등) 같은 트리거로 몰리는 후속 PATCH/rotate 요청들이 커넥션을 쥔 채 무한정 대기해 커넥션 풀을 잠식할 수 있다. 다만 이 코드는 자신의 JSDoc 에서 `execution-engine.service.ts` 의 admission 직렬화를 선례로 명시하는데, 그쪽도 동일하게 timeout 없이 `pg_advisory_xact_lock` 을 쓰고 있어(`execution-engine.service.ts:2977`) 이 저장소에 기존에 받아들여진 패턴과 일관된다. 새 위험 유형이라기보다는 **동일 패턴을 새 자원(트리거별 config)에 처음 적용**한 것이므로, 그 선례에서 이미 감수한 트레이드오프인지 재확인할 가치가 있다.
  - 제안: 의도된 트레이드오프라면 문서(`trigger-config-lock.ts` JSDoc)에 "락 대기에 상한이 없다"는 점을 명시해 다음 사람이 놓치지 않게 하거나, 짧은 `lock_timeout`(예: 수 초)을 트랜잭션 시작 시 `SET LOCAL lock_timeout` 으로 걸어 실패를 명시적으로 드러내는 편이 안전하다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 반환값(쓰기 skip 여부)이 세 호출부 전부에서 버려진다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:256`, `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:293`, `codebase/backend/src/modules/triggers/triggers.service.ts:1120`
  - 상세: `trigger-config-lock.ts` 의 JSDoc(54-56줄)은 "트리거가 그 사이 삭제됐으면 `false` 를 반환하는 이유는 호출부가 «조용히 아무것도 안 했다»를 관측할 수 있게 하기 위함"이라고 명시한다. 그런데 실제 세 호출부는 모두 `await rewriteTriggerConfigLocked(...)` 로만 쓰고 반환값을 읽지 않는다. 그 결과: (1) `chat-channel-binder.service.ts` 성공 경로에서 쓰기가 skip 되어도(동시 삭제) 바로 다음 줄(271번)의 `this.channelListenerRegistry.register(trigger.id, ...)` 는 무조건 실행되어 이미 삭제된 트리거에 대한 리스너가 등록된다. (2) `triggers.service.ts` 의 `rotateBotToken()` 에서는 쓰기가 skip 되어도 곧이어 `recordAudit({ action: TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED, ... })` (1133줄)가 무조건 기록되어, "회전됐다"는 감사 로그가 실제로는 반영되지 않은 상태를 가리킬 수 있다. 이는 이전 코드(무조건 `triggerRepository.update()`, 0-row-affected 도 조용히 성공)와 결과적으로 크게 다르지 않은 edge case 라 신규 회귀로 보기는 어렵지만, 새 함수가 스스로 이 신호를 "관측 가능하게 하려는 목적"이라고 문서화해 놓고 정작 아무도 소비하지 않는다는 점은 다음 사람이 "이미 처리됐다"고 오해할 소지가 있다.
  - 제안: 당장 처리하지 않더라도 최소한 트래커(`plan/in-progress/trigger-config-lost-update.md`)에 "반환값 미소비" 를 알려진 갭으로 등재해 두는 편이 좋다.

- **[INFO]** `chatChannelSetupAt`/`rotatedAt` 타임스탬프가 advisory lock 획득 **이전**에 캡처된다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:264`(`chatChannelSetupAt: new Date()`), `codebase/backend/src/modules/triggers/triggers.service.ts:1119`(`const rotatedAt = new Date();`)
  - 상세: 두 값 모두 `rewriteTriggerConfigLocked(...)` 호출 직전(락 획득 전)에 계산된다. 이전에도 SQL 왕복 시간만큼의 미세한 시차는 있었지만, 이번 변경으로 락 대기 시간이 새로 끼어들 수 있어(위 첫 항목) 컨텐션이 있는 상황에서는 기록되는 시각과 실제 커밋 시각 사이의 괴리가 더 커질 수 있다. 기능적으로 치명적이지는 않으나 "setup/rotate 완료 시각"이라는 컬럼의 의미가 정확히는 "완료 시각"이 아니라 "시도 시작 시각에 가까운 값"이 될 수 있음을 인지할 필요가 있다.
  - 제안: 심각하지 않으므로 처리는 선택 사항. 필요하면 `merge` 콜백 내부(락을 잡은 뒤)에서 시각을 캡처하도록 옮길 수 있다.

- 확인만 하고 이상 없음으로 처리한 항목(참고용, 액션 불필요):
  - `withTransactionMock`(`triggers.service.spec.ts:53-80`)은 인자로 받은 mock 객체를 스프레드로 복제해 반환하며 원본을 직접 mutate 하지 않는다. 여러 `describe` 블록에서 재사용해도 교차 오염 소지가 없음을 확인했다.
  - `rewriteTriggerConfigLocked` 는 순수 신규 함수 추가이고, `ChatChannelBinderService.setupChatChannel`/`TriggersService.update`/`TriggersService.rotateBotToken` 등 기존 공개 시그니처는 그대로 유지된다 — 호출자(컨트롤러 등) 영향 없음.
  - `TRIGGER_CONFIG_LOCK_PREFIX` 는 불변 상수이고, 그 문자열이 Redis 키 네임스페이스(`redis-keys.md`)와 겉모양이 겹치는 문제는 코드 자체 JSDoc(9-16줄)이 이미 인지하고 planner 트래커 항목으로 등재해 두었다 — 중복 지적 생략.
  - 새 e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)의 `afterAll` 은 자신이 만든 `createdTriggerIds` 만 DB 에서 지우고 커넥션을 닫는다 — 다른 테스트 자원을 건드리지 않는다.
  - `Trigger` 엔티티의 `workspace`/`workflow` 관계는 `eager` 가 아니므로, `rewriteTriggerConfigLocked` 안의 `m.findOne(Trigger, { where: { id } })` 가 관계 조인을 추가로 유발하지 않는다.
  - 새 환경 변수 읽기·쓰기, 새 네트워크 호출, 새 파일시스템 접근은 발견되지 않았다.

## 요약

이번 변경의 핵심은 `chat-channel-binder.service.ts`/`triggers.service.ts` 의 세 config 쓰기 지점을 advisory-lock 기반의 "락 안 재읽기 + 머지" (`rewriteTriggerConfigLocked`)로 교체해 lost-update/fail-open 결함을 닫는 것이며, 공개 시그니처·전역 변수·파일시스템·네트워크·환경 변수 측면에서는 새로운 부작용이 발견되지 않았다. 다만 이 교체가 "같은 트리거에 대한 동시 요청이 advisory lock 에서 서로를 대기시키는" 새로운 공유 블로킹 자원을 만들며, 그 대기에 timeout 이 없다는 점(기존 `execution-engine.service.ts` 선례와 동일 패턴이긴 함)과, 함수가 스스로 문서화한 "쓰기 skip 관측" 반환값을 세 호출부 모두 소비하지 않아 리스너 등록·감사 로그가 쓰기 성공 여부와 무관하게 실행된다는 점, 타임스탬프가 락 대기 이전에 캡처된다는 점은 향후 컨텐션 상황에서 관찰 가능한 부수 효과가 될 수 있어 기록해 둔다. 모두 즉시 차단할 결함이라기보다는 인지하고 넘어갈 만한 수준이다.

## 위험도

LOW
