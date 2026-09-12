# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 순수 리팩터 자체는 안전하나, 이 PR 이 신규로 추가한 swagger 응답 DTO(`ChatChannelRotateBotTokenDto`)가 기존 `chat-channel-config.dto.ts` 의 동명 클래스 `ChatChannelBotIdentityDto` 와 이름이 충돌해 OpenAPI 스키마 레지스트리가 오염된다 — `documentation`·`api_contract` 두 reviewer 가 독립적으로 CRITICAL 로 지목한 동일 결함이다. forced 화이트리스트(7명) 전원 결과 확보, 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / documentation | 신규 `ChatChannelRotateBotTokenDto` 안에 선언된 `ChatChannelBotIdentityDto` 가 기존 `chat-channel-config.dto.ts:149` 의 동명 클래스와 **이름은 같고 필드 형태(필수/옵셔널, `teamId` 유무)는 다르다**. `@nestjs/swagger` 는 스키마를 클래스 `.name` 문자열로 등록하므로 두 엔드포인트(`chatChannel` 조회/수정, `rotateBotToken`) 중 하나의 OpenAPI 문서가 실제 응답과 어긋난다. pin 된 `@nestjs/swagger@11.4.5` 는 이 상황에서 "Duplicate DTO detected" 경고를 찍고 나중 정의로 조용히 덮어쓰며, 차기 메이저에서는 하드 에러를 예고한다. 저장소 전체에서 유일한 중복이며 이번 diff 가 유일한 발생원(신규 파일이 기존 이름을 재사용). consistency-checker 의 naming-collision 점검은 plan 이 예고한 코드 헬퍼명만 grep 해 이 DTO 클래스명은 대상 밖이라 놓쳤다. | `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:16` vs `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149` | 신규 클래스명을 `ChatChannelRotateBotIdentityDto` 등으로 좁혀 충돌을 없애거나, 두 자리가 실제로 같은 shape 이어야 한다면 기존 클래스를 import 재사용해 정의를 하나로 합친다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | 신규 `ChatChannelBotIdentityDto` 에 Discord 어댑터가 실제로 채우는 `botIdentity.publicKey` 필드가 없어, 문서화된 응답 스키마가 실제 wire 응답(Discord 트리거의 경우)보다 좁다. `TransformInterceptor` 가 클래스 기반 필드 제거 없이 서비스 반환값을 그대로 통과시키므로 실응답에는 `publicKey` 가 실린다(비민감 값이라 보안 문제는 아님). | `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:16-28` (vs `chat-channel/providers/discord/discord.adapter.ts:157-165`) | `ChatChannelBotIdentityDto` 에 `publicKey?: string`(`@ApiPropertyOptional`) 추가, 또는 의도적으로 숨기려면 서비스/컨트롤러에서 명시 제거해 문서-응답을 일치. |
| 2 | documentation | `rotateBotToken` 엔드포인트에 같은 컨트롤러의 다른 8개 메서드(`findAll`/`findOne`/`create`/`update`/`getHistory`/`remove`/`rotateNotificationSecret`/`revokePerTriggerToken`)가 모두 갖는 `@ApiUnauthorizedResponse` 가 빠져 있다. 이 엔드포인트도 `@ApiBearerAuth`+`@Roles('editor')` 하위라 401 이 실제로 발생 가능한데, 이번 PR 이 바로 이 엔드포인트의 swagger 문서화를 "완성"하려던 것이라 목적 자체가 미완결이다. | `codebase/backend/src/modules/triggers/triggers.controller.ts:257-284` | `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가. |
| 3 | testing | 두-층 등가성 설계("`null`/`''` 는 DTO 를 통과하고 서비스 층(`hasField`/`rejectBlockedField`) 가 거부한다")에서 **서비스 층이 실제로 거부한다는 절반**이 어떤 테스트로도 검증되지 않는다. `trigger-dto-validation.spec.ts:848` 은 DTO 가 통과시킨다는 것만 확인하며, `hasField` 의 `typeof value !== 'undefined'` 를 falsy 판별(`!value`)로 바꾸는 뮤턴트가 있어도 이를 잡는 테스트가 없다 — 이번 PR 이 정확히 리팩터링한 함수의 핵심 설계 근거가 미고정 상태로 남았다. | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:70`(`hasField`) / `chat-channel-rejection-messages.const.ts:8-10` | `chat-channel-input-rules.spec.ts` 에 `assertPatchCarriesNoSecrets(cfg({ botToken: null }))` / `inboundSigningPlaintext: null` 케이스 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | `rotateBotToken` 의 `:id` 파라미터만 형제 rotate 계열과 달리 `ParseUUIDPipe` 가 없음(이 PR 이전부터 존재하던 코드, 스코프 밖). | `triggers.controller.ts` `rotateBotToken` 시그니처 | 후속 PR 에서 `ParseUUIDPipe` 정렬. |
| 2 | documentation | `ChatChannelBotIdentityDto.botId` 주석이 "Slack 만 해시" 라고 서술하나 실제로는 Discord 도 동일하게 해시(Telegram 만 네이티브 정수) — 오독 가능하나 동작 영향 없음. | `chat-channel-rotate-bot-token.dto.ts:17` | 주석을 "Slack·Discord 는 해시, Telegram 은 네이티브" 로 정정. |
| 3 | testing | `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard 동작(무시)이 이 파일 자체의 테스트만으로는 검증되지 않고 다른 파일(`trigger-dto-validation.spec.ts`)의 "도달 불가" 증명에 의존. | `chat-channel-input-rules.ts:222` | `provider: undefined` 직접 호출 케이스 추가(선택). |
| 4 | testing | 신규 `ChatChannelRotateBotTokenDto` 에 런타임 shape 계약 테스트(`response-contract` 배선)가 없음 — 저장소 전역 기존 부분 배선 갭(60개 중 4개)과 동일 수준, 이 PR 신규 결함 아님. | `dto/chat-channel-rotate-bot-token.dto.ts`, `triggers.controller.ts:280-292` | 낮은 우선순위, 향후 `response-contract` 확장 턴에 포함. |
| 5 | maintainability | `throwInvalidField` 저수준 헬퍼는 `field: string` 이라 `rejectBlockedField` 경유가 아닌 직접 호출 6곳은 타입 오타 방지 혜택을 못 받음(단, `details.field` 단언 테스트가 있어 오타는 즉시 RED). | `chat-channel-input-rules.ts:56` | 재발 시 리터럴 유니언 타이핑 고려. |
| 6 | requirement / SPEC-DRIFT 아님(이미 추적됨) | `spec/5-system/15-chat-channel.md` §7 파일 트리가 `chat-channel-input-rules.ts` 를 "입력 검증·변환 순수 함수" 로만 서술하나 실제로는 `translateSetupChannelError`(출력측)도 포함 — 이 PR 이전부터 있던 drift, 이미 트래커(`spec-draft-nullable-notation-followups.md`)에 등재됨. | `spec/5-system/15-chat-channel.md:544` | 조치 불요 — 다음 planner 턴에서 §7 문구 갱신. |
| 7 | requirement | `tsc -p tsconfig.json`(풀 모드) 에서 `telegram-message.renderer.spec.ts` 관련 타입 오류 1건 존재하나 이 PR diff 와 무관한 baseline 결함(`run-test.sh` 는 `tsconfig.build.json` 만 검사해 테스트 경로는 애초에 ratchet 대상 아님). | `telegram-message.renderer.spec.ts:10` (본 PR 비대상) | 별도 트래커 등재 대상, 이 PR 병합 차단 사유 아님. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 오히려 필드명 오타 차단 회귀 표면을 줄이는 방향 확인 |
| requirement | NONE | 동작 보존 실측 확인(jest 106+136 테스트, tsc 무오류), spec 정합 확인. §7 drift 는 기추적 사안 |
| scope | NONE | diff 가 plan 의 6개 작업 항목과 1:1 대응, 스코프 확장 없음 |
| side_effect | NONE | 컨트롤러 반환 타입 변경은 실제 서비스 타입과 구조적으로 동일, 호출자 영향 없음 |
| maintainability | LOW | 저수준 헬퍼 타이핑 범위 등 INFO 수준 관찰만 |
| testing | LOW | 두-층 등가성 서비스측 미검증(WARNING) + INFO 2건 |
| documentation | HIGH | DTO 클래스명 충돌(CRITICAL) + `@ApiUnauthorizedResponse` 누락(WARNING) |
| api_contract | HIGH | DTO 클래스명 충돌(CRITICAL, documentation 과 동일 발견) + Discord `publicKey` 누락(WARNING) |
| user_guide_sync | NONE | 매칭 trigger 1건(`backend-api-change`) 갭 없음 — API 노출 자체가 변경되지 않음 |

## 발견 없는 에이전트

security, requirement, scope, side_effect, user_guide_sync — 각 CRITICAL/WARNING 없이 NONE 판정(관찰용 INFO는 위 표에 반영).

## 권장 조치사항
1. **[CRITICAL]** 신규 `ChatChannelBotIdentityDto` 를 `chat-channel-rotate-bot-token.dto.ts` 에서 이름 변경(예: `ChatChannelRotateBotIdentityDto`)하거나 기존 `chat-channel-config.dto.ts` 의 동명 클래스를 재사용해 OpenAPI 스키마 충돌을 해소한다.
2. **[WARNING]** `rotateBotToken` 응답 DTO 에 Discord 실제 응답 필드 `publicKey` 를 추가해 문서-응답 간극을 없앤다.
3. **[WARNING]** `rotateBotToken` 에 `@ApiUnauthorizedResponse` 를 추가해 컨트롤러 내 문서화 일관성을 맞춘다.
4. **[WARNING]** `chat-channel-input-rules.spec.ts` 에 `botToken`/`inboundSigningPlaintext` 의 `null` 케이스를 추가해 두-층 등가성 설계의 서비스 측 거부를 직접 고정한다.
5. (선택) INFO 항목들은 급하지 않으며 후속 PR 또는 다음 planner 턴에서 처리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 diff(에러 헬퍼 추출 + swagger DTO 추가)와 무관 |
  | architecture | 라우터 판단상 아키텍처 구조 변경 없음(순수 함수 내부 리팩터) |
  | dependency | 신규 외부 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |