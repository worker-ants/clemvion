# 테스트(Testing) 리뷰 — setupChannel 실패 분류 (`code` 판별 · 502 실현 · 원문 echo 중단)

## 발견사항

- **[WARNING]** `Logger.prototype.warn` spy 를 인라인 `mockRestore()` 로만 해제 — 실패 시 누출 위험
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2028`(spyOn) ~ `:2046`(mockRestore), 테스트 `'그 밖의 실패 → 502 + provider 원문은 응답이 아니라 warn 로그에만'`
  - 상세: `jest.spyOn(Logger.prototype, 'warn')` 는 **클래스 prototype 전역**을 대상으로 한다. 이 스펙 파일 전체(3000줄+)에 `afterEach`/`jest.restoreAllMocks()` 가 단 한 곳도 없고(`grep` 확인), 이 테스트는 복원을 마지막 줄의 수동 `warn.mockRestore()` 하나에만 의존한다. 그 앞의 어느 `expect` 든 하나라도 실패하면 `mockRestore()` 에 도달하지 못하고 spy 가 이후 테스트로 누출된다. 같은 저장소의 `http-exception.filter.spec.ts:40-43` 은 정확히 이 문제를 이유로 "Logger spy 복원을 `afterEach` 로 통일(B-5) — 예외로 테스트가 중단돼도 spy 가 누설되지 않는다" 는 관례를 이미 명문화해 두었는데, 이번 신규 테스트는 그 확립된 패턴을 따르지 않는다.
  - 제안: `beforeEach`/`afterEach` 쌍으로 옮기거나(`const warn = jest.spyOn(...)` 를 상단에 두고 `afterEach(() => warn.mockRestore())`), 최소한 `try/finally` 로 감싸 실패해도 복원되게 한다(`discord-client.spec.ts` 의 `global.fetch` 복원 패턴이 이미 이 저장소 안에 좋은 선례로 존재한다).

- **[WARNING]** `GlobalExceptionFilter` 가 실제 `HttpException` 5xx(신규 `BadGatewayException`)를 올바르게 통과시키는지 잠그는 테스트가 없음
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (이번 PR 에서 미변경 — 파일 전체가 review 대상 diff 에 없음)
  - 상세: `chat-channel-input-rules.ts` 의 `translateSetupChannelError` 는 이제 `BadGatewayException`(502) 을 던질 수 있고, 이는 이 저장소에서 **`BadGatewayException` 의 첫 사용**이다(plan 문서 `impl-setup-error-code.md` §"(e) 502 경로는 한 번도 지나간 적이 없다" 가 스스로 그렇게 적어 두었다). `triggers.service.spec.ts` 의 두 신규 테스트는 `rotateBotToken()` 이 catch 한 예외 객체에 직접 `.getStatus()`/`.getResponse()` 를 호출해 값만 확인할 뿐, 실제 HTTP 파이프라인의 `GlobalExceptionFilter.catch()` 를 경유하지 않는다. `http-exception.filter.spec.ts` 를 실측한 결과 `instanceof HttpException` 분기(제네릭 — 어떤 status 든 `getStatus()`/`resp.code` 를 그대로 forward)는 지금까지 오직 4xx(409/401/413)로만 테스트돼 있고, **5xx 를 실어 나르는 케이스는 한 건도 없다**. 게다가 같은 필터의 *다른* 분기(`mapHttpErrorLike`, 순수 `Error`+`.status` 형태)는 5xx 를 보안상 **의도적으로 500 으로 마스킹**한다(`http-exception.filter.spec.ts:93-105` "masks a plain 5xx-ish error ... as 500"). 즉 이 저장소는 "5xx 는 의심하고 마스킹한다" 는 기존 철학을 이미 가지고 있어서, 누군가 그 마스킹을 `HttpException` 분기까지 확장하는 리팩터를 해도 지금은 **그것을 잡아낼 테스트가 하나도 없다** — `BadGatewayException` 이 조용히 500 으로 깔릴 수 있는 회귀 caniary 부재다.
  - 제안: `http-exception.filter.spec.ts` 에 `new BadGatewayException({code:'CHAT_CHANNEL_SETUP_FAILED', message:'...'})` → `status===502`, `body.error.code==='CHAT_CHANNEL_SETUP_FAILED'` 를 단언하는 테스트 한 건을 추가한다(기존 409 케이스와 완전히 같은 패턴이므로 비용이 낮다).

- **[INFO]** 두 신규 서비스 레벨 테스트의 타입 캐스팅이 실제 런타임 타입과 불일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2039-2040`
  - 상세: `expect((caught as BadRequestException).getStatus()).toBe(502);` — `caught` 는 실제로는 `BadGatewayException` 인스턴스인데 `BadRequestException` 으로 캐스팅한다. `HttpException` 서브클래스가 공통 메서드를 공유해서 지금은 동작하지만("BadRequestException 인데 502" 라는 모순된 문구가) 읽는 사람을 혼동시키고, 두 예외 타입의 메서드 시그니처가 나중에 갈라지면(예: 서브클래스별 `getResponse()` 오버로드) 이 캐스트가 타입 오류를 조용히 숨긴다. 바로 위 400 케이스(`:2016`)는 같은 패턴을 `BadRequestException` 으로 올바르게 캐스팅해 대조가 뚜렷하다.
  - 제안: `caught as BadGatewayException` 또는 공통 상위 타입 `HttpException` 으로 캐스팅.

