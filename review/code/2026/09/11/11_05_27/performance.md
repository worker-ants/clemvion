# 성능(Performance) 리뷰

## 검토 범위

실제 애플리케이션 코드 변경은 파일 1~9(`password.util.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts`
· `chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts` · `triggers.service.{ts,spec.ts}` ·
`chat-channel-trigger-create.e2e-spec.ts` · `plan/in-progress/impl-details-code-wiring.md`)이다.
파일 10~17(`review/consistency/2026/09/11/10_28_52/**`)은 consistency-check 산출물(정적 markdown/json
리포트)로, 실행되는 코드가 아니므로 성능 관점의 검토 대상에서 제외했다.

이번 변경의 본질은 세 가지다:
1. 기존 에러 응답 `details[]` 객체(15자리)에 `code: 'INVALID_FIELD'` 키 1개 추가
2. `chatChannel` 차단 5필드의 거부 메시지 리터럴을 `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 의 module-level `as const` 상수로 통합, 두 층(DTO 데코레이터·서비스 가드)이 참조
3. `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 검증 데코레이터 1개 추가

모두 요청당 상수 시간 연산이고, 예외/검증 경로(hot path 아님)에 위치한다.

## 발견사항

관점별로 점검했으나 CRITICAL/WARNING 급 발견 없음.

- **[INFO]** 신규 상수 모듈은 module-load 시 1회 생성되어 요청마다 재할당되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:22` (`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`), `:39` (`CHAT_CHANNEL_BLOCKED_FIELDS`)
  - 상세: 두 상수 모두 `as const` 로 선언되어 모듈 최초 로드 시 한 번만 생성된다. 이전에는 동일 문자열 리터럴이 DTO 데코레이터(`chat-channel-config.dto.ts`)와 서비스 가드(`triggers.service.ts`) 양쪽에 각각 하드코딩돼 있었는데, 상수화 이후에도 참조 방식(property access)이라 요청 경로에 추가 할당이 생기지 않는다. 성능 저하 없음 — 오히려 중복 리터럴을 단일 참조로 통합한 것은 긍정적 방향.
  - 제안: 없음 (현행 유지).

- **[INFO]** `details[].code` 추가는 응답 payload 크기를 상수 크기만큼만 늘린다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (13곳, 예: 654행 `botTokenRef`, 700행 `botToken`), `codebase/backend/src/common/utils/password.util.ts:66`, `:87`
  - 상세: 각 `BadRequestException` 페이로드에 `code: 'INVALID_FIELD'` 문자열 리터럴 1개가 추가된다. 이 경로는 예외(4xx) 발생 시에만 실행되는 냉경로(cold path)이고, 페이로드 증가분은 문자열 리터럴 하나(≈14바이트)라 무시할 수 있는 수준이다.
  - 제안: 없음.

- **[INFO]** `@MinLength(1)` 추가는 검증 체인에 상수 시간 비교 1회만 더한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192` (`botToken`)
  - 상세: `class-validator` 의 `@MinLength` 는 `string.length` 비교로 O(1)이다. 기존에 `@IsString()` `@MaxLength(256)` 두 데코레이터가 이미 있던 자리에 세 번째 데코레이터가 추가된 것으로, 검증 파이프라인의 점근적 복잡도에 변화가 없다. 오히려 이 추가가 막는 결함(빈 문자열이 `SecretResolver.rotate` 를 통해 먼저 저장된 뒤 provider 호출이 실패하는 경로, plan 문서 §C 참조)은 **불필요한 쓰기 1회를 막는** 방향이라 성능에 긍정적이다.
  - 제안: 없음.

- **[INFO]** 신규 테스트의 순차 `for...of + await` 루프는 5회 반복으로 유계이며 테스트 실행 시간에만 영향
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (`[등가성] 차단 5필드의 message 는 공유 상수에서 온다 (D)` 테스트, `CHAT_CHANNEL_BLOCKED_FIELDS` 순회)
  - 상세: `for (const field of CHAT_CHANNEL_BLOCKED_FIELDS) { await run(...) }` 형태로 5개 필드를 순차 검증한다. 병렬화(`Promise.all`)하면 테스트 시간을 단축할 수 있으나, 반복 횟수가 상수(5)로 고정돼 있고 프로덕션 코드가 아니라 CI 실행 시간에 미치는 영향이 미미하다. 알고리즘 복잡도나 N+1 문제로 볼 수준이 아니다.
  - 제안: 불필요 (현행 유지해도 무방).

## 요약

이번 변경은 에러 응답의 `details[]` 에 `code` 필드를 배선하고(15자리), 중복된 거부 메시지 리터럴을 단일 상수로 통합하며, 검증 데코레이터 하나를 추가하는 구조적/계약 정합화 작업이다. 모든 변경이 예외 경로(냉경로) 또는 요청당 O(1) 검증 단계에 위치하고, 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O 는 도입되지 않았다. 상수 추출은 오히려 중복 문자열 리터럴을 줄이는 방향이라 미세하게 긍정적이다. 성능 관점에서 우려할 변경 없음.

## 위험도

NONE
