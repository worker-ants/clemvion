# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 하위 호환성 — `rotateBotToken` 실패 중 "자격 증명 거부가 아닌" 케이스의 HTTP status 가 `400`→`502` 로 바뀐다 (의도된 breaking change)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `translateSetupChannelError` 함수 (return 타입이 `BadRequestException` 단일 → `BadRequestException | BadGatewayException` 로 변경된 지점, 게이트 라인 317~336) / `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 엔드포인트 (게이트 271~274 `@ApiBadGatewayResponse`)
  - 상세: 이전에는 `setupChannel` 이 어떤 이유로 실패하든(자격 증명 거부·provider 5xx·네트워크·타임아웃) 전부 `400 CHAT_CHANNEL_SETUP_FAILED` 로 응답했다. 이번 변경은 그중 "자격 증명 거부가 아닌" 사유만 골라 `502 CHAT_CHANNEL_SETUP_FAILED` 로 status 를 바꾼다. `code` 문자열 자체는 유지되지만 **HTTP status 축이 바뀌는 것은 API 계약 변경**이다 — 4xx→5xx 전환은 클라이언트/프록시/모니터링의 재시도·알림 정책이 다르게 반응할 수 있는 축이다(예: 일부 HTTP 클라이언트·게이트웨이는 5xx 에 자동 재시도를 건다). 저장소 안에서 `BadGatewayException` 사용례가 이번이 처음이라는 점도 plan 문서(`impl-setup-error-code.md` (e))가 스스로 인지하고 있다.
  - 실측: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 의 `rotateMutation.onError`(게이트 393~395)는 status/`code` 를 분기하지 않고 항상 동일한 generic toast 를 띄우므로, **현재 유일하게 확인된 내부 소비자(프런트엔드)는 이 변경에 영향받지 않는다.** 다만 이 엔드포인트를 직접 호출하는 외부/제3자 API 소비자가 있다면 영향권이다.
  - 판단: 이 변경은 `#1323`(planner) 이 3 라운드의 `--spec` 리뷰를 거쳐 확정한 의도된 계약이고, `plan/in-progress/impl-setup-error-code.md` 가 "캐너리가 뒤집히는 것이 의도" 라고 명시적으로 선언했다 — CRITICAL 로 보지 않는다. 다만 API 계약 관점에서는 여전히 **breaking change** 이므로, 릴리스 노트/체인지로그에 "이 엔드포인트의 일부 실패가 400 대신 502 로 바뀐다"는 사실을 명시했는지 확인 권고.
  - 제안: PR 설명·릴리스 노트에 status 코드 변경을 명시. 외부 API 문서(swagger)는 이미 두 status 를 모두 문서화했으므로(양호), 소비자 공지만 보완하면 됨.

