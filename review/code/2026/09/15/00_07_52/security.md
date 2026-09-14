# Security Review — trigger-config-lost-update

## 검토 범위

`trigger.config`(JSONB) lost-update로 인해 `chatChannel.inboundSigningRef`(인입 웹훅 서명
검증 키)가 동시 요청 사이에서 유실되어 `ChatChannelInboundAuthenticator`의
`if (!config.inboundSigningRef) return;`가 걸려 **서명 검증이 fail-open**되던 결함을,
advisory lock(`pg_advisory_xact_lock`) + 락 안 재읽기(read-after-lock)로 닫는 백엔드
동시성 수정이다. 핵심 파일을 직접 열어(diff가 아니라 현재 HEAD 전체 컨텍스트) 확인했다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (전체)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (전체)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`extractInboundSigningRef` 추가분)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` 추출)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (`update()` 컬럼 한정 갱신)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e)
- `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` / `__test-utils__/trigger-transaction-mock.ts` (테스트 인프라)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 외 정적 래칫 가드

## 발견사항

- **[INFO]** `SET LOCAL lock_timeout` 구문이 문자열 보간(string interpolation)으로 조립된다 — 현재는 안전하나 호출 계약이 코드로 강제되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`, `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` `` 문)
  - 상세: `options.timeoutMs`는 파라미터 바인딩이 안 되는 자리라 `Math.trunc`로 정수화한 뒤 그대로 문자열에 넣는다. 실제 호출부를 전수 확인한 결과(`grep -n "acquireTriggerConfigLock"`) `timeoutMs`가 넘어오는 곳은 `triggers.service.ts`의 `remove()` 단 한 곳이며, 그 값은 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`뿐이다 — 사용자 입력이 이 값에 닿는 경로는 없다. 다만 이 안전성은 "현재 호출부가 상수만 넘긴다"는 **관례**에 의존하고 있고, `timeoutMs: number` 타입 시그니처 자체는 임의의 숫자(예: `Infinity`, `NaN`, 혹은 향후 사용자 입력에서 파생된 값)를 허용한다. 지금 당장 익스플로잇 가능한 인젝션은 아니다(파라미터가 SQL 구문이 아니라 값이고, 값 출처가 상수로 고정돼 있으므로).
  - 제안: 차단 사유는 아니다. 여유가 있으면 `timeoutMs`를 `number` 대신 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`류의 **branded/literal 타입**으로 좁히거나, 함수 내부에서 `Number.isInteger(options.timeoutMs) && options.timeoutMs > 0` 방어 검증을 추가해 향후 호출부가 실수로 동적 값을 넘기더라도 인젝션 표면이 열리지 않게 하면 좋다.

- **[INFO]** `rewriteTriggerConfigLocked`의 락 안 재읽기(`m.findOne(Trigger, { where: { id: triggerId } })`)가 `workspaceId`로 스코프되지 않는다 — 호출부 사전 검증에 의존한 설계이고 신규 인가 우회는 아니다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`rewriteTriggerConfigLocked` 내부 `m.findOne` 호출)
  - 상세: 이 헬퍼는 `id` 단일 조건으로만 재읽는다. 호출부 3곳(`chat-channel-binder.service.ts`의 `setupChatChannel` 성공/실패 경로, `triggers.service.ts`의 `rotateBotToken`·`normalizeNotificationSecretRef`·`revokePerTriggerToken`)을 전수 확인한 결과, 모두 이 함수를 부르기 **전에** `findById(id, workspaceId)` 또는 `findByIdForUpdate(id, workspaceId)`로 워크스페이스 소유권을 이미 확정한 뒤였다 — 즉 다른 워크스페이스의 트리거 id를 넘겨도 그 이전 단계에서 `NotFoundException`으로 막힌다. 크론 경로(`promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens`)는 애초에 요청 기반이 아니라 내부 쿼리로 candidate를 뽑으므로 사용자 입력 id가 없다. 신규 인가 우회는 아니며, 기존 `triggerRepository.update({ id: trigger.id }, ...)` 패턴도 동일하게 `workspaceId`를 안 걸었던 관행의 연장이다.
  - 제안: 차단 사유는 아니다. 다음 재사용자가 이 헬퍼를 다른 자리에 붙일 때 "호출부가 소유권을 사전 검증했다"는 전제를 놓치기 쉬우므로, `trigger-config-lock.ts` JSDoc에 그 전제를 한 줄 명시하면 좋다(리뷰 이력상 이미 이전 라운드에서 동일하게 지적·수용된 항목).

- **[INFO]** 삭제 경합의 좁은 창 — `findOne` 성공 후 `remove()`가 끼어들면 조용한 no-op UPDATE
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`rewriteTriggerConfigLocked`)와 `triggers.service.ts` `remove()`의 advisory lock 블록
  - 상세: `rewriteTriggerConfigLocked`는 락을 잡은 뒤 `findOne`으로 존재를 확인하지만, 그 확인은 findOne **시점**의 것이다. `remove()`는 같은 advisory lock을 잡으므로 그 안에서의 경합은 막히지만, `findOne`이 성공적으로 행을 반환한 **직후** — 같은 트랜잭션 내에서 `m.update()`가 실행되기 전 — 다른 프로세스가 개입할 이론적 창이 있다. 다만 `remove()`도 같은 advisory lock을 트랜잭션 시작 시 잡으므로 실질적으로 이 창은 매우 좁고(같은 락을 쥔 트랜잭션 내부의 순차 실행), 설령 발생해도 결과는 데이터 손상이 아니라 "0 rows affected UPDATE가 조용히 성공으로 보고되는" 수준이다. 보안 취약점(인가 우회·정보 노출)이 아니라 관측성 문제다.
  - 제안: 조치 불요. 이미 별도 라운드(`review/code/2026/09/14/18_17_44/database.md`)에서 동일하게 INFO로 식별·수용됐다.

