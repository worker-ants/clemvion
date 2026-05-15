# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `cleanup-invalid-jobs.util.ts` 공개 함수/인터페이스에 JSDoc 없음
  - 위치: `backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts` — `parseCleanupArgs`, `formatSummaryLine`, `sweepInvalidJobs`, `CleanupArgs`, `SweepOptions`, `CleanupLogger`, `CleanupSummary`, `CLEANUP_QUEUE_STATES`, `CLEANUP_PAGE_SIZE` 전체
  - 상세: 이 유틸 파일은 운영 스크립트와 단위 테스트 양쪽에서 import 되는 공개 API 이다. 각 export 의 역할, 매개변수 의미(특히 `pauseDuringSweep` 의 TOCTOU 방지 효과, `logger` 의 기본값이 SILENT인 이유), 반환 타입의 두 유니온 variant 구분 기준이 코드만으로는 불명확하다. 스크립트 진입점(`cleanup-invalid-queue-jobs.ts`)에는 풍부한 JSDoc이 있지만 핵심 로직이 있는 유틸에는 한 줄도 없다.
  - 제안: `sweepInvalidJobs`, `parseCleanupArgs`, `formatSummaryLine` 에 최소한 `@param` / `@returns` 포함 JSDoc 추가. `CleanupSummary` union type 의 두 variant(`queue` 필드 있는 케이스 vs `total: true` 케이스) 구분을 JSDoc 또는 인라인 주석으로 명시.

- **[WARNING]** `backend/src/scripts/migrate-button-ids.ts` 에서 모듈 수준 side-effect 변수(`DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID`)에 주석 불충분
  - 위치: `migrate-button-ids.ts` 라인 `const DRY_RUN = ...`, `const CLI_WORKSPACE_ID = ...`, `const CLI_USER_ID = ...`
  - 상세: `loadDotenv()` 함수에는 "module import만으로 process.env가 오염되면 단위 테스트가 통제 불가능해진다"는 설명이 있어 의도가 명확하다. 그러나 `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 세 상수는 모듈 최상위에서 `process.argv`를 직접 파싱하는 side-effect 코드인데, `loadDotenv()`와 달리 이 패턴을 허용한 이유에 대한 설명이 없다. 단위 테스트(`migrate-button-ids.spec.ts`)가 순수 함수(`backfillButtonIds`)만 테스트하므로 사실상 문제는 없지만, 향후 유지보수자가 이 패턴을 보고 혼란을 겪을 수 있다.
  - 제안: 세 상수 위에 "main() 진입 전 parse — backfillButtonIds 순수 함수 테스트에는 영향 없음" 취지의 짧은 인라인 주석 추가.

- **[WARNING]** 새 npm script `cleanup:queue-jobs` 가 `backend/package.json`에 추가됐으나 README 또는 운영 가이드 문서에 반영되지 않음
  - 위치: `backend/package.json` `"cleanup:queue-jobs"` 항목
  - 상세: 스크립트 진입점 파일(`backend/src/scripts/cleanup-invalid-queue-jobs.ts`)에는 `npx ts-node` 기반 사용법과 `docker compose exec backend npm run cleanup:queue-jobs` 사용법이 모두 JSDoc에 기술돼 있다. 그러나 이 명령을 처음 접하는 운영자가 가장 먼저 볼 프로젝트 루트 README나 별도 운영 가이드에는 이 명령의 존재 및 전제 조건(build 필요 여부, 환경변수 `REDIS_HOST`/`REDIS_PORT` 설정 방법)이 언급되지 않았다.
  - 제안: 루트 README 또는 `spec/` 내 운영 가이드(해당 영역 문서)에 `cleanup:queue-jobs` 스크립트 용도, 사용 전 `npm run build` 필요 여부, 필요한 환경변수 목록을 한 섹션으로 추가.

- **[INFO]** `cleanup-invalid-jobs.util.ts`의 `CLEANUP_QUEUE_STATES` 상수에 'active' 상태가 포함되지 않은 이유 미문서화
  - 위치: `cleanup-invalid-jobs.util.ts` `CLEANUP_QUEUE_STATES` 정의부
  - 상세: `waiting`, `delayed`, `failed`, `paused` 4개 상태만 스캔한다. 활성 처리 중인 `active` 상태를 의도적으로 제외한 이유(실행 중인 job을 건드리면 위험)가 코드에 명시되지 않았다. 삭제된 `backend/scripts/cleanup-invalid-queue-jobs.ts`(구버전)에도 동일하게 4개 상태만 사용했으나 이유는 미기재였다.
  - 제안: 상수 정의 위에 `// 'active' 제외 — 처리 중 job 은 false-positive 위험` 등의 한 줄 주석 추가.

