STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 diff 가 생략된 두 파일(`execution-engine.service.ts`, `execution-engine.service.spec.ts`)은
`Read`/`grep -n`으로 저장소를 직접 열어 실제 소스 줄 번호를 확인했다(`resolveTerminalDurationMs`/
`TERMINAL_DURATION_MS_SQL` 호출부 16곳 전수 grep). 이 두 파일에 대한 위치 인용은 grep 이 반환한
**실제 소스 파일의 줄 번호**이며, 프롬프트 문서 내 오프셋이 아니다. 나머지 파일은 프롬프트에 실린
게이트 숫자를 그대로 썼다. `review/code/2026/08/15/{09_58_24,10_18_38}/**` 는 이전 라운드 산출물이라
아키텍처 판단 대상(신규 코드)이 아니라 근거 참조용으로만 다뤘다.

## 발견사항

- **[WARNING]** `shared/utils` 계층의 "DB-엔진 비의존" 관례를 이 PR 이 처음으로 깬다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` (`TERMINAL_DURATION_MS_SQL`)
  - 상세: `shared/utils/` 폴더의 기존 7개 파일(`bcrypt-format.ts`, `retry-after.ts`,
    `sanitize-error-message.ts`, `strip-external-only-fields.ts`, `terminal-error-payload.ts` 등,
    직전 sibling 인 `terminal-error-payload.ts` 포함)은 전부 순수 TS 함수이고 SQL/DB 스키마 지식이
    없다. 이번 PR 이 추가한 `TERMINAL_DURATION_MS_SQL` 은 Postgres 전용 문법(`::timestamptz`,
    `EXTRACT(EPOCH FROM …)`, `LEAST`)과 컬럼명(`started_at`)을 문자열 상수로 품고 있어, "공용
    순수 유틸" 계층에 처음으로 영속 계층(raw SQL) 지식이 섞여 들어간다. JSDoc 은 *왜 이 헬퍼가
    필요한지*(원자적 RETURNING)는 잘 설명하지만, *왜 이 SQL 조각이 순수 함수들과 같은 폴더에
    있어야 하는지*는 설명하지 않는다. 기능적으로는 문제 없지만(단일 UPDATE 문 안에서 계산해야
    원자성이 보장된다는 근거는 타당함), 계층 경계 관점에서는 "shared/utils = DB 비의존 헬퍼"라는
    이 폴더의 암묵적 계약이 조용히 넓어졌다.
  - 제안: 강제 조치는 아니나, 이 SQL 상수를 `shared/persistence/` 같은 별도 하위 폴더로 분리하거나,
    최소한 파일 상단 JSDoc 에 "이 파일은 예외적으로 Postgres SQL 조각을 포함한다 — 순수 유틸과
    분리할지는 3번째 SQL 상수가 생길 때 재검토" 같은 한 줄로 계약 확장을 명시하면, 다음 사람이
    이 폴더에 SQL 을 추가해도 되는지 판단할 근거가 남는다.

- **[WARNING]** 같은 도메인 규칙(음수→null, 상한 클램프)이 TS 와 SQL 두 곳에 독립적으로 구현돼 SSOT 가 깨져 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:39-41`(`resolveTerminalDurationMs` 의
    `span >= 0 ? span : null`) vs `terminal-duration.ts:87-90`(`TERMINAL_DURATION_MS_SQL` 의
    `CASE WHEN … THEN NULL … LEAST(2147483647, …)`)
  - 상세: 파일 최상단 JSDoc 은 "종결 이벤트의 `durationMs` 를 **한 곳에서** 결정한다"고 선언하지만,
    실제로는 결정 지점이 두 곳(JS 분기, SQL `CASE` 식)이다. "시계 역행 → null", "상한 초과 →
    saturate/null" 같은 동일한 비즈니스 규칙이 언어와 실행 엔진(Node vs Postgres)을 넘나들며 두 번
    수기로 표현돼 있고, 이를 동기화하는 유일한 안전망은 `terminal-duration.spec.ts` 의
    `TERMINAL_DURATION_MS_SQL.toContain('LEAST(2147483647', 'THEN NULL')` 같은 **문자열 포함 검사**
    뿐이다(값 수준 통합 테스트 없음 — 이미 W10/W4 로 별도 리뷰어들이 테스트 관점에서 지적, 이 PR 의
    RESOLUTION 도 "e2e 값 검증 없음"을 후속 트래커로 넘겼다). 아키텍처 관점에서 이건 단순 테스트
    커버리지 문제가 아니라, **"한 곳에서 결정한다"는 설계 의도 자체가 두 개의 독립 표현으로
    쪼개져 있다는 구조적 사실**이다 — 다음 사람이 클램프 상한을 바꾸거나 sentinel 을 바꿀 때 한쪽만
    고치고 넘어갈 실질적 위험이 있다(이 세션의 메모리에 기록된 "방어를 한 방향으로만 세운다" 패턴과
    같은 계열).
  - 제안: 이 PR 범위에서 강제할 사항은 아니다(원자성 요구사항상 SQL 표현이 불가피). 다만 두 표현이
    분기할 때 즉시 드러나도록, 값 수준 e2e/통합 테스트(이미 RESOLUTION 이 트래커 등재한 항목)를
    이 SSOT 위반을 메우는 유일한 실질적 방어로 명시하고 우선순위를 높여둘 것.

- **[INFO]** "엔티티에 대입 → 몇 줄 뒤 emit payload 재계산" 관용구가 10개 호출부에 동형 반복 — OCP 관점에서 향후 필드 추가 비용을 예고한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639`/`668`,
    `:2413`/`2424`, `:2577`/`2593`, `:3564`/`3575`, `:4294`, `:4754`/`4767`, `:4882`/`4886`,
    `:4943`/`4965` / `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`/`730`,
    `:896`/`907`, `:949`/`971`
  - 상세: `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 로 엔티티를 먼저 스탬프하고,
    같은 함수 안에서 몇 줄 뒤 `durationMs: resolveTerminalDurationMs(x)` 로 emit payload 를 다시
    조립하는 패턴이 두 파일 10곳에 손으로 반복돼 있다(성능 리뷰가 이미 "중복 호출"로, 유지보수
    리뷰가 "자기참조 폴백 관용구"로 각각 다른 각도에서 지적함). 아키텍처 관점에서 더 중요한 것은
    비용이 아니라 **책임의 분산**이다 — "종결 시 엔티티를 마감하고 emit payload 를 구성한다"는 하나의
    응집된 오퍼레이션이 한 곳의 함수/클래스로 캡슐화되지 않고 16개 종결 지점에 각자 조립돼 있다.
    이 PR 이 직전에 `error` 필드로 정확히 같은 실패 모드(형제 호출부 누락, `error.nodeId` W1)를 이미
    겪었고, plan 문서(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)의 다음
    백로그 항목이 `result.outputs` 를 같은 16경로에 배관하는 것이라는 점을 볼 때, 이 반복 패턴은
    다음 필드 추가 때도 같은 "grep 으로 전수 확인 → 몇 곳 누락 발견 → 재수정" 사이클을 예약해 둔
    셈이다(실제로 이 PR 자체의 RESOLUTION 이 "6곳 보고 → 실측 9곳" 을 자인했다).
  - 제안: 이 PR 을 막을 사유는 아니다(이미 테스트로 16경로 전수가 고정됨). 다음 종결 필드가
    추가되기 전에, `stampAndBuildTerminalFields(entity, extra?)` 류의 단일 진입점으로 승격해
    "엔티티 마감 + emit payload 구성"을 한 함수 호출로 묶는 리팩터를 고려할 것 — 그러면 새 필드는
    이 한 함수만 확장하면 되고, 16개 호출부를 다시 grep-audit 할 필요가 없어진다.

