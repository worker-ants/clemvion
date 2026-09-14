# Database Review — trigger-config lost-update 후속 (일곱 자리 마감)

## 검토 범위

`trigger.config` lost-update 를 닫는 이전 라운드(창 2·3·4, `chat-channel-binder.service.ts` ·
`triggers.service.ts` 의 `rotateBotToken`/`update`)에 이어, 이번 diff 는 CHANGELOG 가 말하는
"일곱 자리 더" — `normalizeNotificationSecretRef` · `rotateNotificationSecret` ·
`revokePerTriggerToken` · `promoteRotatedNotificationSecrets`(cron, 2분기) ·
`cleanupRotatedChatChannelTokens`(cron) · `SchedulesService` 의 trigger 동기화 · 삭제
(`TriggersService.remove`) — 를 `save(entity)` 대신 컬럼 한정 `update()` 또는
`rewriteTriggerConfigLocked()` 로 바꾼다. `codebase/backend/src/modules/triggers/triggers.service.ts` ·
`trigger-config-lock.ts` · `chat-channel-binder.service.ts` · `hooks.service.ts` ·
`schedules.service.ts` 및 대응 테스트/e2e 를 직접 열어 확인했다.

## 발견사항

- **[CRITICAL]** `normalizeNotificationSecretRef` / `promoteRotatedNotificationSecrets` 의 병합
  콜백이 **락 밖에서 만든 `notification` 객체를 통째로** 쓴다 — `rewriteTriggerConfigLocked`
  자신의 계약("`freshConfig` 위에서 다시 계산하라, 안 그러면 이 헬퍼가 막으려는 결함이
  재발한다")을 이 두 호출부가 스스로 어긴다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:820-838`
    (`normalizeNotificationSecretRef` — `normalizedNotification` 을 815~823행에서 만들고 836행
    `notification: normalizedNotification` 으로 그대로 쓴다), `:1359-1379`
    (`promoteRotatedNotificationSecrets` — `updatedNotification` 을 1359~1362행에서 만들고
    1376행 `notification: updatedNotification` 으로 그대로 쓴다)
  - 상세: `rewriteTriggerConfigLocked` 의 JSDoc(`trigger-config-lock.ts:119-121`)은 명시적으로
    "`merge` 는 락 안에서 읽은 커밋된 최신 `config` 를 받아 새 `config` 를 만든다 … 락 밖에서
    만든 값을 그대로 넣으면 이 함수가 막으려는 결함이 그대로 재발한다" 고 적는다. `chatChannel`
    쪽 세 호출부(`chat-channel-binder.service.ts` 의 `buildChannel`/`survivesWithFresh`,
    `rotateBotToken`)는 최소한 **presence 게이트**를 `freshConfig` 에서 재계산하도록 고쳐졌다.
    그런데 두 함수는 `merge: (freshConfig) => ({ ...freshConfig, notification: X })` 형태로
    `freshConfig` 를 **컨테이너**(다른 최상위 키 보존)로만 쓰고, `notification` 이라는 **바로 그
    서브키의 내용** 은 락 획득 **이전**에 (cron 은 `getMany()` 로 가져온 배치 스냅샷에서,
    normalize 는 함수 인자 `trigger.config` 스냅샷에서) 만든 객체를 무조건 대입한다. 이 객체는
    `{ ...notificationCfg(stale), signing: updatedSigning }` 형태로 "signing 만 바꾸고 나머지
    필드는 보존한다"는 의도를 담고 있는데, 그 "나머지 필드"의 출처가 `freshConfig.notification`
    이 아니라 **오래된 스냅샷**이다.
  - **실패 시나리오** (promote cron): 09:00 cron 이 `getMany()` 로 트리거 T 의
    `notification={url:A, events:[...], signing:{secret:legacy}}` 를 읽는다. `secrets.rotate` 는
    외부 호출이라 시간이 걸리고(비-lock 구간), 그 사이 사용자가 `PATCH /api/triggers/T` 로
    `notification.url` 을 `B` 로 바꿔 커밋한다(창 1 은 이 요청을 정상적으로 재읽고 병합해
    저장한다 — 이 부분은 옳다). 뒤이어 cron 이 `rewriteTriggerConfigLocked` 를 호출하면 락 안에서
    `freshConfig`(= `url:B`)를 읽긴 하지만, 병합 결과는 `{ ...freshConfig, notification:
    updatedNotification }` 이고 `updatedNotification` 은 09:00 스냅샷의 `url:A` 를 그대로 담고
    있다 — 그래서 최종 커밋된 `notification.url` 은 사용자가 방금 바꾼 `B` 가 아니라 **되돌아간
    `A`** 다. 오류도, 로그도 없다. `normalizeNotificationSecretRef` 는 같은 함수가 `create()`/
    `update()` 자기 자신의 저장 직후 호출되므로 창이 훨씬 좁지만(동일 요청 내), 다른 동시 요청이
    그 찰나에 `notification` 을 건드리면 같은 패턴으로 되돌린다.
  - 이것은 이 PR 이 닫으려는 것과 **정확히 같은 결함 클래스**(스냅샷 기반 서브키 통째 재작성)를,
    "`save(entity)` 를 없앤다"는 형식적 목표는 만족시키면서 그 밑에 있는 진짜 불변식은 두 자리에서
    다시 만들고 있다. 커밋 메시지("남은 일곱 자리까지 닫아 «모든 자리» 를 참인 문장으로 만든다")가
    주장하는 완결성과 어긋난다.
  - 제안: 두 함수 모두 `merge: (freshConfig) => { const freshNotif = (freshConfig as any)
    ?.notification ?? {}; const signing = (freshNotif as any)?.signing ?? {}; return {
    ...freshConfig, notification: { ...freshNotif, signing: { ...signing, secretRef: ref,
    secret: undefined } } }; }` 형태로 **`freshConfig.notification` 을 기준으로 secretRef 만
    얹도록** 바꿔야 한다 — `chat-channel-binder.service.ts` 의 `buildChannel` 이 `internalCfg`
    (해당 회전의 산출)와 `freshConfig` 를 함께 받아 필요한 필드만 재계산하는 것과 같은 패턴.
    `signing.secret`(legacy plaintext)를 지우는 로직도 `freshConfig` 기준의 `signing` 에 적용해야
    한다.

- **[WARNING]** `revokePerTriggerToken` 도 같은 모양(락 밖 스냅샷을 서브키 전체에 대입)이지만
  창이 훨씬 좁아 위험도가 낮다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1084-1110`
  - 상세: `updated = { ...interactionCfg, triggerToken: newToken }` 이 `findById` 시점의
    `trigger.config.interaction` 에서 만들어지고, `rewriteTriggerConfigLocked` 의 merge 콜백도
    `freshConfig` 를 무시하고 `updated` 를 그대로 쓴다. 다만 이 경로는 두 문장 사이에 `await` 가
    거의 없는 동기 요청이라(외부 호출이 lock 앞에 없음) 노출 창이 위 두 자리보다 훨씬 좁다 — 그래도
    같은 코드 모양이 반복되면 다음 사람이 "이 패턴은 안전하다"고 오인하고 복제할 위험이 있다.
  - 제안: 위와 같은 수정을 적용하거나, 최소한 위 CRITICAL 항목을 고칠 때 이 자리도 같은 헬퍼로
    통일해 세 곳이 같은 원칙을 공유하게 한다.

- **[WARNING]** `cleanupRotatedChatChannelTokens` 의 무조건 컬럼 null-write 가 동시
  `rotateBotToken` 이 막 커밋한 v2 회전 추적을 지울 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1406-1433`
    (candidates 루프 — `v2Ref = trigger.chatChannelTokenV2` 는 cron 시작 시점 스냅샷, 최종
    `triggerRepository.update({id}, {chatChannelTokenV2: null, chatChannelRotatedAt: null})` 는
    조건 없이 무조건 null)
  - 상세: cron 이 후보 T(v2=A, rotatedAt=T0, 24h 경과)를 골라 A 의 secret 을 revoke·delete 하는
    동안, 다른 요청이 `rotateBotToken` 을 호출해 **새** 회전(v2=B, rotatedAt=T1, 방금)을
    `rewriteTriggerConfigLocked` 로 커밋하면, cron 의 마지막 `update()` 는 그 사실을 모른 채
    `{chatChannelTokenV2: null, chatChannelRotatedAt: null}` 을 무조건 써서 **방금 커밋된 B/T1 을
    지운다.** 그 순간 두 컬럼이 `NULL` 이 되므로, 다음 cron 실행의 `WHERE chat_channel_token_v2 IS
    NOT NULL` 후보 쿼리에도 다시는 걸리지 않는다 — v2Ref=B 가 가리키는 secret_store row 는 영구
    미정리(orphan)로 남고, provider 측 old bot token(B 이전 토큰)도 `tryRevokeOldBotToken` 이 다시
    호출될 기회를 잃어 **영구히 revoke 되지 않는다.** `save(entity)` 를 쓰던 종전 코드는 이보다
    더 나빴다(엔티티 전체, 즉 `config` 까지 스냅샷으로 되썼다)는 점에서 이 diff 는 순net 개선이지만,
    이 좁은 레이스 자체는 남아 있다.
  - 제안: `triggerRepository.update({ id: trigger.id, chatChannelTokenV2: v2Ref }, { … })` 처럼
    조건부 WHERE(낙관적 확인)를 추가해, 그 사이 값이 바뀌었으면(= affected 0) null-write 를
    건너뛰도록 좁힐 수 있다. 심각도는 낮음 — 두 작업이 정확히 같은 트리거를 동시에 건드려야 하고
    (rotateBotToken 은 사용자 명시 호출, cleanup 은 시간당 1회), 데이터 손상이 아니라 "오래된
    credential 이 조용히 계속 살아있다"는 보안 위생 문제다.

- **[INFO]** 두 시간당 cron 의 후보 쿼리에 지원 인덱스가 없다 — 이 diff 가 만든 문제는 아니지만
  쓰기 비용이 늘어난 지금 더 체감된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1312-1318`
    (`promoteRotatedNotificationSecrets` — `WHERE t.notification_secret_v2 IS NOT NULL AND
    t.notification_rotated_at <= :cutoff`), `:1398-1404`
    (`cleanupRotatedChatChannelTokens` — 같은 모양, `chat_channel_token_v2`/`chat_channel_rotated_at`)
  - 상세: `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` 에는 PK 외
    `@Index` 가 하나도 없다. 두 쿼리 모두 `trigger` 테이블 전체를 스캔해 술어를 평가한다 —
    두 컬럼 다 대부분의 행에서 `NULL` 이므로 부분 인덱스(`CREATE INDEX ... WHERE
    notification_secret_v2 IS NOT NULL`)가 값싸게 걸린다. 이 diff 자체는 이 쿼리를 새로 만들지
    않았지만, 각 후보 행의 쓰기 경로를 `save()`(1왕복) 에서 `rewriteTriggerConfigLocked`
    (트랜잭션+advisory lock+SELECT+UPDATE, promote 쪽만 해당)로 늘렸으므로, 트리거 테이블이 커지면
    스캔 비용과 후보 처리 비용이 함께 누적된다.
  - 제안: 이번 배치를 막을 사유는 아니다. 트리거 총량이 늘어나면 부분 인덱스 추가를 백로그에 등재.

- **[INFO]** `promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` 는 `getMany()`
  로 후보 전체를 한 번에 메모리에 올리고 순차 루프를 돈다 — 페이지네이션 없음
  - 위치: 위와 동일 (`triggers.service.ts:1312-1318`, `:1398-1404`)
  - 상세: cron 이 오래 멈춰 있었거나 회전이 폭증하면 `candidates` 배열이 무제한으로 커질 수 있고,
    각 행의 `config` JSONB 까지 함께 로드된다. 순차 `for...of` + `await` 라 처리 시간도 후보 수에
    비례해 선형으로 늘어난다. 정상 운영 범위에서는 문제되지 않지만 대량 데이터 관점에서 상한이
    없다는 점은 기록해 둔다. 이 diff 가 새로 만든 패턴이 아니라 기존 구조를 그대로 물려받았다.
  - 제안: 조치 불요(이번 배치 범위 밖). 후속 여유가 있으면 `take`/`skip` 배치 처리 검토.

## 관점별 확인

- **인덱스**: 위 INFO 두 건(부분 인덱스 부재) 외에는 모두 PK(`id`) 기반 `findOne`/`update`/
  `remove` 라 기존 PK 인덱스로 충분.
- **N+1**: 반복문 내 개별 쿼리가 있는 곳은 두 cron 뿐이고, 이는 "후보 각각을 독립적으로 회전/정리"
  하는 것이 의미상 필요한 개별 쓰기라 고전적인 N+1(같은 정보를 반복 조회)은 아니다. 다만 위
  INFO 로 대량 데이터 측면은 별도로 짚었다.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합은 이번에도 일관되게
  적용됐고, 외부 HTTP/secret-store 호출을 락 밖에 두는 설계 원칙(Cafe24 advisory lock 기각
  선례 학습)도 새 일곱 자리 전부에서 지켜졌다. 삭제(`remove()`) 경로에 `SET LOCAL lock_timeout`
  을 추가해 "되돌릴 수 없는 정리 이후 무한 대기"를 막은 것도 적절하다. 다만 위 CRITICAL/WARNING
  항목이 보여주듯, **트랜잭션·락은 올바르게 걸렸어도 병합 콜백이 `freshConfig` 를 실제로 쓰지
  않으면 락의 효과가 무력화된다** — 이번 라운드에서 그 형태로 두 자리가 새었다.
- **마이그레이션 안전성**: 이번 diff 에 DDL 변경 없음 — 해당 없음.
- **스키마 설계**: 변경 없음. `Trigger.config` JSONB 서브키 단위 병합이라는 기존 접근을 그대로
  확장했다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션을 관리하며 콜백 종료(성공/
  실패 불문) 시 반환한다. 새로 도입된 5초 `lock_timeout` 은 `SET LOCAL` 이라 트랜잭션 종료 시
  자동 해제되고 세션에 남지 않는다. 누수 지점 없음.
- **SQL 인젝션**: `acquireTriggerConfigLock` 의 `SELECT pg_advisory_xact_lock(hashtext($1))` 는
  파라미터 바인딩. `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` 는 PG 의
  `SET` 문법이 바인드 파라미터를 지원하지 않아 문자열 보간이 불가피한데, 호출부가 모듈 상수
  (`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000`)만 넘기고 `Math.trunc` 로 정수화해 사용자 입력이
  닿을 경로가 없다 — 코드 주석도 이를 명시. 안전. e2e 의 raw 쿼리(`UPDATE trigger SET config =
  $2::jsonb WHERE id = $1` 등)도 전부 파라미터화.
- **대량 데이터**: 창 2·3·4(binder, rotateBotToken)와 새 일곱 자리 모두 단일 트리거 단위
  read-merge-write 라 그 자체는 대량 데이터와 무관하다. 두 cron 의 배치 없는 전량 스캔은 위
  INFO 로 별도 기록.

## 요약

`save(entity)` 로 `trigger.config` 를 통째로 되쓰던 나머지 일곱 자리를 컬럼 한정 `update()` 또는
advisory-lock 재읽기(`rewriteTriggerConfigLocked`)로 옮긴 이번 라운드는 방향과 실행 대부분이
견고하다 — 외부 호출을 락 밖에 두는 원칙, 삭제 경로의 락 통합 + 5초 상한, 파라미터화된 SQL,
정적 가드(`endpoint-path-conflict-wrap-guard.ts`)의 `manager.transaction()` 형태 추적까지 전부
일관되게 지켜졌다. 그러나 그 중 두 자리(`normalizeNotificationSecretRef`,
`promoteRotatedNotificationSecrets`)는 `rewriteTriggerConfigLocked` 자신의 계약("병합은
`freshConfig` 위에서 다시 계산하라")을 어기고 락 획득 **이전**의 스냅샷으로 만든 `notification`
객체를 무조건 대입한다 — `save(entity)` 라는 **형태**는 없앴지만 "동시에 커밋된 값을 스냅샷으로
되돌린다"는 **본질**은 이 두 자리에 그대로 남아 있다. 이는 이 PR 전체가 닫으려는 결함과 같은
클래스이고, "모든 자리를 닫았다"는 이번 커밋의 주장과 정면으로 부딪힌다. `cleanupRotatedChatChannelTokens`
의 무조건 null-write 도 동시 `rotateBotToken` 과 좁게 경합해 v2 secret 을 고아로 만들 수 있다
(심각도는 낮음). 두 cron 쿼리의 인덱스 부재·페이지네이션 부재는 이 diff 가 만든 문제는 아니고
이번 배치를 막을 사유도 아니다.

## 위험도

HIGH
