# API 계약(API Contract) 리뷰

## 검토 범위

실제 API 표면에 영향을 주는 파일은 1~9(`CHANGELOG.md`, `password.util.{ts,spec.ts}`,
`chat-channel-rejection-messages.const.ts`, `chat-channel-config.dto.ts`,
`trigger-dto-validation.spec.ts`, `triggers.service.{ts,spec.ts}`,
`chat-channel-trigger-create.e2e-spec.ts`)이다. 파일 10~31은 plan/이전 리뷰(`11_05_27`)·
consistency-check(`10_28_52`) 산출물이 이번 diff 에 함께 커밋된 것으로, 코드가 아니라
정적 마크다운/JSON 기록물이라 API 계약 검토 대상이 아니다. `git log -- plan/in-progress/
impl-details-code-wiring.md` 로 대조한 결과 이번 라운드(commit `0fb691248`)는 직전
라운드(`0710021f0`)가 이미 받은 4개 WARNING(`ErrorCode` 상수 미재사용·CHANGELOG 누락·
주석 오류·fixture 중복) 을 반영한 **수정판**이다 — 실제로 `triggers.service.ts` diff 는
이제 `ErrorCode.INVALID_FIELD` 를 import 해 쓰고(`common/utils/password.util.ts` 만
계층 제약(`common/` → `nodes/` import 선례 0건, 실측 근거 명시)으로 리터럴을 유지),
`CHANGELOG.md` 에 이번 두 동작 변경이 기록됐다.

