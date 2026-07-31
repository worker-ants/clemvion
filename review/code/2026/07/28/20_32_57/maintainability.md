# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `applyRetryLastTurn` 이 이번 diff 로 더 길어지고 분기점이 늘었다 — 신규 ATOMIC CLAIM 블록은 자기완결 단위라 helper 추출이 자연스럽다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:268` (메서드 시작, 종료는 `:451` — 총 184줄). 신규 블록은 `:310`-`:339`.
  - 상세: `applyRetryLastTurn` 은 이미 lookup → fast-path 상태 체크 → `_retryState` 존재 체크 → (신규) atomic claim → execution/node 조회 → context rehydrate → turn 구동 → graph 재개 → try/catch/finally 로 early-return 가드 6개 + try/catch/finally 를 포함해 분기점이 9~10개에 달한다. 이번 diff 가 그 중간에 `claim` 조건부 UPDATE(신규 31줄, 310-339행)를 추가로 끼워 넣으면서 길이·복잡도가 더 늘었다. 이 신규 블록은 "spawnedNodeExecutionId 를 받아 claim 성공 여부(boolean)를 반환" 하는 성격이 명확해 독립 추출·단위 테스트가 쉽다. 같은 파일이 이미 동일한 이유(가드 재사용·테스트 용이성)로 `finalizeGuarded` 를 private 메서드로 분리한 전례가 있고(`:472`), 엔진 쪽에는 동일 명명 컨벤션의 `claimResumeEntry`(`execution-engine.service.ts:1174`) 선례도 있다. 참고로 backend `eslint.config.mjs` 에는 `max-lines-per-function`/`complexity` 룰이 없어(확인함) 이 길이 증가를 자동으로 잡아주는 정적 게이트가 없고, 코드 리뷰가 유일한 체크포인트다.
  - 제안: `private async claimSpawnedRetryRow(spawnedNodeExecutionId: string): Promise<boolean>` 형태로 분리해 `applyRetryLastTurn` 본문은 `if (!(await this.claimSpawnedRetryRow(spawnedNodeExecutionId))) { return; }` 한 줄로 축약. 함수 길이·복잡도 완화, 단위 테스트 대상 명확화, `claimResumeEntry`/`finalizeGuarded` 네이밍 관례와도 정합.

- **[INFO]** JSONB 키 `'_retryState'` 가 raw SQL 리터럴로 4곳(기존 2 + 이번 diff 신규 2)에 중복돼 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:326`, `:331` (신규) — 동일 리터럴 패턴이 `:200`, `:207` (기존 `retryLastTurn` 소비 블록)에도 있음.
  - 상세: `input_data - '_retryState'` / `jsonb_exists(input_data, '_retryState')` 처럼 JSONB 키 이름이 문자열 리터럴로 4곳에 박혀 있고, 타입 시스템이 이 문자열을 `RetryState`/`outputData._retryState` 프로퍼티 접근과 연결해주지 않는다. `retry-turn.service.spec.ts:427,433` 의 (b3) 테스트가 정확히 이 문자열을 정규식으로 검증해 무작위 오타는 CI 가 잡아주지만, "SQL 리터럴과 매칭 테스트만 함께 일관되게 잘못 바뀌고 실제 프로퍼티 접근명은 그대로인" 리네임 시나리오까지는 못 잡는다.
  - 제안: `const RETRY_STATE_KEY = '_retryState';` 같은 단일 상수를 두고 4개 SQL 조각을 템플릿 리터럴로 참조하면 단일 진실 지점이 생겨 향후 drift 위험이 줄어든다.

- **[INFO]** 동일한 히스토리 서사("fast-path 체크가 과거 '자체 멱등 가드' 로 서술돼 continuation processor 가 원자 claim 대상에서 retry_last_turn 을 제외하는 근거가 됐고, 그 자기모순이 ai-review 5차 라운드 CRITICAL 이었다")가 3개 파일에 문구만 바꿔 반복 서술된다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:281`-`:285`, `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:83`-`:92`, `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:371`-`:374`.
  - 상세: 세 곳 모두 같은 사건(자기참조적 주석이 낳은 CRITICAL)을 각자의 표현으로 재서술한다. 이번 커밋이 세 곳을 동시에 손봐야 했다는 사실 자체가 이 반복의 유지비용을 보여준다 — 서사가 다시 정정될 때마다 세 곳의 동기화가 필요하다.
  - 제안: 서사의 정본은 한 곳(예: `applyRetryLastTurn` JSDoc 또는 claim 블록)에만 남기고, 나머지 두 곳은 "왜 여기 없는지/왜 이렇게 되어 있는지"를 한두 줄로 요약한 뒤 정본 위치를 참조하는 방식으로 축약.

