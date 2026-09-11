# 성능(Performance) 리뷰

## 검토 범위와 방법

`git diff origin/main..HEAD --stat -- codebase/` 로 실제 실행 코드 변경 파일을 확인했다: 8개
(`password.util.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` · `chat-channel-config.dto.ts`
· `trigger-dto-validation.spec.ts` · `triggers.service.{ts,spec.ts}` · `chat-channel-trigger-create.e2e-spec.ts`)
+ mdx 문서 2개(텍스트만, 실행 코드 아님). `CHANGELOG.md`·`plan/in-progress/*.md`·
`review/code/2026/09/11/{11_05_27,11_33_35}/**`·`review/consistency/2026/09/11/10_28_52/**` 는 정적
markdown/json 산출물이라 성능 검토 대상이 아니다(직전 두 라운드 performance reviewer 도 동일 스코프 판단).

이번 프롬프트(`12_00_40`)가 실은 diff 는 직전 라운드(`11_33_35`)가 이미 전수 검토한 상태에 대한
**증분**이다. `git show --stat HEAD`(커밋 `2d0270fbd`)로 직접 확인한 결과, `11_33_35` 리뷰 이후 이 턴이
추가한 것은 (1) `trigger-dto-validation.spec.ts` 의 `[C]` 테스트에 `toHaveLength(1)` 단언 추가(엄격도
통일, I7), (2) `triggers.mdx`/`triggers.en.mdx` 두 문장에 `details.code` 문구 추가(W2, user-guide 동기화)
뿐이다. `triggers.service.ts`·`triggers.service.spec.ts`·`password.util.ts`·`chat-channel-config.dto.ts`·
`chat-channel-rejection-messages.const.ts` 는 `11_33_35` 이후 **변경이 없다** — `git diff origin/main --
codebase/backend/src/modules/triggers/triggers.service.ts`(및 `.spec.ts`)를 직접 열어 재확인했고, 그
내용은 직전 라운드 `performance.md`(`review/code/2026/09/11/11_33_35/performance.md`)가 이미 다룬 것과
동일하다.

이번 변경 전체의 본질은 세 가지로 요약된다:
1. 기존 에러 응답 `details`(객체/배열, 15자리)에 `code` 키 1개 추가(대부분 `ErrorCode.INVALID_FIELD`
   상수 참조, `password.util.ts` 2곳만 리터럴)
2. `chatChannel` 차단 5필드의 거부 메시지 리터럴을 `chat-channel-rejection-messages.const.ts` 의
   module-level `as const` 상수로 통합, DTO 데코레이터·서비스 가드 두 층이 참조
