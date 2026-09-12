# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 자격 증명 거부(401/403) 판별 로직이 provider 마다 서로 다른 형태로 흩어져 있다
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:75`
    (`throw app.status === 401 || app.status === 403 ? credentialRejectedError(message) : new Error(message);`)
    vs `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts:48,62-63`
    (`const TELEGRAM_CREDENTIAL_REJECTED_STATUSES: readonly number[] = [401, 403];` + `.includes(res.error_code)`)
  - 상세: 두 파일 모두 "HTTP 401/403 = 자격 증명 거부"라는 **동일한 도메인 규칙**을 구현하지만, telegram 쪽은 이름 있는 모듈 상수 배열로 뽑아 재사용 가능하게 만든 반면 discord 쪽은 리터럴 `401`/`403`을 인라인 삼항식에 그대로 하드코딩했다. 지금은 각자 호출부가 1곳(discord)·2곳(telegram, `telegramApiError` 공용 함수 경유)이라 당장 버그로 이어지진 않지만, 이후 자격 증명 거부 판정 상태코드 집합이 바뀌거나(예: 407 추가) 세 번째 provider가 같은 패턴을 복사해 붙일 때 "어느 스타일을 따라야 하는가"가 불분명해지고, 두 곳 중 하나만 고치는 실수가 나기 쉽다. `chat-channel/types.ts`가 이미 `CREDENTIAL_REJECTED_CODE`라는 공용 상수를 provider 3종에 노출하고 있으므로, 같은 파일에 `CREDENTIAL_REJECTED_HTTP_STATUSES = [401, 403] as const` 류의 공용 상수를 하나 더 두고 두 어댑터가 이를 공유하면 표현이 통일된다.
  - 제안: discord.adapter.ts의 인라인 리터럴 비교를 telegram.adapter.ts 스타일(이름 있는 상수 + `.includes()`)로 맞추거나, 두 provider가 함께 쓰는 공용 상수를 `chat-channel/types.ts`에 신설해 참조.

- **[INFO]** `CHAT_CHANNEL_SETUP_FAILED` 코드 문자열이 `CREDENTIAL_REJECTED_CODE`와 달리 명명 상수로 승격되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:333` (`code: 'CHAT_CHANNEL_SETUP_FAILED',`)
  - 상세: 같은 §5.4 응답 계약의 두 코드 중 `BOT_TOKEN_INVALID`는 `chat-channel/types.ts`의 `CREDENTIAL_REJECTED_CODE` export 상수를 거치는 반면(오타 방지가 명시적 동기), `CHAT_CHANNEL_SETUP_FAILED`는 리터럴 문자열로 직접 쓰였다. 이 리터럴은 프로덕션 코드 1곳 + 테스트 3곳(`triggers.service.spec.ts:2041`, `chat-channel-input-rules.spec.ts:287,301,308`)에서 각각 다시 타이핑된다. 지금은 사용처가 늘지 않았고 테스트가 오타를 즉시 잡아주므로 실질 위험은 낮지만, 같은 파일 안에서 한쪽은 상수·한쪽은 리터럴이라는 비대칭이 "왜 이 코드만 상수화했는가"라는 의문을 남긴다.
  - 제안: `CHAT_CHANNEL_SETUP_FAILED_CODE` 같은 명명 상수를 `CREDENTIAL_REJECTED_CODE` 옆에 추가해 대칭을 맞추거나, 비대칭을 의도적으로 유지한다면 그 이유(예: 이 코드는 fail-safe 기본값이라 오타 시 영향이 다르다)를 주석에 남긴다.

