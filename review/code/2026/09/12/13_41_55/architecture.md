# 아키텍처 리뷰 — setupChannel 실패 분류 (`impl-setup-error-code`)

## 발견사항

- **[INFO]** `chat-channel-input-rules.ts` 의 파일 책임 서술과 `translateSetupChannelError` 의 실제 역할 불일치 (기존 갭, 이 diff 가 심화)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 상단 모듈 주석("chat-channel **입력 규칙** … 도메인 검증·정화 계층")과 `translateSetupChannelError` 함수(게이트 296~335 부근, 특히 `credentialRejected` 판별 블록 321~325)
  - 상세: 파일 헤더는 스스로를 "0-dependency 순수 **입력** 검증·정화 계층"이라 규정하는데, 이 diff 가 확장하는 `translateSetupChannelError` 는 **출력측**(외부 API 실패 → HTTP 응답 계약) 변환 함수다. 방향이 반대인 관심사가 한 파일에 공존해 응집도가 낮아진다. 이 diff 는 그 함수에 `BadGatewayException` 분기·`isCredentialRejectedError` 정확 일치 판별·502/400 매핑을 새로 추가해 로직을 더 키웠으므로, 기존에 존재하던 이 미스매치가 더 눈에 띄게 됐다. 이미 `consistency-check`(cross_spec INFO) 가 별도 트래커에 유예해 뒀고 이번 PR 을 막을 사유는 아니지만, 다음에 이 파일을 여는 사람이 "여기는 입력만 다룬다"는 헤더 주석을 믿고 새 출력측 로직을 잘못된 자리에 추가할 위험은diff 로 인해 오히려 커졌다.
  - 제안: 이번 PR 완료 후(계획에 이미 있는 항목) `translateSetupChannelError` 를 별도 파일(`chat-channel-error-mapping.ts` 류) 또는 최소한 헤더 주석에 "출력측(에러 변환)도 포함" 한 줄을 추가해 다음 리더의 오배치 확률을 낮춘다.

- **[INFO]** `code` 판별자가 같은 호출 스택에서 최소 4가지 의미로 오버로드됨 — 헬퍼는 정확 일치로 안전하지만 형태 불일치는 남음
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `isCredentialRejectedError`(게이트 512~532, JSDoc 이 3가지 다른 `code` 를 스스로 열거) + `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:95` 의 Node/undici 시스템 에러 `.code`
  - 상세: `Error.code` 프로퍼티가 (1) 이 계약의 문자열 판별자, (2) Discord 원본 응답의 숫자 `app.code`/`res.code`, (3) EIA `event.error.code`, (4) Node 표준 시스템 에러 `.code`(`ENOTFOUND` 등, telegram-client.ts 에 이미 존재) 로 네 가지 다른 네임스페이스를 공유한다. `isCredentialRejectedError` 가 `=== CREDENTIAL_REJECTED_CODE` 정확 일치로 짜여 있어 지금 당장 오분류 위험은 낮지만, 이 다의성은 인터페이스 경계에 타입으로 강제되지 않고 JSDoc 주석 하나에만 의존한다 — 향후 누군가 `if (err.code)` 같은 truthy 판별로 "최적화"하면 DNS 실패(`ECONNREFUSED`)가 조용히 "토큰이 잘못됐다"로 오분류될 수 있다(연쇄 리뷰가 이미 캐너리 테스트로 이 회귀를 막아 두긴 했다).
  - 제안: 별도 코드 변경은 불필요 — spec 문서(`chat-channel-adapter.md §1.1.2`) 다의성 표에 Node 시스템 에러 `.code` 행을 추가하는 문서 후속만으로 충분(이미 consistency-check 가 같은 결론).

