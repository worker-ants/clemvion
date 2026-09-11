# 테스트(Testing) 리뷰 — chat-channel-input-rules 추출 후속 (신규 단위 테스트 반영)

## 검토 범위 및 방법

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 12 tests)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (T1 순수 함수 6개)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (호출부 `this.X` → import 함수, 순수 치환)
- `plan/in-progress/impl-chat-channel-binder.md`, `spec-draft-nullable-notation-followups.md`,
  `review/code/2026/09/11/15_31_54/**` — plan/이전 라운드 산출물. 코드 변경이 아니므로 테스트 관점
  발견사항 없음(단, 이전 라운드 `testing.md` MEDIUM 지적이 이번 라운드에서 어떻게 처리됐는지는
  회귀 검증의 근거로 참조).

저장소 파일은 수정하지 않았다 — `Read`/`grep`/`git diff`/`npx jest`(읽기 전용 실행)만 사용했고
`git status --short` 로 리뷰 종료 시점에 untracked 산출물(`review/code/2026/09/11/15_57_42/`) 외
변경이 없음을 확인했다.

## 사실관계 실측 (판단 근거)

- `npx jest chat-channel-input-rules.spec.ts` 실행 → **12 passed, 0 failed** (GREEN, 실측).
- `git diff <이전 커밋> <현재 커밋> --numstat -- '*.spec.ts'` → 기존 `triggers.service.spec.ts` 는
  diff 0줄(무편집), 신규 `chat-channel-input-rules.spec.ts` 만 +185. 이전 라운드가 "순수 이동"이라고
  주장한 것과 정확히 일치한다.
- `npx jest chat-channel-input-rules.spec.ts --coverage` 로 신규 테스트 단독의 **실제 커버리지**를
  측정 — `chat-channel-input-rules.ts`: Stmts 82.69% / Branch 70.45% / Funcs 100% / Lines 84.31%,
  **미달 라인: `123-124, 149-150, 245, 251-254, 280`**. 이 5개 구간을 소스와 대조하면:
  - `123-124` → `assertChatChannelInputSafe(chatChannel, 'update')` 의 `mode === 'update'` 분기
    (`assertPatchCarriesNoSecrets` 위임 + `return`). **공개 진입점을 통한 PATCH 디스패치 경로가
    테스트에서 한 번도 호출되지 않는다** — 새 스펙 파일에 `'update'` 리터럴이 인자로 등장하는
    자리가 0건임을 `grep`으로도 확인.
  - `149-150` → `assertPatchCarriesNoSecrets` 의 `inboundSigningPlaintext` 차단 분기. 새 테스트는
    이 함수를 `botToken` 케이스로만 직접 호출한다(`chat-channel-input-rules.spec.ts` `it('PATCH 는
    값 필드(botToken)도 거부한다 …')`). 이 함수는 plan 이 "이 표면에서 `#1314` 가 CRITICAL 을
    맞았다"고 명시한 R-CC-21 가드의 절반이라, 두 필드 중 하나만 커버된 상태다.
  - `245` → `assertInboundSigningPlaintextByProvider` 의 telegram **정상 경로**(필드 미입력 시
    조용히 `return`). 텔레그램 테스트는 필드를 항상 채워 넣어(`{ inboundSigningPlaintext:
    'a'.repeat(32) }`) 던지는 분기만 지나고, "정상적인 telegram 생성"(필드 없음 → 통과)은
    미검증이다.
  - `251-254` → slack/discord 공통 "필수 필드 누락" 분기(`typeof plaintext !== 'string' ||
    plaintext.length === 0`). 새 테스트는 slack 을 **형식 오류**(대문자)와 **정상**(소문자) 두
    값으로만 부르고, **필드 자체가 없는 경우**는 부르지 않는다.
  - `280` → `provider === 'discord'` 형식 검증 분기. **discord 는 새 스펙 파일에 단 한 번도
    등장하지 않는다**(`grep -n discord chat-channel-input-rules.spec.ts` → 캐너리 테스트의
    에러 메시지 문자열 안에서만 등장, `provider: 'discord'` 로 함수를 부르는 테스트는 0건).
- `discord.adapter.ts:94` 를 직접 읽어 캐너리 테스트(`chat-channel-input-rules.spec.ts` 마지막
  `it`)가 인용한 에러 문자열(`'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와
  불일치'`)이 실제 adapter 코드와 **글자 단위로 일치**함을 확인 — 캐너리가 가짜 fixture 가 아니라
  실제 경로를 재현한다.

