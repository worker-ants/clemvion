# Architecture Review

## 발견사항

---

### 파일 5 & 6: cleanup-invalid-jobs.util.ts / cleanup-invalid-queue-jobs.ts (스크립트 리팩터링)

- **[INFO]** 스크립트 로직의 핵심 기능을 `cleanup-invalid-jobs.util.ts` 유틸 모듈로 분리한 설계는 단일 책임 원칙(SRP)을 잘 따르고 있다.
  - 위치: `backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts`
  - 상세: `sweepInvalidJobs`, `parseCleanupArgs`, `formatSummaryLine` 로 기능을 명확히 분리하고, 진입점 스크립트(`cleanup-invalid-queue-jobs.ts`)는 오케스트레이션만 담당한다. 이전 `backend/scripts/cleanup-invalid-queue-jobs.ts` 는 sweep 로직과 진입점이 혼재한 단일 파일이었으나, 이번 리팩터링으로 모듈 경계가 명확해졌다.
  - 제안: 현재 구조 유지. 긍정적 변경.

- **[INFO]** `CleanupLogger` 인터페이스 주입으로 의존성 역전 원칙(DIP)을 실현했다.
  - 위치: `cleanup-invalid-jobs.util.ts` L1406-L1409 (`CleanupLogger` 인터페이스), `SweepOptions.logger?: CleanupLogger`
  - 상세: 유틸 함수가 `console`에 직접 의존하지 않고 `CleanupLogger` 추상에 의존하므로, 테스트 시 로거 교체가 가능하다. `SILENT_LOGGER` 기본값 제공도 적절하다.
  - 제안: 현재 구조 유지.

- **[WARNING]** `cleanup-invalid-jobs.util.ts` 가 `knowledge-base` 모듈 내 `queues/` 하위에 위치하지만, 해당 유틸의 `sweepInvalidJobs` 는 BullMQ `Queue` 인터페이스만 사용하며 knowledge-base 도메인 개념에 독립적이다.
  - 위치: `backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts`
  - 상세: 현재 위치는 `isValidDocumentId` 의존성(`job-payload.util`)이 동일 디렉토리에 있어 실용적이기는 하나, 향후 다른 큐(knowledge-base 외)에 동일한 cleanup 패턴을 적용하려 할 때 모듈 경계를 넘어 임포트해야 한다. 스크립트 진입점(`src/scripts/`)이 `src/modules/knowledge-base/queues/`를 직접 임포트하고 있어 scripts 레이어가 특정 모듈 내부에 결합된다.
  - 제안: 장기적으로 `src/shared/queue-utils/` 또는 `src/common/` 같은 공유 레이어로 이동하거나, `isValidDocumentId` 의 검증 콜백을 `SweepOptions`에 주입받는 형태(예: `isInvalidJob?: (job: Job) => boolean`)로 변경하면 knowledge-base 모듈 경계 밖에서도 재사용 가능하다.

- **[INFO]** `backend/scripts/cleanup-invalid-queue-jobs.ts` (구 파일) 삭제 후 `backend/src/scripts/cleanup-invalid-queue-jobs.ts`(신규)로 경로 이동은 `backend/package.json`의 `cleanup:queue-jobs` npm script(`node dist/scripts/cleanup-invalid-queue-jobs.js`)와 일치하는 올바른 배치다.
  - 위치: `backend/package.json` L35, `backend/src/scripts/cleanup-invalid-queue-jobs.ts`
  - 상세: 이전 파일은 `backend/scripts/`(dist 빌드 대상 외부)에 있어 운영 환경에서 `node dist/scripts/...`로 실행이 불가능했다. 이번 이동으로 `src/scripts/` → `dist/scripts/` 빌드 경로가 확립되었다.
  - 제안: 현재 구조 유지.

---

### 파일 6: cleanup-invalid-queue-jobs.ts (환경 변수 처리)

- **[WARNING]** `cleanup-invalid-queue-jobs.ts` 에서 `dotenv.config()` 호출이 블록 스코프(`{ ... }`) 안에 있고 import 문 앞에 배치되어 있다. TypeScript/Node.js 에서 import 구문은 호이스팅되므로, `dotenv.config()` 가 실제로 모듈 로드 전에 실행된다는 보장이 없다.
  - 위치: `backend/src/scripts/cleanup-invalid-queue-jobs.ts` L1722-L1728
  - 상세: 이 패턴(`{ dotenv.config(); } import ...`)은 CommonJS(ts-node/tsc 출력)에서는 동작하지만, ESM 모드나 일부 번들러에서는 import 가 먼저 평가되어 환경 변수가 주입되기 전에 모듈 초기화가 실행될 수 있다. `migrate-button-ids.ts`(파일 8)는 이 문제를 인식해 `loadDotenv()`를 `main()` 내부에서 명시적으로 호출하는 더 견고한 패턴을 사용한다.
  - 제안: `cleanup-invalid-queue-jobs.ts`도 `migrate-button-ids.ts`와 동일하게 `loadDotenv()` 함수를 `main()` 첫 줄에서 호출하는 패턴으로 통일. 두 스크립트 간 아키텍처 일관성도 확보된다.

---

### 파일 8: migrate-button-ids.ts

