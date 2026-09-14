# 보안(Security) Review

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 `config` 를 스냅샷으로 되돌려
`chatChannel.inboundSigningRef` 를 지우고, 그 결과 `ChatChannelInboundAuthenticator` 의
`if (!config.inboundSigningRef) return;` 로 **인입 웹훅 서명 검증이 fail-open** 되던 경로를
닫는 수정. 핵심 프로덕션 파일을 직접 열어 diff·전체 컨텍스트를 대조했다:
`trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`hooks.service.ts` · `schedules.service.ts` · 관련 `*.spec.ts`/e2e·정적 가드 파일. `plan/in-progress/trigger-config-lost-update.md` 의 후속(§후속) 표도 대조해, 이미 추적 중인
잔여 항목과 새 발견을 구분했다.

## 발견사항

- **[WARNING]** `rotateNotificationSecret()` 이 쓴 새 시크릿을 `update()`(창 1)의 전체 엔티티
  저장이 되돌릴 수 있다 — 이 PR 이 닫은 것과 **같은 클래스**의 잔여 lost-update
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 트랜잭션의
    `m.save(Trigger, target)` (함수 `update`, advisory-lock 트랜잭션 콜백 마지막 줄) vs
    `rotateNotificationSecret()` (같은 파일, `this.triggerRepository.update({id: trigger.id}, {notificationSecretV2, notificationRotatedAt})` 호출부)
  - 상세: `rotateNotificationSecret()` 은 `trigger-config` advisory lock 을 잡지 않고 컬럼
    한정 `update()` 만 수행한다. `update()`(창 1)는 advisory lock 을 잡은 뒤 `m.findOne`으로
    "fresh" 행을 읽어 `target` 을 만들고, PATCH DTO 필드(`defined`)와 `config` 만 갱신한 뒤
    `m.save(Trigger, target)` 로 엔티티 전체를 저장한다. `notificationSecretV2`/
    `notificationRotatedAt` 은 `defined` 에 없으므로 `target` 은 **자신이 읽은 시점의 값**을
    그대로 갖고 있다. 만약 `rotateNotificationSecret()` 의 컬럼 update 가 창 1 의 `findOne`
    **이후, save 이전** 시점에 커밋되면, 창 1 의 `save` 가 그 값을 다시 옛 값으로 덮어써
    **방금 회전시킨 시크릿이 조용히 원복**된다. 이 시크릿은 아웃바운드 알림 웹훅 서명에
    쓰이므로, 회전(예: 유출 의심 시 인시던트 대응)이 경합으로 무효화될 수 있다는 뜻이다 —
    이 PR 이 `inboundSigningRef` 에 대해 닫은 것과 정확히 같은 형태의 취약점이 인접 시크릿
    컬럼에 남아 있다.
  - 참고: `plan/in-progress/trigger-config-lost-update.md` §후속 표가 이 항목을 "`rotateNotificationSecret` 이 락 도메인 밖 … 관측용(`lastTriggeredAt`)과 달리 **보안 성격** (8라운드 W4)" 으로 이미 자체 등재해 뒀다 — 새로 발견한 결함이 아니라 **현재 코드베이스에 살아 있는, 저자 스스로 "보안 성격"이라 명명한 잔여 gap**이라는 뜻이다. 이번 PR 은 이 자리를 닫지 않고 후속으로 미뤘다.
  - 제안: 후속 PR 에서 `rotateNotificationSecret()` 도 같은 advisory lock 을 잡거나(간단하지만 이 경로가 잦아지면 컨텐션 증가), 창 1 의 `m.save`가 `notificationSecretV2`/`notificationRotatedAt` 를 `target`에 재대입하기 전에 그 두 컬럼만 다시 읽어 보존하도록(`mergeIntoFreshSubKey` 와 같은 패턴을 컬럼에도 적용) 좁히는 편이 낫다. 최소한 plan 의 후속 우선순위에서 "보안 성격"으로 표시된 이 항목이 다음 스프린트로 밀리지 않도록 가시성을 높일 것을 권고.

- **[INFO]** `cleanupRotatedChatChannelTokens` cron 의 무조건 null-write 가 동시 `rotateBotToken` 의 새 v2 토큰을 지울 수 있다 (같은 클래스, 낮은 발생 가능성)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `cleanupRotatedChatChannelTokens()` 의 `this.triggerRepository.update({id: trigger.id}, { chatChannelTokenV2: null, chatChannelRotatedAt: null })` 호출부 (diff 안 "컬럼 갱신 — **컬럼만 쓴다**" 주석 지점)
  - 상세: 이 정리 cron 은 advisory lock 밖에서 조건 없이 `chatChannelTokenV2` 를 null 로 쓴다. `rotateBotToken()`(같은 파일, `rewriteTriggerConfigLocked` 사용 지점)이 grace-period 만료 시점과 겹쳐 새 v2 토큰을 커밋한 직후 이 cron 이 그것을 null 로 지우면, 방금 회전된 봇 토큰 참조가 사라진다. 발생 창이 cron 배치 주기와 grace 만료 시점이 겹치는 좁은 구간이라 실제 발생 가능성은 낮다.
  - 참고: `plan/in-progress/trigger-config-lost-update.md` §후속 표 "8라운드 W2" 로 이미 추적됨(조건부 `WHERE chatChannelTokenV2 = <읽은 값>` 낙관적 확인 제안).
  - 제안: 별도 조치 불요(추적됨). 후속 착수 시 낙관적 조건부 UPDATE로 좁힐 것.

- **[INFO]** `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` — 파라미터 바인딩이 불가능한 자리에 값을 문자열 보간
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock()` 내 `manager.query(\`SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'\`)`
  - 상세: `SET LOCAL` 구문은 PostgreSQL 프로토콜상 값 파라미터 바인딩(`$1`)이 안 되는 자리라 문자열 보간이 불가피하다. 현재는 `Math.trunc()` 로 정수화하고, 실제 호출부가 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(모듈 상수 `5_000`) 단 하나뿐임을 코드 전수 검색(`acquireTriggerConfigLock(` 2회 호출, `timeoutMs` 전달은 `remove()` 한 곳)으로 확인했다 — 사용자 입력이 이 값에 닿는 경로는 없어 **현재는 SQL 인젝션 위험이 없다**. 다만 이 함수 시그니처(`options: { timeoutMs?: number }`)는 임의의 숫자를 받게 열려 있어, 향후 요청 바디·쿼리 파라미터에서 유도한 값을 이 자리에 넘기는 변경이 생기면 인젝션 벡터가 된다(`Math.trunc(NaN)` 등 비정상 값도 SQL 구문 오류를 낼 수 있다).
  - 제안: 조치 불요(현재 안전). 방어적으로 `Number.isInteger(timeoutMs) && timeoutMs > 0` 런타임 가드를 추가하거나, JSDoc 에 "이 파라미터는 모듈 상수만 받아야 한다 — 절대 요청 유도 값을 넘기지 말 것" 을 명시해 다음 변경자가 실수로 문을 열지 않게 하는 것을 권고.

