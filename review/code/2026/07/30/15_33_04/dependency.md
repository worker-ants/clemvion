# 의존성(Dependency) Review

## 대상 변경 개요

`execution.retry_last_turn` 재진입 짝 전이(FAILED→RUNNING/WAITING_FOR_INPUT)가 상태머신에서는 opt-in 허용되지만 DB 가드(`lockNonTerminalExecutionRow`)가 여전히 FAILED 를 배제해 항상 0행이었던 결함을 수정한 변경이다. 대상 5개 파일:

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

`git diff origin/main...HEAD` 로 실제 코드 변경분을 직접 대조했다 (프롬프트 페이로드가 대용량이라 `execution-engine.service.ts` 전체 컨텍스트가 1,225/8,582줄에서 내부 절단됨 — 나머지 구간은 실제 파일을 `Read`/`grep -n` 으로 직접 열어 정확한 줄 번호를 확인).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 확인 완료
  - 위치: 전체 diff 범위 (파일 1~5 공통)
  - 상세: `git diff origin/main...HEAD -- '**/package.json' 'package.json'`, `'**/pnpm-lock.yaml'`, `'**/yarn.lock'`, `'**/package-lock.json'` 전부 빈 결과. 5개 대상 파일의 diff 에도 새 `import`/`require` 문이 전혀 없다 (`git diff ... | grep -E "^\+.*import"` 로 확인한 유일한 매치는 `retry-turn.service.spec.ts` 의 기존 내부 모듈 `../websocket/websocket.service` 에서 `NodeEventType` 을 추가로 가져오는 것뿐 — 신규 외부 패키지 아님). 이번 변경은 상태머신 opt-in 폭 확장(`FAILED → WAITING_FOR_INPUT` 추가) + DB 가드 정합화 + 내부 인터페이스 파라미터 확장으로만 구성된 순수 내부 로직 수정이다.
  - 제안: 조치 불요.

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기 — 해당 없음
  - 위치: N/A
  - 상세: 새 의존성이 없으므로 버전 pinning, 라이선스 호환성, CVE, 번들/빌드 시간 영향 항목은 모두 영향 없음(no-op). 사용된 것은 기존 pinned `typeorm: "^0.3.28"` (`codebase/backend/package.json:88`) 의 `createQueryBuilder()`/`transaction()` API 뿐이며 이 변경으로 새 API surface 를 끌어오지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 내부 의존성 — `EngineDriver` ISP 인터페이스 확장이 파일 4곳에 걸쳐 일관되게 threading 됨
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:210` (`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 시그니처에 `opts?: { allowRetryReentry?: boolean }` optional 3번째 인자 추가), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8224`/`8233` (구현체 동일 시그니처), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (`this.driver.tryLockActiveExecutionAndSaveNodeExec(...)` 호출부 2곳에서 `allowRetryReentry ? {...} : undefined` 로 opts 전파)
  - 상세: `ExecutionEngineService implements EngineDriver`(`EngineDriver extends AiTurnEngineDriver, RetryEngineDriver`)이고 `AiTurnOrchestrator`/`RetryTurnService` 는 `forwardRef(() => ExecutionEngineService)` 기반 `ENGINE_DRIVER` 토큰으로 이 인터페이스만 주입받는 기존 ISP 구조(god-class 분해, C-1)를 그대로 따른다. 이번 변경은 그 표면에 **optional** 파라미터 1개를 추가하는 하위호환 확장이며, 인터페이스·구현체·호출부·mock(스펙 파일) 4곳이 정확히 동기화됐다(`grep -rn tryLockActiveExecutionAndSaveNodeExec` 로 전수 확인 — 시그니처 불일치·누락 호출부 없음). forwardRef 순환 DI 방향(엔진 ← orchestrator/retry, 값 import 는 단방향)도 변경되지 않았다.
  - 제안: 조치 불요 — 인터페이스 확장 방식(optional param)과 4-지점 동기화가 이 프로젝트의 기존 ISP 컨벤션에 정확히 부합한다.

- **[INFO]** 내부 의존성 — `RETRY_STATE_KEY` 상수 도입으로 중복 문자열 리터럴 단일화(의존성 위생 개선)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42` (`const RETRY_STATE_KEY = '_retryState';` 선언), 사용처 `retry-turn.service.ts:538`(`claimSpawnedRetryRow` 신설 메서드의 raw SQL) 포함 파일 내 4곳 이상
  - 상세: 기존에는 `_retryState` 문자열 리터럴이 raw SQL(`output_data - '_retryState'`, `jsonb_exists(..., '_retryState')`)과 TS 프로퍼티 접근(`outputData._retryState`, `seededInput._retryState`)에 손으로 중복돼 있어 리네임 시 조용히 drift 할 위험이 있었다(파일 자체 주석이 이 배경을 명시). 이번 변경은 새 외부 의존성을 들이지 않고 기존 파일 내부에 단일 상수를 도입해 그 중복을 제거한 것으로, "내부 의존성"·"불필요한 의존성" 관점에서 결합도를 낮추는 방향의 리팩터다(신규 결합 추가 아님).
  - 제안: 조치 불요 — 긍정적 방향.