- **[INFO]** 테스트 파일의 query-builder mock 체이닝 보일러플레이트가 이번 diff 로 2곳 더 늘어 전체 10곳에 근접한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:389`, `:414` (신규 (b2)/(b3)) — 유사 블록이 이미 `:61`, `:73`, `:186`, `:934`, `:985`, `:1016`, `:1092`, `:1152` 등에 존재.
  - 상세: `{ update: jest.fn().mockReturnThis(), set: ..., where: ..., andWhere: ..., execute: ... }` 형태가 테스트마다 인라인으로 재구성된다. 테스트별로 어느 절에 spy 를 심을지가 달라 완전한 통합은 어렵지만, 공통 뼈대(미지정 절은 `mockReturnThis()`)를 만들어주는 팩토리 하나만 있어도 반복이 줄어든다. 테스트 전용 코드라 우선순위는 낮음.
  - 제안: `function makeQueryBuilderMock(overrides?: {...}) {...}` 류의 헬퍼를 파일 상단에 두고 각 테스트가 필요한 절만 override.

- **[INFO]** (경미) 주석의 조건 bullet 순서와 실제 `.andWhere()` 체이닝 순서가 어긋난다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:314`-`:318` (주석) vs `:328`-`:331` (코드).
  - 상세: 주석은 `jsonb_exists`(레이스 결정자)를 먼저 설명하고 `status='running'`을 이어서 설명하는데, 실제 코드는 `status` 조건이 먼저이고 `jsonb_exists` 가 나중이다. SQL `AND` 는 교환 법칙이 성립해 동작에는 영향 없지만, 주석과 코드의 순서를 맞추면 대조가 더 쉬워진다.
  - 제안: 코드 조건절 순서를 주석 순서에 맞추거나(jsonb_exists 먼저), 주석 순서를 코드 순서에 맞춰 재배열.

## 요약

이번 diff(`applyRetryLastTurn` 재진입 가드를 조건부 UPDATE 원자 claim 으로 교체)는 범위가 작고 목적이 분명하며, 기존 파일의 확립된 관례(`retryLastTurn` 의 atomic-consume 과 동일한 JSONB `-`/`jsonb_exists` 패턴, `:running` bind-var 네이밍이 엔진 쪽 여러 곳과 일치, `ack-and-discard` 로깅 스타일 일관)를 그대로 따라 전반적으로 읽기 쉽고 일관성이 높다. 변경 자체는 새로운 중첩이나 매직 넘버를 만들지 않았고, 새 분기(b2/b3)에 대응하는 단위 테스트도 함께 추가돼 변경-테스트 대응이 좋다. 다만 (1) 이미 길었던 `applyRetryLastTurn` 이 이번 추가로 더 길어져 자기완결적인 claim 로직을 helper 로 뽑아낼 시점에 가까워졌고, (2) `_retryState` JSONB 키 리터럴이 4곳(신규 2 포함)에 중복돼 단일 상수화 여지가 있으며, (3) 동일한 히스토리 서사가 3개 파일에 중복 서술돼 있다는 점은 향후 유지보수 비용을 조금씩 키우는 요인이다. 모두 즉시 차단할 문제는 아니고 점진적 개선 항목이다.

## 위험도

LOW
