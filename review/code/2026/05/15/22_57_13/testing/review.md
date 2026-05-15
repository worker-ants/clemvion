# Testing 리뷰

## 발견사항

### 파일 4 & 5: cleanup-invalid-jobs.util.spec.ts / cleanup-invalid-jobs.util.ts (신규)

- **[INFO]** 테스트 커버리지 범위는 양호하나 logger 호출 검증 케이스 부재
  - 위치: `cleanup-invalid-jobs.util.spec.ts` — `sweepInvalidJobs` describe 블록 전체
  - 상세: `sweepInvalidJobs`에 주입 가능한 `CleanupLogger` 인터페이스가 설계에 포함되어 있고, `SILENT_LOGGER`가 기본값으로 쓰인다. 그러나 실제 로그 라인 포맷(`[${name}] scanning ...`, `jobId=... name=... payloadKeys=...`, `[${name}] invalid=... removed=...`)이 의도대로 출력되는지 검증하는 케이스가 없다. 운영 시 grep 친화적 출력이 핵심 가치이므로, 최소 1개의 "logger 인자를 모킹해 출력 포맷 확인" 케이스가 있으면 회귀를 잡기 좋다.
  - 제안: `logger: { log: jest.fn(), warn: jest.fn() }` 를 sweepOptions에 넣고, `logger.log`가 특정 패턴으로 호출되는지 검증하는 케이스를 추가한다.

- **[INFO]** `apply=true, pauseDuringSweep=true` 조합 케이스 부재
  - 위치: `cleanup-invalid-jobs.util.spec.ts` — `sweepInvalidJobs` describe 블록
  - 상세: 현재 테스트 케이스는 apply와 pauseDuringSweep를 각각 true로 설정하는 경우를 분리해서 다룬다. 두 플래그가 동시에 true인 경우(가장 실제 운영에 가까운 경로)에 pause→getJobs→remove→resume 순서가 보장되는지 직접 검증하는 케이스가 없다.
  - 제안: `apply: true, pauseDuringSweep: true`로 callOrder를 추적하는 케이스를 1개 추가한다.

- **[INFO]** `pauseDuringSweep=false`일 때 `queue.resume()`이 호출되지 않음을 확인하는 케이스 암묵적 처리
  - 위치: `cleanup-invalid-jobs.util.spec.ts` line 946-968 (dry-run 케이스)
  - 상세: dry-run 케이스에서 `queue.pause`와 `queue.resume` 둘 다 not.toHaveBeenCalled로 검증하므로 이 경로는 커버되어 있다. 명시적으로 의도를 드러낸 좋은 패턴이다.
  - 제안: 유지.

---

### 파일 7: migrate-button-ids.spec.ts (임포트 경로 수정)

- **[INFO]** `../../scripts/migrate-button-ids` → `./migrate-button-ids` 경로 수정은 테스트 격리 측면에서 올바른 방향
  - 위치: `migrate-button-ids.spec.ts` line 4(변경 전) → line 4(변경 후)
  - 상세: 이전 상대경로(`../../scripts/...`)는 `backend/src/scripts/` 기준에서 잘못된 경로로, 실제로 spec 파일이 해당 위치로 이동됨에 따라 올바르게 수정되었다. 이 수정으로 `jest` 실행 시 경로 해석 오류가 제거된다.
  - 제안: 유지.

- **[INFO]** `main()` 경로(DB 연결, 트랜잭션, audit_log 쓰기)에 대한 단위 테스트 없음 — 의도적
  - 위치: `migrate-button-ids.spec.ts` 전체
  - 상세: 파일 상단 주석에 "DB-touching `main()` path is exercised manually (staging dry-run before prod apply)"라고 명시되어 있어 의도적인 결정이다. 다만 `runMigration`의 순수 로직(scan + pendingUpdates 누적 + dry-run 분기)은 `DataSource`를 모킹하면 단위 테스트 가능하다. 향후 회귀 방지를 위해 추가를 고려할 수 있다.
  - 제안: 단기 필수는 아님. 장기적으로 `runMigration`을 export하고 모킹된 `DataSource`를 주입하는 형태로 단위 커버를 보완하면 안전성이 높아진다.