3. `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 검증 데코레이터 1개 추가

세 축 모두 요청당 O(1) 연산이고, 전부 예외/검증 실패 경로(cold path, 4xx 응답 생성 시에만 실행)에
위치한다. 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O 는 프로덕션 코드 어디에도 도입되지
않았다.

## 발견사항

CRITICAL/WARNING 급 발견 없음. `11_33_35` 라운드가 이미 지적한 INFO 1건(테스트 전용, 아래 재확인)
외에 이번 증분(I7 단언 강화, mdx 문구 추가)에서 새로 발생한 성능 관련 사항은 없다.

- **[INFO]** (직전 라운드에서 이미 관측, 이번 증분 미해결 — 상태 재확인) `[A]`·`[등가성]` 두 `it.each`
  블록이 동일 fixture 로 NestJS 테스트 모듈을 총 10회 재컴파일한다(프로덕션 코드 아님, CI 시간에만 영향)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `BLOCKED_FIELD_CASES` 를
    공유하는 `it.each(...)('[A] %s — 서비스 가드가 details 를 { field, code } 로 낸다', ...)` 블록과
    바로 아래 `it.each(...)('[등가성] %s — 서비스 message 는 공유 상수에서 온다', ...)` 블록
  - 상세: 두 블록이 각자 `await setup('x')`(`Test.createTestingModule(...).compile()`, 리플렉션 기반
    DI 그래프 재구성)를 필드마다 호출해, 동일 입력(5 케이스)에 대해 module 컴파일이 5회가 아니라 10회
    일어난다. 이 지점은 `11_05_27` testing reviewer 가 처음 지적했고(`review/code/2026/09/11/11_05_27/
    testing.md` INFO #2), `11_33_35` performance reviewer 가 fixture 공유 후에도 블록 자체는 둘로 남아
    해소되지 않았음을 재확인했다(`review/code/2026/09/11/11_33_35/performance.md` INFO #4). 이번
    `12_00_40` 증분은 이 파일을 건드리지 않아(git diff 로 확인) 상태 변화 없음. 프로덕션 hot path 와
    무관하고 반복 횟수가 5(상수)로 유계라 점근적 복잡도 문제는 아니다.
  - 제안: 두 assertion(`details` 와 `message`)을 한 `it.each` 안에서 함께 검증하도록 병합하면 module
    컴파일 횟수를 절반(5회)으로 줄일 수 있다. 프로덕션 영향 없는 테스트-전용 최적화라 차단 사유 아님 —
    이번 PR 을 막을 근거로 쓰지 않는다.

- **[INFO]** `details.code` 추가는 응답 payload 크기를 상수 크기만큼만 늘린다 (기존 판단 유지)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 13곳(`ErrorCode.INVALID_FIELD`
    참조), `codebase/backend/src/common/utils/password.util.ts` 2곳(리터럴)
  - 상세: 각 `BadRequestException` 페이로드에 짧은 문자열 키 1개가 추가된다. 예외(4xx) 발생 시에만
    실행되는 냉경로이며 페이로드 증가분은 무시할 수 있는 수준.
  - 제안: 없음.

- **[INFO]** `@MinLength(1)` 추가는 검증 체인에 상수 시간 비교 1회만 더하고, 오히려 불필요한 시크릿
  쓰기 1회를 막아 성능에 긍정적
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`botToken` 필드,
    `@IsString()`·`@MaxLength(256)` 사이)
  - 상세: `class-validator` 의 `@MinLength` 는 `string.length` 비교로 O(1). 이 추가가 막는 결함(빈
    문자열이 `SecretResolver.rotate` 를 통해 provider 호출 전에 먼저 저장되는 경로)은 실패할 요청에서
    불필요한 시크릿 UPSERT 1회를 조기에 걷어내는 방향이라 부수적으로 성능에도 도움이 된다.
  - 제안: 없음.

- **[INFO]** mdx 문서 2곳(`triggers.mdx`/`triggers.en.mdx`)의 이번 증분 변경은 정적 텍스트 문자열
  교체뿐이며 런타임 성능과 무관
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`, `triggers.mdx` (각 1줄,
    `details.code='INVALID_FIELD'` 문구 추가)
  - 상세: 빌드타임 MDX 콘텐츠 텍스트 변경으로, 런타임 렌더링 비용에 영향 없음(문자열 길이 증가분 무시
    가능 수준).
  - 제안: 없음.

## 요약

이번 리뷰 대상 diff 는 에러 응답 `details` 에 `code` 키를 배선(15자리)하고, 중복된 거부 메시지
리터럴을 단일 상수로 통합하며, `botToken` 에 `@MinLength(1)` 검증 데코레이터 하나를 추가하는
구조적/계약 정합화 작업이다. 모든 프로덕션 코드 변경이 예외 경로(냉경로) 또는 요청당 O(1) 검증 단계에
위치하고, 신규 반복문·DB/API 호출·대규모 메모리 할당·블로킹 I/O 는 도입되지 않았다. 직전 두 라운드
(`11_05_27`, `11_33_35`)가 이미 프로덕션 코드 전체를 성능 관점에서 전수 검토했고, 이번 `12_00_40`
라운드가 다루는 증분(테스트 단언 엄격도 통일 1건, mdx 문구 동기화 2줄)은 런타임과 무관해 그 결론을
바꾸지 않는다. 유일하게 남아 있는 관찰 사항은 신규 테스트의 `it.each` 두 블록이 같은 fixture 로
NestJS 테스트 모듈을 10회 재컴파일하는 점인데, 이는 CI 실행 시간에만 영향을 주는 INFO 수준이며
프로덕션 성능과 무관하고 이번 증분에서 새로 생긴 것도 아니다. 성능 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
