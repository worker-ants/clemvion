# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 6: backend/src/scripts/cleanup-invalid-queue-jobs.ts

- **[WARNING]** 모듈 최상위 블록에서 `dotenv.config()` 호출로 `process.env` 즉시 오염
  - 위치: 라인 22–28 (`{ const envPath = ...; dotenv.config(...); }`)
  - 상세: `cleanup-invalid-queue-jobs.ts` 는 모듈 최상위 블록(`{ ... }`) 안에서 `dotenv.config()` 를 실행한다. 이는 스크립트가 `import` 되는 순간 — 테스트 환경 포함 — `process.env` 를 즉시 변경한다. `migrate-button-ids.ts` 는 같은 문제를 인식하고 `loadDotenv()` 함수로 감싸 `main()` 진입 시점까지 지연시키는 패턴을 채택했으나, `cleanup-invalid-queue-jobs.ts` 는 이를 따르지 않았다.
  - 제안: `dotenv.config()` 호출을 `loadDotenv()` 함수로 감싸고 `main()` 내부에서만 호출하도록 수정. `migrate-button-ids.ts` 의 패턴을 동일하게 적용.

- **[WARNING]** `process.env.REDIS_HOST` / `process.env.REDIS_PORT` 를 모듈 최상위가 아닌 `createQueue()` 안에서 읽지만, `dotenv.config()` 가 최상위 블록에서 실행되어 환경 변수 적용 순서가 불명확
  - 위치: 라인 39–43 (`function createQueue`)
  - 상세: `dotenv.config()` 가 최상위 블록에서 실행되므로 `createQueue` 가 호출될 때는 이미 `.env` 가 로드된 상태다. 그러나 위 WARNING 에서 언급한 대로 이 최상위 실행 자체가 import-time side effect 이므로, 테스트에서 모킹되지 않은 경우 실제 `.env` 값이 `process.env` 에 섞여들 수 있다.
  - 제안: `loadDotenv()` 패턴으로 통일하면 이 문제도 함께 해결됨.

### 파일 8: backend/src/scripts/migrate-button-ids.ts

