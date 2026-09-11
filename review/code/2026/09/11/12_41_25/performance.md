# 성능(Performance) 코드 리뷰

## 검토 범위

이번 세션(`12_41_25`)의 diff(`origin/main..HEAD`, 커밋 `0710021f0`~`9fcce3f47`)를 `git diff
origin/main..HEAD --stat -- codebase/` 로 재확인하고, 프롬프트에서 크기 제한으로 생략된
`triggers.service.ts` · `triggers.service.spec.ts` 전체 diff 를 `git diff` 로 직접 열어 확인했다.
실질 애플리케이션 코드 변경은 다음 8개 파일에 국한된다:

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`

나머지(`CHANGELOG.md`·`*.mdx`·`plan/**`·`review/code/**`·`review/consistency/**`)는 문서/리뷰
산출물이며 실행되는 코드가 아니므로 성능 검토 대상에서 제외했다. 이 diff 는 직전 두 라운드
(`review/code/2026/09/11/11_05_27`, `11_33_35`)의 fix 커밋을 포함한 누적본이며, 두 라운드 모두
performance 관점 위험도를 NONE 으로 판정했다 — 이번 라운드는 그 판정을 재검증하는 것이다.

이번 변경의 본질은 세 가지 뿐이다.

1. 기존 `BadRequestException` `details` 객체/배열(15자리 + `authConfigId` 1자리 = 총 16자리)에
   `code: ErrorCode.INVALID_FIELD` (또는 리터럴 `'INVALID_FIELD'`) 키 1개씩 추가
2. `chatChannel` 차단 5필드의 거부 메시지 리터럴을 module-scope `as const`/`Record<...>` 상수
   (`chat-channel-rejection-messages.const.ts`)로 통합, DTO 데코레이터·서비스 가드 양쪽이 참조
3. `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` class-validator 데코레이터 1개 추가

모두 예외(4xx) 발생 시에만 실행되는 검증/에러 경로(cold path)에 위치하며, 요청당 O(1) 연산이다.

## 발견사항

CRITICAL/WARNING 급 발견 없음.

- **[INFO]** 신규 상수(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`, `CHAT_CHANNEL_BLOCKED_FIELDS`)는
  module load 시 1회만 생성되고 요청마다 재할당되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (전체)
  - 상세: `as const` / `Record<ChatChannelBlockedField, string>` 리터럴은 모듈 최초 로드 시 한
    번만 평가된다. 종전에는 동일 문자열이 `chat-channel-config.dto.ts` 의 데코레이터 인자와
    `triggers.service.ts` 의 throw 자리 양쪽에 하드코딩돼 있었는데, 상수화 후에도 소비 방식이
    단순 property access(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botToken`)라 런타임 오버헤드가
    없다. 오히려 중복 리터럴을 단일 참조로 모아 V8 문자열 인터닝 관점에서도 중립~긍정적이다.
  - 제안: 없음.

- **[INFO]** `details` 객체당 `code` 필드 1개 추가는 payload 크기·GC 압력 증가가 무시 가능한
  수준
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (throw 자리 13곳, `git diff`
    로 실측 확인 — `:509`(`type`), `:655`·`:662`·`:669`(내부 필드 3종), `:700`·`:708`(PATCH
    불변 2종), `:731`·`:742`(chatChannel/provider), `:798`·`:816`·`:830`·`:840`
    (inboundSigningPlaintext 검증 4곳), `:1011`(`authConfigId`, 도메인 top-level 예외))·
    `codebase/backend/src/common/utils/password.util.ts` (2곳)
  - 상세: 각 `BadRequestException` 페이로드에 짧은 문자열 리터럴 1개가 추가될 뿐이고, 이 경로는
    4xx 예외 발생 시에만 실행되는 콜드 패스다. 요청당 할당량 증가는 무시할 수준이며 hot path(정상
    요청 처리 흐름)에는 전혀 영향이 없다.
  - 제안: 없음.

- **[INFO]** `@MinLength(1)` 추가는 검증 체인에 O(1) 길이 비교 1회를 더할 뿐이며, 실제로는
  불필요한 쓰기 1회를 막아 순효과가 긍정적
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `botToken`
    필드의 `@IsString()` `@MaxLength(256)` 자리 (`@MinLength(1)` 신규 삽입)
  - 상세: `class-validator` 의 `MinLength` 는 `string.length` 비교라 점근적 복잡도 변화가 없다.
    반대로 이 검증이 막는 것은 `botToken: ''` 요청이 DTO 를 통과해 `SecretResolver.rotate()` 로
    **빈 시크릿을 먼저 저장**한 뒤 provider 호출이 실패하는 경로(요청은 실패하지만 쓰기는 이미
    발생)였다 — 이 검증 추가는 그 불필요한 write 1회를 조기에 차단하는 방향이라 성능/자원 사용
    관점에서 오히려 개선이다.
  - 제안: 없음.

- **[INFO]** 신규 테스트의 `it.each`/`for...of` 반복은 상수(5)로 유계이고 프로덕션 코드가 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의
    `BLOCKED_FIELD_CASES`(5-tuple) 를 공유하는 두 `it.each` 블록, `dto/trigger-dto-validation.spec.ts`
    의 `CHAT_CHANNEL_BLOCKED_FIELDS` 를 순회하는 `for (const field of ...) { await run(...) }`
  - 상세: 반복 횟수가 차단 필드 개수(5)로 고정돼 있고, 이 라운드는 이전 라운드가 지적한 "두
    `it.each` 가 5-tuple 배열을 바이트 그대로 복제" WARNING 을 `BLOCKED_FIELD_CASES` 공유 상수로
    통합해 해소했다 — 실행 시간 관점에서도 중복 정의가 사라져 약간 개선됐다. 순차 `await` 는 테스트
    실행 시간에만 영향을 주고 CI 부담도 무시할 수준이다. N+1/알고리즘 복잡도 이슈로 볼 사안이 아니다.
  - 제안: 불필요(현행 유지).

## 요약

이번 diff 는 에러 응답 `details[].code` 필드를 16개 발행 지점에 additive 하게 배선하고, 중복된
거부 메시지 리터럴을 module-scope 상수로 통합하며, `botToken` DTO 에 O(1) 길이 검증 데코레이터를
하나 추가하는 것이 전부다. 모든 변경이 4xx 예외 경로(콜드 패스) 또는 요청당 O(1) 검증 단계에
위치하고, 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O·캐싱 필요 지점은 도입되지 않았다.
`triggers.service.ts` 전체 diff 를 직접 열어 13곳 전부가 단순 객체 리터럴 필드 추가/치환뿐임을
확인했고, 테스트 쪽 반복문은 상수(5)로 유계이며 오히려 fixture 중복을 상수로 통합해 소폭
개선됐다. 직전 두 라운드(`11_05_27`, `11_33_35`)의 NONE 판정과 이번 재검증 결과가 일치한다.
성능 관점에서 우려할 변경 없음.

## 위험도

NONE
