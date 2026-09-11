# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `botToken` 검증 강화(`@MinLength(1)`)로 종전에 (버그로) 통과하던 빈 문자열 요청이 이제 400 으로 거부된다 — 계약 관점에서는 "선언(OpenAPI `minLength: 1`)과 구현(검증 체인)의 간극을 닫는" 정합화이지만, 클라이언트 관점에서는 **이전에 성공하던 요청이 이제 실패하는 동작 변경**이다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`(게이트 숫자 `@MinLength(1)` 추가 줄)
  - 상세: `@ApiProperty`가 이미 `minLength: 1`을 광고하고 있었으므로 이번 변경은 문서화된 계약을 실제로 강제하는 것에 가깝다(=계약 위반이 아니라 계약 준수). 또한 diff 주석이 이 결정을 명확히 설명하고 있고(빈 시크릿이 먼저 저장되는 버그를 막음), `[C]` 테스트(`trigger-dto-validation.spec.ts`)로 회귀 방지도 되어 있다. 다만 이 엔드포인트를 호출하는 기존 클라이언트가 빈 문자열을 보내던 경로가 있었다면 그 경로는 이제 400을 받는다.
  - 제안: 별도 조치는 불필요 — 버그 수정으로서 정당하다. 다만 외부에 공개된 API라면 체인지로그/릴리스 노트에 "botToken 빈 문자열 입력이 이제 명시적으로 거부됨(이전엔 조용히 손상된 상태로 남았음)"을 한 줄 남기는 것을 권장.

- **[INFO]** `details[].code` 필드가 15개 자리(에러 응답 payload)에 추가되었다 — 순수 additive 변경으로 기존 클라이언트가 `details` 객체/배열의 다른 키만 참조한다면 영향 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (13곳, 예: `:655`, `:662`, `:669`, `:700`, `:707`, `:730`, `:741`, `:794`, `:809`, `:821`, `:830`, `:509`, `:995`) · `codebase/backend/src/common/utils/password.util.ts:66`, `:87`
  - 상세: `spec/5-system/2-api-convention.md` §5.3 의 2026-09-11 규약(「`details` 항목이 `field` 를 실으면 `code` 도 싣는다」)을 그대로 배선한 것으로, DTO 검증 파이프 층(`CustomValidationPipe`)과 서비스 가드 층 양쪽이 이제 동일한 `{ field, code: 'INVALID_FIELD' }` 형태를 낸다 — 두 층 간 응답 스키마 불일치가 해소됐다. `toEqual`/`toMatchObject` 뮤테이션 검증(plan 문서 기록)으로 15자리 전부 회귀 캐너리가 걸려 있다는 점도 확인했다. 유일하게 이미 도메인 특화 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)를 쓰던 `rethrowEndpointPathConflict` (`triggers.service.ts:1837` 부근)는 손대지 않아 §5.3의 "top-level 특화 코드와 details.code 를 겹쳐 쓰지 않는다" 원칙과 정합적으로 남아 있다.
  - 제안: 조치 불필요 — 계약 준수 개선으로 판단.

- **[INFO]** `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수로 옮긴 5개 사용자 노출 문구가 문체가 혼재한다 — `botTokenRef`/`inboundSigningRef`/`inboundSigning`은 격식체(`...입니다`/`...하세요`), `botToken`/`inboundSigningPlaintext`는 해요체(`...없어요`/`...주세요`).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:23-34`
  - 상세: 이번 PR은 리터럴 값 자체를 바꾸지 않고 두 층(DTO pipe / service)에 흩어져 있던 것을 상수로 모았을 뿐이므로 이 불일치는 pre-existing이며 이 PR이 만든 결함은 아니다. 다만 한 파일로 모이면서 문체 혼재가 더 눈에 띄게 됐다.
  - 제안: 이번 PR 범위 밖 — 필요하면 후속 tracker 에 "에러 메시지 문체 통일" 항목으로 등재.

## 요약

이번 변경은 신규 엔드포인트나 URL/버전 변경 없이, 기존 chatChannel 검증 에러 응답의 `details[].code` 필드를 15개 발행 지점에 additive 하게 배선하고(§5.3 2026-09-11 규약 준수), DTO 파이프 층·서비스 가드 층·e2e 층 세 곳의 assertion을 함께 갱신해 두 층의 응답 스키마를 정합화했다. 동시에 `botToken`에 대해 선언된 OpenAPI `minLength: 1`을 실제 검증 체인에 반영(`@MinLength(1)`)해 "선언이 구현보다 넓은" 계약 위반을 해소했는데, 이는 이전에 (버그로) 성공하던 빈 문자열 요청을 이제 거부하는 의도된 동작 변경이며 테스트로 뒷받침된다. 5개 거부 메시지를 공유 상수로 묶어 두 층 간 문면 drift를 원천 차단한 점도 계약 일관성에 긍정적이다. 인증/인가·페이지네이션·URL 설계·버전 관리 축에는 변경이 없으며, 발견된 항목은 모두 INFO 수준(의도된 개선 또는 pre-existing 사소한 결함)으로 CRITICAL/WARNING 급 계약 위반은 없다.

## 위험도
LOW