- **[WARNING]** 신규(첫 노출) 에러 코드가 중앙 에러 카탈로그에 미등재 — API 계약 문서 완결성
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `CREDENTIAL_REJECTED_CODE = 'BOT_TOKEN_INVALID'` 상수 정의부(게이트 486) / `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` 의 `CHAT_CHANNEL_SETUP_FAILED` 리터럴(게이트 333)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 은 "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다 — 등재되지 않으면 소비자가 존재를 알 방법이 없다" 고 규정하는데, `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 두 코드 모두 `spec/5-system/3-error-handling.md §1` 중앙 카탈로그에 없다(같은 세션의 `convention_compliance` consistency-checker 가 이미 WARNING 으로 등재, grep 0건 실측 포함). API 계약 관점에서 봤을 때 "이 API 가 반환할 수 있는 전체 에러 코드 목록"의 단일 진실이 깨진 상태로 신규 status(502)까지 얹히는 것이라, 소비자가 이 엔드포인트의 실패 계약을 파악하려면 도메인 spec(`15-chat-channel.md §5.4`)과 swagger 데코레이터까지 따로 찾아야 한다.
  - 제안: `3-error-handling.md`에 도메인 spec 참조 서브섹션을 신설해 두 코드 + status + SoT 를 등재 (이미 같은 PR 의 consistency-check 산출물이 동일 제안을 냈음 — 이 리뷰가 독립적으로 API 계약 각도에서 재확인).

- **[INFO]** Swagger 문서가 실제 응답 계약과 정확히 일치함 (positive 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `@ApiBadRequestResponse`/`@ApiBadGatewayResponse` (게이트 267~274)
  - 상세: `@ApiBadRequestResponse` 설명에 열거된 5개 코드(`INVALID_BOT_TOKEN`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_NOT_CONFIGURED`·`CHAT_CHANNEL_PROVIDER_UNKNOWN`·`CHAT_CHANNEL_ENDPOINT_REQUIRED`)와 `@ApiBadGatewayResponse` 의 `CHAT_CHANNEL_SETUP_FAILED` 가 실제 `translateSetupChannelError`/컨트롤러 구현과 정확히 대응한다. `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)도 `BadGatewayException` 을 `HttpException` 분기로 정상 처리해 표준 `{ error: { code, message, requestId } }` 봉투를 유지함을 직접 확인했다 — 응답 형식 축은 문제 없음.

- **[INFO]** 응답 본문에서 provider 원문(`details.reason`) 제거 — 정보 유출 축소, 계약 단순화 (positive 확인)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (diff 상 `details: { reason: message.slice(0, 256) }` 두 곳 삭제)
  - 상세: 기존에는 provider 원문 일부(최대 256자)가 `details.reason` 으로 클라이언트에 그대로 노출됐다. 이번 변경으로 응답은 고정 `{code, message}` 만 반환하고 원문은 `TriggersService.rotateBotToken` 의 `this.logger.warn` 으로만 남는다(`codebase/backend/src/modules/triggers/triggers.service.ts` 게이트 1070~1077). `grep` 으로 `details.reason` 잔존 참조가 코드에 없음을 확인했다 — 응답 스키마가 더 좁고 예측 가능해졌으며 프런트엔드(`backend-labels.ts`)도 `details` 를 읽지 않으므로 호환성 문제 없음.

- **[INFO]** 인증/인가 — 이번 diff 는 `@Roles('editor')` 등 기존 인가 데코레이터를 변경하지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` 게이트 257
  - 상세: 엔드포인트의 권한 요건은 그대로이며, 이번 변경은 에러 분류·응답 계약에 한정된다.

## 요약

이 PR 은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 실패 응답 계약을 "transport(401/403 문자열 매칭)" 기반에서 "원인(자격 증명 거부 여부, adapter 가 `Error.code` 프로퍼티로 선언)" 기반으로 재설계하고, provider 5xx/네트워크 실패를 이 저장소 최초로 `502`(`BadGatewayException`) 로 분리하며, 응답 본문에서 provider 원문(`details.reason`)을 제거했다. Swagger 문서·`GlobalExceptionFilter` 봉투 처리·프런트엔드 소비자 코드를 직접 대조한 결과 응답 형식·인증/인가·요청 검증 축에는 새로운 결함이 없다. 다만 API 계약 관점에서 두 가지는 명시적으로 짚을 필요가 있다: (1) 비-자격증명 실패의 status 가 `400→502` 로 바뀌는 것은 의도됐고 spec·consistency-check 를 통과했지만 여전히 **breaking change** 이므로 소비자 공지가 필요하고, (2) 신규로 노출을 강화한 에러 코드 2종이 중앙 에러 카탈로그(`3-error-handling.md §1`)에 아직 등재되지 않아 API 계약 문서의 단일 진실 원칙이 이 표면에서 깨져 있다(이미 별도 consistency-check 라운드가 WARNING 으로 추적 중). 두 항목 모두 병합을 막을 CRITICAL 은 아니다.

## 위험도

LOW