이번 변경의 본질은 (A) 기존 검증 에러 응답 `details[]`/`details` 에 `code: 'INVALID_FIELD'`
필드를 15자리 배선, (C) `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가해 선언
(`@ApiProperty({ minLength: 1 })`)과 구현의 간극을 닫는 것, (D) 중복된 거부 메시지 5쌍을
공유 상수로 통합하는 것이다. 신규 엔드포인트·URL 변경·인증/인가 로직 변경·페이지네이션 관련
변경은 없다.

## 발견사항

- **[INFO]** `details[].code` 필드가 15자리에 additive 로 신설된다 — 순수 스키마 확장이며
  기존 소비자가 `details` 의 다른 키만 참조한다면 하위 호환에 영향 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (예: 게이트 510, 656,
    663, 670, 701, 708, 731, 735, 746, 801, 819, 834, 846, 1012 — `ErrorCode.INVALID_FIELD`
    참조), `codebase/backend/src/common/utils/password.util.ts` (게이트 75, 96)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 의 2026-09-11 규약(「`field` 를 실으면
    `code` 도 싣는다 — 형태 무관」)을 그대로 구현한다. 배열 형태(`CustomValidationPipe`)와
    단일 객체 형태(서비스 가드) 두 갈래 모두 이제 `{ field, code }` 를 함께 실어, 종전에
    갈라져 있던 두 층의 응답 스키마가 통일됐다. `GlobalExceptionFilter` 가 `details` 를
    그대로 통과시키므로(§5.3 확인) wire 레벨에서도 반영되며, e2e(`chat-channel-trigger-
    create.e2e-spec.ts`)가 `toEqual` 로 실제 HTTP round-trip 을 5곳 고정해 뒷받침한다.
  - 제안: 조치 불필요 — 계약 준수 방향의 additive 변경.

- **[INFO]** `botToken` `@MinLength(1)` 은 실질적인 클라이언트 대면 동작 변경이다 — 종전에
  (버그로) 성공하던 빈 문자열 POST 요청이 이제 400 으로 거부된다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (게이트 192,
    `@MinLength(1)`)
  - 상세: `@ApiProperty` 는 이미 `minLength: 1` 을 광고하고 있었으므로(선언 ↔ 구현 간극을
    닫는 방향), breaking change 라기보다는 "문서화된 계약을 실제로 강제"하는 정합화다. 다만
    빈 문자열을 보내던 기존 호출측이 있었다면 그 경로는 이제 400을 받는다 — 순수 additive는
    아니다. 직전 라운드(`11_05_27`)의 api_contract 리뷰가 지적했던 "CHANGELOG 미기록"
    WARNING 은 이번 라운드에서 `CHANGELOG.md`(파일 1)에 해당 항목이 상세히 기록되면서
    해소됐다. PATCH 경로(`ChatChannelUpdateConfigDto`)는 `OmitType` 이 부모 데코레이터를
    떼고 `@IsEmpty()` 로 재선언하므로 이 변경의 영향을 받지 않는다 — `[C]` 테스트
    (`trigger-dto-validation.spec.ts`)가 양방향(생성=거부/PATCH=허용)을 캐너리로 고정한다.
  - 제안: 조치 불필요 — 데이터 무결성 결함(빈 시크릿 선-저장) 수정으로서 정당하고 문서화도
    이미 갖춰져 있다.

- **[INFO]** 세 가지 서로 다른 거부 사유(내부 필드 금지·PATCH 불변·생성 전용)가 여전히
  동일한 generic `details[].code: 'INVALID_FIELD'` 로만 구분된다 — 소비자가 프로그램적으로
  분기하려면 여전히 한국어 `message` 문자열 파싱에 의존해야 한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (게이트 25-26 주석), `CHANGELOG.md`(게이트 20-21)
  - 상세: `2-api-convention.md §5.3` 은 `field`-having details 항목에 `code` 를 요구할 뿐,
    도메인 특화 세부 코드 신설까지는 요구하지 않는다 — 이번 배선은 규약을 만족한다. 다만
    API 계약 관점에서 "기계가 읽을 수 있는 사유"는 여전히 세 사유를 가르지 못하는 채로
    남는다는 점은 이 PR 이 스스로 CHANGELOG·상수 파일 주석에 투명하게 명시하고 있어(신규
    은닉 갭이 아님), CRITICAL/WARNING 이 아니라 참고 기록.
  - 제안: 조치 불필요(이번 PR 스코프 밖으로 명시적으로 분리됨). 도메인 특화 코드 신설은
    별개 트래커 항목.

- **[INFO]** 공백 전용 `botToken`(`'   '`)은 `@MinLength(1)` 로 막히지 않는다 — 길이만
  검사하므로 여전히 통과해 `SecretResolver.rotate` 에 사실상 빈 시크릿을 저장할 수 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(게이트 192),
    `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` `[C]` 케이스
  - 상세: `CHANGELOG.md`(게이트 30-31)와 `[C]` 테스트 JSDoc 양쪽 모두 이 경계를 "trim 정책은
    별개 결정"으로 명시하고 있어 은닉된 갭이 아니다. 증상은 이번 PR 이 고친 결함(`''`)과
    동일한 클래스라 후속 트래커 항목으로 남겨두는 것이 맞다.
  - 제안: 조치 불필요 — 스코프 아웃이 문서에 명시돼 있다.

## 확인했으나 문제 없음

- **버전 관리**: URL 경로·API 버전 표기(`/api/triggers` 등) 변경 없음. 이번 diff 는 응답
  payload 필드 추가·검증 강화·내부 리팩터일 뿐, 엔드포인트 시그니처 자체는 그대로다.
- **HTTP 상태 코드**: 모든 신규/변경 throw 자리가 계속 `BadRequestException`(400)을 쓰고,
  top-level `code`(`VALIDATION_ERROR`/`AUTH_CONFIG_NOT_FOUND`)와 `details[].code`
  (`INVALID_FIELD`)를 겹쳐 쓰지 않는다 — §5.3 "둘을 겹쳐 쓰지 않는다" 원칙 준수
  (`triggers.service.ts` 게이트 1008-1012, `AUTH_CONFIG_NOT_FOUND` 는 top-level 특화 코드를
  유지한 채 `details` 에는 필드-수준 사유만 추가).
- **요청 검증**: `botToken` MinLength 추가로 선언-구현 간극이 닫혔고, 차단 5필드
  (`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext`)의
  거부 메시지가 공유 상수(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)로 양층(DTO pipe·서비스
  가드) 등가성이 테스트로 고정됐다 — 문면 drift 재발 방지.
- **URL/경로 설계, 페이지네이션, 인증/인가**: 이번 diff 범위에 해당 축의 변경 없음.
- **응답 형식 일관성**: `details` 가 배열/단일 객체 두 형태를 갖는 것 자체는 `2-api-
  convention.md §5.3`(211-218행)이 "둘 다 유효하다"고 명시한 기존 설계이고, 이번 PR 은 그
  경계를 넘지 않는다.

## 요약

이번 변경은 URL/버전/인증 표면에는 손대지 않고, 기존 계약(§5.3 `details[].code`)을
DTO 검증 파이프 층·서비스 가드 층·e2e 층 세 곳에 정합하게 사후 배선하며, 직전 리뷰
라운드가 지적한 4개 WARNING(canonical `ErrorCode` 미재사용·CHANGELOG 누락·주석 오류·
테스트 fixture 중복)을 이번 커밋(`0fb691248`)에서 실제로 반영한 수정판이다. `details[].code`
15자리 추가는 순수 additive 스키마 확장이고, `botToken` `@MinLength(1)`은 문서화된
OpenAPI 계약(`minLength: 1`)을 실제로 강제하는 방향의 의도된 동작 변경으로 이제 CHANGELOG
에도 기록돼 있다. 세 거부 사유가 여전히 generic `INVALID_FIELD` 로만 뭉쳐 있는 점과 공백
전용 `botToken` 미차단은 모두 이 PR 이 스스로 투명하게 스코프 아웃을 문서화한 잔여 항목이라
은닉 결함이 아니다. CRITICAL/WARNING 급 API 계약 위반은 발견되지 않았다.

## 위험도

LOW