## 발견사항

- **[WARNING]** `assertPatchCarriesNoSecrets` 의 두 차단 필드 중 `inboundSigningPlaintext` 분기가
  신규 단위 테스트에서 누락됐다 — 이 함수는 R-CC-21/`#1314` CRITICAL 클래스를 직접 막는 가드다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:149-150`
    (`assertPatchCarriesNoSecrets` 의 `inboundSigningPlaintext` 체크) — 대응 테스트는
    `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 의
    `it('PATCH 는 값 필드(botToken)도 거부한다 — create 는 받는다', …)` (botToken 만 검증).
  - 상세: 이 함수는 `botToken`·`inboundSigningPlaintext` 두 필드를 대칭으로 차단한다. 실측
    커버리지에서 149-150 라인(두 번째 `if` 블록 전체)이 미달로 나왔다 — 즉 slack/discord PATCH 로
    `inboundSigningPlaintext` 를 실어 보내는 요청이 실제로 거부되는지는 이 스펙 파일이 전혀
    확인하지 않는다. 이 가드가 뚫리는 형태의 회귀(예: 조건문이 `botToken` 만 남기고
    `inboundSigningPlaintext` 체크가 실수로 삭제되는 뮤테이션)가 나도 이 테스트 파일은 RED 가 되지
    않는다.
  - 제안: 같은 `describe` 블록에 `it('PATCH 는 inboundSigningPlaintext 도 거부한다', () => { … })`
    형태로 대칭 케이스를 추가한다 — `assertPatchCarriesNoSecrets(cfg({ inboundSigningPlaintext:
    'a'.repeat(32) }))` 가 `details: { field: 'inboundSigningPlaintext', code: 'INVALID_FIELD' }`
    를 던지는지 확인.

- **[WARNING]** `assertInboundSigningPlaintextByProvider` 의 discord 분기(hex64 검증)가 신규
  단위 테스트에서 완전히 빠져 있다 — slack(hex32)은 유효/무효 두 값으로 테스트됐지만 discord 는
  단 한 번도 provider 값으로 등장하지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:279-289`
    (`provider === 'discord' && !DISCORD_PUBLIC_KEY_REGEX.test(plaintext)` 분기) — 대응 테스트
    `describe('chat-channel-input-rules — provider 분기 (생성 전용)')` 안에 discord 케이스 없음.
  - 상세: 실측 커버리지에서 `280`(discord 분기의 throw 문)이 미달로 확인됐다. slack 과 discord 는
    같은 함수 안에서 서로 다른 정규식(`SLACK_SIGNING_SECRET_REGEX` vs
    `DISCORD_PUBLIC_KEY_REGEX`)을 쓰는 **서로 다른 분기**라, slack 이 통과한다고 discord 분기가
    안전하다는 보장이 없다 — 예를 들어 두 정규식 참조가 실수로 뒤바뀌는 뮤테이션(discord 자리에
    `SLACK_SIGNING_SECRET_REGEX` 를 쓰는)이 들어와도 이 테스트 스위트는 조용히 GREEN 이다.
  - 제안: `it('discord 는 hex64 를 요구한다', …)` 를 slack 테스트와 대칭으로 추가한다 — 유효
    (`'a'.repeat(64)`)·무효(대문자 또는 길이 부족) 두 값, 그리고 아래 항목의 "필드 누락" 케이스도
    provider 를 슬랙/디스코드 둘 다로 파라미터화(`it.each`)하면 한 번에 닫을 수 있다.

- **[INFO]** slack/discord 공통 "inboundSigningPlaintext 필드 자체가 없음" 분기(필수 위반, 형식
  위반과는 다른 에러 메시지)가 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:249-262`
    (`typeof plaintext !== 'string' || plaintext.length === 0` → `"${label} 가 필요합니다"` 메시지)
  - 상세: 실측 커버리지 미달 구간 `251-254` 가 이 분기다. 현재 테스트는 "형식이 틀린 값"(대문자)과
    "정상 값"만 다루므로, "아예 안 보냄"(예: PATCH 로 다른 필드만 바꾸다가 실수로 생성 경로를 타는
    경우)의 에러 메시지가 다르게 나오는지 확인할 방법이 없다. `assertInboundSigningPlaintextByProvider`
    가 두 가지 다른 에러를 내도록 설계된 이유(형식 오류 vs 필수 누락, label 문자열 분기)가 테스트
    로 고정돼 있지 않아 label 조건(`provider === 'slack' ? … : …`)이 틀려도 안 잡힌다.
  - 제안: `it.each([['slack', 'Slack signing secret'], ['discord', 'Discord application public
    key']])` 형태로 `cfg({ provider, inboundSigningPlaintext: undefined })` 를 호출해
    `message` 에 해당 label 이 포함되는지 확인.

