# 보안(Security) 리뷰 — trigger-config-lost-update

## 검토 범위

동시 `PATCH /api/triggers/:id` 등이 `trigger.config` 를 스냅샷 기반으로 통째 덮어써
`chatChannel.inboundSigningRef`(인입 웹훅 서명 검증 키)가 유실되고, 그 결과
`ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;` 가 걸려
**서명 검증 없이 웹훅이 통과하는 fail-open** 경로를 advisory lock(`pg_advisory_xact_lock`)
+ 락 안 재읽기로 닫는 변경이다. 핵심 신규 파일 `trigger-config-lock.ts` 와, 이를 배선하는
`triggers.service.ts` / `chat-channel-binder.service.ts` / `hooks.service.ts` /
`schedules.service.ts` / `chat-channel-input-rules.ts` 를 실제 소스(diff + 전체 파일)로
직접 열어 확인했다. `review/code/**`·`review/consistency/**`·`plan/**` 산출물은 이전 라운드
기록이며 코드 변경이 아니라 이번 라운드의 대상에서 제외했다.

이 PR **자체가 보안 수정**이라는 점을 먼저 짚는다 — 새 취약점을 찾는 관점과 별개로,
"고친 코드가 실제로 그 fail-open 을 닫는가"를 검증하는 것이 이번 리뷰의 핵심이다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 락 안 재읽기가 `workspaceId` 로 스코프되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:162` (`m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 이 헬퍼는 `id` 단일 조건으로만 트리거 행을 재조회한다. IDOR 관점에서 우려될 수 있는 지점이지만, 실제 호출부를 전수 확인한 결과 이 함수를 부르기 **전에** 이미 워크스페이스 스코프 조회로 소유권이 확정돼 있다 — `TriggersService.update()` 는 `findByIdForUpdate(id, workspaceId)`(`triggers.service.ts:531,546`), `revokePerTriggerToken`/`rotateBotToken` 은 `findById(id, workspaceId)`(`triggers.service.ts:1120`), `chat-channel-binder.service.ts` 의 `setupChatChannel` 은 호출자가 이미 워크스페이스 스코프로 확보한 `Trigger` 엔티티를 인자로 받는다. cron 경로(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)는 애초에 전체 워크스페이스를 순회하는 배치라 워크스페이스 경계가 없다. 따라서 이번 diff 가 새로 여는 인가 우회는 없다 — 다만 이 헬퍼가 소유권 사전 검증을 **전제**로만 두고 코드로 강제하지 않으므로, 다음에 이 헬퍼를 다른 자리(워크스페이스 사전 검증이 없는 자리)에 재사용하면 조용히 다른 워크스페이스 행을 읽고 쓸 위험이 있다.
  - 제안: `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 의 JSDoc에 "호출부가 `triggerId` 의 워크스페이스 소유권을 이미 검증했음을 전제한다(이 함수는 workspaceId 필터를 걸지 않는다)"는 전제를 명시해 다음 재사용자가 실수하지 않게 한다. 차단 사유는 아니다(이미 이전 라운드에서 동일하게 지적·수용된 항목의 재확인).

- **[INFO]** `SET LOCAL lock_timeout` 이 파라미터 바인딩 없이 문자열 보간으로 구성된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:57` (`acquireTriggerConfigLock`)
  - 상세: `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` `` 는 PostgreSQL 이 이 위치에 바인드 파라미터를 허용하지 않아 문자열 보간을 쓴 자리다. 실제 호출부 전수 확인 결과(`triggers.service.ts:623` 은 인자 없이 호출, `triggers.service.ts:1027-1028`·`schedules.service.ts:315-316` 은 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 만 전달) 사용자 입력이 이 값에 닿는 경로는 현재 없다. `Math.trunc()` 가 숫자가 아닌 임의 문자열을 넘겨도 `ToNumber` 강제 변환으로 `NaN` 이 되어 SQL 인젝션이 아니라 문법 오류(`'NaNms'`)로 귀결되므로, 설사 향후 실수로 비신뢰 입력이 흘러들어와도 인젝션보다는 쿼리 실패 쪽으로 fail 한다. 현재로서는 익스플로잇 가능한 결함이 아니다.
  - 제안: 방어 심도 차원에서 `Number.isFinite(options.timeoutMs)` 검증(또는 상한 clamp)을 함수 진입부에 추가해 두면, 향후 이 함수가 사용자 입력을 받는 자리로 확장되더라도 이 자리가 자동으로 안전하게 유지된다. 차단 사유는 아니다.

