# 유지보수성(Maintainability) 리뷰 — setupChannel 실패 분류 재분류 (`impl-setup-error-code`)

## 발견사항

- **[INFO]** `CHAT_CHANNEL_SETUP_FAILED` 코드 문자열이 형제 코드(`BOT_TOKEN_INVALID`)와 달리 여전히 명명 상수로 승격되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:333` (`code: 'CHAT_CHANNEL_SETUP_FAILED',`) — 실측 확인. 같은 리터럴이 `chat-channel-input-rules.spec.ts:287,301,308`, `triggers.service.spec.ts:2045` 에서 각각 다시 타이핑된다(코드 1곳 + 테스트 4곳, `Read`/`grep` 으로 재확인).
  - 상세: 같은 §5.4 응답 계약의 두 코드 중 `BOT_TOKEN_INVALID`는 `codebase/backend/src/modules/chat-channel/types.ts:486` 의 `export const CREDENTIAL_REJECTED_CODE = 'BOT_TOKEN_INVALID'` 를 거쳐 오타를 구조적으로 막는 반면, `CHAT_CHANNEL_SETUP_FAILED`는 여전히 리터럴 문자열로 직접 쓰인다. 지금은 사용처가 늘지 않고 테스트가 오타를 즉시 잡아 주므로 실질 위험은 낮지만, 같은 파일·같은 계약 안에서 한쪽만 상수화된 비대칭이 "왜 이 코드만 상수화했는가"라는 의문을 남긴다. 직전 라운드(`review/code/2026/09/12/13_41_55/maintainability.md`)가 같은 항목을 INFO 로 지적했고, 이번 라운드에서도 해소되지 않은 채 남아 있음을 실측으로 재확인했다.
  - 제안: `CHAT_CHANNEL_SETUP_FAILED_CODE` 류의 명명 상수를 `CREDENTIAL_REJECTED_CODE` 옆에 추가해 대칭을 맞추거나, 의도적으로 비대칭을 유지한다면 그 이유를 주석으로 남긴다. 급하지 않음.

- **[INFO]** `discord.adapter.spec.ts` 가 "client 생성 → getApplicationMe spy → adapter 생성" 3줄 셋업을 같은 파일 안에서 두 번 반복한다 — slack/telegram 은 헬퍼로 뽑았는데 discord 만 인라인 중복이 남아 있다
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts:117-124` (`it.each([401, 403])` 블록 내부) 와 `discord.adapter.spec.ts:132-139` (`'getApplicationMe HTTP 404 → code 미부착 (호출자가 502)'` 단독 테스트) — 두 블록 모두 `const client = new DiscordClient(); jest.spyOn(client, 'getApplicationMe').mockResolvedValue({...}); const adapter = new DiscordAdapter(client, makeSecretsMock());` 3줄을 거의 그대로 반복.
  - 상세: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts` 는 `thrownFor` 헬퍼로, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` 는 `rejectedWith` 헬퍼로 같은 "실패시키고 catch 해 관측" 패턴을 한 곳에 모아 뒀다. discord 파일만 그 패턴을 헬퍼로 추출하지 않고 두 자리(it.each + 단독 테스트)에 각각 풀어 썼다. 세 provider 테스트 파일이 같은 세션에서 나란히 작성됐는데 discord 만 스타일이 다른 것이라, 다음에 discord 쪽에 같은 케이스가 하나 더 추가되면 세 번째 인라인 중복이 생길 가능성이 있다. 직전 라운드 리뷰가 이미 같은 지점을 INFO 로 지적했고, 이번 라운드 diff 에도 그대로 남아 있다.
  - 제안: discord.adapter.spec.ts 에도 `rejectedWith`류 헬퍼를 도입해 slack/telegram 과 형태를 통일한다. 급하지 않음.