## 긍정적으로 확인한 점

- **인젝션**: advisory lock 키(`triggerId`)는 `pg_advisory_xact_lock(hashtext($1))` 형태로 항상 파라미터 바인딩된다(`trigger-config-lock.ts`, e2e 스펙의 raw 쿼리 포함). 문자열 concat으로 조립되는 SQL은 없다.
- **인증/인가**: `rewriteTriggerConfigLocked`를 부르는 모든 요청-기반 경로가 사전에 `workspaceId` 스코프 조회로 소유권을 검증한 뒤 진입한다. `update()`의 창 1(advisory lock 안으로 옮긴 부분)도 `where: { id: trigger.id, workspaceId }`로 재읽기 자체를 워크스페이스 스코프로 건다.
- **비밀 처리 회귀 없음**: `inboundSigningRef`/`botTokenRef`는 DTO 레벨에서 `@IsEmpty()` + `rejectBlockedField`로 클라이언트 입력을 거부하고(`chat-channel-input-rules.ts` `assertPatchCarriesNoSecrets`), 서비스가 서버 측에서만 `buildSecretRef`로 재유도한다 — 이번 변경이 이 경계를 건드리지 않았다. `sanitizeForResponse`의 4축 스트립(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`)도 변경 없음.
- **핵심 보안 수정 자체의 정확성**: `survivesWithFresh`(binder)와 창 1의 `previousInboundSigningRef` 재계산이 "컨테이너만 다시 읽는 것으로는 부족하다"는 이전 회귀(1라운드에서 예고했지만 7라운드에서 실제로 재발했던 함정)를 실제로 닫았다 — presence 게이트의 항이 요청 시작 시점 값 OR 락 안에서 재읽은 값으로 정확히 구성되어 있음을 코드로 확인했다. `rewriteTriggerConfigLocked`의 `patch = { ...columns, config: merge(...) }` 스프레드 순서(단위 테스트로 고정)도 호출부의 컬럼이 병합 결과를 실수로 덮지 못하게 막는다.
- **외부 호출을 락 밖에 두는 설계**: `setupChannel`(HTTP)이 항상 advisory lock 트랜잭션 **밖**에서 끝난 뒤에만 `rewriteTriggerConfigLocked`가 불린다 — Cafe24 advisory lock 기각 선례(HTTP를 트랜잭션에 묶으면 커넥션 점유가 늘어난다)를 정확히 학습해 반영했고, 이는 DoS/자원 고갈 관점에서도 바람직하다.
- **삭제 경로의 fail-fast**: `remove()`는 되돌릴 수 없는 정리(provider teardown·secret 삭제·BullMQ 해제)를 락 밖에서 먼저 끝낸 뒤, 삭제 자체만 5초 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)을 걸어 무한 대기 대신 드러나는 오류로 실패하게 한다 — 반쯤 삭제된 상태가 조용히 굳는 것을 막는 설계.
- **하드코딩된 시크릿 없음**: 변경 파일 전수(정규식 `AKIA...`, PEM 헤더, Slack `xoxb-*`, GitHub `ghp_*` 등)를 스캔한 결과, 테스트 파일의 `'xoxb-fake-token'`/`'111:e2eTelegramBotToken'`류 명백한 fixture 문자열 외에는 없다.
- **에러 처리**: `rotateBotToken`의 provider 에러 원문은 응답이 아니라 서버 로그(`this.logger.warn`)로만 남고, 클라이언트에는 `translateSetupChannelError`가 변환한 정형화된 코드만 전달된다(§5.4 계약 유지, 이번 PR이 건드리지 않음).
- **hooks.service.ts / schedules.service.ts의 컬럼 한정 갱신**: `touchLastTriggeredAt`과 `SchedulesService.update()`의 트리거 패치가 `save(entity)` 대신 `update({id}, patch)`로 바뀌어, 인입 hot path·스케줄 편집 양쪽에서 동시 PATCH가 확립한 `inboundSigningRef`를 되돌리는 경로가 제거됐다 — 이 PR이 의도한 보안 수정의 핵심 부분이며 실제로 정확히 구현돼 있다.

## 요약

이 변경은 실재하는 보안 결함(동시 요청에 의한 `trigger.config` lost-update가 인입 웹훅 서명 검증을 fail-open으로 되돌리는 문제)을 advisory lock 기반 직렬화 + 락 안 재읽기·서브키 단위 병합으로 정확히 닫는다. SQL은 전부 파라미터 바인딩이고, 워크스페이스 인가 검증은 모든 호출 경로에서 이 헬퍼 진입 전에 이미 끝나 있으며, 비밀 값 스트립·클라이언트 입력 차단 경계는 이번 변경으로 약화되지 않았다. 발견한 세 항목은 전부 INFO 수준이다 — `SET LOCAL lock_timeout` 문자열 보간은 현재 호출부가 상수만 넘겨 익스플로잇 불가능하고, 헬퍼의 `workspaceId` 미스코프는 호출부 사전 검증에 의존한 기존 관행의 연장이며, 삭제 경합의 좁은 창은 데이터 손상이 아닌 관측성 이슈다. 세 항목 모두 이전 리뷰 라운드에서 이미 식별·수용된 내용과 동일선상에 있다. 신규 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