- **[INFO]** REST(pull) 와 push(webhook/SSE/WS) 가 같은 도메인 이벤트를 서로 다른 필드 집합으로 노출 — 공유 뷰 추상화 부재
  - 위치: CHANGELOG.md (`REST GET /api/external/executions/:id 에는 아직 없다` 절), plan
    `spec-draft-eia-notification-payload-contract.md` 표(`durationMs` 행)
  - 상세: 이번 PR 은 push 계열(webhook/SSE/WS) 16경로 전부에 `durationMs` 를 채웠지만
    REST 재조회 엔드포인트는 그대로 두었다. 기능적으로는 CHANGELOG·plan 에 고지되고 트래커에
    등재돼 있어 "누락"이 아니라 "의도된 범위 밖"이다. 다만 구조적으로 보면, 같은 종결 도메인
    이벤트(execution 종결)를 표현하는 두 개의 독립된 직렬화 지점(REST DTO 매퍼 vs
    `toChatChannelEvent`/emit payload)이 공유 "terminal event view" 추상화 없이 각자 필드를
    유지보수하고 있다는 뜻이다 — 이번에 실제로 필드 하나가 한쪽에서만 갱신되며 비대칭이 생겼다.
    이는 새 필드가 생길 때마다 반복될 수 있는 구조적 원인이다.
  - 제안: 이 PR 범위 밖(이미 트래커에 등재됨). 다음에 REST 쪽을 채울 때, DTO 매퍼와 emit payload
    양쪽이 같은 소스(예: 공유 "terminal fields" 셀렉터)에서 값을 가져오도록 통합해 두면 이런
    누락이 구조적으로 재발하지 않는다.

- **[INFO]** (긍정) producer/consumer 타입 계약 분리 — DIP 관점에서 적절한 판단
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent`/`EiaFailedEvent`/
    `EiaCancelledEvent` 의 `durationMs?: number | null`)
  - 상세: producer 는 항상 키를 채우지만, 이 인터페이스는 명시적으로 "producer 계약이 아니라 consumer
    계약"이라 문서화하고 `?`(optional)를 유지했다 — 배포 경계에서 재생되는 레거시 이벤트가 실제로
    이 키를 갖지 않기 때문이다. 타입이 현재 구현이 보장하는 것보다 넓게 약속하지 않도록 의도적으로
    제약한 판단으로, 이 세션의 반복 교훈("문서한 보장이 구현보다 넓으면 안 된다")과 정확히 반대
    방향으로 — 즉 안전한 방향으로 — 결정돼 있다. `error.nodeId` 에서 이미 같은 판단을 내린 선례를
    인용해 일관성도 있다. 조치 불요, 좋은 패턴으로 기록.

- **[INFO]** `shared/utils/terminal-duration.ts` → `execution-engine`/`retry-turn` 단방향 의존, 순환 없음 확인
  - 상세: `terminal-duration.ts` 자체는 어떤 도메인 모듈도 import 하지 않는 순수 파일이고(SQL 상수도
    문자열 리터럴일 뿐 import 없음), `execution-engine.service.ts`/`retry-turn.service.ts` 가 이를
    단방향으로 import 한다(`grep -rln "terminal-duration'"` 결과 두 파일뿐). `chat-channel` 모듈은
    `ExecutionChannelEvent` 라는 이벤트 페이로드 타입만 소비하고 `execution-engine` 을 직접 import
    하지 않아, presentation/adapter 계층과 도메인 계층 사이의 결합도 이벤트 기반으로 유지된다.
    순환 의존 없음.

## 요약

핵심 설계 — 순수 계산(`resolveTerminalDurationMs`/`toFiniteNumber`)을 `shared/utils` 에 추출하고
raw UPDATE 5경로는 SQL 상수로 원자적 RETURNING 을 쓰는 구조 — 는 기존 sibling(`terminal-error-payload.ts`)
관례를 따르고 producer/consumer 타입 계약도 신중하게 분리해 전반적으로 건전하다. 다만 이 SQL 상수가
`shared/utils` 의 "DB 비의존 순수 헬퍼"라는 암묵적 계층 계약을 처음으로 깨고 있고, 그로 인해 동일한
도메인 규칙(시계 역행→null, 상한 클램프)이 TS/SQL 두 표현으로 갈라져 있어 값 수준 검증 없이는 drift
가능성이 구조적으로 남는다(둘 다 WARNING). 또한 "엔티티 마감 + emit payload 조립"이 16개 호출부에
동형 반복돼 있어, 다음 종결 필드(`result.outputs`, 이미 백로그에 등재)를 추가할 때 이번 PR 이 스스로
겪은 "형제 호출부 누락 → 재감사" 사이클이 재발할 소지가 있다(INFO, 향후 리팩터 후보). REST/push 필드
비대칭은 이미 문서·트래커로 관리되고 있어 이번 PR 자체의 결함은 아니다. 모두 이 PR 을 막을 사유는
아니며, 이미 강한 회귀 테스트(16경로 grep 전수, 헬퍼 25 케이스)로 방어돼 있다.

## 위험도

LOW