- **[INFO]** 이번 변경이 닫는 것은 실질적인 보안 결함(fail-open)이며, 회귀 테스트로 고정돼 있다 — 긍정적 확인
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` 전체, `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:423-437`(`extractInboundSigningRef` 단위 테스트), `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:195-238`(`survivesWithFresh`/`buildChannel`가 락 안에서 재읽은 `freshConfig` 의 ref presence 를 게이트에 포함)
  - 상세: e2e 스펙은 advisory lock 을 테스트가 직접 쥐어 "요청 B 가 시작할 때 ref 가 없고, 그 사이 요청 A 가 ref 를 확립"하는 정확한 경합 조건을 결정적으로 재현한다 — 우연한 타이밍에 기대지 않는다. 락 획득(`pg_advisory_xact_lock(hashtext($1))`)과 A 가 쓰는 `UPDATE trigger SET config = $2::jsonb WHERE id = $1` 모두 파라미터 바인딩을 쓴다(SQL 인젝션 없음). `chatChannel.inboundSigningRef` 를 되쓰는 세 갈래(성공 경로, 실패/degraded 경로, `chatChannel` 을 아예 싣지 않은 PATCH)를 각각 별도 캐너리로 커버한 점도 확인했다.
  - 제안: 없음(참고 목적).

- **[INFO]** 신규/변경된 컬럼 한정 갱신 경로(`touchLastTriggeredAt`, `rotateNotificationSecret`, `promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens`, `SchedulesService.update`)는 모두 `{ id: trigger.id }` 를 조건으로 쓰고 트리거 id 는 이미 워크스페이스 스코프 조회로 확정된 값만 사용 — 신규 인가 우회 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `touchLastTriggeredAt`, `codebase/backend/src/modules/schedules/schedules.service.ts:238-256`
  - 상세: 문자열 결합이 아닌 TypeORM `update(criteria, partial)` API 를 사용하므로 SQL 인젝션 표면이 없다. 로그(`schedules.service.ts` 의 `logger.error`, `triggers.service.ts` 의 삭제 실패 로그)에 실리는 값은 `err.message`(내부 DB 오류 메시지)뿐이고 시크릿·토큰 값을 포함하지 않으며, 서버 로그로만 가고 HTTP 응답에는 노출되지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 신규 취약점을 도입하는 PR 이 아니라, 동시 PATCH/웹훅 경합으로 `chatChannel.inboundSigningRef` 가 조용히 유실되어 인입 웹훅 서명 검증이 fail-open 되던 실질적 보안 결함을 advisory lock + 락 안 재읽기로 닫는 수정이다. 모든 신규/변경 쿼리는 파라미터 바인딩(`$1`) 또는 TypeORM criteria API 를 사용해 SQL 인젝션 표면이 없고, 유일한 문자열 보간 지점(`SET LOCAL lock_timeout`)은 호출부가 모듈 상수만 전달하도록 배선돼 있어 현재는 익스플로잇 불가능하다(다만 방어 심도로 숫자 검증을 추가할 여지는 있다). 락 안 재읽기 헬퍼가 `workspaceId` 스코프 없이 `id` 단일 조건으로 조회하는 점은 현재 모든 호출부가 사전에 워크스페이스 소유권을 검증한 뒤라 실질적 인가 우회로 이어지지 않지만, 헬퍼 자체가 그 전제를 강제하지 않으므로 향후 재사용 시 실수 가능성에 대비해 JSDoc 명시를 권한다. 하드코딩된 시크릿·평문 전송·안전하지 않은 해시 사용·민감 정보 에러 노출·신규 의존성 취약점은 발견되지 않았다. 차단할 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

LOW
