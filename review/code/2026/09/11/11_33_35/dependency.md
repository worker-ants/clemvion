# Dependency Review — chatChannel `details[].code` 배선 + PATCH botToken 빈 문자열 방지

## 점검 범위 확인

리뷰 대상 9개 코드 파일(`CHANGELOG.md`, `password.util.{ts,spec.ts}`,
`chat-channel-rejection-messages.const.ts`(신규), `chat-channel-config.dto.ts`,
`trigger-dto-validation.spec.ts`, `triggers.service.{ts,spec.ts}`,
`chat-channel-trigger-create.e2e-spec.ts`) 전부를 확인했다. 나머지(`plan/in-progress/**`,
`review/code/**`, `review/consistency/**`)는 이전 리뷰/컨시스턴시 라운드 산출물이며 코드가 아니다.

`package.json`·`pnpm-lock.yaml`·`package-lock.json` 등 매니페스트 파일은 이 diff 에 **전혀
포함되어 있지 않다** (`git log`/`grep` 로 대상 파일 목록에 없음을 확인). 즉 이번 변경은 **외부
패키지를 하나도 추가·제거·버전변경 하지 않는다** — 순수 내부 리팩토링 + 테스트 보강이다.

## 발견사항

- **[INFO]** 신규 내부 상수 모듈 `chat-channel-rejection-messages.const.ts` — 의존 방향 정상, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규 파일, import 없음)
  - 상세: 5필드 거부 메시지를 단일 상수(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)로 승격해
    `dto/chat-channel-config.dto.ts` 와 `triggers.service.ts` 양쪽(파이프 층 + 서비스 층)이 같은
    문자열을 참조하게 했다. 상수 파일 자체는 외부 의존성이 없고, 소비자 방향이
    `dto/`, `triggers.service.ts` → `chat-channel-rejection-messages.const.ts` 한 방향이라
    순환 위험이 없다. `Record<ChatChannelBlockedField, string>` 타입으로 필드 배열과 메시지
    맵의 **양방향 동기화**를 컴파일러가 강제하도록 설계한 점도 내부 결합을 안전하게 만든다.
  - 제안: 없음 — 설계가 건전하다.

- **[INFO]** `INVALID_FIELD` 리터럴이 3곳에 흩어짐 — canonical enum 대비 로컬 복제
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode.INVALID_FIELD` 정의) ·
    `codebase/backend/src/common/pipes/validation.pipe.ts:13,58` (기존, 리터럴) ·
    `codebase/backend/src/common/utils/password.util.ts` (`validatePasswordStrength` 함수, 이번 PR 신규 리터럴)
  - 상세: `triggers.service.ts` 는 이번 PR 에서 `ErrorCode.INVALID_FIELD` (canonical import,
    `nodes/core/error-codes.ts`)를 쓰는 반면, `common/utils/password.util.ts` 는 같은 값을
    문자열 리터럴 `'INVALID_FIELD'` 로 하드코딩한다. PR 자체 주석이 이 비대칭을 정확히
    설명한다 — `common/` → `nodes/` import 선례가 0건이라 층을 거스르지 않기 위한 의도적
    선택이며, 상수를 `common/` 으로 승격하는 것은 9개 모듈의 import 경로를 건드리는 별개
    작업으로 트래커에 남겼다고 명시했다. `grep` 으로 실측한 결과 확인: `common/` 이
    `nodes/core/error-codes` 를 import 하는 곳은 여전히 0곳, `modules/**` 는 8곳에서 이미
    import 하고 있어(`websocket.gateway.ts`, `ai-turn-orchestrator.service.ts`,
    `execution-engine.service.ts`, `workflow-errors.ts`, `shutdown-state.service.ts`,
    `interaction.service.ts`, `executions.service.ts`, `executions.controller.ts`) 이번
    `triggers.service.ts` 의 import 는 기존 선례를 따른 것이지 새로운 계층 위반이 아니다.
    `error-codes.md` 규약도 인라인 문자열 리터럴 발행을 명시적으로 허용 범위에 포함하므로
    (`§Overview` "인라인 문자열 리터럴로 발행되는 코드... 포함") 규약 위반은 아니다. 다만
    `'INVALID_FIELD'` 값이 언젠가 바뀌면(§2 정책상 거의 없겠지만) `password.util.ts` 와
    `validation.pipe.ts` 는 컴파일 타임에 드리프트를 잡아주지 못한다 — 순수 내부 유지보수
    리스크이며 외부 의존성 문제는 아니다.
  - 제안: 이미 문서화된 트래커 항목(상수를 `common/` 안전한 위치로 승격) 그대로 진행 —
    지금 이 PR 범위에서 추가로 요구할 사항은 없음.

- **[INFO]** 새 상수 파일 소비처 확산 범위 — 4개 파일 (프로덕션 2 + 테스트 2)
  - 위치: `dto/chat-channel-config.dto.ts`, `triggers.service.ts`,
    `dto/trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`
  - 상세: 내부 모듈 의존 관계 확산이 `modules/triggers/` 디렉터리 내부로 국한돼 있고
    외부 모듈에서 이 상수를 import 하지 않는다. 응집도가 높고 blast radius 가 작다.
  - 제안: 없음.

## 요약

이번 diff 는 **외부 패키지 추가·삭제·버전변경이 전혀 없다** — `package.json`/lockfile 변경이
diff 목록에 존재하지 않음을 확인했다. 유일한 신규 "의존성"은 순수 내부 TypeScript 상수 모듈
(`chat-channel-rejection-messages.const.ts`)이며, import 방향이 단방향이고 순환이 없어 번들
크기·빌드 시간에 미치는 영향은 무시할 수준이다. `triggers.service.ts` 가 `nodes/core/error-codes`
의 `ErrorCode` 를 import 하는 것은 8건의 기존 `modules/**` 선례를 따른 것으로 계층 위반이
아니며, `common/utils/password.util.ts` 가 같은 값을 리터럴로 유지한 것도 `common/` → `nodes/`
선례 0건이라는 근거로 의도적으로 층을 거스르지 않은 결정이다(트래커 항목으로 후속 예정).
라이선스·취약점·버전 고정·호환성 관점에서는 검토할 대상 자체가 없다.

## 위험도

NONE
