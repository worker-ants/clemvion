# 부작용(Side Effect) 리뷰

## 검증 방법

프롬프트에 실린 diff 는 파일 6·7·8(트리거 서비스/서비스 스펙/DTO 검증 스펙)에서 용량 제한으로
생략돼 있어, `git diff origin/main...HEAD -- <file>` 로 실제 소스를 직접 대조했다. 또한
`ErrorCode.INVALID_FIELD` 신규 import(`triggers.service.ts` → `nodes/core/error-codes`)가
순환 참조를 만드는지 `error-codes.ts` 의 import 목록(0건)으로 확인했고, `@MinLength(1)`이
`ChatChannelUpdateConfigDto`(`OmitType(['botToken', 'inboundSigningPlaintext'])`)로 새는지
DTO 선언을 직접 열어 확인했다. 저장소 파일은 건드리지 않았다 — `git status --short` 로
확인한 결과 미커밋 변경은 이번 리뷰 산출물 디렉터리(`review/code/2026/09/11/12_41_25/`)뿐이다.

## 발견사항

- **[INFO]** 공개 에러 응답 payload shape 가 additive 하게 확장된다 — `details[]`/`details`
  객체 15자리에 `code: 'INVALID_FIELD'` (또는 `ErrorCode.INVALID_FIELD`) 키가 신규로 실린다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`validateUpdatePayload`·
    `blockInternalFields`·`blockPatchOnlyFields`·`assertChatChannelNotCarried`·
    `validateInboundSigning` 등 13개 throw 자리) · `codebase/backend/src/common/utils/password.util.ts`
    (`validatePasswordStrength` 2개 throw 자리)
  - 상세: `BadRequestException` payload 는 그대로 HTTP 응답으로 나가는 공개 계약이다. 키 추가는
    additive 라 `details.field`/`details.message` 만 읽는 기존 소비자에는 영향이 없지만, `details`
    전체를 정확 일치(deep-equal)로 비교하던 소비자가 있다면 그 자리는 깨진다. 저장소 내부는 이
    변경에 맞춰 unit(13+2곳)·e2e(5곳) 단언을 함께 갱신했고 `frontend` 쪽 `INVALID_FIELD` 정확-일치
    소비는 발견되지 않았다(grep 0건). 외부(서드파티) 소비자 존재 여부는 이 diff 범위에서 확인 불가.
  - 제안: 외부 API 소비자가 있다면 릴리스 노트에 additive 필드 추가로 명시. 이 PR 범위에서는 추가
    조치 불필요 — CHANGELOG.md 에 이미 배경이 상세히 기록돼 있다.

- **[INFO]** `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가로 검증 동작이 엄격해진다 —
  종전에 (버그로) 통과하던 `botToken: ''` 생성 요청이 이제 400 으로 거부된다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`botToken` 필드,
    `@MinLength(1)` 데코레이터 추가 줄)
  - 상세: `@ApiProperty` 가 이미 `minLength: 1` 을 광고하고 있었는데 검증 체인에는 없어 "선언이
    구현보다 넓은" 상태였다. `''` 가 `setupChatChannel` 의 `SecretResolver.rotate(botTokenRef, ws, '')`
    로 흘러 빈 시크릿을 먼저 저장한 뒤 provider 호출이 실패하는 상태 불일치를 이번 PR 이 DTO
    단계에서 조기 차단한다. `OmitType(['botToken', 'inboundSigningPlaintext'])` 로 PATCH DTO
    (`ChatChannelUpdateConfigDto`)가 부모 데코레이터를 명시적으로 떼고 `@IsEmpty()` 를 재선언하므로
    `@MinLength(1)` 은 PATCH 경로로 새지 않음을 직접 확인했다(양방향 캐너리 테스트 `[C]` 존재).
    이 자체는 인터페이스 축소가 아니라 문서화된 계약(`minLength: 1`)을 실제로 강제하는 정합화다.
  - 제안: 추가 조치 불필요.

- **[INFO]** 신규 모듈 `chat-channel-rejection-messages.const.ts` — 순수 `as const` 데이터
  상수, 부작용 없음. 전역 mutable state 도입 없음. 이 상수를 import 하는 3개 프로덕션/테스트
  파일(`chat-channel-config.dto.ts`, `triggers.service.ts`, 그리고 두 spec 파일)이 동일 리터럴을
  참조하게 되어, 종전 두 층(DTO 데코레이터 / 서비스 가드)에 흩어져 있던 리터럴이 어긋날 가능성을
  오히려 줄인다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (`CHAT_CHANNEL_BLOCKED_FIELDS`, `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)