- **[INFO]** `TriggersService.rotateBotToken` 이 이미 140줄대 6단계 오케스트레이션 메서드이며, 이번 diff 가 `catch` 블록에 로깅 5~9줄을 더 얹혀 계속 길어지는 중 (기존 스코프 문제, 이번 PR 이 새로 만든 것은 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:985`(`async rotateBotToken(`) 부터 함수 종료까지, 신규 로깅 블록은 `triggers.service.ts:1070-1077`(`this.logger.warn(...)`)
  - 상세: 이번 변경 자체는 `catch` 블록에 `this.logger.warn(...)` 호출을 추가한 것뿐이라 diff 단위로는 문제가 아니지만, 메서드가 이미 "resolve → v2 백업 → rotate → setupChannel → issuedInboundSigning 저장 → trigger 갱신"의 6단계를 한 메서드 안에 순차 배치하고 있어 함수 길이·단일 책임 관점에서 계속 누적되고 있다.
  - 제안: 이번 PR 스코프 밖이므로 즉시 조치 불필요. 다음에 이 메서드를 다시 여는 사람은 단계별 private 메서드 분리를 고려할 만하다는 점만 기록.

## 이전 라운드 대비 개선 확인 (긍정적으로 평가)

- **[해소됨]** 직전 라운드(`review/code/2026/09/12/13_41_55/maintainability.md`)가 WARNING 으로 지적한 "Discord 가 401/403 판별을 인라인 리터럴로, Slack/Telegram 은 이름 있는 상수로 처리해 provider 간 스타일이 흩어져 있다"는 지금 해소됐다 — `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:28` 에 `DISCORD_CREDENTIAL_REJECTED_STATUSES: readonly number[] = [401, 403]` 가 신설되어 `TELEGRAM_CREDENTIAL_REJECTED_STATUSES`(`telegram.adapter.ts:48`) 와 형태가 통일됐고, 판별식(`discord.adapter.ts:82-85`)도 그 상수를 참조하도록 바뀌었다(`RESOLUTION.md` #3, 커밋 `a07c91b64`). 재발 없음을 직접 grep 으로 확인.
- **[해소됨]** 직전 라운드가 `side_effect.md` 에서 지적한 "`triggers.service.spec.ts` 신규 테스트가 `Logger.prototype.warn` 을 스파이하면서 원복을 테스트 마지막 줄의 수동 호출에만 맡겨, 조기 실패 시 spy 가 파일 전체로 누출된다"는 문제도 지금은 `try { ... } finally { warn.mockRestore(); }` 로 감싸져 있다(`triggers.service.spec.ts` 신규 테스트, 주석 "afterEach 없이 mockRestore() 를 마지막 줄 하나에만 맡기면 … spy 가 파일 전체로 누출된다 — try/finally 로 원복을 보장" 참조, 커밋 `8847b6736`). `http-exception.filter.spec.ts` 의 `afterEach(jest.restoreAllMocks)` 관례와 결은 다르지만(파일 전체 대신 이 한 테스트에 국한된 try/finally), 목적(예외 중단 시에도 spy 누출 방지)은 동일하게 달성됐다.

## 비대상으로 확인한 항목 (양호)

- `credentialRejectedError`/`isCredentialRejectedError`/`CREDENTIAL_REJECTED_CODE`(`chat-channel/types.ts:479-532`) — 이름·JSDoc이 명확하고, `code` 프로퍼티의 네 가지 의미(우리 계약값·Discord 원본 숫자·EIA 분류·Node 시스템 에러)를 정확 일치로만 판별해 truthy 판별로 인한 오분류 위험을 구조적으로 막아 둔 설계가 좋다.
- `SLACK_CREDENTIAL_REJECTED_ERRORS`(`ReadonlySet<string>`) / `TELEGRAM_CREDENTIAL_REJECTED_STATUSES`(`readonly number[]`) / `DISCORD_CREDENTIAL_REJECTED_STATUSES`(`readonly number[]`) — 세 provider 모두 이제 이름 있는 모듈급 상수로 판별 기준을 노출하고, 왜 그 값들만 열거했는지·나머지는 왜 502로 두는지를 주석에 남겨 매직 넘버/매직 문자열 논란을 사실상 해소했다.
- `translateSetupChannelError`(`chat-channel-input-rules.ts:296-336`)의 JSDoc이 판별 기준·한시적 예외·응답 본문 정책·SoT를 모두 갖춰 함수 하나만 읽어도 설계 맥락을 알 수 있고, 함수 본문 자체는 15줄 내외로 간결하며 중첩도 얕다(if 1단).
- `discord-client.spec.ts` 의 뮤테이션 근거 주석("`status: res.status` 를 지웠는데 434개 테스트가 통과했다")처럼, 왜 이 테스트가 필요한지를 실측으로 남기는 방식이 신규 테스트 전반에 일관되게 적용돼 있어 재발견 비용을 낮춘다.
- `chat-channel-input-rules.spec.ts` 의 `describe` 재구성(단일 → 중첩)은 `translate`/`fromMessage` 두 개의 짧은 헬퍼로 "status+body 관측"·"message 만으로 관측" 두 축을 깔끔히 분리했고, 세 그룹(자격 증명 거부/그 밖/원문 비노출) 경계가 명확해 가독성이 개선됐다.
- CHANGELOG.md·frontend 문서(discord/slack `.mdx` 4파일)·`backend-labels.ts` 문구 변경은 기존 저장소 관례(Unreleased 서사형 기록, ko/en 대응 문서 동시 갱신)를 그대로 따른다.

## 요약

이번 변경은 provider 3종(Discord/Slack/Telegram)의 setupChannel 실패 판별을 `Error.code` 프로퍼티 기반의 단일 축으로 재구성하면서, 직전 라운드 리뷰가 지적한 WARNING(Discord 상수화 누락) 과 side-effect 이슈(Logger spy 전역 누출 위험)를 모두 실측 확인 가능한 형태로 해소했다. 남은 항목은 전부 INFO 수준이다 — `CHAT_CHANNEL_SETUP_FAILED` 코드가 형제 코드와 달리 상수화되지 않은 비대칭, discord adapter 테스트 파일만 헬퍼 추출 없이 셋업 3줄을 두 번 반복하는 점, `TriggersService.rotateBotToken` 이 6단계 오케스트레이션으로 계속 길어지는 기존 스코프 이슈다. 세 항목 모두 지금 당장 버그를 유발하지 않는 낮은 위험의 스타일/DRY 이슈이며 병합을 막을 사유는 아니다.

## 위험도

LOW