- **[INFO]** 특정 서드파티 patch 버전 거동 인용 — 실질적 취약점 아님(문서적 참고)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538` 인근 (`claimSpawnedRetryRow` JSDoc 및 `applyRetryLastTurn` 내 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 라인 주석)
  - 상세: 주석이 "TypeORM 0.3.30 기준으로 확인된 jsonb diff 가 DB 를 재-SELECT 해 옛 값과 비교" 거동을 관찰 근거로 인용한다. `codebase/backend/package.json:88` 의 pin 은 `^0.3.28`(0.3.x 자동 패치/마이너 허용)이라 0.3.30 은 그 범위 안에 있다. 주석 자체가 "이 delete 는 버전-불문 방어라 이후 patch 버전에서도 유지한다"고 명시해, 특정 patch 거동에 대한 하드 의존이 아니라 관측된 현상에 대한 방어적 코딩(TypeORM 이 어떤 patch 로 바뀌어도 안전)임을 이미 표시하고 있다.
  - 제안: 조치 불요 — 향후 `typeorm` 마이너 업그레이드(0.4.x 등) 시 이 JSDoc 을 재검토 대상 후보로만 인지하면 충분하다(코드 자체는 버전에 안전).

- **[INFO]** 호환성 — 기존 의존성(NestJS/TypeORM/enum) 사용 패턴과 충돌 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:534` (`NON_TERMINAL_OR_FAILED_STATUSES_SQL` — `Object.values(ExecutionStatus)` 기반, 기존 `NON_TERMINAL_STATUSES_SQL`(WARNING #8 이력)과 동일 패턴의 형제 상수)
  - 상세: 신규 SQL 상수는 기존 `ExecutionStatus` enum(이미 프로젝트 전역에서 pinned 사용 중)에서 값을 파생하며 사용자 입력이 섞이지 않아(주석에 "enum 값 기반이라 인젝션 우려 없음" 명시) 기존 방어 패턴을 그대로 계승한다. `@nestjs/*`, `typeorm`, `bullmq` 등 이 파일이 참조하는 기존 의존성 버전과의 충돌 소지가 없다.
  - 제안: 조치 불요.

## 요약

이번 변경은 신규 외부 패키지·버전 변경·lockfile 변경이 전혀 없는 **순수 내부 로직 수정**이다(상태머신 opt-in 확장 + DB 가드 정합화 + 인터페이스 파라미터 확장 + 상수 추출). `package.json`/`pnpm-lock.yaml` 등 전 의존성 매니페스트 diff 가 비어 있음을 직접 확인했고, 변경 5개 파일 어디에도 새 `import`/`require` 가 없다. 내부 의존성 관점에서는 `EngineDriver`(ISP) 인터페이스에 optional 파라미터 1개를 하위호환적으로 추가하며 구현체·호출부·테스트 mock 4곳이 정확히 동기화됐고, `RETRY_STATE_KEY` 상수 추출은 기존에 여러 곳에 흩어져 있던 문자열 리터럴 결합을 오히려 줄이는 방향이다. 라이선스·취약점·번들 크기·버전 충돌 등 의존성 리스크 항목은 모두 해당 없음(no-op)이며, CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
