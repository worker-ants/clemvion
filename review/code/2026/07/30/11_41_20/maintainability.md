# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `applyRetryLastTurn` 이 여전히 길고(188줄) 분기점이 많다(순환 복잡도 ~10) — 직전 라운드가 제안한 helper 추출은 실행됐으나 순 길이는 줄지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:281`(메서드 시작) ~ `:468`(종료). 신규 가드 시퀀스는 `:308`-`:356`.
  - 상세: 직전 라운드(`review/code/2026/07/28/20_32_57/maintainability.md` WARNING)가 "claim 블록은 자기완결 단위라 helper 추출이 자연스럽다"고 지적했고, 실제로 `claimSpawnedRetryRow`(`:520`-`:534`)로 추출됐다(전례: `finalizeGuarded`). 그러나 같은 CRITICAL 수정 커밋(`414550a1d`)이 claim 성공 후 필수가 된 새 판정 2개 — "claim 성공했으나 in-memory `retryState` 부재"(구조적 불변식 위반 방어, `:337`-`:348`)와 "claim 이 지운 키를 in-memory 에도 반영"(`:356`의 `delete`) — 를 같은 메서드에 추가해, 추출로 줄어든 분량을 상쇄하고 총 길이는 오히려 184→188줄로 늘었다. early-return 가드(구조 검증·상태 체크·claim 실패·retryState 부재·execution 부재·node 부재·PARK_RELEASED) 7개 + try/catch/finally 로 순환 복잡도가 ~10에 달한다. `eslint.config.mjs` 에는 `complexity`/`max-lines-per-function` 룰이 없어 정적 게이트가 없고 코드 리뷰가 유일한 체크포인트다.
  - 제안: `:308`-`:356`(in-memory retryState 확보 → claim 호출 → claim 실패/retryState 부재 판정 → in-memory 동기화)을 `claimSpawnedRetryRow`/`finalizeGuarded` 추출 전례와 동일한 방식으로 `private async claimAndSyncRetryState(spawnedRow): Promise<RetryState | null>` 로 분리하면 본문이 "null 이면 discard, 아니면 계속" 한 줄로 축약되고 각 판정이 독립적으로 단위 테스트 가능해진다.

- **[WARNING]** `applyRetryLastTurn` 의 execution/node not-found 처리 블록이 메시지 2곳만 다르고 완전히 동일한 구조를 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:364`-`:375`(execution not found), `:376`-`:387`(node not found). (이 두 블록은 원 추출 커밋 `0c275dd7f0`부터 존재하던 기존 패턴 — 이번 diff 로 신규 도입된 것은 아니나, 리뷰 유형이 "Review"(전체 파일)이므로 범위에 포함.)
  - 상세: 두 블록 모두 `logger.error(...)` → `spawnedRow.status = FAILED` → `spawnedRow.error = {message: ...}` → `spawnedRow.finishedAt = new Date()` → `save(spawnedRow)` → `return` 순서로 동일하며, 차이는 로그 문구와 에러 메시지 문자열뿐이다.
  - 제안: `private async markSpawnedRowFailed(spawnedRow: NodeExecution, message: string): Promise<void>` 헬퍼로 공통 5줄을 추출하고 호출부는 메시지만 다르게 전달.

- **[INFO]** 동일한 "자체 멱등 가드" 히스토리 서사가 파일 3곳에 문구만 바꿔 반복되며, 직전 라운드 지적 이후에도 그대로다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:297`-`:300`, `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:372`-`:374` (+ 리뷰 범위 밖 `continuation-execution.processor.ts:89`-`:92`).
  - 상세: `review/code/2026/07/28/20_32_57/maintainability.md` INFO 항목이 이미 이 3중 반복을 지적했으나 이번 라운드에도 미조치 상태다. 서사가 다시 정정될 때마다 3곳 동기화 비용이 든다. 즉시 조치는 불필요.
  - 제안: 정본을 한 곳(예: `applyRetryLastTurn` fast-path 주석)에 두고 나머지 두 곳은 "정본 참조" 한 줄로 축약.

- **[INFO]** 테스트 파일의 query-builder mock 보일러플레이트가 9곳으로 늘었고, 직전 라운드 지적 이후에도 미조치다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:389`, `:414`, `:448`, `:494`, `:1006`, `:1057`, `:1088`, `:1164`, `:1224`.
  - 상세: `{ update: jest.fn().mockReturnThis(), set, where, andWhere, execute }` 형태가 테스트마다 인라인으로 재구성된다. 직전 라운드가 "테스트 전용 코드라 우선순위는 낮음"으로 판정한 항목과 동일하며 그 판단은 여전히 유효하다.
  - 제안: 공통 뼈대를 반환하는 팩토리 헬퍼(예: `function mockQueryBuilder(overrides?: {...})`)를 파일 상단에 두고 각 테스트가 필요한 절만 override.

- **[INFO]** `claimSpawnedRetryRow` JSDoc 의 조건 설명 순서가 실제 `.andWhere()` 체이닝 순서와 여전히 어긋난다(직전 라운드 지적, 미조치).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:477`-`:482`(주석 — `jsonb_exists` 먼저, `status='running'` 나중) vs `:528`-`:531`(코드 — `status='running'` 먼저, `jsonb_exists` 나중).
  - 상세: SQL `AND` 는 교환법칙이 성립해 동작에 영향은 없으나, 주석과 코드를 나란히 대조하기 어렵다.
  - 제안: 주석 순서를 코드 순서(status 먼저)에 맞추거나 반대로 통일.

