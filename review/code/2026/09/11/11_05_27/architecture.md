# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `details[].code` 값 `'INVALID_FIELD'` 를 15곳에 문자열 리터럴로 중복 배선 — 기존 canonical 상수를 재사용하지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:509,655,662,669,700,707,730,741,794,809,821,830,995` (13곳), `codebase/backend/src/common/utils/password.util.ts:66,87` (2곳)
  - 상세: 이 PR 은 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 라는 공유 상수를 새로 만들어 "메시지 문자열이 두 층에서 갈리면 안 된다"는 등가성을 코드 레벨로 고정했다(근거는 타당). 그런데 같은 PR 이 함께 배선하는 `details[].code: 'INVALID_FIELD'` 값에는 **같은 원칙을 적용하지 않고** 문자열 리터럴을 15곳에 그대로 흩뿌렸다. 저장소에는 이미 이 정확한 목적("VALIDATION_ERROR 응답 `details[].code` — canonical code strings, one source of truth")으로 선언된 `ErrorCode.INVALID_FIELD` (`codebase/backend/src/nodes/core/error-codes.ts:116`)가 있고, `modules/execution-engine/workflow-errors.ts`·`modules/external-interaction/interaction.service.ts`·`modules/executions/*`·`modules/websocket/*`·`modules/integrations/integrations.service.ts` 등 다수의 `modules/*` 파일이 실제로 이를 import 해 쓰고 있다. `triggers.service.ts`/`password.util.ts`(및 기존 `common/pipes/validation.pipe.ts`)는 이 SoT 를 import 하지 않고 리터럴을 반복한다. 결과적으로 하나의 값이 코드베이스 안에서 "상수로 참조되는 곳"과 "리터럴로 박히는 곳"으로 나뉘어 있다 — 오탈자(`'INVALID_FEILD'` 등)가 나면 타입 시스템이 아니라 이번에 추가된 테스트에만 의존해 잡힌다.
  - 제안: `ErrorCode.INVALID_FIELD` 를 import 해 리터럴을 치환한다. 다만 `common/utils/password.util.ts`·`common/pipes/validation.pipe.ts` 처럼 `nodes/core` 를 참조하기에 계층이 낮은 파일이 있다면, 그 판단(`nodes/core` 의존을 피하는 것이 의도적 레이어 경계인지)을 먼저 확인하고, 그렇다면 이 canonical 값을 더 낮은 공용 위치(`common/`)로 승격하는 것이 근본 해법이다.

- **[WARNING]** 상수 파일 헤더 주석이 존재하지 않는 스펙 파일(`chat-channel-rejection-messages.spec.ts`)을 SoT 근거로 인용
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 파일 헤더 주석 (`"그 등가성을 상수로 고정하고, chat-channel-rejection-messages.spec.ts 가 두 층이 이 상수를 쓰는지 단언한다."` 문장)
  - 상세: 이 문장은 이 상수의 등가성을 검증하는 전용 스펙 파일이 존재한다고 서술하지만, 그런 파일은 이 diff 에도 저장소 어디에도 없다(`grep` 전수 확인 — 0건). 실제 등가성 단언은 `trigger-dto-validation.spec.ts` 의 `[등가성]` 테스트(파이프 층)와 `triggers.service.spec.ts` 의 `[등가성]` 테스트(서비스 층)에 나뉘어 존재한다. 모듈이 스스로의 테스트 소재지를 부정확하게 서술하는 것은, 다음에 이 파일을 여는 사람(혹은 agent)이 실재하지 않는 파일을 찾다 시간을 쓰게 만드는 경계 서술 결함이다.
  - 제안: 주석을 `trigger-dto-validation.spec.ts` / `triggers.service.spec.ts` 의 실제 `[등가성]` 테스트 위치로 정정한다.

