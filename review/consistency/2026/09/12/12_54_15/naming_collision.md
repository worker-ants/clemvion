# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep, `plan/in-progress/impl-setup-error-code.md`)

## 조사 방법

target 은 `spec/5-system/` 전체이나, 이번 구현 턴(`impl-setup-error-code-ddd078`, `spec_impact: none`)이
실제로 건드리는 식별자는 이미 이전 planner 턴(`#1323`)이 `2-api-convention.md §6` ·
`15-chat-channel.md §5.4` · `chat-channel-adapter.md §1.1.2`에 확정해 둔 것들이다. 프롬프트에
번들된 두 파일(`2-api-convention.md` 전문, `15-chat-channel.md` 전문)과 plan 본문을 읽고,
plan 이 도입하는 식별자(`BOT_TOKEN_INVALID` · `CHAT_CHANNEL_SETUP_FAILED` · `translateSetupChannelError`
· `credentialRejected` · `BadGatewayException`/`@ApiBadGatewayResponse`)를 실제 저장소
전체(`spec/` · `codebase/` · `plan/`)에서 grep 해 기존 사용처와 의미가 겹치는지 대조했다.

## 발견사항

- **[INFO]** `code` 프로퍼티 다의성 — convention 표가 "세 뜻"이라 적지만 실측하면 **네 번째 뜻**이 이미 같은 호출 경로에 존재한다
  - target 신규 식별자: `Error.code = 'BOT_TOKEN_INVALID'` (adapter 가 새로 throw 하는 `Error` 의 프로퍼티, `chat-channel-adapter.md §1.1.2`)
  - 기존 사용처: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:95` (`const code = (cause as { code?: unknown }).code;`) 및 그 테스트 `telegram-client.spec.ts:12` (`code: 'ENOTFOUND'`) — Node/undici 의 **네트워크 시스템 에러**가 `Error`(또는 그 `cause`)에 붙이는 표준 `.code` (`ENOTFOUND`/`ECONNREFUSED`/`ECONNRESET` 등, `NodeJS.ErrnoException` 관례)
  - 상세: `spec/conventions/chat-channel-adapter.md:165-173` 의 표는 `code` 의 뜻을 (1) 본 절의 신규 `Error.code`, (2) `event.error.code`(EIA), (3) `app.code`/`res.code`(Discord 원본 응답, 숫자) 셋으로만 열거한다. 그런데 같은 setupChannel 호출 스택 안에 **네 번째 소유자**가 이미 있다 — Node 런타임/undici 가 네트워크 실패에 붙이는 `.code`(문자열, `E`-접두 시스템 에러 코드)다. `translateSetupChannelError`/`credentialRejected` 판별이 **`err.code === 'BOT_TOKEN_INVALID'` 처럼 정확히 값 비교**하면 `ECONNRESET` 같은 시스템 코드와 절대 부딪히지 않아 실질 위험은 낮다(plan 의 캐너리 `ECONNRESET → 502` 도 이 전제 위에 있다). 다만 표가 "세 뜻"이라고 세어 두면, 다음 사람이 `if (err.code)` 식의 **truthy 판별**로 확장했을 때(예: fallback 을 없애며 `code` 존재만으로 분류) 시스템 에러 코드가 조용히 잘못된 분류로 새어 들어갈 위험이 있고, 그 실수를 표가 미리 경고하지 못한다.
  - 제안: `chat-channel-adapter.md §1.1.2` 의 다의성 표에 "네트워크/시스템 `Error.code`(`ENOTFOUND` 등, Node 표준)" 행을 추가하고, "판별은 항상 화이트리스트 값과의 **정확한 문자열 일치**이지 존재 여부가 아니다" 를 명시하면 이 표가 실제로 커버하는 충돌 후보를 완전하게 만든다. 이번 구현(`credentialRejected` 헬퍼)이 정확 일치로 짜여 있다면 코드 변경은 불필요 — 문서 갱신만으로 충분.

- **[INFO]** `credentialRejected` — 저장소 전체에서 0건, 신규 식별자이나 인접 도메인에 비슷한 성격의 다른 명명 패턴이 이미 있다
  - target 신규 식별자: `credentialRejected(message)` (plan §b, `chat-channel/types.ts` 에 신설 예정)
  - 기존 사용처: 직접 충돌은 없음(`grep -rn credentialRejected` 전수 0건, plan 문서 자신 제외). 다만 `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:211` 의 `Cafe24IncompleteCredentialsError extends Error`, `makeshop-api.client.ts:115` 의 `MakeshopIncompleteCredentialsError extends Error`, `modules/integrations/integrations.service.ts:376` 의 `IntegrationCredentialsUnreadableError extends BadRequestException` 이 이미 "자격 증명 문제를 Error 서브클래스로 표현" 하는 확립된 관례다
  - 상세: 실제 이름 충돌은 없다(파일·모듈이 다르고 export 심볼도 다르다). 다만 plan §b 는 서브클래스 대신 **프로퍼티 부착 팩토리 함수**를 의도적으로 선택했고(의존 결합 회피가 근거), 이 저장소의 기존 "credential 실패" 관례는 전부 **PascalCase Error 서브클래스**다. 두 관례가 같은 개념(자격 증명 거부)을 다른 형태로 표현하게 되어, 향후 검색("Credential 관련 에러가 어떻게 표현되나")에서 한쪽만 걸리기 쉽다.
  - 제안: 별도 조치 불필요(이미 plan §b 가 서브클래스를 쓰지 않는 이유를 문서화했고, `chat-channel/` 스코프 안에서는 이름 충돌이 없다). 다만 헬퍼에 남기는 JSDoc 에 "이 저장소의 cafe24/makeshop 패턴과 달리 서브클래스가 아니라 프로퍼티다" 한 줄을 적으면 향후 재발견 시 재질문을 막는다.

## 비대상 확인 (grep 0건 — 충돌 없음)

- `BOT_TOKEN_INVALID` · `CHAT_CHANNEL_SETUP_FAILED`: 저장소 전역(spec/docs/i18n/plan/codebase) grep 전수 확인 결과 모든 등장이 **같은 의미**(chat-channel setupChannel 실패 분류)로만 쓰인다. 두 문자열 모두 `_SETUP_FAILED`/`_TOKEN_INVALID` 접미 패턴으로 확장 grep 해도 다른 도메인의 동명 코드 없음 — ID 충돌 없음. (참고: 두 코드 모두 `codebase/backend/src/nodes/core/error-codes.ts` 의 중앙 `ErrorCode` enum에는 없고 리터럴 문자열로 직접 쓰인다 — 이는 §5.3 이 이미 규정한 "도메인 특화 top-level code" 패턴과 일치하며 collision 관점의 문제는 아니다.)
- `BadGatewayException`: `codebase/backend/src` 전수 grep 0건 — plan 이 스스로 적은 "0건"이 실측과 일치한다. `@nestjs/common` 표준 클래스를 로컬에서 재정의/shadow 하는 곳 없음.
- `@ApiBadGatewayResponse`: `@nestjs/swagger` 패키지가 실제로 export 하는 표준 데코레이터(`node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.d.ts`)이고, `triggers.controller.ts` 의 기존 import 블록에 동명 로컬 정의 없음 — 충돌 없음.
- `discord.adapter.ts` 의 기존 `'code' in app` / `'code' in res` (Discord 원본 응답 숫자 필드)와 신규 `Error.code`(문자열)의 충돌은 이미 plan §d 및 convention 표가 명시적으로 인지·구분해 뒀다 — 재발 위험 낮음, 별도 지적 불필요.
- 새 API endpoint · 파일 경로 · env var · 이벤트/큐 이름은 이번 턴에서 신설되지 않는다(spec_impact: none, 컨트롤러에 데코레이터만 추가) — 해당 관점은 충돌 후보 자체가 없다.

## 요약

이번 구현 턴이 실제로 새로 만드는 식별자는 `credentialRejected` 헬퍼 하나뿐이고, 저장소 전수 검색상
이름 충돌은 없다. `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`/`translateSetupChannelError`는
이미 존재하는 식별자의 **동작 정정**(400→402/502 재분류, 판별 축 message→code)이라 신규 ID 충돌
검토 대상이 아니다. 유일하게 실질적인 관찰은 `code` 프로퍼티가 이 코드베이스에서 이미 세 가지
뜻으로 오버로드돼 있고(convention 문서가 스스로 표로 인정) 여기에 Node 네트워크 시스템 에러의
`.code` 라는 **문서화되지 않은 네 번째 뜻**이 실제로 같은 호출 스택에 존재한다는 점이다 — 이번
구현이 정확 일치 판별로 설계돼 있어 당장의 위험은 낮으나, disambiguation 표를 완전하게 갱신해
두는 편이 향후 truthy 판별로의 변형 실수를 막는다. CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 위험도

LOW