- **[WARNING]** `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 가 모듈 최상위 레벨 상수로 평가된다(module-level side effect).
  - 위치: `backend/src/scripts/migrate-button-ids.ts` L2111-L2125
  - 상세: `process.argv`를 모듈 임포트 시점에 파싱하므로, 단위 테스트에서 `backfillButtonIds` 함수만 임포트해도 `process.argv` 파싱 코드가 실행된다. 테스트 파일(파일 7)에서 `backfillButtonIds`와 `BackfillHit`만 임포트하므로 현재는 큰 문제가 없으나, `DRY_RUN` 상수 값이 테스트 환경의 `process.argv`에 영향받는 잠재적 취약점이다. (`cleanup-invalid-queue-jobs.ts`의 `parseCleanupArgs`는 `main()`에서 호출되어 이 문제를 회피하고 있다.)
  - 제안: `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 파싱을 `main()` 내부로 이동하거나, `parseCliArgs()` 함수로 추출해 `main()` 에서 호출한다. `backfillButtonIds` 처럼 순수 함수만 export 하는 현재의 export 경계는 좋다.

- **[INFO]** `backfillButtonIds` 함수는 순수 함수(pure function)로 설계되어 입력이 변경되지 않으면 동일 참조를 반환하고, 변경이 발생하면 새 객체를 반환한다. copy-on-write 패턴으로 불변성을 유지한다.
  - 위치: `backfillButtonIds` 함수 전체
  - 상세: `ensureCopy()`를 통한 지연 복사, 변경 없을 시 `config` 원본 반환 패턴은 테스트에서 참조 동일성 검사(`expect(out).toBe(input)`)로 검증되고 있다. 확장성 측면에서 새로운 button 위치 타입이 추가되더라도 동일 패턴으로 처리 가능하다.
  - 제안: 현재 구조 유지.

- **[WARNING]** `runMigration` 함수가 데이터 스캔, 변경 계획, 콘솔 출력, DB 트랜잭션 쓰기를 모두 담당한다. 단일 책임 원칙 위반 수준에는 미치지 않으나, 출력 레이어(console.log)와 데이터 레이어(DB 쓰기)가 혼재한다.
  - 위치: `migrate-button-ids.ts` L2290-L2372 (`runMigration`)
  - 상세: 스크립트 특성상 완전한 레이어 분리를 강제하는 것은 과도할 수 있으나, `backfillButtonIds` 처럼 DB 쓰기 로직과 출력 로직을 분리하면 향후 dry-run 결과를 파일로 저장하는 등 확장 시 유연성이 높아진다.
  - 제안: 단발성 운영 스크립트이므로 현재 구조를 수용 가능하다. 단, `cleanup-invalid-jobs.util.ts`의 `CleanupLogger` 패턴처럼 출력 로직을 콜백이나 logger 인터페이스로 분리하는 것을 중·장기 개선으로 고려.

---

### 파일 3: background-runs.service.ts

- **[INFO]** 변경 내용은 코드 포매팅(들여쓰기, 줄바꿈) 및 미사용 import(`BackgroundRunNodeExecutionsPageDto`) 제거에 한정된다. 아키텍처 변경 없음.
  - 위치: `backend/src/modules/executions/background-runs/background-runs.service.ts`
  - 상세: 서비스 레이어 책임 분리, 결합도, 레이어 경계 등 기존 설계는 유지된다. `verifyExecutionAccess`, `findBackgroundNodeExecution`, `fetchBodyPage`, `aggregateBodyStatus` 등 private 메서드로의 세분화는 단일 책임 원칙과 높은 응집도를 잘 지키고 있다.
  - 제안: 현재 구조 유지.

---

### 전체 구조 관점

- **[INFO]** `scripts/` 레이어(`src/scripts/`)와 `modules/` 레이어 사이의 단방향 의존 방향(scripts → modules, 역방향 없음)은 올바르다. 순환 의존성은 발견되지 않았다.
  - 위치: `src/scripts/cleanup-invalid-queue-jobs.ts` → `src/modules/knowledge-base/queues/`
  - 상세: scripts 는 modules 를 소비하나, modules 는 scripts 를 참조하지 않는다. 의존 방향이 단방향으로 유지된다.
  - 제안: 현재 방향 유지.

---

## 요약

이번 변경의 핵심은 BullMQ cleanup 스크립트를 `backend/scripts/`(빌드 외부)에서 `backend/src/scripts/`(빌드 포함)로 이동하고, sweep 핵심 로직을 `cleanup-invalid-jobs.util.ts`로 추출한 리팩터링이다. SOLID 원칙 측면에서 단일 책임 분리와 DIP(CleanupLogger 인터페이스)가 잘 적용되었으며, 모듈 경계도 개선되었다. 주요 아키텍처 우려는 두 가지다: (1) `cleanup-invalid-jobs.util.ts`가 `knowledge-base` 모듈 내부에 위치해 scripts 레이어가 도메인 모듈 내부에 직접 결합되는 점, (2) `migrate-button-ids.ts`의 모듈 최상위 `process.argv` 파싱이 테스트 격리를 잠재적으로 깨뜨릴 수 있다는 점. `cleanup-invalid-queue-jobs.ts`의 dotenv 로드 패턴도 `migrate-button-ids.ts`의 패턴과 불일치해 정비가 권장된다. 전반적으로 이전 버전 대비 아키텍처 품질이 향상되었으며, 발견된 문제들은 모두 WARNING/INFO 수준이다.

## 위험도

LOW