- **[INFO]** `assertChatChannelInputSafe` 의 `mode === 'update'` 디스패치 분기가 공개 진입점을
  통해서는 한 번도 실행되지 않는다 — `assertPatchCarriesNoSecrets` 는 직접 호출로만 검증됐다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:118-125`
    (`if (mode === 'update') { assertPatchCarriesNoSecrets(chatChannel); return; }`)
  - 상세: 실측 커버리지 미달 구간 `123-124`. `triggers.service.ts` 가 실제로 부르는 형태는
    `assertChatChannelInputSafe(chatChannel, 'update')` 인데(예: `update()` 메서드), 새 스펙
    파일은 이 조합을 한 번도 재현하지 않는다 — `assertPatchCarriesNoSecrets` 단독 호출은 그
    함수 자체의 정확성은 보여주지만, "`assertChatChannelInputSafe` 가 `'update'` 모드일 때 실제로
    그 함수에 위임하고, provider 필수 검증(`assertInboundSigningPlaintextByProvider`)으로
    새지 않는다"는 **디스패치 배선**은 별개의 주장이라 별도 테스트가 필요하다. 이 파일 docstring
    (`:79-82`)이 "오버로드로 mode 와 DTO 타입을 컴파일 타임에 묶는 것"을 보안 결함 재발 방지의
    핵심으로 명시하는 만큼, 그 배선 자체를 공개 API 경유로 한 번은 통과시켜 두는 편이 다음
    리팩터에서 이 분기가 삭제되거나 순서가 바뀌는 회귀를 잡는다.
  - 제안: `assertChatChannelInputSafe(cfg({ inboundSigningPlaintext: 'a'.repeat(32) }) as unknown as
    ChatChannelUpdateConfigDto, 'update')` 처럼 캐스팅해 호출하고, `assertPatchCarriesNoSecrets`
    호출과 동일한 에러가 나는지 + `assertInboundSigningPlaintextByProvider` 쪽 에러(형식 다름)가
    나지 **않는지**를 함께 단언하는 테스트 1개를 추가한다.

- **[INFO]** `assertChatChannelAlreadySetUp` 의 "정상 통과"(예외를 던지지 않는) 경로가 테스트되지
  않는다 — 현재 두 테스트 모두 throw 하는 케이스만 다룬다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:168-193`
    — 대응 테스트 `describe('chat-channel-input-rules — 정화·존재성')` 의
    `it('chatChannel 이 없는 트리거에 …')`, `it('provider 전환도 거부한다')` 둘 다 throw 단언만.
  - 상세: 함수 커버리지는 100%(Funcs 열)로 나오지만 이는 "함수가 호출됐다"만 보장할 뿐 "정상
    입력에서 조용히 반환한다"는 계약은 값으로 확인된 적이 없다 — 예를 들어
    `if (incoming.provider && incoming.provider !== current.provider)` 를 `if (true)` 로 바꾸는
    뮤테이션(모든 PATCH 를 provider 불일치로 오판)이 들어와도, 이 테스트 스위트에 "같은 provider
    로 PATCH 하면 통과해야 한다"는 대조군이 없어 못 잡는다.
  - 제안: `it('provider 가 같으면 통과한다', () => { expect(thrown(() =>
    assertChatChannelAlreadySetUp(existing, cfg({ provider: 'telegram' })))).toBeNull(); })` 류의
    양성 케이스를 추가한다.

