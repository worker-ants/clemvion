# Dependency Review — `details[].code` 배선 + PATCH botToken 빈 문자열 방지 (재검증 라운드)

## 점검 범위 확인

리뷰 대상 코드 파일: `CHANGELOG.md`, `codebase/backend/src/common/utils/password.util.{ts,spec.ts}`,
`codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`(신규),
`codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`,
`codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`,
`codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}`,
`codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`,
`codebase/frontend/src/content/docs/02-nodes/triggers.{en.,}mdx` 를 전부 확인했다.
나머지(`plan/in-progress/**`, `review/code/**`, `review/consistency/**`)는 이전
리뷰/컨시스턴시 라운드의 산출물이거나 plan 문서이며 코드/의존성 변경이 아니다.

`git diff origin/main --name-only` 로 `package.json`·`pnpm-lock.yaml`·`package-lock.json`
등 매니페스트 파일이 diff 목록에 **전혀 없음**을 실측했다. 즉 이번 변경은 **외부 패키지를
하나도 추가·제거·버전변경 하지 않는다** — 순수 내부 리팩토링(공유 상수 추출) + 검증 데코레이터
1개 추가 + 테스트 보강이다.

`triggers.service.ts` 의 신규 import 2개도 실측했다 — `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
(같은 디렉터리의 신규 내부 상수 파일)와 `ErrorCode`(`../../nodes/core/error-codes`, 기존
canonical enum). 둘 다 프로젝트 내부 모듈이고 외부 패키지가 아니다.

## 발견사항

- **[INFO]** 신규 내부 상수 모듈 `chat-channel-rejection-messages.const.ts` — 의존 방향 정상, 순환 없음, 외부 의존성 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규 파일, import 문 없음)
  - 상세: 5필드 거부 메시지를 단일 상수(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)로 승격해
    `dto/chat-channel-config.dto.ts`(파이프 층)와 `triggers.service.ts`(서비스 층) 양쪽이
    같은 문자열을 참조하게 했다. 소비 방향이 `dto/`, `triggers.service.ts` →
    `chat-channel-rejection-messages.const.ts` 한 방향이라 순환 위험이 없다.
    `Record<ChatChannelBlockedField, string>` 타입으로 필드 배열(`CHAT_CHANNEL_BLOCKED_FIELDS`)과
    메시지 맵의 **양방향 동기화**를 컴파일러가 강제하도록 설계한 점도 내부 결합을 안전하게
    만든다(주석이 밝힌 대로 종전 `satisfies` 판본은 편도 검사였다는 점까지 실제 코드로 확인).
  - 제안: 없음 — 설계가 건전하다.

- **[INFO]** `INVALID_FIELD` 값이 여전히 두 표현으로 공존 — canonical enum vs 로컬 문자열 리터럴 (이전 라운드 대비 변화 없음)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode.INVALID_FIELD` 정의) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts` (이번 PR, `ErrorCode.INVALID_FIELD` canonical import 사용) ·
    `codebase/backend/src/common/utils/password.util.ts` (이번 PR 신규, `code: 'INVALID_FIELD'` 리터럴)
  - 상세: `triggers.service.ts` 는 `modules/**` 층이라 `nodes/core/error-codes` 를 import 하는
    기존 선례(`websocket.gateway.ts` 등 8곳, `grep` 로 실측)를 따라 canonical enum 을 쓴다.
    반면 `common/utils/password.util.ts` 는 `common/` → `nodes/` import 선례가 0건이라는
    근거(PR 자체 주석 및 `grep` 실측 일치)로 문자열 리터럴을 유지했다. 두 표현이 같은 값을
    가리키는 한 기능상 문제는 없으나, `ErrorCode.INVALID_FIELD` 값이 바뀌면(정책상 드물지만)
    `password.util.ts` 는 컴파일 타임에 드리프트를 잡지 못한다 — 순수 내부 유지보수 리스크이며
    외부 의존성 문제는 아니다. PR 이 이를 트래커 항목(`common/` 으로 상수 승격, 9개 모듈
    import 경로 영향)으로 이미 명시했다.
  - 제안: 기존 트래커 항목 그대로 진행 — 이번 PR 범위에서 추가 요구 없음.

- **[INFO]** 새 상수 파일 소비처 확산 범위 — 프로덕션 2 + 테스트 2, `modules/triggers/` 내부로 국한
  - 위치: `dto/chat-channel-config.dto.ts`, `triggers.service.ts`,
    `dto/trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`
  - 상세: 외부 모듈이 이 상수를 import 하지 않아 blast radius 가 작다. 번들 크기·빌드 시간에
    미치는 영향은 무시할 수준(문자열 상수 객체 하나).
  - 제안: 없음.

- **[INFO]** `@MinLength(1)` 데코레이터 추가 — `class-validator` 기존 의존성 범위 내, 신규 패키지 아님
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`ChatChannelConfigDto.botToken`)
  - 상세: 이미 프로젝트가 사용 중인 `class-validator` 데코레이터를 하나 더 얹은 것으로,
    새 의존성 도입이 아니다. `@ApiProperty({ minLength: 1 })` 선언과 실제 검증 체인을
    일치시키는 변경이며 의존성 관점에서는 영향이 없다.
  - 제안: 없음.

## 요약

이번 diff 는 **외부 패키지 추가·삭제·버전변경이 전혀 없다** — `package.json`/lockfile 이
변경 파일 목록에 존재하지 않음을 `git diff --name-only` 로 재확인했다. 유일한 신규 "의존성"은
순수 내부 TypeScript 상수 모듈(`chat-channel-rejection-messages.const.ts`)이며, import 방향이
단방향이고 순환이 없어 번들 크기·빌드 시간 영향은 무시할 수준이다. `triggers.service.ts` 가
canonical `ErrorCode` enum 을 쓰고 `password.util.ts` 가 같은 값을 리터럴로 유지하는 비대칭은
계층 선례(각각 `modules/**`→`nodes/**` 8건, `common/**`→`nodes/**` 0건)에 근거한 의도적 결정으로
실측 확인했고, 이미 별도 트래커 항목으로 남아 있어 이번 PR 범위에서 추가 조치가 필요하지 않다.
라이선스·취약점·버전 고정·기존 의존성과의 호환성 관점에서는 검토할 신규 대상 자체가 없다.

## 위험도

NONE
