# Security Review — setupChannel 실패 분류 (`impl-setup-error-code`)

## 발견사항

- **[INFO]** `translateSetupChannelError` 의 401/403 message-fallback 판별식이 여전히 `err.message` 문자열을 정규식으로 검사한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `translateSetupChannelError` 함수, `/\b(401|403)\b/.test(message)` 줄 (게이트 325)
  - 상세: 새 `code` 기반 판별(`isCredentialRejectedError`)이 주 경로가 되었지만, `code` 를 아직 안 붙인 경로를 위한 "한시적 fallback"으로 `err.message` 안에 `401`/`403` 문자열이 있는지 정규식으로 계속 검사한다. 이 `message` 는 provider(Slack/Discord/Telegram) 응답 본문에서 유래한 문자열을 포함할 수 있어, 이론적으로는 provider 응답을 조작할 수 있는 위치(예: 공격자가 제어하는 봇 계정)에서 400/502 분류를 흔들 수 있다. 다만 (a) 이 엔드포인트는 `@Roles('editor')` 로 이미 인가된 사용자만 호출 가능하고, (b) 응답 본문에는 이 PR 로 인해 provider 원문이 더 이상 실리지 않으므로(→ 아래 참고) 실질 피해는 상태 코드 오분류(400 vs 502) 정도에 그친다. 정보 노출 관점의 실질적 위험은 없음.
  - 제안: plan 문서(`impl-setup-error-code.md`)가 이미 이 fallback 을 "한시적 예외"로 명시하고 제거 조건을 §1.1.2 에 남겨두었으므로 현재 설계 의도대로 유지해도 무방함. 후속 PR 에서 3-provider 전부 `code` 부착이 끝나면 이 fallback 을 제거하는 것을 권장(이미 `spec-draft-nullable-notation-followups.md` 트래커에 등재됨 — consistency 리뷰 WARNING #4 참고).

- **[INFO]** `credentialRejectedError`/`isCredentialRejectedError` 의 `code` 프로퍼티가 Node/undici 시스템 에러(`ENOTFOUND` 등)와 이름이 겹친다는 점을 코드 스스로 인지하고 화이트리스트 정확 일치로 방어
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `isCredentialRejectedError` 함수 (게이트 525-532)
  - 상세: `err.code === CREDENTIAL_REJECTED_CODE` 정확 문자열 비교이므로 DNS 실패 등 무관한 시스템 에러가 `BOT_TOKEN_INVALID` 로 오분류될 위험은 구조적으로 차단되어 있다. `chat-channel-input-rules.spec.ts` 에도 이 오분류를 막는 회귀 테스트(`ENOTFOUND` 케이스)가 신설되어 있음을 확인. 결함 아님 — 설계가 올바르게 방어하고 있음을 기록해 둔다.

## 보안 개선점 (참고용, 발견사항 아님)

이 PR 은 순수하게 보안을 강화하는 방향의 리팩터다:

1. **정보 노출(CWE-209) 축소**: 기존 `translateSetupChannelError` 는 `details: { reason: message.slice(0, 256) }` 형태로 provider 원문(에러 메시지, 경우에 따라 URL·호스트명 포함 가능)을 HTTP 응답 본문에 그대로 echo 했다. 이번 변경으로 그 `details` 필드가 완전히 제거되고, 응답은 고정 client-safe 문자열(`'Bot token was rejected by the provider.'` / `'Chat channel setup failed after rotation.'`)만 반환한다. 원문은 `TriggersService.rotateBotToken` 의 catch 블록에서 `this.logger.warn` 으로만 서버 로그에 남도록 이동했다(`triggers.service.ts` 게이트 1070-1077). 신규 테스트(`triggers.service.spec.ts` 게이트 2021-2047, `chat-channel-input-rules.spec.ts` 게이트 317-327)가 응답 본문에 provider 원문(호스트명 등)이 포함되지 않음을 `JSON.stringify(ex.body)` 로 직접 단언하여 회귀를 방지한다.
2. **에러 분류 계약의 명확화**: `Error.code` 프로퍼티 기반의 명시적 선언(`credentialRejectedError`)으로 전환하여, 기존에 `message` 문자열에 의존하던 취약한 패턴 매칭(예: `'BOT_TOKEN_INVALID: ...'` 접두 문자열)을 대체했다. Slack 이 자격 증명 거부를 `HTTP 200 + {ok:false, error}` 로 알리는 경로가 기존 401/403 fallback 으로는 원리적으로 잡히지 않던 자리였는데, 이를 명시적으로 처리해 오분류(502 로 잘못 떨어지는 것)를 줄였다.
3. **화이트리스트 방식의 열거**: Slack 자격 증명 거부 값(`SLACK_CREDENTIAL_REJECTED_ERRORS`)을 열거형(allow-list)으로 좁혀, 열거되지 않은 값은 보수적으로 502(일반 실패)로 처리한다. "토큰이 잘못됐다"는 오분류를 피하는 fail-safe 방향이며, blast radius 가 제한적이다.

## 점검 결과 요약

- **인젝션**: 해당 없음. 이 diff 는 SQL/커맨드/경로 조작 입력을 다루지 않는다. provider 응답 문자열(Slack `error`, Discord `code`/`message`, Telegram `error_code`/`description`)은 그대로 `Error.message` 에 담기지만 클라이언트 응답에는 더 이상 echo 되지 않는다(위 개선점 1).
- **하드코딩된 시크릿**: 없음. 테스트 파일의 `'bot-token'` 등은 명백한 placeholder.
- **인증/인가**: 이 diff 자체는 `@Roles('editor')` 가드(사전 존재, 변경 없음)를 건드리지 않음. `translateSetupChannelError` 반환 타입이 `BadRequestException | BadGatewayException` 으로 넓어졌으나 인가 로직과 무관.
- **입력 검증**: `newBotToken` 검증(컨트롤러 단 `typeof` 체크)은 diff 밖(기존 코드). `assertInboundSigningPlaintextByProvider` 등 기존 정규식 검증 로직은 이 diff 로 변경되지 않음.
- **암호화**: `verify_key !== expectedPublicKey` 비교(Discord public key 대조, `discord.adapter.ts`)는 상수시간 비교가 아니나 두 값 모두 공개 키(public key)이고 비밀이 아니므로 타이밍 공격 실익이 없음 — 결함 아님.
- **에러 처리**: 이 PR 의 핵심 목적이자 최대 개선점(위 참고 1). CWE-209 관점에서 명확히 개선됨.
- **의존성 보안**: 신규 의존성 없음.

## 요약

이번 변경은 `setupChannel` 실패 분류를 `message` 문자열 파싱에서 `Error.code` 명시적 선언으로 전환하고, 그 과정에서 HTTP 응답 본문에 provider 원문(민감할 수 있는 내부 에러 텍스트·호스트명 등)을 echo 하던 기존 `details.reason` 필드를 완전히 제거해 정보 노출(CWE-209) 표면을 줄였다. 원문은 서버 로그로만 남도록 재배선되었고 이를 검증하는 테스트도 신설되었다. 남아있는 401/403 message-fallback 정규식은 설계상 의도된 한시적 예외이며 실질적 보안 위험은 낮다(권한 있는 사용자만 도달 가능 + 응답에 원문이 실리지 않음). 새로운 인젝션·하드코딩된 시크릿·인가 우회는 발견되지 않았다.

## 위험도
NONE