- **[INFO]** `finalizeGuarded` 의 CANCELLED 분기와 FAILED/COMPLETED 분기가 query-builder 골격을 그대로 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:612`-`:626`(CANCELLED) vs `:627`-`:640`(기본).
  - 상세: `.createQueryBuilder().update(Execution).set({...}).where('id = :id', ...).andWhere('status = :status', ...).execute()` 골격이 두 번 반복되고 `.set()` 페이로드(COALESCE 표현식 vs raw 덮어쓰기, `error` 포함 여부)만 다르다. 각 분기가 다른 이유를 설명하는 주석이 이미 상세하므로(:594-:611) 무리하게 통합하면 그 설명력을 해칠 수 있어 우선순위는 낮다.
  - 제안: 원한다면 공통 골격만 `private guardedLifecycleUpdate(executionId, target, setClause, params?)` 로 추출하되 분기별 rationale 주석은 유지.

- **[INFO]** 매직 넘버 — 초→ms 변환 `1000` 하드코딩.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:190`.
  - 상세: `retryAfterSec * 1000` 의 `1000` 이 이름 없는 리터럴이다. 파일이 이미 `RETRY_STATE_KEY` 로 단일 상수화 관례를 세워둔 것과는 비대칭이지만, 보편적으로 이해되는 변환 계수라 실질 위험은 낮다.
  - 제안: 원한다면 `const MS_PER_SECOND = 1000` 상수화 (선택 사항).

- **[INFO]** 동일 개념(재진입 시작 시 로드된 `Execution` 엔티티)의 파라미터 이름이 메서드마다 `execution`/`savedExecution` 으로 갈린다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:556`(`finalizeGuarded(execution: Execution, ...)`), `:684`(`completeRetryExecution(execution: Execution, ...)`), `:744`(`resumeGraphAfterRetry(savedExecution: Execution, ...)`).
  - 상세: `applyRetryLastTurn` 이 로드해 넘기는 동일 엔티티가 호출 체인을 따라 `execution` → (`resumeGraphAfterRetry` 진입 시) `savedExecution` 으로 이름이 바뀐다. 자매 메서드 `resumeFromCheckpoint` 의 기존 명명을 그대로 따른 것으로 보이나(문서화된 의도적 코드 공유), 파라미터를 추적하는 독자에게는 순간적 혼동을 줄 수 있다.
  - 제안: 우선순위는 낮음 — 향후 신규 파라미터 도입 시 이 파일 내부에서는 `execution` 계열로 통일하는 편을 권장.

## 요약

이번 라운드는 이전 ai-review(`review/code/2026/07/28/20_32_57`)가 발견한 CRITICAL 2건(claim 삽입 위치 결함)을 수정한 커밋(`414550a1d`) 이후 전체 파일을 재검토한 것이다. 전반적 유지보수성은 견고하다 — 네이밍은 `claimResumeEntry`/`finalizeGuarded` 등 기존 관례와 일관되고, 직전 라운드의 최우선 WARNING(claim 블록 helper 추출)과 INFO(`RETRY_STATE_KEY` 단일 상수화)는 실제로 반영됐으며, guard-clause 스타일 덕분에 중첩 깊이는 대체로 얕고, 각 판정의 이유가 spec 조항·과거 리뷰 라운드까지 추적 가능하게 JSDoc/인라인 주석으로 상세히 설명돼 있다. 다만 (1) `applyRetryLastTurn` 은 claim 블록 추출에도 불구하고 그 직후 필수로 추가된 새 판정들 때문에 순 길이·복잡도가 줄지 않았고, (2) execution/node not-found 처리 블록의 명백한 중복이 남아 있으며, (3) 직전 라운드가 지적한 INFO 3건(히스토리 서사 3중 반복·테스트 mock 보일러플레이트·주석-코드 순서 불일치)이 그대로 미조치 상태로 지속된다. 모두 정확성에 영향을 주지 않는 점진적 개선 항목이며, 코드는 이미 다수 회차의 집중 검토와 mutation 테스트를 통과한 상태다.

## 위험도

LOW