## 관점별 확인

- **인젝션**: advisory lock(`pg_advisory_xact_lock(hashtext($1))`) 및 e2e 의 모든 raw 쿼리는 파라미터 바인딩. 유일한 문자열 보간 자리(`SET LOCAL lock_timeout`)는 위 INFO 항목대로 현재 사용자 입력과 무관해 안전.
- **하드코딩된 시크릿**: 없음. 테스트 파일의 `'111:e2eTelegramBotToken'`, `secret://triggers/t-1/inbound-signing`, `wsk_...` 형태는 전부 합성 placeholder/포맷 문자열이며 실제 자격증명이 아니다.
- **인증/인가**: 이 수정의 본질이 인가 성격 보증(인입 웹훅 서명 검증)의 fail-open 재발을 막는 것이다. `findByIdForUpdate`/트랜잭션 내 재조회 모두 `workspaceId` 필터를 유지해 테넌트 격리가 보존된다. `rewriteTriggerConfigLocked` 는 자체적으로 workspace 소유권을 검증하지 않지만, 세 호출부(`chat-channel-binder.service.ts` 성공/실패 경로, `rotateBotToken`) 모두 이미 workspace 검증을 마친 `trigger.id` 만 넘기므로 악용 경로는 없다(이미 plan INFO#1 로 추적).
- **입력 검증**: `extractInboundSigningRef` 는 `unknown` 입력에 옵셔널 체이닝만 사용해 예외 없이 안전하게 실패한다. `chatChannel`/`config` 관련 기존 검증(`assertChatChannelInputSafe`, `stripChatChannelPlaintext`, `assertPatchCarriesNoSecrets`)은 이 PR 에서 변경되지 않았다.
- **암호화**: 새 알고리즘/해시 도입 없음. `randomBytes(32)` 기반 시크릿 생성은 기존 코드 그대로.
- **에러 처리**: `rethrowEndpointPathConflict` 는 충돌이 아닌 에러(예: 삭제-경합으로 인한 `NotFoundException`)를 그대로 재던져 정보를 감추거나 왜곡하지 않는다. 삭제 실패 시 `logger.error` 는 `err.message` 만 남기고 시크릿·스택은 노출하지 않는다.
- **의존성**: `package.json`/lockfile 변경 없음. 신규 import 는 기존 `typeorm` 서브패스(`workflows.service.ts` 선례 재사용)와 신규 내부 모듈뿐.
- **OWASP Top 10 관점**: 이 PR 은 A04(안전하지 않은 설계, race condition으로 인한 인증 우회)에 해당하는 실제 취약점을 advisory lock + lock-안-재읽기로 구조적으로 닫는다. 외부 HTTP 호출을 락 밖에 두어 커넥션 보유 시간을 최소화한 설계, `remove()` 경로의 5초 타임아웃을 통한 "반쯤 삭제된 상태" 방지도 확인했다.

## 요약

이 변경은 동시 PATCH 요청이 `trigger.config` 를 스냅샷으로 통째 덮어써 `chatChannel.inboundSigningRef` 를 잃고, 그 결과 인입 웹훅 서명 검증이 **fail-open** 으로 되돌아가던 실질적인 보안 취약점(레이스 컨디션 기반 인증 우회)을 advisory lock(`pg_advisory_xact_lock`) + "락 안에서 재읽어 병합" 패턴으로 구조적으로 닫는다. 외부 HTTP 호출을 임계 구간 밖에 두는 설계, presence 게이트를 락 안에서 재계산하는 정정, 삭제 경합(고아 INSERT·반쯤 삭제 상태) 방지까지 촘촘하게 다뤄졌고, 관련 SQL 은 전부 파라미터 바인딩돼 있으며 하드코딩된 시크릿도 없다. 다만 저자 스스로 plan 에 "보안 성격"이라 명명해 둔 잔여 gap 하나 — `rotateNotificationSecret()` 이 같은 advisory lock 도메인 밖에 있어 `update()`(창 1)의 전체 엔티티 저장이 방금 회전된 알림 서명 시크릿을 조용히 되돌릴 수 있는 경로 — 가 이번 PR 범위에서 닫히지 않고 후속으로 남아 있다. 이 PR 자체가 새로 도입한 취약점은 없으며, 남은 항목은 이미 문서화·추적된 상태다.

## 위험도

LOW