- **[WARNING]** 모듈 최상위에서 `process.argv` 를 파싱해 `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 를 모듈 스코프 상수로 고정
  - 위치: 라인 2111–2125 (`const DRY_RUN`, `const CLI_WORKSPACE_ID`, `const CLI_USER_ID`)
  - 상세: `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 는 모듈이 `import` 되는 시점에 `process.argv` 를 읽어 확정된다. 테스트에서 이 모듈을 `import` 하면 테스트 프로세스의 `process.argv` 가 그대로 반영되어 `DRY_RUN` 값이 의도치 않게 결정된다. 현재 spec 파일(`migrate-button-ids.spec.ts`)은 `backfillButtonIds` 만 테스트하고 `runMigration` / `main` 을 테스트하지 않으므로 실제 오동작은 없지만, 향후 `DRY_RUN` 분기를 테스트하려 할 때 통제 불가 상태가 된다.
  - 제안: `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 파싱을 `parseCliArgs()` 함수로 래핑하고 `main()` 안에서만 호출. `backfillButtonIds` 처럼 인수 주입 패턴을 사용하면 테스트 가능성이 높아진다.

- **[INFO]** `audit_log` INSERT 에서 `resource_id = NULL` 로 고정
  - 위치: 라인 2352–2364 (`INSERT INTO audit_log`)
  - 상세: 마이그레이션은 여러 워크플로 노드를 수정하지만 `resource_id` 는 `NULL` 로 고정된다. 이는 의도적 설계 선택일 수 있으나, 추후 audit 조회 시 영향 받은 노드를 역추적할 수 없다. 부작용의 추적성 문제.
  - 제안: 영향 받은 노드 ID 목록을 `metadata` JSON 에 포함하거나, `resource_id` 를 복수 대상에 맞게 기록하는 정책을 문서화.

### 파일 5: backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts

- **[INFO]** `SILENT_LOGGER` 는 모듈 스코프 상수이나 불변(frozen) 처리 없이 노출
  - 위치: 라인 1425 (`const SILENT_LOGGER: CleanupLogger = { log: () => {}, warn: () => {} }`)
  - 상세: `SILENT_LOGGER` 는 `export` 되지 않으므로 외부에서 직접 변경할 수 없다. 다만 모듈 내부 코드가 이를 `options.logger ?? SILENT_LOGGER` 로 사용하므로, 추후 `SILENT_LOGGER` 를 `export` 하거나 속성을 추가할 경우 의도치 않은 공유 상태 변경이 가능해진다.
  - 제안: 현 상태에서는 무해하나, 추후 `export` 시 `Object.freeze(SILENT_LOGGER)` 적용 고려.

### 파일 3: backend/src/modules/executions/background-runs/background-runs.service.ts

- **[INFO]** `BackgroundRunNodeExecutionsPageDto` import 제거
  - 위치: diff 라인 `-  BackgroundRunNodeExecutionsPageDto,`
  - 상세: 사용하지 않는 import 가 제거되었다. 부작용 없음. 단, 해당 DTO 가 다른 파일에서 이 서비스를 통해 re-export 되었는지 확인 필요.
  - 제안: `dto/background-run-response.dto` 에서 직접 import 하는 다른 소비자가 없는지 확인.

### 파일 7: backend/src/scripts/migrate-button-ids.spec.ts

- **[INFO]** import 경로 수정 (`../../scripts/migrate-button-ids` → `./migrate-button-ids`)
  - 위치: diff 라인 `-import { backfillButtonIds, BackfillHit } from '../../scripts/migrate-button-ids';` → `+import { backfillButtonIds, BackfillHit } from './migrate-button-ids';`
  - 상세: 파일이 `backend/scripts/` 에서 `backend/src/scripts/` 로 이동함에 따른 import 경로 정정이다. 부작용 없음.
  - 제안: 해당 없음.

### 파일 2: backend/scripts/cleanup-invalid-queue-jobs.ts (삭제)

- **[INFO]** 기존 스크립트 파일 삭제
  - 위치: 파일 전체 (`deleted file mode 100644`)
  - 상세: 구 스크립트는 `backend/scripts/` (프로젝트 루트 상대) 에 위치했으나 신규 버전은 `backend/src/scripts/` 로 이동되었다. 삭제 자체는 의도된 리팩토링이지만, 구 스크립트를 참조하는 CI 설정, 운영 문서, README 등에서 경로 참조가 남아있다면 런타임 오류 발생.
  - 제안: `package.json` 의 `cleanup:queue-jobs` 스크립트 경로(`dist/scripts/cleanup-invalid-queue-jobs.js`)가 신규 위치(`src/scripts/`)에서 컴파일된 산출물을 가리키는지 tsconfig `rootDir` 설정과 함께 검증.

## 요약

이번 변경의 핵심 부작용 위험은 두 스크립트 파일의 **모듈 로드 시점 환경 변수 오염**에 집중된다. `cleanup-invalid-queue-jobs.ts` 는 최상위 블록에서 `dotenv.config()` 를 실행해 import 만으로 `process.env` 를 변경한다. `migrate-button-ids.ts` 는 같은 문제를 `loadDotenv()` 로 올바르게 해결했으나, `DRY_RUN`·`CLI_WORKSPACE_ID`·`CLI_USER_ID` 를 여전히 모듈 최상위에서 `process.argv` 로부터 읽어 테스트 통제성을 약화시킨다. `BackgroundRunsService` 의 변경은 순수 코드 포매팅과 미사용 import 제거에 해당해 부작용이 없다. `cleanup-invalid-jobs.util.ts` 는 부작용을 신중하게 `apply` / `pauseDuringSweep` 플래그로 제어하는 설계를 채택해 전반적으로 안전하다.

## 위험도

LOW
