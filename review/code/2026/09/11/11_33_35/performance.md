# 성능(Performance) 리뷰

## 검토 범위와 방법

`git diff origin/main..HEAD --stat` 로 이번 PR 의 실제 변경 파일 31개를 확인했다. 그중 실행되는
애플리케이션/테스트 코드는 9개(`password.util.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts`
· `chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts` · `triggers.service.{ts,spec.ts}` ·
`chat-channel-trigger-create.e2e-spec.ts`)이고, 나머지(`CHANGELOG.md`, `plan/in-progress/*.md`,
`review/code/2026/09/11/11_05_27/**`, `review/consistency/2026/09/11/10_28_52/**`)는 정적 markdown/json
문서·이전 리뷰 라운드 산출물이라 성능 관점의 검토 대상이 아니다.

프롬프트에는 파일 8(`triggers.service.ts`)의 diff 가 완전히 누락돼 있어(게이트 없이 헤더만 존재),
`git diff origin/main..HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts` 로 직접
열어 실제 누적 diff(이전 라운드 커밋 `0710021f0` + 후속 fix 커밋 `0fb691248` 을 합친 최종 상태)를
확인했다. `0fb691248` 은 이전 라운드 performance reviewer 가 관여하지 않은 architecture WARNING
(`ErrorCode.INVALID_FIELD` canonical 상수 미재사용)을 반영해 `triggers.service.ts` 13곳의 `code:
'INVALID_FIELD'` 리터럴을 `ErrorCode.INVALID_FIELD` import 참조로 치환한 것 — 값·자리 모두 리터럴에서
상수 참조로 바뀌었을 뿐 실행 비용은 동일(둘 다 O(1) property lookup)하다.

이번 변경의 본질은 세 가지다:
1. 기존 에러 응답 `details`(객체/배열, 15자리)에 `code` 키 1개 추가(리터럴 또는 `ErrorCode.INVALID_FIELD` 상수 참조)
2. `chatChannel` 차단 5필드의 거부 메시지 리터럴을 `chat-channel-rejection-messages.const.ts` 의 module-level `as const` 상수로 통합, DTO 데코레이터·서비스 가드 두 층이 참조
3. `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 검증 데코레이터 1개 추가

세 축 모두 요청당 O(1) 연산이고, 전부 예외/검증 실패 경로(cold path, 4xx 응답 생성 시에만 실행)에
위치한다. 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O 는 프로덕션 코드 어디에도 도입되지
않았다.

## 발견사항

CRITICAL/WARNING 급 발견 없음.

- **[INFO]** 신규 상수 모듈은 module-load 시 1회 생성되어 요청마다 재할당되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`, `CHAT_CHANNEL_BLOCKED_FIELDS`)
  - 상세: 두 상수 모두 `as const` 로 선언되어 모듈 최초 로드 시 한 번만 생성된다. 이전에는 동일 문자열 리터럴이 DTO 데코레이터(`chat-channel-config.dto.ts`)와 서비스 가드(`triggers.service.ts`) 양쪽에 각각 하드코딩돼 있었는데, 상수화 이후에도 참조 방식(property access)이라 요청 경로에 추가 할당이 생기지 않는다.
  - 제안: 없음(현행 유지).

- **[INFO]** `details.code` 추가는 응답 payload 크기를 상수 크기만큼만 늘린다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (13곳, `ErrorCode.INVALID_FIELD` 참조 — 함수 `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider`/`resolveAuthConfigId` 계열), `codebase/backend/src/common/utils/password.util.ts`(`validatePasswordStrength`, 리터럴 `'INVALID_FIELD'` 2곳)
  - 상세: 각 `BadRequestException` 페이로드에 짧은 문자열 키 1개가 추가된다. 이 경로는 예외(4xx) 발생 시에만 실행되는 냉경로이고, 페이로드 증가분은 무시할 수 있는 수준이다.
  - 제안: 없음.

