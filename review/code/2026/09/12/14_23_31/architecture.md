# 아키텍처 리뷰 — setupChannel 실패 분류 (`impl-setup-error-code`, 2차 라운드)

## 발견사항

- **[INFO]** `chat-channel-input-rules.ts` 의 "입력 전용" 자기 서술과 `translateSetupChannelError`(출력측) 의 공존 — 이전 라운드부터 이어지는 미해결 항목
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 상단 모듈 주석(diff 에 포함되지 않은 컨텍스트 — `Read` 로 직접 확인: `// chat-channel **입력 규칙** — TriggersService 에서 떼어낸 도메인 검증·정화 계층` 및 "이 규칙들은 외부 협력자를 하나도 쓰지 않는다" 서술) vs `translateSetupChannelError` 함수(게이트 294~336, 특히 `credentialRejected` 판별 블록 320~326)
  - 상세: 파일 헤더는 스스로를 "0-dependency 순수 **입력** 검증·정화 계층"이라 규정하는데(`this.*` 참조 0개가 이동 근거였다고 명시), 이 diff 가 확장한 `translateSetupChannelError` 는 **출력측**(외부 adapter 실패 → HTTP 응답 계약) 변환이다. 이번 라운드에서 그 함수는 `isCredentialRejectedError` import(게이트 13~15)·`BadGatewayException` 분기(게이트 320~332)까지 추가로 얹으며 더 커졌다 — 응집도 낮은 공존이 심화됐다. 기능적 결함은 아니고 이전 라운드(`review/code/2026/09/12/13_41_55/architecture.md`)가 이미 INFO 로 유예해 뒀으나, 이번 라운드에서도 그 분리(파일 분리 또는 헤더 주석 보강)가 이뤄지지 않아 재확인 차원에서 다시 남긴다.
  - 제안: 별도 파일(예: `chat-channel-error-mapping.ts`)로 옮기거나, 최소한 헤더 주석에 "출력측 에러 변환도 포함" 한 줄을 추가.