- **[INFO]** `chatChannel === undefined` 조기 반환(두 진입점 모두가 실제로 호출하는 형태 —
  `chatChannel` 이 옵셔널이라 PATCH 바디에 그 키가 아예 없을 때 자연히 발생)이 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:95`
    (`if (!chatChannel) return;`)
  - 상세: `triggers.service.ts` 의 실제 호출부(`assertChatChannelInputSafe(chatChannel, 'create')`
    등)에서 `chatChannel` 은 요청 바디에 그 필드가 없으면 `undefined` 로 넘어온다 — 즉 이건 흔한
    실사용 경로이지 인위적인 edge case 가 아니다. 새 스펙 파일은 항상 `cfg(...)` 로 채워진 객체만
    넘기므로 이 분기가 한 번도 실행되지 않는다(다만 이 라인은 위 jest coverage 리포트의 미달
    목록에는 없다 — 단순 `return` 문이라 statement 자체는 다른 호출로 카운트됐을 수 있으나, 이
    조건의 참(true) 분기가 실제로 타겼는지는 별도 확인이 필요하다).
  - 제안: `expect(thrown(() => assertChatChannelInputSafe(undefined, 'create'))).toBeNull()` 한
    줄로 저비용에 닫을 수 있다.

## 회귀·품질 관점 — 긍정적으로 확인된 것

- 이전 라운드(`review/code/2026/09/11/15_31_54/testing.md`, MEDIUM)가 지적한 "신규 순수 함수
  모듈에 전용 단위 테스트가 없다"·"`translateSetupChannelError` 테스트 0건"이 이번 커밋에서
  **실제로 해소**됐다 — `translateSetupChannelError` 는 401/403 케이스, fallback 케이스, 그리고
  discord verify_key 불일치가 **의도(400)와 다르게 502 로 떨어지는 현재 동작을 캐너리로 고정**하는
  세 번째 테스트까지 갖췄다. 캐너리 주석이 "고치면 이 테스트가 RED 가 된다"를 명시해 향후 수정
  의도를 diff 로 드러내는 설계는 바람직하다.
- `thrown()` 헬퍼로 "성공 시 `null`, 실패 시 에러 페이로드"를 통일해 매 테스트에서 try/catch
  보일러플레이트가 없다 — 가독성이 좋다.
- PATCH 대조군 테스트(`'PATCH 는 값 필드(botToken)도 거부한다 — create 는 받는다'`)의 주석이
  "왜 slack 을 provider 로 골랐는가"(telegram 을 쓰면 다른 이유로 던져 대조군이 흡수된다)를 명시적
  으로 설명한다 — vacuous test 를 피하려는 의식적 설계가 코드에 남아 있어 다음 사람이 provider 를
  실수로 telegram 으로 바꾸는 회귀를 막는다.
- mock 을 전혀 쓰지 않는다 — 이동된 6개 함수가 전부 외부 협력자 의존 0인 순수 함수이므로 이는
  적절한 선택이다(실제 동작과의 괴리 없음).
- 테스트 간 공유 가변 상태가 없고(`cfg()` 가 매번 새 객체 리턴), 실행 순서 의존도 없다 — 격리 양호.
- `npx jest chat-channel-input-rules.spec.ts` 실측 12/12 GREEN, 기존 `triggers.service.spec.ts` 는
  diff 0줄이라 회귀 없음이 재확인된다.

## 요약

신규 `chat-channel-input-rules.spec.ts` 는 이전 라운드가 MEDIUM 으로 지적한 "전용 단위 테스트
부재"와 "`translateSetupChannelError` 미검증"을 실제로 닫았고, 회귀 안전성(기존 테스트 diff 0줄 +
재실행 GREEN)도 실측으로 재확인된다. 다만 실제 `--coverage` 측정으로 5개 미달 구간
(`123-124, 149-150, 245, 251-254, 280`)이 잡히는데, 그중 두 곳은 이 PR 이 명시적으로 "R-CC-21 /
`#1314` CRITICAL 클래스를 막는 가드"라고 부르는 함수의 절반(`assertPatchCarriesNoSecrets` 의
`inboundSigningPlaintext` 분기)과 provider 분기 중 한 갈래 전체(discord, `assertInboundSigning
PlaintextByProvider`)다 — slack 이 통과한다고 discord 가 안전하다는 보장이 없는 서로 다른 코드
경로라 실질적 커버리지 공백이다. 로직 자체는 순수 이동이라 회귀 위험은 낮지만, "테스트 용이성을
확보하려고 뽑아낸 파일인데 정작 새 테스트가 그 표면의 절반만 덮는다"는 점에서 이번 라운드의 목적을
완전히 달성하지는 못했다.

## 위험도

MEDIUM
