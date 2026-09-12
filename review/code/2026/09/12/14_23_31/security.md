# Security Review — setupChannel 실패 분류 재설계 (`impl-setup-error-code`, 2026-09-12 14:23:31)

## 발견사항

- **[INFO]** 401/403 message-fallback 판별이 여전히 provider 원문 문자열에 의존한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `translateSetupChannelError` 함수, `/\b(401|403)\b/.test(message)` 판별식 (게이트 321~325)
  - 상세: 주 판별 경로는 `isCredentialRejectedError(err)`(정확 일치)로 옮겨졌지만, 아직 `code` 를 붙이지 않은 경로(예: Slack 4xx 응답이 JSON 이 아닐 때 client 가 합성하는 `error: 'HTTP 401'`)를 위해 `err.message` 문자열에 `401`/`403` 이 있는지 정규식으로 계속 검사한다. 이 `message` 는 provider 응답에서 유래한 문자열을 포함할 수 있어 이론적으로는 provider(또는 provider 를 가장한 MITM)가 문구를 조작해 400/502 분류를 흔들 여지가 있다. 다만 (a) 이 경로는 `@Roles('editor')` 로 이미 인가된 사용자만 도달 가능하고, (b) 오분류의 결과는 최악이어도 "502 여야 할 것이 400 으로 응답" 정도이며 권한 상승·정보 노출로 이어지지 않고, (c) 응답 본문에는 이 PR 로 provider 원문이 더 이상 실리지 않는다(아래 개선점 참고). `spec/conventions/chat-channel-adapter.md` §1.1.2 가 스스로 "제거의 충분조건이 아니다"라고 2026-09-12 갱신에서 명시하며 잔여 경로를 추적 중이므로 설계상 인지된 한시적 예외다. 실질 보안 위험 없음.
  - 제안: 조치 불요 — 기존 추적 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md` "CCA §1.1.2 fallback 제거 판정")을 그대로 따르면 된다.

- **[INFO]** provider 원문(`err.message`)이 이제 응답 대신 서버 로그(`Logger.warn`)로 이동 — 로그 인젝션(CWE-117) 표면은 원리적으로 존재하나 신규 위험 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken` 의 `catch (err)` 블록, `this.logger.warn(...)` 호출 (게이트 1070~1077)
  - 상세: `err.message` 는 Discord/Slack/Telegram 이 반환한 텍스트(`app.message`/`result.error`/`res.description`)를 그대로 담을 수 있다. 개행·제어문자가 섞인 문자열이 로그 라인에 그대로 찍히면 로그 위조(다음 줄을 가짜 로그 항목처럼 보이게 함)가 이론적으로 가능하다. 다만 이 값의 출처는 신뢰 경계가 있는 3rd-party provider API(Discord/Slack/Telegram) 응답이지 익명 사용자의 직접 입력이 아니며, 동일 문자열이 이전 버전에서는 HTTP 응답 본문(`details.reason`)으로 클라이언트에까지 그대로 노출되고 있었다 — 이번 변경은 노출 범위를 클라이언트 응답에서 서버 로그로 **좁힌** 것이라 순net 개선이다. 새로 도입된 위험이 아니라 기존에도 있었을 법한 표면을 재확인하는 수준.
  - 제안: 조치 불요. 로그 sanitize 가 필요하다고 판단되면 프로젝트 공통 로거 레벨에서 처리할 문제이며 이 PR 범위 밖.

## 보안 개선점 (참고용, 발견사항 아님)

이 PR 은 순수하게 보안을 강화하는 방향의 리팩터다:

1. **정보 노출(CWE-209) 제거**: 기존 `translateSetupChannelError` 는 `details: { reason: message.slice(0, 256) }` 로 provider 원문(호스트명·에러 텍스트 등 포함 가능)을 HTTP 응답 본문에 그대로 echo 했다. 이번 변경은 그 `details` 필드를 완전히 제거하고, 응답은 고정 client-safe 문자열(`'Bot token was rejected by the provider.'` / `'Chat channel setup failed after rotation.'`)만 반환한다. 원문은 `TriggersService.rotateBotToken` 의 catch 블록에서 `this.logger.warn` 으로만 서버 로그에 남도록 이동했다. `chat-channel-input-rules.spec.ts`(신규 `'provider 원문을 응답 본문에 싣지 않는다'` 테스트, `JSON.stringify(ex.body)` 로 `'slack.com'` 미포함을 직접 단언)와 `triggers.service.spec.ts`(신규 `'그 밖의 실패 → 502 + provider 원문은 응답이 아니라 warn 로그에만'` 테스트, 응답 body 에 `'api.telegram.org'` 부재 + warn 로그에는 존재를 동시 단언)가 이 회귀를 구조적으로 막는다 — 직접 코드/테스트를 열람해 확인했다.
2. **에러 분류 계약의 명확화**: `Error.code` 프로퍼티 기반의 명시적 선언(`credentialRejectedError`/`isCredentialRejectedError`, `chat-channel/types.ts`)으로 전환해, 기존에 `message` 문자열에 의존하던 취약한 패턴 매칭(예: `'BOT_TOKEN_INVALID: ...'` 접두 문자열, 숫자 없는 문구는 원리적으로 놓침)을 대체했다. Slack 이 자격 증명 거부를 `HTTP 200 + {ok:false, error}` 로 알리는 경로는 옛 401/403 fallback 으로 원리적으로 잡히지 않던 자리였는데(코드 주석·테스트로 "2026-09-12 실측"까지 명시), 이번에 명시적으로 처리된다.
3. **truthy 판별 대신 화이트리스트 정확 일치**: `isCredentialRejectedError` 는 `err.code === CREDENTIAL_REJECTED_CODE` 정확 문자열 비교이며, Node/undici 시스템 에러(`ENOTFOUND` 등)도 `.code` 를 갖는다는 사실을 JSDoc 에서 스스로 인지하고 화이트리스트로 방어한다. `chat-channel-input-rules.spec.ts` 의 `ENOTFOUND` 회귀 테스트로 "DNS 실패가 토큰 오류로 오분류"되는 시나리오가 막혀 있음을 직접 확인했다.
4. **Slack 화이트리스트 열거**: 자격 증명 거부 값(`SLACK_CREDENTIAL_REJECTED_ERRORS`)을 allow-list 로 좁혀, 열거되지 않은 값(`ratelimited` 등)은 보수적으로 502(일반 실패)로 처리한다 — "토큰이 잘못됐다"는 오분류(사용자에게 잘못된 조치를 유도)를 피하는 fail-safe 방향.

