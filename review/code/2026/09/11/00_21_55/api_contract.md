# API 계약(API Contract) 리뷰 — `impl-chat-channel-patch-token` (3라운드, `83d5f3f94` 기준)

## 컨텍스트

본 라운드는 직전 두 라운드(`review/code/2026/09/10/23_21_57`, `review/code/2026/09/10/23_55_23`)가
각각 CRITICAL 1건(R-CC-10 우회)·CRITICAL 1건(`inboundSigningRef` PATCH 소실 → fail-open)을
잡아 닫은 뒤, 2라운드의 WARNING 6건(#2 user-guide 오기·#3 `details.field` 측정 범위·#4 `mode`
판별자 타입 미결속·#5 `null` 케이스 4조합 누락 등) 을 조치한 커밋(`83d5f3f94`) 위에서 도는
freshness 재검증이다. 실제 코드(`chat-channel-config.dto.ts` · `update-trigger.dto.ts` ·
`triggers.controller.ts` · `triggers.service.ts`)를 `Read` 로 직접 열어 대조했고, `git log`/
`git diff 83d5f3f94 HEAD --stat` 로 워킹트리가 그 커밋과 동일함을 확인했다(diff 없음).

## 발견사항

이번 라운드에서 코드가 새로 도입한 API 계약 결함은 없다. 직전 라운드 WARNING 4건(#2~#5)의
수정 결과를 코드로 직접 대조한 결과는 다음과 같다.

- 컨트롤러 `@ApiBadRequestResponse`(`codebase/backend/src/modules/triggers/triggers.controller.ts`
  `update()` 데코레이터 블록)가 3가지 400 사유(비밀 필드 / 최초 setup / provider 전환)와, 비밀
  필드 사유의 flat vs nested `details.field` 갈림을 서술하고, 그 서술이 실제 코드
  (`triggers.service.ts` `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`, 전역
  `CustomValidationPipe`)와 정확히 일치함을 확인했다. `CustomValidationPipe.flattenErrors`
  는 배열(`ValidationDetail[]`, 중첩 경로)을 만들고, 서비스 가드는 `details: { field }` 단일
  object(flat)를 던진다 — 문서의 두 갈래 서술과 코드가 1:1 대응한다.
- `assertChatChannelInputSafe` 의 오버로드 시그니처(`mode: 'create'` ↔ `ChatChannelConfigDto`,
  `mode: 'update'` ↔ `ChatChannelUpdateConfigDto`)가 실제로 컴파일 타임에 두 DTO 축을 묶고
  있음을 확인했다 — 문자열 판별자만 남아 있던 이전 상태와 달리, 짝이 어긋난 호출은 `tsc` 가
  거부한다.
- `trigger-dto-validation.spec.ts` 의 `[실측]` 테스트 두 개가 "비어있지 않은 값 → nested/배열"
  / "`null`·`''` → flat/단일 object" 두 갈래를 분리해 검증하고 있고, 대상 필드가 `botToken`·
  `inboundSigningPlaintext` 양쪽 다 커버돼 있어 2라운드가 지적한 "한 필드만 쟀다"는 결함이
  재발하지 않았다.
- 프런트엔드 사용자 문서 4파일(`triggers.mdx`/`.en.mdx`, `telegram.mdx`/`.en.mdx`)이 예전
  필드명(`botTokenRef`, 입력 필드였던 적 없음)과 예전 `details.field` 형식(flat)을 버리고
  실제 공개 필드(`botToken`)·실제 응답 형식(`chatChannel.botToken`, 비어있지 않은 값 기준)으로
  갱신됐음을 확인했다. `PROJECT.md` `backend-api-change` 매트릭스가 요구하는 동반 문서 갱신
  대상과 일치한다.

## 확인한 것 — 위반 없음 (2라운드 대비 회귀 없음)

- `ChatChannelUpdateConfigDto`(`chat-channel-config.dto.ts:372-404`)는 여전히
  `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` + `@IsEmpty()`
  재선언 구조를 유지하고, `provider`·`uiMapping`·`languageHints` 등 나머지 필드의 필수/금지
  상태는 부모와 동일 — 회귀 없음.
- 에러 봉투 형식(`code: 'VALIDATION_ERROR'`, 두 형태의 `details`)·HTTP 상태(400)는 이 저장소의
  기존 컨벤션(`spec/5-system/3-error-handling.md §2.1`, 중첩/배열 경로 유지)과 일치한다.
  `provider` 전환 차단·최초 setup 차단도 여전히 같은 파일의 schedule 타입 트리거 필드 제한
  선례(`400 VALIDATION_ERROR`)와 동일한 패턴을 쓴다.
- 응답 strip 로직(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`)은 이번 라운드 diff 범위 밖이며 변경되지
  않았다 — secret ref 가 응답으로 흘러나가는 새 경로는 없다.
- 인증/인가(`@Roles('editor')`)·URL 설계(`PATCH /api/triggers/:id`, 버전 접두사 없는 기존 패턴
  유지)·페이지네이션은 이번 diff 로 변경되지 않았다.
- `CreateTriggerDto`(생성 경로)는 건드리지 않아 `botToken` 필수·`inboundSigningPlaintext`
  provider 분기가 무회귀로 유지된다.

## 아직 남아 있는 것 — 이전 라운드부터 이어지는 INFO (비차단, 신규 아님)

- **[INFO]** `ChatChannelUpdateConfigDto` 의 금지 필드 두 개(`botToken`·
  `inboundSigningPlaintext`)가 여전히 `writeOnly: true` 로 선언돼 있다 (`chat-channel-config.dto.ts:381`,
  `:396`). OpenAPI 코드젠 관점에서 `writeOnly` 는 "요청에는 넣을 수 있는 값"이라는 신호를 주는데,
  이 서브클래스에서는 두 필드가 "보내면 100% 400" 인 금지 필드다. description 산문("(PATCH
  금지)")은 있지만 스키마 필드 자체(`writeOnly`, `type: string`)는 여전히 그 신호를 안 준다.
  2라운드 api_contract 가 이미 지적했고, 조치하지 않는 것으로 확인·유지된 상태다 — 새로
  차단할 사유는 아니다.
  - 제안(유지): SDK 코드젠 클라이언트를 지원할 계획이 생기면 `writeOnly` 대신/추가로
    "채우면 안 됨" 의도에 더 가까운 마커를 검토.
- **[INFO]** 1라운드가 지적한 "PATCH 계약의 의도된 breaking change(botToken/inboundSigningPlaintext
  를 실은 PATCH 가 이제 항상 400)"에 대해, 사용자 문서(mdx)는 이번 라운드에서 갱신됐지만
  별도 CHANGELOG 항목은 없다(`CHANGELOG.md` 최신 항목은 이번 PR 과 무관한 deps 감사 건).
  알려진 유일한 소비자(`ChatChannelCard`)는 영향받지 않으므로 차단 사유는 아니지만, 내부
  API 를 호출하는 운영 스크립트 등 미확인 클라이언트가 있다면 조용히 깨질 수 있다는 점은
  1라운드부터 이어지는 참고사항으로 재기록한다.

## 요약

3라운드 시점 코드(`83d5f3f94`, 워킹트리와 diff 없음 확인)는 1·2라운드가 판정한 CRITICAL 2건과
WARNING 6건 중 API 계약에 해당하는 항목(컨트롤러 Swagger 미반영·`mode` 판별자 타입 미결속·
`details.field` 측정 범위 오류·사용자 문서 오기)이 모두 실제 코드·테스트·문서로 정합하게
반영된 상태다. 코드를 직접 열어 대조한 결과 새로 도입된 API 계약 결함은 없고, 회귀도 없다.
남은 항목은 전부 이전 라운드부터 이어지는 INFO 2건(`writeOnly` 마커의 코드젠 신호 불일치,
breaking change 의 CHANGELOG 미기재)이며 둘 다 비차단으로 이미 검토·유지가 결정된 사안이다.

## 위험도

LOW