- **[INFO]** 삭제된 `backend/scripts/cleanup-invalid-queue-jobs.ts`(루트 레벨 scripts 폴더)와 신규 `backend/src/scripts/cleanup-invalid-queue-jobs.ts`(src 하위) 간의 경로 변경 이력이 스크립트 JSDoc에만 있고 CHANGELOG/commit 외부 문서에 없음
  - 위치: `backend/src/scripts/cleanup-invalid-queue-jobs.ts` JSDoc
  - 상세: 구버전 스크립트는 `backend/scripts/` 에 위치했고 `npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts`로 실행했다. 신버전은 `backend/src/scripts/`로 이동하고 `npm run cleanup:queue-jobs` 또는 `npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts`로 실행한다. 오래된 북마크나 런북을 보유한 운영자가 구 경로를 그대로 실행하면 "파일 없음" 오류가 발생한다. 이 경로 변경 이유(dist 빌드 포함, 단위 테스트 가능)는 파일 본문에 기록되지 않았다.
  - 제안: 신규 스크립트 JSDoc 상단 또는 `spec/` 운영 문서에 "구 경로(`backend/scripts/`)는 삭제됨, 현재 경로는 `backend/src/scripts/`" 한 줄 마이그레이션 노트 추가.

- **[INFO]** `background-runs.service.ts`에서 삭제된 import(`BackgroundRunNodeExecutionsPageDto`) 관련 인라인 주석 또는 JSDoc에 변경 이유 없음
  - 위치: `background-runs.service.ts` diff 상단 `BackgroundRunNodeExecutionsPageDto` import 삭제 부분
  - 상세: 순수 코드 정리(unused import 제거)이므로 주석이 반드시 필요하지는 않으나, 이 DTO가 어디로 이동했는지 혹은 사용처가 제거됐는지가 diff만으로는 불명확하다. 해당 파일의 클래스 레벨 JSDoc(`spec/4-nodes/1-logic/12-background.md §8` 참조)은 잘 작성돼 있다.
  - 제안: 별도 조치 불필요. 필요 시 해당 DTO 삭제 이유를 커밋 메시지로 보충하는 것으로 충분.

## 요약

이번 변경의 핵심은 cleanup 스크립트를 `backend/scripts/`(루트)에서 `backend/src/scripts/`(src 하위)로 이동하고, 핵심 sweep 로직을 테스트 가능한 유틸(`cleanup-invalid-jobs.util.ts`)로 분리한 리팩터링이다. 진입점 스크립트(`cleanup-invalid-queue-jobs.ts`)와 마이그레이션 스크립트(`migrate-button-ids.ts`)의 JSDoc은 사용법, 운영 절차, 배경 이유까지 충실하게 기술되어 있어 전반적인 문서화 수준은 양호하다. 다만 공개 API 역할을 하는 `cleanup-invalid-jobs.util.ts`의 export 함수·인터페이스에 JSDoc이 전무하고, 새로 추가된 `cleanup:queue-jobs` npm script가 README 등 외부 진입 문서에 반영되지 않은 점은 운영자 혼란을 야기할 수 있어 보완이 권장된다. `background-runs.service.ts`의 변경은 포맷 정리와 unused import 제거로, 기존 주석의 정확성은 유지되고 있다.

## 위험도

LOW