- **[INFO]** `triggers.service.ts` 에 신규 import `ErrorCode` (`../../nodes/core/error-codes`) —
  순환 참조 여부를 실측했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (import 문, `ErrorCode`)
  - 상세: `nodes/core/error-codes.ts` 는 import 문이 0건이라(leaf 모듈) 순환 참조를 만들지 않는다.
    `ErrorCode.INVALID_FIELD` 값도 기존에 각 자리에서 쓰던 리터럴 `'INVALID_FIELD'` 와 바이트
    동일함을 확인했다(`error-codes.ts:116`). `common/utils/password.util.ts` 는 같은 상수를 쓰지
    않고 리터럴을 유지했는데(`common/` → `nodes/` import 선례 0건이라는 소스 주석의 설명), 이는
    같은 PR 안에서 두 자리가 "정합해 보이지만 실제로는 리터럴 값이 우연히 일치하는" 관계다 —
    한쪽이 나중에 `ErrorCode` enum 값을 바꾸면 다른 쪽은 조용히 어긋난다(사이드이펙트라기보다
    유지보수성 축에 가깝지만, "같은 키가 두 자리에서 독립적으로 유지된다"는 점은 부작용 관점에서도
    주목할 만하다).
  - 제안: 이미 소스 주석(`password.util.ts`)과 CHANGELOG 가 이 비대칭을 의도로 명시하고 후속
    트래커 항목(`common/` 상수 승격)으로 남겼다 — 추가 조치 불필요.

## 확인한 항목 (부작용 없음으로 판정)

- **함수 시그니처**: `validatePasswordStrength`, `TriggersService` 의 관련 private 메서드들
  시그니처 변경 없음 — 파라미터·반환 타입 모두 그대로이고 throw 되는 예외 객체의 payload
  내용만 확장됐다.
- **전역 변수**: 신규 전역 변수 없음. 두 상수(`CHAT_CHANNEL_BLOCKED_FIELDS`,
  `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)는 module-scope `const … as const` 로 불변이며
  재할당 지점이 없다.
- **파일시스템**: 런타임 코드 경로에 파일 I/O 없음. 커밋에 포함된 `plan/in-progress/**`,
  `review/**` 산출물은 이 프로젝트의 정상 워크플로 산출물(계획서·리뷰/컨시스턴시 체크 리포트)이며
  런타임 부작용이 아니다.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 새 외부 호출 없음. `SecretResolver.rotate` 등 기존 호출부는 로직 변경이
  없고, `botToken` 빈 값이 DTO 단계에서 조기 차단되어 오히려 불필요한 후속 provider 호출(및
  그 실패로 인한 빈 시크릿 저장)이 줄어드는 방향이다.
- **이벤트/콜백**: 없음. 예외 throw 조건 분기 자체는 그대로이고 payload 필드만 추가됐다.
- **테스트 인프라(mock) 변경**: `triggers.service.spec.ts` 에 추가된 `it.each(BLOCKED_FIELD_CASES)`
  두 블록은 기존 fixture 를 상수로 통합한 것으로, 프로덕션 코드의 동작이나 mock 대상을
  바꾸지 않는다(전 라운드 maintainability WARNING 을 해소한 결과물).
- **최신 커밋(`9fcce3f47`)의 코드 변경**: `triggers.service.ts`(13줄, 주석만) ·
  `trigger-dto-validation.spec.ts`(2줄, 주석만) · `triggers.service.spec.ts`(2줄, 주석만) —
  전부 인용 문구/판정 근거 주석이며 실행 경로 변경 없음을 `git show 9fcce3f47` 로 확인했다.

## 요약

이번 diff 는 (1) 15개 에러 throw 자리에 `details[].code` 를 additive 하게 배선하고, (2)
`ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가해 선언(OpenAPI)-구현(class-validator)
간극을 좁혀 "빈 시크릿 선(先)저장" 상태 불일치를 차단하며, (3) 5개의 바이트 동일 거부 메시지를
공유 상수로 추출하는 순수 리팩터, 이 세 축으로 구성된다. 전역 상태·환경 변수·파일시스템·네트워크·
이벤트 콜백에 대한 의도치 않은 부작용은 관측되지 않았고, 함수 시그니처도 변하지 않았다. 신규
`ErrorCode` import 는 leaf 모듈이라 순환 참조를 만들지 않음을 직접 확인했다. 유일하게 부작용
관점에서 주목할 지점은 (a) 공개 에러 응답 shape 가 additive 하게 넓어진다는 점과 (b) `botToken`
빈 문자열 생성 요청이 이제 거부된다는 점인데, 둘 다 PR 이 스스로 문서화(CHANGELOG, plan, 소스
주석)하고 unit(15곳)·e2e(5곳) 양쪽에서 뮤테이션 검증까지 마친 의도된 변경이라 회귀라기보다
정상적인 인터페이스 진화로 판단된다. `common/utils/password.util.ts` 가 같은 `ErrorCode` 상수를
쓰지 않고 리터럴을 유지한 비대칭은 값이 우연히 일치하는 상태로 남아 있으나, 이는 소스 주석과
CHANGELOG 가 의도로 명시하고 후속 트래커에 등재한 사안이라 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