- **[INFO]** `@MinLength(1)` 추가는 검증 체인에 상수 시간 비교 1회만 더한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`botToken` 필드, `@IsString()`·`@MaxLength(256)` 사이에 삽입)
  - 상세: `class-validator` 의 `@MinLength` 는 `string.length` 비교로 O(1)이다. 검증 파이프라인의 점근적 복잡도에 변화가 없다. 오히려 이 추가가 막는 결함(빈 문자열이 `SecretResolver.rotate` 를 통해 먼저 저장된 뒤 provider 호출이 실패하는 경로)은 **불필요한 시크릿 저장 쓰기 1회를 막는** 방향이라 성능에 긍정적이다.
  - 제안: 없음.

- **[INFO]** 신규 `[등가성]` 테스트 쌍이 동일 필드 집합에 대해 NestJS 테스트 모듈을 총 10회 재컴파일한다(프로덕션 코드 아님, CI 시간에만 영향)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `it.each(BLOCKED_FIELD_CASES)('[A] %s — 서비스 가드가 details 를 { field, code } 로 낸다', ...)` 블록과 바로 아래 `it.each(BLOCKED_FIELD_CASES)('[등가성] %s — 서비스 message 는 공유 상수에서 온다', ...)` 블록
  - 상세: 두 `it.each` 가 동일한 5-tuple `BLOCKED_FIELD_CASES` 를 공유하도록 이번 PR(후속 fix 커밋 `0fb691248`)이 중복을 제거했으나, 여전히 **블록 자체는 둘**이라 각 필드마다 `setup('x')`(`Test.createTestingModule(...).compile()`, DI 그래프 재구성)와 `service.update(...)` 호출이 두 번(코드 검증용 1회 + 메시지 검증용 1회) 실행된다 — 동일 입력에 대해 module 컴파일이 5회가 아니라 10회 일어난다. NestJS 테스트 모듈 컴파일은 단순 `it.each` 반복 대비 상대적으로 비용이 크다(리플렉션 기반 DI 해석). 다만 이는 순수 테스트 실행 시간(CI)에만 영향을 주고 프로덕션 hot path 와는 무관하며, 반복 횟수가 5(상수)로 유계라 점근적 복잡도 문제는 아니다. 이전 라운드 testing reviewer 가 이미 같은 지점을 "한 `it.each` 로 통합해 module 재컴파일 절반으로" 제안했고(`review/code/2026/09/11/11_05_27/testing.md` INFO #2), 후속 fix 는 fixture 배열만 공유시키고 블록 통합까지는 하지 않았다.
  - 제안: 두 assertion(`details` 와 `message`)을 한 `it.each` 안에서 함께 검증하도록 병합하면 module 컴파일 횟수를 절반(5회)으로 줄일 수 있다. 프로덕션 영향 없는 테스트-전용 최적화라 차단 사유 아님.

## 요약

이번 변경은 에러 응답 `details` 에 `code` 키를 배선(15자리, 이전 라운드 이후 canonical `ErrorCode.INVALID_FIELD` 참조로 치환됨)하고, 중복된 거부 메시지 리터럴을 단일 상수로 통합하며, `botToken` 에 `@MinLength(1)` 검증 데코레이터 하나를 추가하는 구조적/계약 정합화 작업이다. 모든 프로덕션 코드 변경이 예외 경로(냉경로) 또는 요청당 O(1) 검증 단계에 위치하고, 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O 는 도입되지 않았다. 상수 추출은 중복 문자열 리터럴을 줄이는 방향이라 미세하게 긍정적이며, `@MinLength(1)` 은 불필요한 시크릿 쓰기 1회를 막아 부수적으로 성능에도 도움이 된다. 유일한 관찰 사항은 신규 테스트의 `it.each` 두 블록이 같은 fixture 로 NestJS 테스트 모듈을 10회 재컴파일하는 점인데, 이는 CI 실행 시간에만 영향을 주는 INFO 수준이며 프로덕션 성능과 무관하다. 성능 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
