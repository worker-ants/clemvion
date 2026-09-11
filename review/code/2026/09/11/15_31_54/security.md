# 보안(Security) 코드 리뷰

## 대상 요약
`codebase/backend/src/modules/triggers/triggers.service.ts` 에 있던 chat-channel 입력
검증·정화 로직(6개 함수: `assertChatChannelInputSafe`(오버로드 2) · `assertPatchCarriesNoSecrets` ·
`assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `assertInboundSigningPlaintextByProvider` ·
`translateSetupChannelError`)을 신규 파일 `chat-channel-input-rules.ts` 로 **순수 이동**한 리팩터.
plan(`plan/in-progress/impl-chat-channel-binder.md`)의 주장대로 `git diff --stat` 로 확인한 결과
테스트 파일 diff 는 **0줄**이고(`codebase/backend/src/modules/triggers/` 하위 변경 파일은 신규
`chat-channel-input-rules.ts` 와 `triggers.service.ts` 두 개뿐), 이동된 6개 함수의 본문은 원본과
바이트 단위로 동일하다(`this.` 접두사 제거, `private` → `export function` 전환만).

## 검증 절차
- 두 파일의 unified diff 를 라인 단위로 대조해 로직 델타 없음을 확인.
- `triggers.service.ts` 전체(1,585줄)에서 제거된 구 private 메서드에 대한 잔존 참조
  (`this.assertChatChannelInputSafe` 등)를 grep — **0건**, 컴파일 깨짐/누락 호출 없음.
- `setupChatChannel`/`teardownChatChannel`(T2, 이번 PR 범위 아님)이 여전히
  `triggers.service.ts` 에 남아 있고, `#1314` 에서 CRITICAL 로 잡혔던 `inboundSigningRef`
  fail-open 방지 로직(`inboundSigningRefSurvives` 판정, `previousInboundSigningRef` 보존)이
  그대로 보존됨을 라인 500-970 대역에서 확인.
- 신규 모듈 `chat-channel-input-rules.ts` 의 현재 import 자는 `triggers.service.ts` **1곳**뿐임을
  grep 으로 확인(노출 범위 실측).

## 발견사항

- **[INFO]** provider 전용 검증 함수가 클래스 private 메서드에서 module-level export 함수로
  바뀌며 캡슐화가 느슨해짐
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:227` (`assertInboundSigningPlaintextByProvider` 함수 선언, 게이트 `227|`)
  - 상세: 이 함수의 JSDoc(게이트 `214`~`226`)과 호출부 주석(게이트 `126`~`129`)은 "이 함수는
    `mode === 'create'` 인 자리에서만 도달해야 한다"는 불변식을 명시한다. 종전에는 `private`
    이라 `TriggersService` 밖에서 호출할 방법이 없어 이 불변식이 캡슐화로도 보장됐다. 이제는
    exported 함수라 어떤 모듈이든 import 해 update(PATCH) 경로에서 직접 호출할 수 있고, 그 경우
    "PATCH 는 `inboundSigningPlaintext` 금지" 규칙을 우회해 provider-issued 값을 검증 없이(또는
    엉뚱한 필수/형식 검증으로) 통과시킬 수 있다. 다만 실측 결과 현재 이 함수의 import 자는
    `triggers.service.ts` 1곳뿐이라 **오늘 시점에 실제로 악용 가능한 경로는 없다** — 이는
    잠재적 회귀 표면에 대한 관측이다.
  - 제안: 새 호출자가 생길 때 `assertChatChannelInputSafe` 를 거치지 않고
    `assertInboundSigningPlaintextByProvider` 를 직접 호출하지 않도록 코드리뷰 체크리스트나
    ESLint 규칙(예: 모듈 내부 전용 export 관례, 또는 `mode` 인자를 받는 단일 진입점만 노출)으로
    가드하는 것을 고려. 현재는 CRITICAL/WARNING 격이 아니라 참고 수준.

- **[INFO]** `translateSetupChannelError` 가 provider 어댑터 에러 메시지 최대 256자를
  `details.reason` 에 그대로 담아 클라이언트에 반환
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:304`-`317` (게이트 번호 그대로)
  - 상세: 로직 자체는 이번 PR 로 신규 도입된 것이 아니라 `triggers.service.ts` 의 기존 private
    메서드를 그대로 옮긴 것이다(원본과 완전 동일). Slack/Discord/Telegram adapter 가 던지는
    `Error.message` 를 그대로 잘라 응답 `details.reason` 에 노출하는데, adapter 구현이 향후
    바뀌어 원본 HTTP 응답 본문·헤더 등을 message 에 포함시키면 이 경로로 외부에 유출될 위험이
    있다. 지금은 "Slack auth.test failed: 401" 류의 정형화된 문자열만 가정하고 있어 즉각적인
    위험은 낮음.
  - 제안: adapter 에러 메시지 포맷이 통제된 화이트리스트(상태 코드/일반 문구)임을 타입이나
    전용 에러 클래스로 강제하면, 향후 adapter 변경 시 시크릿·원본 응답 유출을 구조적으로
    차단할 수 있다. 이번 PR 범위(순수 이동)는 아니므로 별도 항목으로 트래킹 권장.

## 점검했으나 문제 없음 (참고)

- **비밀 필드 차단**: `botTokenRef`/`inboundSigningRef`/`inboundSigning`(서버 발급 자료) 를
  외부 입력에서 거부하는 3중 검사, PATCH 에서 `botToken`/`inboundSigningPlaintext` 를 추가로
  차단하는 `assertPatchCarriesNoSecrets` — 이동 전후 로직 100% 동일.
- **plaintext DB 잔류 차단**: `stripChatChannelPlaintext` 가 `mergeExternalConfig` 호출 전에
  `botToken`/`inboundSigningPlaintext` 를 제거해 JSONB 저장 전 평문 노출 창을 없애는 로직도
  이동 전후 동일.
- **형식 검증(정규식)**: `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 는
  `@workflow/chat-channel-validation` 공유 패키지에서 그대로 import — 이번 diff 에서 정규식
  자체는 변경되지 않음(패키지 자체는 이번 리뷰 대상 diff 에 포함되지 않음).
  대소문자(lowercase hex) 강제로 provider 측 HMAC/ed25519 검증 실패를 사전 차단하는 방어도 유지.
  ReDoS 관점에서 두 정규식은 이번 diff 에서 변경되지 않았으므로 신규 위험 없음.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:267`, `279`
- **provider 전환 차단**: `assertChatChannelAlreadySetUp` 의 provider mismatch 거부(다른
  provider 의 토큰이 새 adapter 로 넘어가는 것을 막음) — 로직 동일.
- **에러 코드 노출 표면**: 모든 에러가 `BadRequestException` + `VALIDATION_ERROR` 구조화 응답만
  사용, 스택트레이스·내부 경로 노출 없음.
- **하드코딩된 시크릿·인증정보**: 신규/변경 파일에 하드코딩된 API 키·토큰·비밀번호 없음.
- **인젝션(SQL/커맨드/경로탐색)**: 이 diff 는 문자열 비교·구조분해·정규식 매칭만 수행 — DB
  쿼리·쉘 명령·파일 경로 조합 없음.
- **인가**: 이 파일은 `workspaceId`/권한 검사를 다루지 않는 순수 입력 검증 계층이며, 호출부
  (`triggers.service.ts` `create`/`update`)의 workspace 스코프 검사는 이번 diff 로 변경되지
  않음(`findById(id, workspaceId)` 등 그대로).
- **테스트 회귀 증거**: 이동 대상 6개 함수에 대해 기존 테스트가 `createTestingModule` 등록
  변경 없이 그대로 통과한다는 것이 diff 로 확인됨(0줄 테스트 변경) — 동작 보존의 강한 방증.

## 요약
이 PR 은 `TriggersService` 의 chat-channel 입력 검증 로직 6개 함수를 신규 순수 함수 모듈로
옮기는 리팩터로, 라인 단위 대조 결과 로직 변경이 전혀 없는 **기계적 이동**이다. 비밀 필드 차단
(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/PATCH 의 `botToken`/`inboundSigningPlaintext`),
plaintext DB 잔류 방지, provider 형식 검증, provider 전환 차단 등 기존 보안 불변식이 모두
그대로 보존되어 있고, `#1314` 에서 CRITICAL 이었던 `inboundSigningRef` fail-open 방지 로직은
이번 PR 범위 밖(T2, `setupChatChannel`)으로 손대지 않았음을 확인했다. 새로 발견된 보안
결함은 없으며, 함수가 클래스 private → module export 로 바뀌며 캡슐화가 느슨해진 점과 기존
에러 메시지 슬라이스 노출 관행을 INFO 로만 남긴다(둘 다 오늘 시점 실제 악용 경로 없음).

## 위험도
NONE
