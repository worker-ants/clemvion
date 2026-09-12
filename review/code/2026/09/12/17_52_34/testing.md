# 테스트(Testing) 코드 리뷰

## 검증 방법

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.{ts,spec.ts}` ·
`repo-guards/__tests__/dto-class-name-collision{-guard,}.ts`(신규 가드+테스트+fixture 4개)를
`c9bc5dca6..HEAD` 전체 diff 로 직접 대조했다. 프롬프트의 diff 생략 부분(`chat-channel-input-rules.{ts,spec.ts}`)은
`git diff` 로 재취득했다.

가설 검증을 위해 `chat-channel-input-rules.ts` 의 slack/discord **형식(hex) 불일치** 메시지 두 개를
저장소 파일에서 직접 스왑해 `npx jest chat-channel-input-rules.spec.ts` 를 돌렸다(원본은 `mktemp`
스크래치 디렉터리에 `cp` 보관 → 실행 후 `cp` 로 원복, `diff` 로 원복 동일함 확인,
최종 `git status --short` 로 잔여 변경 없음 확인). 그 외 `triggers.service.spec.ts` 신규 케이스,
`dto-class-name-collision.spec.ts`, `trigger-dto-validation.spec.ts` 신규 케이스는 타겟 `jest` 실행으로
GREEN 을 직접 재현했다(뮤테이션은 걸지 않음).

## 발견사항

- **[WARNING]** provider 별 **형식 불일치** 에러 메시지가 서로 바뀌어도(Slack↔Discord) 어떤 테스트도 감지하지 못한다 — 이번 PR 이 같은 클래스의 다른 자리(부재 분기)에 대해 방금 고친 것과 동일한 결함이다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `assertInboundSigningPlaintextByProvider` 의 `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 불일치 분기 두 `throwInvalidField(...)` 호출 (`if (provider === 'slack' && !SLACK_SIGNING_SECRET_REGEX.test(...))` 와 바로 아래 `discord` 분기)
  - 상세: 이번 PR 은 "부재(필수 위반)" 분기에 대해 정확히 이 클래스의 결함을 실측·수정했다 — `chat-channel-input-rules.spec.ts` 신규 `it.each`(`%s 는 부재를 거부하고 자기 provider 의 이름으로 안내한다`)가 `res?.message` 로 Slack/Discord 라벨 스왑을 잡도록 고쳤다(주석에 "판별자는 `message` 다" 라고 명시). 그런데 바로 아래 **형식 불일치** 분기의 두 메시지(`'Slack signing secret 형식이...'` / `'Discord application public key 형식이...'`)는 여전히 `details: { field: 'inboundSigningPlaintext', code: 'INVALID_FIELD' }` 만 단언되고 `message` 는 어떤 테스트도 보지 않는다. 두 메시지를 서로 바꿔치기해 `npx jest chat-channel-input-rules.spec.ts` 를 실행한 결과 **30개 테스트 전부 GREEN** — 즉 Slack 사용자가 "Discord application public key 형식이 올바르지 않습니다" 를 보게 되는 회귀를 이 스위트가 원리적으로 못 잡는다. `it.each(['slack',32,64],['discord',64,32])` 블록의 "비-hex" 케이스(`'Z'.repeat(ownLen)`)에 `expect(res?.message).toContain(...)` 한 줄만 더하면 잡힌다.
  - 제안: 부재 분기와 동일한 패턴으로 형식 불일치 케이스에도 `message` 단언(라벨 문자열 포함 여부)을 추가할 것. 같은 파일 안에서 같은 함수의 형제 분기 하나만 하드닝되고 다른 하나가 남은 상태라, 다음 리뷰가 다시 "메시지 스왑 미검출" 을 지적하게 될 자리다.

- **[INFO]** 신규 `throwInvalidField` 헬퍼 자체를 겨눈 직접 단위 테스트는 없다 — 다만 실질 커버리지 갭은 아니다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56` 부근(`function throwInvalidField`)
  - 상세: `throwInvalidField`/`hasField`/`rejectBlockedField` 는 모듈-내부(비-export) 함수라 12개 호출부를 통해서만 간접 검증된다. 기존 `it.each` 스위트(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext` 5필드 전부)가 각 호출부의 `details.field`/`details.code`/`message` 를 이미 단언하고 있어 헬퍼 추출로 인한 실질 회귀 위험은 낮다. 이번 리팩터가 "테스트를 한 줄도 안 고쳐도 될 만큼 순수 이동" 이라는 주장과도 일치한다.
  - 제안: 조치 불요. 언급은 완전성을 위한 기록.

- **[INFO]** `dto-class-name-collision.spec.ts` 의 "베이스라인은 0이다" 라는 실측 근거 문구가 실제 실행으로 재현됨을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` (`'*.dto.ts' 의 export class 이름은 저장소 안에서 유일하다`)
  - 상세: `find modules common -name '*.dto.ts' ! -name '*.spec.ts' | wc -l` → 114 (주석의 "114개가 modules(111)·common(3)" 과 일치), `npx jest dto-class-name-collision.spec.ts` → 4/4 GREEN. 대조군 두 건(`alpha/beta.dto.ts` 이름 충돌, `decoy.dto.ts` AST vs 정규식)도 fixture 가 실제로 다르게 판정되는 값으로 구성돼 vacuous 하지 않음을 확인했다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `triggers.service.spec.ts` 의 신규 provider-identity 필드 테스트(`toEqual` 사용)는 이전 라운드의 유예 근거("전체 스프레드라 안전")를 실제로 무력화하는 형태로 잘 작성됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `'§5.4 — %s 의 부가 identity 필드가 응답까지 그대로 온다'`
  - 상세: `objectContaining` 이 아니라 `toEqual` 을 써서 필드 누락 시 RED 가 되도록 명시적으로 설계했고(주석에도 그 이유가 적혀 있음), `mockAdapter.setupChannel.mockResolvedValueOnce(...)` 로 provider 별 identity 형태를 격리해 주입한다. `beforeEach` 가 매 테스트마다 `mockAdapter`/서비스를 재구성해 테스트 간 상태 누수도 없다. 타겟 실행으로 GREEN 확인.
  - 제안: 조치 불요.

## 요약

전반적으로 이번 diff 는 헬퍼 추출·타입 정합·신규 응답 DTO 배선이라는 스코프에 비례해 테스트를 잘 보강했다 — 특히 이전 라운드에서 지적된 "provider label 스왑 미검출"·"DTO 층 null/'' 미고정"·"botIdentity 부가 필드 유실" 세 가지를 각각 판별 가능한(discriminating) fixture 로 정확히 막았고, 신규 `dto-class-name-collision` 가드는 대조군·vacuous 방지 테스트까지 갖춰 격리·가독성 모두 양호하다. 다만 이번에 하드닝된 "provider label 스왑" 패턴이 형제 분기인 "형식 불일치 메시지 스왑" 에는 적용되지 않아, 같은 함수 안에 방금 고친 것과 대칭인 커버리지 갭이 하나 남아 있다(실측: 메시지 스왑 후 30/30 GREEN). 나머지는 격리·가독성·mock 적절성 모두 양호하며 회귀 위험은 낮다.

## 위험도

MEDIUM