## 점검 관점별 결과

- **인젝션**: 해당 없음. SQL/커맨드/경로 조작 입력을 다루지 않는다. `/\b(401|403)\b/` 정규식은 중첩 정량자가 없어 ReDoS 위험 없음. provider 응답 문자열은 더 이상 클라이언트 응답에 echo 되지 않는다(개선점 1). `discord-client.ts` 는 `res.status`/`method`/`path` 만 에러 메시지에 담고 헤더(Authorization)는 포함하지 않음을 직접 확인 — botToken 이 에러 메시지·로그로 새어 나가는 경로 없음.
- **하드코딩된 시크릿**: 없음. 테스트의 `'bot-token'`, `NEW_TOKEN` 등은 명백한 placeholder.
- **인증/인가**: 이 diff 는 `@Roles('editor')` 가드(사전 존재, 변경 없음) · `newBotToken` 컨트롤러 단 타입 체크(변경 없음)를 건드리지 않는다. `translateSetupChannelError` 반환 타입이 `BadRequestException | BadGatewayException` 으로 넓어졌으나 인가 로직과 무관.
- **입력 검증**: 이 PR 범위 밖(기존 코드 유지). Discord `verify_key !== expectedPublicKey` 비교는 상수시간 비교가 아니지만 두 값 모두 공개 키(secret 아님)라 타이밍 공격 실익 없음 — 결함 아님(전 라운드 확인 사항 재확인).
- **OWASP Top 10**: A01(인가) 영향 없음. A09(로깅/모니터링)는 위 INFO 참고. 그 외 해당 없음.
- **암호화**: 신규 암호화/해시 로직 없음.
- **에러 처리**: 이 PR 의 핵심 목적이자 최대 개선점 — CWE-209 관점에서 명확히 개선. `GlobalExceptionFilter` 가 `BadGatewayException` 을 `instanceof HttpException` 표준 경로로 처리해(신규 필터 테스트로 확인) `mapHttpErrorLike`(비-`HttpException` 5xx 마스킹 경로, `exception.stack` 포함 분기)로 새지 않음도 직접 확인 — stack trace 노출 없음.
- **의존성 보안**: 신규 의존성 없음.

## 요약

이번 변경은 3개 provider adapter(Discord/Slack/Telegram)의 `setupChannel` 실패 분류를 `message` 문자열 파싱에서 `Error.code` 명시적 선언(`credentialRejectedError`/`isCredentialRejectedError`, 정확 일치 화이트리스트)으로 전환하고, 그 과정에서 HTTP 응답 본문에 provider 원문(호스트명·에러 텍스트 등 민감할 수 있는 내부 정보)을 echo 하던 `details.reason` 필드를 완전히 제거해 정보 노출(CWE-209) 표면을 줄였다. 원문은 서버 로그(`Logger.warn`)로만 남도록 재배선됐고, 이를 검증하는 신규 테스트(`chat-channel-input-rules.spec.ts`, `triggers.service.spec.ts`)가 응답 본문 부재와 로그 존재를 각각 직접 단언한다. `GlobalExceptionFilter` 를 통한 신규 502(`BadGatewayException`) 경로도 stack trace 마스킹 경로로 새지 않음을 확인했다. 남아있는 401/403 message-fallback 정규식과 원문의 로그 이관은 각각 설계상 인지된 한시적 예외·낮은 잔여 표면이며, 인가된 사용자만 도달 가능하고 실질 피해가 상태 코드 오분류 수준에 그쳐 실질적 위험은 없다. 새로운 인젝션·하드코딩된 시크릿·인가 우회·암호화 결함은 발견되지 않았다.

## 위험도

NONE