- **[INFO]** 3개 provider 테스트 파일이 "throw 후 catch 해 관측" 패턴을 각각 다른 헬퍼 이름으로 재구현
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts` `thrownFor` 헬퍼,
    `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` `rejectedWith` 헬퍼,
    `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts` (동일 로직을 `it('getApplicationMe HTTP 404 → code 미부착 (호출자가 502)')` 안에 인라인으로 중복 작성, 별도 헬퍼 없음)
  - 상세: 세 파일 모두 "`setupChannel`을 호출하고 실패하면 `.then(() => null).catch((err) => err)`로 값을 꺼낸다"는 동일한 관측 패턴을 쓰지만, slack/telegram은 파일 스코프 헬퍼로 뽑았고 discord는 인라인으로 한 번 더 풀어 썼다. 각 파일이 독립된 adapter를 테스트하므로 파일 간 완전한 통합은 과할 수 있으나, 최소한 같은 파일 안에서라도 헬퍼 유무·이름이 통일되지 않은 점은 다음에 discord 쪽에 같은 케이스가 하나 더 추가될 때 또 인라인으로 중복될 가능성을 남긴다.
  - 제안: discord.adapter.spec.ts에도 `rejectedWith`류 헬퍼를 도입하거나, 세 파일이 정말 같은 모양이라면 `chat-channel` 테스트 공용 유틸로 추출.

- **[INFO]** `TriggersService.rotateBotToken`이 이미 140줄에 달하는 6단계 오케스트레이션이며, 이번 diff가 로깅 블록을 추가해 조금 더 길어졌다 (기존 스코프 문제, 이번 PR이 새로 만든 것은 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:985`(`async rotateBotToken(`)부터 함수 종료까지
  - 상세: 이번 변경은 `catch` 블록에 `this.logger.warn(...)` 5줄을 추가한 것뿐이라 diff 자체의 문제는 아니지만, 함수가 이미 "resolve → v2 백업 → rotate → setupChannel → issuedInboundSigning 저장 → trigger 갱신"의 6단계를 한 메서드 안에 순차 배치하고 있어 "함수 길이/단일 책임" 관점에서 계속 누적되는 중이다. plan(`plan/in-progress/impl-setup-error-code.md`)도 이 함수를 6단계 오케스트레이션이라 스스로 부른다.
  - 제안: 이번 PR 스코프 밖이므로 즉시 조치 불필요. 다음에 이 메서드에 손을 댈 일이 생기면 단계별 private 메서드 분리를 고려할 만하다는 점만 기록.

## 비대상으로 확인한 항목 (양호)

- `credentialRejectedError` / `isCredentialRejectedError` 헬퍼(`chat-channel/types.ts`)는 이름·JSDoc이 명확하고, `code` 프로퍼티의 4가지 의미(우리 계약값·Discord 원본 숫자·EIA 분류·Node 시스템 에러)를 정확 일치로만 판별하도록 설계해 truthy 판별로 인한 오분류 위험을 구조적으로 막아 둔 점이 좋다.
- `discord-client.spec.ts`의 뮤테이션 근거 주석("`status: res.status`를 지웠는데 434개 테스트가 통과했다")처럼, 왜 이 테스트가 필요한지를 실측으로 남기는 방식이 일관되게 적용돼 있어 향후 재발견 비용을 낮춘다.
- `translateSetupChannelError`의 JSDoc이 판별 기준·한시적 예외·응답 본문 정책·SoT를 모두 갖춰 함수 하나만 읽어도 설계 맥락을 알 수 있다.
- `SLACK_CREDENTIAL_REJECTED_ERRORS`/`TELEGRAM_CREDENTIAL_REJECTED_STATUSES` 등 신규 상수는 각각 왜 그 값들만 열거했는지, 왜 나머지는 502로 두는지를 주석에 남겨 매직 넘버/매직 문자열 논란을 사실상 해소했다.
- `plan/in-progress/impl-setup-error-code.md`는 설계 판단 (a)~(e)를 근거와 함께 미리 정리해 두어 diff만 봐도 "왜 이렇게 짰는가"를 되짚을 수 있다.

## 요약

이번 변경은 provider 3종(Discord/Slack/Telegram)의 setupChannel 실패를 `Error.code` 프로퍼티 기반의 단일 판별 축으로 재구성하면서, 각 함수·상수에 왜 이렇게 설계했는지를 촘촘한 JSDoc/주석으로 남겨 전반적으로 가독성과 근거 추적성이 높다. 다만 "401/403 = 자격 증명 거부"라는 동일한 규칙이 discord(인라인 리터럴)와 telegram(이름 있는 상수 배열)에서 서로 다른 형태로 구현돼 있어 provider 간 스타일 일관성이 약간 흔들리고, `CHAT_CHANNEL_SETUP_FAILED` 코드는 형제 코드(`BOT_TOKEN_INVALID`)와 달리 상수화되지 않은 채 4곳에서 리터럴로 반복된다. 두 항목 모두 지금 당장 버그를 유발하진 않는 낮은 위험의 스타일/DRY 이슈이며, `TriggersService.rotateBotToken`의 길이는 이번 PR이 새로 만든 문제가 아니라 기존 스코프의 연장선이다. 전반적으로 CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
