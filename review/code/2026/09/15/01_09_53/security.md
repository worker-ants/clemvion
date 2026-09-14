# Security Review — trigger-config-lost-update

## 검토 범위

이번 라운드(01_09_53)는 앞선 여러 라운드(18_17_44 → 19_07_43 → … → 00_38_16)에서 지적된
CRITICAL/WARNING 이 순차로 해소된 뒤의 상태다. 실제 프로덕션 코드 변경은 다음 파일에
집중된다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) — advisory lock +
  락 안 재읽기 프리미티브
- `codebase/backend/src/modules/triggers/triggers.service.ts` — 창 1(`update()`)을 포함한
  네 자리 + 그 외 일곱 자리를 락/컬럼-한정 갱신으로 전환
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel`
  성공/실패 경로를 락 안 재읽기로 전환, presence 게이트 재계산
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `extractInboundSigningRef`
  추출(순수 리팩터)
- `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()`(트리거 컬럼
  한정 갱신) · `remove()`(cascade 삭제도 같은 config 락 사용)
- `codebase/backend/src/modules/hooks/hooks.service.ts` — `touchLastTriggeredAt` 공유 헬퍼로
  두 웹훅 인입 경로의 `lastTriggeredAt` 갱신을 컬럼 한정으로 전환
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e)
- `codebase/backend/src/repo-guards/__tests__/*` — 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)
  갱신, 보안 로직 아님

핵심 결함(수정 대상)은 **인증 우회급**이다: 동시 PATCH 가 `trigger.config` 를 요청 시작
시점 스냅샷으로 통째로 되쓰면서, 다른 요청이 막 확립한 `chatChannel.inboundSigningRef`
를 지워 `ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;` 가
걸려 **인입 웹훅 서명 검증이 fail-open** 이 되는 lost-update/TOCTOU 였다. 이번 diff 는 그
경로 전체(4개 창 + 추가로 실측된 7곳)를 advisory lock(`pg_advisory_xact_lock(hashtext(...))`)
+ 락 안 재읽기 + 하위 키 한정 병합으로 닫는다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 락 안 재읽기가 `workspaceId` 로 스코프되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:162` (`rewriteTriggerConfigLocked` 내부 `m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 이 헬퍼는 `id` 단일 조건으로 최신 행을 재조회한다. 호출부(`chat-channel-binder.service.ts` 의 `setupChatChannel`, `triggers.service.ts` 의 `rotateBotToken`/`revokePerTriggerToken`/`normalizeNotificationSecretRef` 등)는 전부 이 함수를 부르기 **전에** 이미 워크스페이스-스코프 조회(`findById(id, workspaceId)` 등)로 소유권을 확정해 놓은 뒤라, 현재 배선에서 다른 워크스페이스 행을 노출하는 새로운 인가 우회는 아니다. 다만 함수 시그니처 자체가 그 전제를 강제하지 않으므로, 다음에 이 헬퍼를 워크스페이스 사전검증 없는 자리(cron 등 제외)에 재사용하면 스코프 누락을 놓치기 쉽다. (같은 관측이 이전 라운드 `review/code/2026/09/14/19_07_43/api_contract.md` INFO 로 이미 등재되어 있고, 이번 diff 로 배선이 늘었어도(triggers.service.ts 의 창 1은 별도로 `workspaceId` 를 재읽기 조건에 포함시켜 이 문제가 없음) 헬퍼 자체의 계약은 그대로다.)
  - 제안: `trigger-config-lock.ts` JSDoc에 "호출부가 triggerId 소유권을 사전에 검증했다고 가정한다(워크스페이스 필터 없음)"는 전제를 명시하면 재사용 시 실수를 줄일 수 있다. 차단 사유는 아니다.

- **[INFO]** `SET LOCAL lock_timeout` 이 파라미터 바인딩 없이 문자열 보간으로 구성된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:56-58` (`acquireTriggerConfigLock` 내부 ``await manager.query(`SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`)``)
  - 상세: Postgres 는 `SET`/`SET LOCAL` 문에 파라미터 바인딩(`$1`)을 지원하지 않아 구조적으로 문자열 결합이 불가피한 자리다. 코드는 `Math.trunc()` 로 값을 정수로 강제해 문자열 삽입을 막고 있고, 실제 호출부는 전부 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 만 넘긴다(`triggers.service.ts:1027`, `schedules.service.ts:311` 확인, 사용자 입력이 `timeoutMs` 에 닿는 경로 없음). 현재는 인젝션 가능 경로가 아니다.
  - 제안: 조치 불요. 다만 향후 이 옵션에 사용자/설정값을 연결하는 변경을 할 경우 `Math.trunc` 가드가 반드시 유지되어야 함을 인지할 것 — 이미 함수 JSDoc 에 "사용자 입력이 여기 닿는 경로는 없다"고 명시돼 있어 회귀 인지는 되어 있다.

## 관점별 확인

- **인젝션**: 신규/변경된 raw SQL(`pg_advisory_xact_lock(hashtext($1))`)은 모두 파라미터 바인딩. e2e 테스트의 raw pg 쿼리(`UPDATE trigger SET config = $2::jsonb WHERE id = $1` 등)도 전부 바인딩됨. 위 INFO 항목(`lock_timeout`) 제외 문자열 결합 없음.
- **하드코딩된 시크릿**: `git diff` 전수 grep 결과 실제 시크릿 없음. `triggers.service.spec.ts` 의 `'plain-legacy'`/`'old-plain'`, e2e 의 `'111:e2eTelegramBotToken'` 은 전부 테스트 픽스처용 값.
- **인증/인가**: 컨트롤러·가드·미들웨어 변경 없음. `chatChannel.botTokenRef`/`inboundSigningRef`/`inboundSigning` 은 `assertChatChannelInputSafe`/`rejectBlockedField` 가 여전히 외부 입력을 차단(`chat-channel-input-rules.ts:161-163`) — 신규 `extractInboundSigningRef` 는 이 값을 DB 에서 읽기만 하는 순수 접근자라 사용자 입력이 닿지 않는다. 이 PR 의 본질은 오히려 인가 성격 결함(서명 검증 우회)의 수정.
- **입력 검증**: DTO/validation pipe 변경 없음. 위 항목 참조.
- **암호화/평문 전송**: 신규 코드에 해시/암호화 알고리즘 도입 없음. secret store 경유 방식 그대로 유지.
- **에러 처리**: `translateSetupChannelError` 는 이번 diff 로 변경되지 않았고 여전히 provider 원문을 클라이언트에 노출하지 않는다(고정 client-safe 메시지). `chatChannelLastError: message.slice(0, 1024)` (원문 저장)은 이번 PR 이전부터 있던 동작으로 신규 회귀 아님.
- **의존성**: `package.json`/lockfile 변경 없음, 새 외부 패키지 없음.

## 요약

이번 변경은 동시 PATCH 로 인해 `chatChannel.inboundSigningRef` 가 유실되어 인입 웹훅 서명
검증이 fail-open 되던 실제 보안 결함을 advisory lock(`pg_advisory_xact_lock`) + 락 안
재읽기 + 하위 키 한정 병합으로 닫는다. 이미 여러 라운드의 리뷰를 거치며 발견된 CRITICAL(창
1 미포함, whole-config 스냅샷 재발, 헬퍼 사용 중 델타 대신 스냅샷을 다시 넣은 회귀 등)이
전부 후속 커밋으로 해소된 상태이며, 이번 라운드에서 새로 검토한 `hooks.service.ts`(공유
`touchLastTriggeredAt`)·`schedules.service.ts`(cascade 삭제도 같은 락 사용)도 같은 원칙을
일관되게 적용하고 있다. 모든 신규/변경 raw SQL 은 파라미터 바인딩을 사용하고, 시크릿 관련
필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)는 여전히 외부 입력에서 차단된다.
하드코딩된 시크릿, 새 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 신규
취약 의존성 등은 발견되지 않았다. 남은 두 항목(락 헬퍼의 workspace 미스코프, `lock_timeout`
문자열 보간)은 모두 현재 배선에서는 악용 불가능하고 이미 문서화·인지된 설계상 제약으로,
차단 사유가 아니다.

## 위험도

LOW
