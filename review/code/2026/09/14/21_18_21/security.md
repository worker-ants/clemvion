# 보안(Security) Review

## 검토 범위

이번 변경의 핵심은 `trigger.config` lost-update 수정이다: 동시 PATCH/삭제/bot-token 회전이
서로의 `trigger.config` 쓰기를 스냅샷으로 덮어써 `chatChannel.inboundSigningRef`(인입 웹훅
서명 검증에 쓰이는 secret ref)를 되돌리던 fail-open 경로를 `pg_advisory_xact_lock` 기반의
락-안-재읽기(`trigger-config-lock.ts`)로 닫는다. 실제 보안 성격의 변경 파일은:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규 유틸)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`extractInboundSigningRef` 추출)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` — 인입 hot path 의 같은 결함)
- 그리고 이들에 대응하는 테스트/e2e/가드 스펙

나머지(CHANGELOG, plan, `review/**` 산출물, `endpoint-path-conflict-wrap-guard.ts` 등 정적
가드)는 문서·테스트-인프라 성격이라 보안 표면에 직접 영향이 없다.

## 발견사항

- **[INFO]** advisory lock timeout 을 raw SQL 문자열 보간으로 조립 — 현재는 안전하지만 방어적이지 않은 패턴
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `acquireTriggerConfigLock` 함수 (``SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`` 줄)
  - 상세: `options.timeoutMs` 를 파라미터 바인딩 없이 SQL 문자열에 직접 삽입한다. `Math.trunc()` 가 `ToNumber()` 강제 변환을 거치므로 문자열 페이로드(`"0; DROP TABLE trigger;--"` 등)를 넣어도 `NaN` 이 되어 즉시 실패할 뿐 injection 으로 이어지지는 않는다 — 실제로 호출부를 전수 확인한 결과(`triggers.service.ts` 의 `remove()` 한 곳) 인자는 하드코딩 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 뿐이라 사용자 입력이 이 값에 도달하는 경로는 없다. 다만 `SET LOCAL` 은 파라미터 바인딩(`$1`)을 지원하지 않는 DDL/설정 문이라 이런 보간이 구조적으로 필요했던 것이고, 향후 이 함수가 사용자 입력에서 파생된 timeout(예: 워크스페이스별 설정값)을 받도록 확장되면 같은 자리가 실제 인젝션 표면이 된다.
  - 제안: 지금 당장 조치는 불필요하나, 이 함수의 JSDoc/타입에 "정수 리터럴 상수만 전달할 것 — 사용자 입력을 직접 전달 금지"를 명시하거나, 호출 전 `Number.isInteger(timeoutMs) && timeoutMs > 0` 가드를 함수 안에 추가해 향후 오용을 컴파일이 아닌 런타임에서라도 막아두면 좋다.

- **[INFO]** `chatChannelLastError` 컬럼에 provider 원문 에러 메시지를 그대로 저장 (기존 동작, 이 PR 범위 밖)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel` catch 블록의 `chatChannelLastError: message.slice(0, 1024)`
  - 상세: `err.message` (adapter/provider 원문)를 1024자로 잘라 DB 에 저장한다. 이 PR 은 저장 방식(`save` → `rewriteTriggerConfigLocked`)만 바꿨고 이 필드 자체의 존재나 값 소스는 변경하지 않았다. `translateSetupChannelError`/§7.5.2 가 **응답 본문**에는 원문을 싣지 않도록 이미 방어하고 있어 API 소비자에게 직접 노출되지는 않지만, `chatChannelLastError` 를 조회 응답(`GET /api/triggers/:id`)이 그대로 반환한다면(본 diff 범위 밖이라 미확인) provider 에러 메시지에 담긴 세부 정보(예: 내부 엔드포인트 경로, rate-limit 정책 문구)가 인가된 사용자에게 노출될 수 있다. 새로 만든 결함이 아니므로 이번 PR 을 막을 사유는 아니다.
  - 제안: 조치 불요(이번 PR 범위 밖). 응답 DTO 가 `chatChannelLastError` 를 그대로 노출하는지 별도로 확인해 볼 가치는 있음.

- **[INFO]** `rewriteTriggerConfigLocked` 의 삭제-경합 창(`findOne` 과 `update` 사이)이 완전히 닫히지 않음 — 보안적 악용 가능성 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `rewriteTriggerConfigLocked` 함수 (`m.findOne` 이후 `m.update` 호출부)
  - 상세: `TriggersService.remove()` 는 같은 advisory lock 을 잡지만, `rewriteTriggerConfigLocked` 의 `findOne` 이 행을 본 **직후** 삭제가 끼어들면 뒤이은 `update` 는 영향 행 0건으로 조용히 성공(`true`) 반환한다. 데이터 손상이나 인가 우회로 이어지지 않는 순수 동시성/관측성 이슈이고 이미 `review/code/2026/09/14/18_17_44/database.md` 가 같은 항목을 INFO 로 등재·수용했다. 신규 지적 아님, 보안 관점에서도 위험 없음(고아 UPDATE 자체가 secret 유출·권한 상승과 무관).
  - 제안: 조치 불요.

## 긍정적으로 확인한 점 (참고)

- 이번 수정이 닫는 결함 자체가 인입 웹훅 **서명 검증 fail-open**(`ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;`)이었고, `chat-channel-binder.service.ts`/`triggers.service.ts`/`hooks.service.ts` 세 계열 모두 "락 안에서 재읽은 행의 ref presence" 를 게이트 항으로 추가해 이 fail-open 재발 경로를 실제로 닫았다. `hooks.service.ts` 의 `touchLastTriggeredAt` 도 인입 hot path 에서 `save(trigger)`(전체 스냅샷 저장, config 재작성 위험) 대신 `update({id}, {lastTriggeredAt})` 로 컬럼 한정 갱신을 하도록 고쳐, PATCH 경합보다 훨씬 잦은 "인입 메시지마다" 발생하던 더 위험한 경로를 닫았다.
- `translateSetupChannelError`/`assertInboundSigningPlaintextByProvider` 는 provider 원문 에러를 API 응답에 싣지 않고, credential-rejected 여부만 고정 문자열로 반환한다 — 정보 노출 최소화.
- 신규 e2e (`trigger-config-lost-update.e2e-spec.ts`) 를 포함해 모든 raw SQL 쿼리가 파라미터 바인딩(`$1`, `$2`)을 사용하며 문자열 concat 이 없다.
- `stripChatChannelPlaintext`/`assertPatchCarriesNoSecrets`/`rejectBlockedField` 는 `botTokenRef`·`inboundSigningRef`·`inboundSigning` 등 내부 필드를 외부 입력에서 계속 차단하고, PATCH 에서 `botToken`/`inboundSigningPlaintext` 를 금지하는 R-CC-21/D-1 규칙도 이 PR 로 훼손되지 않았다.
- `package.json`/lockfile 변경 없음 — 신규 의존성 도입 없음, 알려진 취약점 표면 변화 없음.
- `git diff origin/main...HEAD` 전수에서 하드코딩된 API 키·비밀번호·토큰·인증서 패턴은 발견되지 않았다(테스트 코드는 harness 가 발급하는 `accessToken` 만 사용).

## 요약

이번 변경은 `trigger.config` 의 lost-update 로 인해 발생하던 인입 웹훅 서명 검증 fail-open(진짜 보안 결함)을 advisory lock + 락-안-재읽기로 닫는 수정이며, 새로 도입된 코드(`trigger-config-lock.ts`, binder/triggers/hooks 서비스의 배선)는 SQL 인젝션·시크릿 하드코딩·인증/인가 우회·안전하지 않은 암호화·에러 메시지를 통한 정보 노출 어느 축에서도 신규 결함을 만들지 않는다. 유일하게 짚을 만한 점은 락 timeout 을 SQL 문자열에 보간하는 방어적이지 못한 패턴인데, 호출부가 하드코딩 상수 하나뿐이라 현재는 착취 불가능하다(INFO). 나머지 두 항목(삭제 경합의 좁은 창, provider 에러 메시지 DB 저장)도 기존에 이미 문서화·수용된 저위험 항목이거나 이번 PR 범위 밖이다. 이번 배치를 막을 CRITICAL/WARNING 급 보안 이슈는 없다.

## 위험도

NONE
