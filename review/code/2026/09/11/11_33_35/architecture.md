# 아키텍처(Architecture) 리뷰

## 컨텍스트

이번 diff(`0fb691248`)는 직전 리뷰 라운드(`review/code/2026/09/11/11_05_27`)의
architecture WARNING 4건(코드 리터럴 중복·거짓 헤더 주석·편도 동기화·fixture 중복)에 대한
**fix 라운드**다. 아래는 각 WARNING 이 실제로 해소됐는지 코드로 직접 재검증한 결과와,
그 위에서 추가로 발견된 사항이다.

## 발견사항

- **[INFO]** (검증 완료) canonical `ErrorCode.INVALID_FIELD` 재사용 — 이전 WARNING 온전히 해소
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:50`(신규 import), `:511,657,663,670,701,708,735,746,802,816,834,847,1011`(13곳 전부 `ErrorCode.INVALID_FIELD` 사용)
  - 상세: 이전 라운드가 지적한 15자리 문자열 리터럴 중 `triggers.service.ts` 13곳은 전부 `ErrorCode.INVALID_FIELD` import 참조로 치환됐다(`grep -c` 로 리터럴 잔존 0건, 상수 참조 13건 실측). `password.util.ts` 남은 2곳(`:75,:96`)은 리터럴을 유지하되 그 이유를 코드 주석으로 명시했다 — "`common/` 이 `nodes/` 를 import 하는 선례가 0건"이라는 주장을 `grep -rl "nodes/core" codebase/backend/src/common/` 로 직접 재확인했고 실제로 0건이었다. 반대로 `modules/triggers` 가 `nodes/core/error-codes` 를 참조하는 것은 `websocket`·`execution-engine`·`external-interaction`·`executions` 등 다수 `modules/*` 가 이미 쓰는 기존 패턴이라 새 순환이나 계층 위반이 아니다. 절반만 옮기고 절반은 방치하는 "하다 만" 리팩터가 아니라, 계층 경계에 근거해 의도적으로 갈린 것 — 근거가 실측 가능하고 실제로 참이다.
  - 제안: 조치 불필요. 다만 `nodes/core` 를 에러코드 SoT 로 계속 확장하는 것이 장기적으로 맞는지(코멘트가 스스로 제안하는 `common/` 승격)는 트래커 항목으로 남아 있으니 그대로 유지.

- **[INFO]** (검증 완료) 거짓 헤더 주석 정정 — 이전 WARNING 온전히 해소
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 파일 헤더
  - 상세: 존재하지 않는 `chat-channel-rejection-messages.spec.ts` 를 가리키던 문장이, 실제 등가성 단언이 있는 두 파일(`dto/trigger-dto-validation.spec.ts`·`triggers.service.spec.ts`)의 구체적 테스트 이름으로 정정됐다("전용 spec 파일은 없다" 명시). `git diff origin/main` 으로 두 스펙 파일 모두에 `[등가성]` 테스트가 실제로 존재함을 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** (검증 완료) 편도 동기화 → 양방향 동기화로 설계 반전 — 이전 INFO 온전히 해소
  - 위치: `chat-channel-rejection-messages.const.ts`(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES: Record<ChatChannelBlockedField, string>`)
  - 상세: 종전 `satisfies` 판본은 배열→메시지 key 유효성만 편도 검사했다. 이번 수정은 배열을 1차 SoT 로 유지하되 메시지 객체 타입을 `Record<ChatChannelBlockedField, string>` 으로 바꿔, 메시지 객체에 키가 하나라도 빠지거나(누락 컴파일 에러) 타입에 없는 키가 추가되면(초과 컴파일 에러) 양쪽 다 TS 컴파일 타임에 잡히도록 반전했다. 코드를 직접 읽어 타입 선언이 실제로 `Record<...>` 형태임을 확인했다 — 근거가 되는 설계 주장(양방향 컴파일 타임 검사)이 실제 타입 정의와 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** (검증 완료) `it.each` fixture 중복 → 공유 상수로 통합 — 이전 WARNING 온전히 해소
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(`BLOCKED_FIELD_CASES` 상수, `[A]`/`[등가성]` 두 `it.each` 가 공유)
  - 상세: 두 블록에 바이트 그대로 복제돼 있던 5-tuple 배열이 `BLOCKED_FIELD_CASES` 하나로 합쳐졌고, 추가로 "fixture 가 `CHAT_CHANNEL_BLOCKED_FIELDS` 전체를 덮는지"를 `toEqual` 로 고정하는 별도 테스트(`[A] fixture 가 차단 5필드 전체를 덮는다`)까지 신설해, 손으로 적은 fixture 배열이 향후 6번째 필드 추가 시 조용히 뒤처지는 것을 막았다. 단순 중복 제거를 넘어 "중복 제거만으로는 drift 를 못 막는다"는 점까지 테스트로 캐너리화한 점이 눈에 띈다.
  - 제안: 조치 불필요.

- **[INFO]** CHANGELOG 미기록 — 이전 WARNING 해소
  - 위치: `CHANGELOG.md` `## Unreleased — 거부 사유가 사람만 읽을 수 있었다 …` 항목
  - 상세: 이전 라운드가 지적한 두 동작 변경(`details[].code` 배선, `botToken` 빈 문자열 거부)이 모두 기록됐고, 범위 밖으로 명시적으로 스코프아웃한 항목(도메인 특화 코드 미신설, trim 정책 미결정)까지 "범위 밖을 함께 적는다" 절로 남겨 다음 사람이 "전부 닫혔다"로 오독하지 않도록 했다.
  - 제안: 조치 불필요.

- **[INFO]** (carry-forward, 신규 아님) `TriggersService` 비대화 지속 — 이번 라운드도 계속 누적, 그러나 plan 이 정확히 추적 중
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 전체(1852줄 → 이번 라운드에 13개 site 추가 수정, 순 라인수 소폭 증가)
  - 상세: `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets` 등 provider-특화 검증 책임이 `TriggersService` 안에 그대로 남아 있다. `plan/in-progress/impl-details-code-wiring.md:19-28,65`(§"E 의 전제는 실측으로 틀렸다")를 직접 읽어 확인한 결과, 이 PR 자체가 "E(모듈 경계 추출)는 별도 PR" 로 명시적으로 스코프아웃했고, 그 근거(과거 `forwardRef` 순환 제거 이력 때문에 `chat-channel/` 이 아니라 `triggers/` 안 협력자로 추출해야 한다는 실측)까지 plan 에 남아 있다. `- [ ] E 후속 PR` 체크박스도 살아 있다. Critical 이 아니며, 이번 라운드가 새로 만든 부채도 아니다.
  - 제안: 조치 불필요 — 후속 PR 착지 여부만 추적.

## 요약

이번 diff 는 신규 기능이 아니라 직전 아키텍처 리뷰 WARNING 4건에 대한 정정 라운드이며, 네 항목 모두 코드를 직접 읽고 `grep`/`git diff` 로 재검증한 결과 **온전히, 절반이 아니라 전부** 해소됐다 — canonical 상수 참조 13/13, 거짓 스펙 인용 정정, 편도→양방향 타입 반전, fixture 완전 통합 + exhaustiveness 캐너리 신설, CHANGELOG 기록까지 확인했다. `password.util.ts` 가 리터럴을 유지한 것은 방치가 아니라 계층 경계(`common/` → `nodes/` 미참조 선례)에 근거한 의도적 결정이고 그 근거를 실측으로 확인했다. `TriggersService` SRP 누적은 여전하지만 plan 이 후속 PR 로 명시적·구체적 근거와 함께 분리해 두었으므로 이번 라운드의 병합을 막을 사안이 아니다. 신규 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
