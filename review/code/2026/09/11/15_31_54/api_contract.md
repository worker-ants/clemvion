# API 계약(API Contract) 리뷰

## 검증 방법 (요약)

이 커밋(`2ae81077c`)은 `TriggersService` 안의 chat-channel 입력 검증 함수 6개
(`assertChatChannelInputSafe`(+overload 2) · `assertPatchCarriesNoSecrets` ·
`assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
`assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를 신규 파일
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 **그대로 이동**하고,
`triggers.service.ts` 의 호출부를 `this.foo(...)` → `foo(...)` (import) 로 바꾼 것이 전부다.

저장소 트리에는 아무 것도 쓰지 않고 읽기 전용 명령으로만 확인했다:

- `git diff HEAD~1 --stat` → 변경 파일은 `chat-channel-input-rules.ts`(신규) ·
  `triggers.service.ts` · `plan/in-progress/impl-chat-channel-binder.md` ·
  `review/consistency/2026/09/11/14_59_33/**` (11개) 뿐. **DTO 파일
  (`dto/chat-channel-config.dto.ts`) · 컨트롤러(`triggers.controller.ts`) · 라우트 정의는
  이 diff 에 전혀 포함되지 않았다.**
- `grep -n "this\.assert...\|this\.strip...\|this\.translate..." triggers.service.ts` → 이동
  전 이름으로 남은 호출 0건 (모든 호출부가 새 import 로 일괄 치환됨).
- `git diff HEAD~1 --stat -- ...triggers.service.spec.ts ...triggers.controller.spec.ts
  ...triggers.web-chat.spec.ts` → **출력 없음, 즉 테스트 파일 diff 0줄.** plan 문서가 주장하는
  "순수 이동의 증거"가 실측으로 확인된다.
- 이동된 함수 6개의 본문(오버로드 시그니처, `BadRequestException` 페이로드의 `code` /
  `message` / `details.field` / `details.code` 구성, provider 분기, 정규식 검증 순서)을
  구 위치(diff 의 `-` 블록)와 신 위치(`+` 블록/전체 파일 컨텍스트)에서 줄 단위로 대조 —
  텍스트가 동일하다(주석 포함).

## 발견사항

이 diff 범위 안에서 API 계약 관점의 **행위 변화는 관측되지 않았다.**

- **[INFO]** 순수 이동이 신뢰할 수 있게 검증됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규 파일 전체) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:42-45,404,414,487,495,510,912,1291`
  - 상세: 에러 봉투 형태(`{code: 'VALIDATION_ERROR', message, details: {field, code}}`), HTTP
    상태 코드(400 / `BOT_TOKEN_INVALID` 400 · `CHAT_CHANNEL_SETUP_FAILED` 502), provider별
    (`telegram`/`slack`/`discord`) 필수·금지 분기, `mode==='create'|'update'` 오버로드 쌍 바인딩이
    모두 이동 전후 동일하다. 이 파일이 다루는 요청 검증(관점 5)·에러 응답 형식(관점 4)은
    `create`(POST `/api/triggers`) · `update`(PATCH `/api/triggers/:id`) 두 진입점에서 지금까지와
    같은 응답을 낸다.
  - 제안: 없음 — 후속 라운드에서 이 파일을 다시 손댈 경우, `assertInboundSigningPlaintextByProvider`
    는 이제 `export` 라 `triggers/` 밖에서도 import 가능해졌다(구조 관점의 캡슐화 문제일 뿐 계약
    변화는 아님 — architecture reviewer 영역).

- **[INFO]** `ChatChannelInput` / `ChatChannelInputMode` 타입이 module-private → `export` 로 승격
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:40,54`
  - 상세: TypeScript 컴파일 타임 타입일 뿐 와이어 스키마(요청/응답 JSON)에는 영향이 없다. DTO
    (`ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`)의 `class-validator` 데코레이터는 이
    diff 에서 전혀 건드리지 않았다(위 `git diff --stat` 로 확인, dto 파일이 changeset 에 없음).
  - 제안: 계약 관점에서는 조치 불필요.

점검 관점 1~8 (하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL/경로 설계·페이지네이션·인증/인가)
을 개별 대조한 결과, 이번 diff 로 인해 새로 생기거나 깨지는 것은 없다:

1. 하위 호환성 — 엔드포인트·요청/응답 스키마 무변경. Breaking change 없음.
2. 버전 관리 — 해당 없음(버전 표면 미접촉).
3. 응답 형식 — `BadRequestException` 페이로드 구조 동일 유지.
4. 에러 응답 — `code`/`message`/`details.field`/`details.code` 조합·HTTP 상태 코드 동일.
5. 요청 검증 — 6개 검증 함수의 판정 로직(순서·조건·정규식) 바이트 단위로 동일.
6. URL/경로 설계 — 컨트롤러·라우트 파일이 changeset 밖.
7. 페이지네이션 — 무관 영역.
8. 인증/인가 — 컨트롤러 가드 무변경.

## 요약

이번 diff 는 `TriggersService` 에 있던 chat-channel 입력 검증 6개 함수를 신규 순수 함수 모듈
(`chat-channel-input-rules.ts`)로 옮기고 호출부를 메서드 호출에서 함수 호출로 바꾼 **동작 보존
리팩터**다. `git diff --stat` 으로 DTO·컨트롤러·라우트가 changeset 에 없음을, 테스트 파일 diff
0줄로 단언 무변경을, 이동된 함수 본문 텍스트 대조로 에러 봉투·검증 로직 무변경을 각각 확인했다.
API 계약(요청 검증, 에러 응답 형식, 하위 호환성, 인증/인가, 라우팅)에 영향을 주는 변경은 없다.

## 위험도

NONE