- **[INFO]** `CHAT_CHANNEL_BLOCKED_FIELDS` 배열과 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 객체의 동기화가 컴파일러가 아니라 사람 주의에 의존
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:22-45`
  - 상세: `CHAT_CHANNEL_BLOCKED_FIELDS` 는 `as const satisfies readonly (keyof typeof CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES)[]` 로 선언돼 배열의 각 원소가 메시지 객체의 유효한 key 인지는 검사하지만, 메시지 객체의 **모든** key 가 배열에 포함됐는지(exhaustiveness)는 검사하지 않는다. 나중에 6번째 차단 필드 메시지가 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 에 추가되는데 `CHAT_CHANNEL_BLOCKED_FIELDS` 갱신을 빠뜨려도 컴파일 에러가 나지 않는다 — 두 층 순회 테스트(`[등가성]`, `CHAT_CHANNEL_BLOCKED_FIELDS` 로 순회)가 그 신규 필드를 조용히 건너뛰게 된다. 파일 자체의 주석은 "배열을 따로 두는 이유는 타입 안전"이라 말하지만, 그 안전은 편도(원소→key 유효성)일 뿐 양방향은 아니다.
  - 제안: 필드 목록(`as const` 배열)을 1차 SoT 로 두고 `Record<(typeof FIELDS)[number], string>` 타입으로 메시지 객체를 선언하는 순서로 뒤집으면, 객체 쪽에서 키 누락·초과가 있을 때 컴파일 에러로 양방향 동기화가 강제된다.

- **[INFO]** `TriggersService` (1852줄) 로의 chatChannel 검증 로직 추가 누적 — 이미 트래킹된 항목이나 계속 커짐
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (전체), 특히 `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider` 군
  - 상세: 이 PR 은 위 메서드들의 13개 throw 자리에 `code` 를 추가해 `TriggersService` 의 provider-특화 검증 책임을 그대로 유지·확장한다. `plan/in-progress/impl-details-code-wiring.md` 자신이 "E(`TriggersService` 모듈 경계 추출)는 후속 PR" 이라고 명시적으로 인지·분리했고, 그 근거(`#676` 의 `forwardRef` 순환 제거를 되살리지 않기 위해 `chat-channel/` 이 아니라 `triggers/` 안의 협력자로 추출해야 한다)도 실측에 기반해 타당하다. Critical 은 아니며, "동작 변경(A)과 이동(E)을 한 diff 에 섞지 않는다"는 판단 자체는 리뷰 관점에서 바람직하다 — 다만 후속 PR 이 실제로 같은 턴에 착지하는지 추적이 필요하다(체크리스트에 미체크 항목으로 남아 있음).

## 요약

이번 변경은 새 필드·API 표면을 추가하는 기능 개발이 아니라, 기존 계약(§5.3 `details[].code`)을 사후 배선하고 두 검증 층(class-validator DTO 파이프 / `TriggersService` 가드) 사이의 메시지 리터럴 중복을 공유 상수로 접는 구조적 정리에 가깝다. `assertChatChannelInputSafe` 의 오버로드로 `mode`↔DTO 타입을 컴파일 타임에 묶은 설계, DTO·서비스 양쪽이 같은 필드를 같은 이유로 거부해야 한다는 요구를 상수 하나로 고정한 설계는 모두 타당한 근거를 가진 선택이며 레이어 경계(프레젠테이션 검증 vs 비즈니스 가드)를 침범하지 않는다. `TriggersService` 의 비대화(SRP 관점의 누적 부채)도 계획서가 이미 인지하고 후속 PR 로 명시적으로 분리했다. 다만 이 PR 이 스스로 "메시지 중복은 상수로 고정한다"고 주장하면서 나란히 추가한 `code: 'INVALID_FIELD'` 리터럴 15곳에는 그 원칙을 적용하지 않았고, 저장소에 이미 존재하는 canonical `ErrorCode.INVALID_FIELD` SoT 를 재사용하지 않은 점, 그리고 새 상수 파일의 자기 서술(주석)이 실재하지 않는 스펙 파일을 가리키는 점은 구조적 일관성 측면에서 지적할 만하다. 두 항목 모두 동작을 깨뜨리지 않는 유지보수성 문제로, 병합을 막을 사안은 아니다.

## 위험도

LOW
