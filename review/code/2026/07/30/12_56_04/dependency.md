### 발견사항

- **[INFO]** `claimSpawnedRetryRow` 방어 로직 주석이 TypeORM 특정 패치 버전 동작에 근거하지만 `package.json` 은 caret 범위로 고정
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:359` (주석: `TypeORM 0.3.30 기준으로 확인된 jsonb diff`)
  - 상세: `applyRetryLastTurn` 의 `delete spawnedRow.inputData[RETRY_STATE_KEY]` (같은 파일 369번 줄) 바로 위 주석이 "TypeORM 0.3.30 기준으로 확인된" stale-entity jsonb diff 재조합 동작을 근거로 든다. 그런데 `codebase/backend/package.json:88` 의 `"typeorm": "^0.3.28"` 은 caret 범위라 `0.3.28`~`0.3.x` 최신 패치까지 자동 허용한다 (실제 lockfile 은 `typeorm@0.3.30` 으로 해석돼 주석의 실측 버전과는 현재 일치— `pnpm-lock.yaml:9304`). 즉 코드 정합성 근거가 서드파티 라이브러리의 정확한 패치 버전 동작 관측에 결속돼 있는데, 그 버전이 pin 이 아니라 범위로 열려 있다.
  - 다만 리스크는 낮다 — 주석이 스스로 "이 delete 자체는 버전-불문 방어라 이후 patch 버전에서도 유지한다(W9)" 라고 명시해, 실제 안전장치(무조건 delete)는 TypeORM 의 향후 patch 동작 변경 여부와 무관하게 유지된다. 이번 diff 는 `package.json`/lockfile 을 건드리지 않으므로 이 자체가 새로 도입된 의존성 리스크는 아니다.
  - 제안: 현상 유지로 충분하나, 차후 `typeorm` 패치 업데이트 시 이 주석이 언급하는 jsonb diff 관측이 여전히 유효한지(또는 이미 무의미해졌는지) 회귀 스펙(`retry-turn.service.spec.ts` 의 "ai-review CRITICAL #2 회귀" 케이스, 369/560/583 줄 부근 `_retryState` 부활 방지 단언)로 계속 잠겨 있는지만 확인하면 충분 — 별도 액션 불필요.

- **[INFO]** 신규 `NodeEventType` 심볼은 기존에 이미 로드되던 내부 모듈에서 추가로 가져온 것 — 신규 모듈 의존 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:10-11`
  - 상세: `ExecutionEventType` 만 가져오던 import 가 같은 `../websocket/websocket.service` 모듈에서 `NodeEventType` 을 추가로 가져오도록 확장됐다(`ExecutionEventType`/`NodeEventType` 둘 다 그 모듈이 원래 export 하던 enum — `websocket.service.ts:66`, `:168`). 새 외부/내부 모듈 의존이 아니라 같은 모듈의 기존 export 활용 범위 확장이므로 의존성 관점에서 위험 없음.
  - 제안: 조치 불필요 (정보성 기록).

### 요약

이번 변경(`retry-turn.service.ts` / `retry-turn.service.spec.ts`)은 `package.json`·lockfile 어디에도 diff 가 없어 **신규 외부 패키지 추가가 전무**하다 (`git diff origin/main --stat -- '**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml' '**/yarn.lock'` 결과 0줄). 신규 private 메서드 `claimSpawnedRetryRow` (2차 원자 claim) 도 같은 파일의 `retryLastTurn` 이 이미 쓰던 `nodeExecutionRepository.createQueryBuilder().update().set().where().andWhere().execute()` TypeORM 패턴과 Postgres 내장 jsonb 연산자(`-`, `jsonb_exists`)를 그대로 재사용해, 새 라이브러리·새 DB 확장·새 TypeORM API 표면을 전혀 끌어들이지 않는다. 유일하게 눈에 띄는 항목은 방어 코드 주석이 TypeORM 특정 patch 버전(0.3.30)의 관측된 동작을 근거로 들면서 `package.json` 은 caret 범위(`^0.3.28`)로만 고정돼 있다는 점인데, 주석 스스로 그 delete 를 "버전-불문" 방어로 설계했다고 명시하고 있어 실질 위험은 낮다. 내부 모듈 의존 관계(`RetryTurnService` 생성자 주입 목록, `RetryEngineDriver` ISP slice, `AiTurnOrchestrator` forwardRef) 도 이번 diff 에서 변경되지 않았고, spec 파일의 import 확장(`NodeEventType`)도 이미 로드되던 모듈의 기존 export 를 추가로 쓴 것뿐이다. 종합적으로 의존성 관점에서 실질적 우려사항은 없다.

### 위험도
NONE