- **[INFO]** 두 형제 응답 코드의 추상화 수준이 비대칭 — 한쪽만 명명 상수·타입·팩토리로 승격
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `CREDENTIAL_REJECTED_CODE`(게이트 486) + `CredentialRejectedError` 타입(게이트 488~491) + `credentialRejectedError`/`isCredentialRejectedError` 팩토리(게이트 502~532) vs `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 의 `code: 'CHAT_CHANNEL_SETUP_FAILED'` 리터럴(게이트 333)
  - 상세: `§5.4` 응답 계약의 두 코드(`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`)는 개념적으로 대칭(자격 증명 거부 vs 그 밖)인데, 한쪽만 export 상수 + 판별 타입 + 정확-일치 헬퍼로 감싸여 있고 다른 쪽은 그대로 문자열 리터럴이다. 지금은 `CHAT_CHANNEL_SETUP_FAILED` 를 별도로 "선언"할 provider 측 로직이 없어(그냥 default) 실질적 위험은 낮지만, 같은 계약의 두 갈래가 다른 추상화 레벨에 머물러 있다는 점은 다음에 이 코드를 손대는 사람에게 "왜 한쪽만 상수인가"라는 판단 부담을 남긴다.
  - 제안: 대칭을 맞추려면 `CHAT_CHANNEL_SETUP_FAILED_CODE` 상수를 나란히 추가하거나, 비대칭이 의도(전자만 "선언"이 필요한 판별자이고 후자는 fail-safe 기본값)라면 그 이유를 주석 한 줄로 남긴다. (참고: 이 항목은 유지보수성 관점 리뷰에서도 별도로 다룰 수 있으나, "동일 계약의 두 구성 요소가 다른 추상화 레벨" 이라는 점에서 아키텍처 관점 관찰로도 유효.)

- **[INFO]** `Error.code` 판별자가 같은 호출 스택에서 4가지 의미로 오버로드되는데, 그 다의성이 타입 시스템이 아니라 JSDoc 주석 하나에만 의존
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `isCredentialRejectedError`(게이트 512~532, JSDoc 이 3가지 다른 `code` 소유자를 스스로 열거) + `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:95` 의 Node/undici 시스템 에러 `.code`(diff 밖, 기존 코드 — 직접 확인)
  - 상세: (1) 이 계약의 문자열 판별자, (2) Discord 원본 응답의 숫자 `app.code`/`res.code`, (3) EIA `event.error.code`, (4) Node 표준 시스템 에러 `.code`(`ENOTFOUND` 등) — 네 네임스페이스가 `code` 라는 같은 프로퍼티 이름을 공유한다. `isCredentialRejectedError` 는 `=== CREDENTIAL_REJECTED_CODE` 정확 일치로 짜여 있어(게이트 528~531) 지금 오분류 위험은 구조적으로 낮고, 새로 추가된 `chat-channel-input-rules.spec.ts` 의 `ENOTFOUND` 회귀 테스트도 이를 캐너리로 고정해 뒀다(직접 확인). 다만 이 경계가 인터페이스 타입으로 강제되지 않고 문서로만 지켜지는 구조는 향후 `if (err.code)` 같은 truthy 판별 "최적화"가 들어올 표면을 남긴다.
  - 제안: 코드 변경 불필요 — spec 문서(`chat-channel-adapter.md §1.1.2`)의 다의성 표에 이미 이번 라운드에서 "네트워크/시스템 `Error.code`" 행이 추가됐음을 확인했다(spec 커밋 반영 완료, 코드 fix 대상 아님).

## 정합성이 확인된 설계 판단 (긍정적으로 평가)

- **DIP/결합도**: `credentialRejectedError`/`isCredentialRejectedError`/`CREDENTIAL_REJECTED_CODE`(`chat-channel/types.ts` 게이트 479~532)를 `Error` 서브클래스 계층이 아니라 **프로퍼티 태깅 + 팩토리 함수**로 설계한 점 — provider 3종(discord/slack/telegram)이 공통 클래스를 import 하지 않아도 되므로 결합이 늘지 않는다. `Grep` 으로 `chat-channel/types.ts` 의 import 를 직접 확인한 결과 `shared/conversation-thread` 외 참조가 없어 `triggers/` 를 되돌아보지 않는다 — `triggers → chat-channel` 단방향 의존만 성립, 순환 없음.
- **LSP/OCP — 필터 계층과의 통합**: `BadGatewayException` 이 `HttpException` 을 상속하므로 `http-exception.filter.ts` 의 `instanceof HttpException` 일반 처리 경로(게이트 44~67, diff 밖·직접 확인)에 특별 분기 없이 흡수된다. `getCodeFromStatus`(502 케이스 없음, 직접 확인)가 실행될 일이 없는 이유도 확인했다 — `resp.code` 가 항상 `'CHAT_CHANNEL_SETUP_FAILED'` 로 채워져 있어 그 fallback 경로에 도달하지 않는다. 이번 라운드에 추가된 `http-exception.filter.spec.ts` 회귀 테스트(파일 2, 게이트 221~236)가 이를 실행 가능한 캐너리로 고정했다 — 새 상태 코드 도입이 필터 계층 변경을 요구하지 않음을 코드로 증명.
- **개방-폐쇄**: `translateSetupChannelError` 는 `isCredentialRejectedError(err) || 정규식 fallback` 형태(게이트 320~326)라, 새 provider 가 추가돼도 각 adapter 가 `credentialRejectedError` 를 호출하기만 하면 이 함수 자체는 안 바뀐다 — 분류 로직이 provider 별로 국지화돼 OCP 를 만족한다.
- **레이어 책임 — transport vs domain**: `discord-client.ts`(파일 4, 게이트 120~126)는 원시 `status` 필드만 실어 나르고, `discord.adapter.ts`(파일 6, 게이트 75~86)가 그 값으로 자격 증명 거부 여부를 판단한다. 이번 라운드에 신설된 `discord-client.spec.ts`(파일 3)가 "adapter mock 이 `status` 를 자기가 채워 주는 바람에 client 배선 누락이 434개 테스트 전부 GREEN 이었다"는 뮤테이션 실측을 근거로 이 경계를 직접 잠갔다 — transport/domain 분리가 테스트로 강제된 좋은 사례.
- **스타일 대칭성 개선 확인**: 이전 라운드(`review/code/2026/09/12/13_41_55/maintainability.md`)가 "Discord 만 401/403 을 인라인 리터럴로 하드코딩, Slack/Telegram 은 이름 있는 상수" 라고 WARNING 으로 지적했던 비대칭이 이번 라운드에서 해소됐다 — `discord.adapter.ts` 게이트 28 에 `DISCORD_CREDENTIAL_REJECTED_STATUSES: readonly number[] = [401, 403]` 가 추가돼 세 provider 어댑터가 이제 "이름 있는 모듈급 상수 + `.includes()`" 로 동일한 확장 지점 모양을 갖는다.
- **SRP 경계 — 로깅 책임 위치**: `translateSetupChannelError` 를 순수 함수로 유지하기 위해 provider 원문 로깅을 호출자(`TriggersService.rotateBotToken` catch 블록, 게이트 1069~1079)의 기존 `this.logger` 로 넘긴 것은 "순수 변환 계층"과 "인프라(로깅) 계층"의 책임을 정확히 분리한 결정이다. 다만 `rotateBotToken` 자체는 이미 6단계 오케스트레이션(resolve→백업→rotate→setupChannel→로깅→trigger 갱신)을 한 메서드에 담고 있어, 이번에 추가된 5줄이 그 길이를 좀 더 늘렸다 — 새 결함은 아니고 기존 스코프의 연장선이라 이번 라운드 조치 대상은 아니다.
- **프레젠테이션 계층 순수성**: `triggers.controller.ts` 의 `rotateBotToken`(파일 15, 게이트 275~290)은 입력 검증(`newBotToken` 존재/타입) 후 서비스에 위임만 하고, 신규 `@ApiBadRequestResponse`/`@ApiBadGatewayResponse`(게이트 267~274)는 문서화 데코레이터일 뿐 분기 로직을 추가하지 않는다 — 컨트롤러가 여전히 얇은 프레젠테이션 계층으로 남아 있다.

## 요약

이번 2차 라운드 diff 는 1차 라운드(`review/code/2026/09/12/13_41_55`)가 이미 LOW 로 판정한 핵심 아키텍처(provider 3종의 `Error.code` 프로퍼티 기반 명시적 계약, 서브클래스 대신 공유 팩토리, transport/domain 계층 분리, 필터 계층과의 무분기 통합)를 그대로 유지하면서, 그때 WARNING 으로 지적됐던 Discord/Slack/Telegram 판별 상수 스타일 비대칭을 해소했고(`DISCORD_CREDENTIAL_REJECTED_STATUSES` 신설), `http-exception.filter`·`discord-client` 양쪽에 계층 경계를 지키는 회귀 테스트를 추가했다. 순환 의존은 발견되지 않았고(`chat-channel/types.ts` → `triggers/` 역참조 없음, 직접 확인), 프레젠테이션/비즈니스/데이터 계층 분리도 유지된다. 남은 항목은 모두 INFO 수준 — `chat-channel-input-rules.ts` 의 "입력 전용" 자기 서술과 출력측 함수의 공존(이전 라운드부터 이월, 이번 라운드에 오히려 약간 심화), `CREDENTIAL_REJECTED_CODE` 대비 `CHAT_CHANNEL_SETUP_FAILED` 의 추상화 수준 비대칭, `code` 프로퍼티 4중 오버로드가 타입이 아닌 주석 규율에 의존하는 점(실질 위험은 정확-일치 판별 + 회귀 테스트로 구조적으로 낮음)이다. 이 중 어느 것도 병합을 막을 사유는 아니다.

## 위험도

LOW