- **[WARNING]** `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID`가 모듈 최상위에서 `process.argv`를 즉시 평가
  - 위치: `migrate-button-ids.ts` lines 2111-2125
  - 상세: `const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply')` 및 `parseCliFlag` 호출이 모듈 import 시점에 실행된다. 단위 테스트 환경에서 `process.argv`를 조작하지 않으면 이 값들이 고정되어 버려 `backfillButtonIds`의 순수 로직 테스트에는 영향이 없지만, 향후 `runMigration`을 테스트할 때 `DRY_RUN` 분기를 제어하기 어렵다. `loadDotenv()`를 main() 안으로 이동한 것처럼, CLI 파싱도 main() 안으로 이동하면 테스트 용이성이 개선된다.
  - 제안: `DRY_RUN`과 `parseCliFlag` 호출을 `main()` 내부로 이동하고 `runMigration(ds, opts)`처럼 옵션을 인자로 전달한다.

---

### 파일 3: background-runs.service.ts (코드 포맷 정리 및 import 제거)

- **[INFO]** `BackgroundRunNodeExecutionsPageDto` import 제거에 대한 회귀 테스트 여부 확인 필요
  - 위치: `background-runs.service.ts` line 327 (diff)
  - 상세: `BackgroundRunNodeExecutionsPageDto`를 import 목록에서 제거했다. 이 DTO가 서비스 메서드 시그니처나 반환 타입에 노출되지 않는다면 기존 테스트에 영향이 없다. 다만 해당 DTO를 직접 참조하는 기존 단위 테스트가 있다면 컴파일 오류가 발생할 수 있다.
  - 제안: `background-runs.service.spec.ts` 또는 관련 테스트 파일에서 `BackgroundRunNodeExecutionsPageDto`를 직접 참조하는지 확인한다. 참조가 없으면 문제없다.

- **[INFO]** 코드 포맷 변경(줄바꿈 재정렬)은 테스트 영향 없음
  - 위치: `background-runs.service.ts` diff 전체 (`.where(...)` 포맷, `qb.orderBy` 체이닝, `toNodeExecutionDto` 시그니처, `aggregateBodyStatus` 시그니처)
  - 상세: 모두 whitespace/포맷만 변경이므로 기존 테스트를 깨지 않는다.
  - 제안: 유지.

---

### 파일 2: backend/scripts/cleanup-invalid-queue-jobs.ts (삭제)

- **[INFO]** 구 스크립트 삭제로 인해 기존 스크립트를 직접 import하거나 참조하는 테스트가 있는지 확인 필요
  - 위치: `backend/scripts/cleanup-invalid-queue-jobs.ts` (삭제)
  - 상세: 구 스크립트는 테스트 파일을 별도로 갖지 않았고, 기능이 `cleanup-invalid-jobs.util.ts`로 리팩토링되어 `util.spec.ts`로 커버된다. 경로 변경(`backend/scripts/` → `backend/src/scripts/`)으로 인해 구 경로를 참조하는 테스트가 있다면 깨질 수 있다.
  - 제안: `grep -r "cleanup-invalid-queue-jobs"` 등으로 구 경로 참조를 확인하고, 없으면 문제없다.

---

### 파일 1: backend/package.json

- **[INFO]** `cleanup:queue-jobs` 스크립트 추가 — 테스트 스크립트 체계와 무관
  - 위치: `package.json` line 35
  - 상세: 운영 용도의 npm script 추가이며, 기존 `test`, `test:cov`, `test:e2e` 스크립트에는 영향이 없다. 이 스크립트 자체에 대한 e2e/통합 테스트는 없지만 핵심 로직은 `util.spec.ts`로 커버되어 있다.
  - 제안: 유지.

---

## 테스트 아키텍처 전반 평가

`cleanup-invalid-jobs.util.ts` + `cleanup-invalid-jobs.util.spec.ts` 쌍이 이번 변경의 핵심이다. 구 `backend/scripts/cleanup-invalid-queue-jobs.ts`가 NestJS 외부 스크립트로 테스트 불가능한 구조였던 것과 달리, 신규 구현은 로직을 `sweepInvalidJobs`, `parseCleanupArgs`, `formatSummaryLine`으로 분리해 의존성 주입(`Queue`, `CleanupLogger`)을 허용한다. 이는 테스트 용이성 면에서 명확한 개선이다. `util.spec.ts`는 dry-run/apply, 페이지네이션, 오류 격리, pause/resume 순서, 타입 엣지 케이스(null/number/공백)를 모두 커버한다. `migrate-button-ids.spec.ts`는 순수 변환 로직을 충분히 검증한다. 다만 `migrate-button-ids.ts`에서 `DRY_RUN`이 모듈 로드 시점에 확정되는 구조는 향후 `runMigration` 테스트를 어렵게 만들 수 있어 개선 여지가 있다. `background-runs.service.ts`는 포맷 전용 변경으로 테스트 영향이 없다.

## 위험도

LOW