- **[INFO]** 세 provider adapter 의 "자격 증명 거부 판별 기준" 추상화 수준이 서로 다름
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` 게이트 75 (`throw app.status === 401 || app.status === 403 ? ... `, 매직 리터럴 인라인) vs `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` 게이트 54~60 (`SLACK_CREDENTIAL_REJECTED_ERRORS: ReadonlySet<string>` 이름 있는 모듈급 상수) vs `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` 게이트 48 (`TELEGRAM_CREDENTIAL_REJECTED_STATUSES: readonly number[]`)
  - 상세: 세 어댑터가 같은 책임(자격 증명 거부 판별 → `credentialRejectedError` 위임)을 담당하는데, Slack·Telegram 은 판별 기준을 문서화된 이름 있는 모듈급 상수로 추출한 반면 Discord 는 동일한 401/403 을 조건식에 인라인했다. 기능적으로는 문제없고(Discord 는 값이 2개뿐이라 상수 추출의 이득이 작다), 세 파일을 나란히 읽는 사람 입장에서 "이 판별 기준을 어디서 확장하는가"에 대한 위치가 provider 마다 달라진다.
  - 제안: 선택 사항 — Discord 도 `DISCORD_CREDENTIAL_REJECTED_STATUSES = [401, 403]` 형태로 추출하면 세 어댑터의 "확장 지점" 모양이 통일된다. 급하지 않음.

## 정합성이 확인된 설계 판단 (긍정적으로 평가)

- **DIP/결합도**: `credentialRejectedError`/`isCredentialRejectedError`/`CREDENTIAL_REJECTED_CODE` (`chat-channel/types.ts`, 게이트 479~532)를 `Error` 서브클래스 계층이 아니라 **프로퍼티 태깅 + 팩토리 함수**로 설계한 결정은 명시적으로 근거가 적혀 있고(서브클래스였다면 provider 3종이 공통 클래스를 import 해야 해 결합이 늘어난다는 점) 실제로 결합도를 낮춘다. `chat-channel/types.ts` 는 이미 adapter 3종이 공유하는 위치라 새 의존을 만들지 않는다 — 순환 의존 검사 결과 `chat-channel/types.ts` 는 `triggers/`를 import 하지 않아 `triggers → chat-channel` 단방향 의존만 성립한다(순환 없음, 직접 확인).
- **SRP/계층 분리**: `translateSetupChannelError` 를 순수 함수로 유지하기 위해 원문 로깅 책임을 호출자(`TriggersService.rotateBotToken`, `triggers.service.ts` 게이트 1070~1077)의 기존 `this.logger`(이미 존재하던 필드, 새로 주입되지 않음)로 넘긴 것은 "순수 변환 계층"과 "인프라(로깅) 계층"의 책임을 정확히 분리한 결정이다.
- **개방-폐쇄**: `translateSetupChannelError` 는 `isCredentialRejectedError(err) || 정규식 fallback` 형태로, 새 provider 가 추가돼도 이 함수 자체를 고칠 필요 없이 각 adapter 가 `credentialRejectedError` 를 호출하기만 하면 된다 — 분류 로직이 provider 별로 국지화돼 있어 OCP 를 만족한다.
- **필터 계층과의 통합**: `BadGatewayException` 이 `HttpException` 을 상속하므로 `http-exception.filter.ts` 의 `instanceof HttpException` 일반 처리 경로에 특별한 분기 추가 없이 흡수된다 — 새 상태 코드 도입이 필터 계층의 변경을 요구하지 않음을 직접 확인(LSP/OCP 모두 만족).
- **레이어 책임**: `discord-client.ts` (transport) 는 원시 `status` 필드만 실어 나르고, `discord.adapter.ts` (domain) 가 그 값으로 분류 판단을 내린다 — transport 가 도메인 판단을 하지 않고 필요한 원시 신호만 노출하는 계층 분리가 유지된다.

## 요약

이번 PR 은 3개 provider adapter 의 "자격 증명 거부" 판별을 문자열 message 파싱에서 `Error.code` 프로퍼티 기반 명시적 계약으로 옮기고, 그 계약을 서브클래스가 아닌 공유 팩토리 함수로 구현해 결합도를 낮췄다. 순환 의존은 발견되지 않았고, 필터·컨트롤러·서비스 계층의 책임 분리도 유지된다. 남은 항목은 모두 INFO 수준으로 — `chat-channel-input-rules.ts` 의 "입력 전용" 자기 서술과 `translateSetupChannelError`(출력측)의 실제 역할 불일치가 이 diff 로 다소 심화된 점, `code` 프로퍼티의 4중 의미 오버로드가 타입 시스템이 아닌 주석 규율에만 의존하는 점, 세 adapter 간 판별 기준 추출 수준의 사소한 불일치 정도다. 이 중 어느 것도 병합을 막을 사유는 아니다.

## 위험도
LOW