- **[INFO]** 신규 서비스 레벨 502 테스트의 mock 내용이 fixture 의 provider 와 불일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2005-2019` (400 케이스) — `mockAdapter.setupChannel.mockRejectedValueOnce(credentialRejectedError('Slack auth.test failed: invalid_auth'))`
  - 상세: 이 `describe` 블록의 `beforeEach`(≈`:1874`)가 구성하는 trigger fixture 의 `config.chatChannel.provider` 는 `'telegram'` 인데, 주입하는 에러 메시지는 `'Slack ...'` 문구를 쓴다. adapter 자체를 mock 하므로 테스트 정확성에는 영향 없지만(어느 adapter 든 `credentialRejectedError` 를 던지면 400 으로 옮겨진다는 것이 검증 대상), provider-불일치 문구는 다음 사람이 "이 테스트가 telegram 경로를 검증한다" 고 오독할 여지를 만든다.
  - 제안: 메시지를 `'Telegram setWebhook failed: ...'` 류로 바꾸거나, provider 무관성이 의도라면 주석 한 줄로 명시.

- **[INFO]** `error_code 400 / 부재` 테스트가 두 fixture 를 한 `it` 안에서 순회
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts:182-191`, `it('error_code 400 / 부재 → code 미부착 (호출자가 502)', ...)`
  - 상세: `for (const res of [...])` 로 서로 다른 두 입력(`error_code:400`, `error_code` 부재)을 한 테스트 안에서 순회한다. 실패 시 어느 fixture 가 깨졌는지 테스트 이름만으로는 구분이 안 되고, Jest 출력에서 스택을 봐야 한다. 바로 위 신용-거부 케이스는 `it.each([401, 403])` 로 이미 분리돼 있어 대조된다.
  - 제안: `it.each([{error_code:400,...}, {description:'fetch failed'}])` 로 통일해 각 케이스를 독립 테스트로 승격.

## 강점 (참고)

- `discord-client.spec.ts`(신규): 실제 뮤테이션(`status: res.status` 삭제)으로 434개 기존 테스트가 전부 GREEN 이었음을 실증하고 그 갭을 정확히 겨냥해 추가한 파일 — 이 리뷰 항목들이 요구하는 "가설을 뮤테이션으로 확인" 을 이미 저자가 선행한 좋은 사례다.
- `chat-channel-input-rules.spec.ts` 의 캐너리 뒤집기(`discord verify_key → 502` 를 `400` 으로 교체)와 `ENOTFOUND` truthiness 회귀 테스트는 실제로 제시된 뮤테이션(code 판별 제거 / fallback 제거 / 502→400)을 모두 RED 로 잡아낼 수 있는 설계다 — 각 provider(`slack`/`discord`/`telegram`) 의 화이트리스트 상수도 `it.each` 로 개별 값 단위까지 커버된다.
- `credentialRejectedError()` 를 테스트에서 직접 import 해 프로덕션과 동일한 헬퍼로 fixture 를 만든다(자체 재현 객체를 손으로 짜지 않음) — mock/stub 의 "실제 동작과의 괴리" 를 구조적으로 차단한다.
- 각 provider 어댑터 spec 은 `beforeEach`/팩토리 함수로 client·secrets mock 을 매 테스트 새로 생성해 격리가 깨지지 않는다(`discord.adapter.spec.ts`, `slack.adapter.spec.ts`, `telegram.adapter.spec.ts` 전수 확인).

## 요약

핵심 로직(`translateSetupChannelError` 의 `code`/fallback 판별, provider 3종의 자격 증명 거부 화이트리스트, `DiscordClient` 의 `status` 배선, 응답 본문 원문 미노출)에 대한 신규 테스트는 뮤테이션 관점에서 설계가 탄탄하고 mock 도 프로덕션 헬퍼를 재사용해 괴리가 적다. 다만 이번 PR 이 이 저장소에서 처음 실사용하는 `BadGatewayException`(502)이 실제 `GlobalExceptionFilter` 를 통과할 때도 마스킹되지 않는지 잠그는 테스트가 없다는 점(기존 필터가 "5xx-ish 신호는 의심하고 마스킹" 하는 다른 분기를 이미 갖고 있어 회귀 가능성이 구조적으로 존재)과, 신규 `Logger.prototype.warn` spy 가 이 저장소가 이미 문서화한 "afterEach 로 복원 통일" 관례를 따르지 않아 실패 시 누출 위험이 있는 점은 WARNING 으로 지적할 가치가 있다. 나머지는 가독성·mock 내용 정합성 수준의 INFO다.

## 위험도

LOW
