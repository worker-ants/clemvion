# 요구사항(Requirement) 리뷰

## 발견사항

### [파일 1] backend/package.json

- **[INFO]** `cleanup:queue-jobs` npm 스크립트가 추가됨
  - 위치: `package.json` line 58
  - 상세: `node dist/scripts/cleanup-invalid-queue-jobs.js` 실행 경로가 올바르게 설정되어 있으며, `backend/src/scripts/cleanup-invalid-queue-jobs.ts` 가 컴파일된 결과(`dist/scripts/...`)를 참조한다. ts 소스가 `src/scripts/`로 이동했으므로 `dist/scripts/` 출력 경로도 일치한다.
  - 제안: 이상 없음.

---

### [파일 2] backend/scripts/cleanup-invalid-queue-jobs.ts (삭제)

- **[INFO]** 구(舊) 스크립트 파일이 `backend/scripts/`(루트 레벨)에서 삭제됨
  - 위치: 삭제된 파일 전체
  - 상세: 로직이 `backend/src/scripts/` + `cleanup-invalid-jobs.util.ts` 로 분리·재배치되었다. 삭제 자체는 의도된 리팩토링이며, 기능적 손실 없음.
  - 제안: 이상 없음.

---

### [파일 3] background-runs.service.ts

- **[INFO]** `BackgroundRunNodeExecutionsPageDto` import 제거, 코드 포맷 정리만
  - 위치: diff 전체
  - 상세: 실질적인 로직 변경은 없으며 미사용 import 제거 및 줄바꿈 포맷만 조정되었다.
  - 제안: 이상 없음.

- **[WARNING]** `deriveBackgroundRunStatus` — `failed` 상태가 있어도 `running`/`waiting` 노드가 동시에 존재하면 `'failed'`를 먼저 반환함
  - 위치: `deriveBackgroundRunStatus` 함수 (lines 756–778)
  - 상세: 현재 우선순위 순서는 `failedCount > 0 → 'failed'`, 이후 `runningCount > 0 || waitingCount > 0 → 'running'`. 이 순서 자체는 의도적("일부라도 실패하면 전체 실패 취급")으로 보이나, 비즈니스 규칙에서 명확히 정의된 우선순위인지 확인이 필요하다. 주석·spec 참조가 없다.
  - 제안: 해당 우선순위가 spec에 명시되어 있는지 확인하고, 함수 상단에 우선순위 근거 주석을 추가한다.

- **[INFO]** `deriveBackgroundRunStatus` — `totalCount === 0`일 때 `'pending'` 반환
  - 위치: line 765
  - 상세: 본문 노드가 하나도 없는 경우(스크립트 시작 직후) 'pending'을 반환하는 것은 정상적인 초기 상태 처리로 적절하다.
  - 제안: 이상 없음.

- **[INFO]** `verifyExecutionAccess` — `leftJoin` 사용으로 workflow가 null일 수 있음
  - 위치: lines 577–593
  - 상세: `leftJoin`으로 workflow를 조인하므로 `row.workflow?.workspaceId`가 `undefined`가 될 수 있고, 이 경우 `!== userWorkspaceId` 조건이 true가 되어 `NotFoundException`이 발생한다. IDOR 방지 목적으로 의도된 동작이다.
  - 제안: 이상 없음.

---

### [파일 4] cleanup-invalid-jobs.util.spec.ts (신규)

- **[INFO]** 테스트 커버리지 적절
  - 위치: 전체 파일
  - 상세: dry-run/apply, 페이지네이션, remove 실패 복구, pause/resume 순서, sweep 중 예외 발생 시 resume 보장 등 핵심 요구사항이 모두 테스트됨.
  - 제안: 이상 없음.

- **[INFO]** `pauseDuringSweep=true + apply=false` 조합 테스트 누락
  - 위치: `sweepInvalidJobs` describe 블록
  - 상세: `pauseDuringSweep=true`이지만 `apply=false`인 dry-run에서 pause/resume 동작 확인 테스트는 있으나, `apply=true + pauseDuringSweep=true`의 정상 완료 시 pause-sweep-remove-resume 전체 흐름을 하나의 케이스로 확인하는 통합 케이스가 없다. 기존 케이스들의 조합으로 유추 가능하나, 완전성 측면에서 미미한 공백이다.
  - 제안: 운영에서 주요하게 사용하는 `--apply --pause-during-sweep` 플래그 조합을 커버하는 통합 케이스 1건 추가 권장.

---

### [파일 5] cleanup-invalid-jobs.util.ts (신규)

- **[INFO]** 기능 완전성 양호
  - 위치: 전체 파일
  - 상세: 페이지네이션, dry-run/apply 분기, pause/resume TOCTOU 방어, remove 실패 허용(partial remove 계속 집계), 로거 주입 가능 구조 모두 구현됨.
  - 제안: 이상 없음.

- **[WARNING]** `CLEANUP_QUEUE_STATES`에 `'active'` 상태 미포함
  - 위치: lines 1384–1389 (`CLEANUP_QUEUE_STATES` 상수)
  - 상세: BullMQ의 `active` 상태(현재 worker가 처리 중인 job)는 정책적으로 스캔 대상에서 제외되어 있다. 의도적 설계라면(worker가 처리 중인 job을 제거하면 위험하다는 이유) 주석에 명시적으로 이유가 서술되어야 한다. 현재 주석에는 이 판단 근거가 없다. `completed` 상태도 스캔하지 않는데 그 이유도 불명확.
  - 제안: 상수 정의 위에 `// 'active' 제외: worker 처리 중인 job 삭제 시 데이터 손상 위험. 'completed' 제외: 자동 만료됨.` 수준의 주석을 추가한다.

- **[INFO]** `pauseDuringSweep` + remove 실패 조합 시 `resume()`는 `finally`에서 보장됨
  - 위치: `sweepInvalidJobs` 함수 (lines 1438–1454)
  - 상세: sweep 내부 에러 발생 시에도 `finally`가 `resume()`을 보장한다. 올바른 구현.
  - 제안: 이상 없음.

---

### [파일 6] backend/src/scripts/cleanup-invalid-queue-jobs.ts (신규)

- **[INFO]** 기능 완전성 양호
  - 위치: 전체 파일
  - 상세: `parseCleanupArgs`, `sweepInvalidJobs`, `formatSummaryLine`을 util로 분리해 테스트 가능성을 높였으며, 스크립트 진입점은 queue close 처리(`finally`)와 exit code 1 처리를 포함한다.
  - 제안: 이상 없음.

- **[INFO]** `dotenv` 로드 블록이 import 문 이전에 위치함 (모듈 레벨 실행 블록)
  - 위치: lines 1722–1728
  - 상세: TypeScript `import` 는 호이스팅되므로 런타임 순서는 컴파일 결과에 따라 다르다. 그러나 `dotenv.config()` 블록이 named import 앞에 위치하므로, 컴파일된 CommonJS 출력에서는 실제로 `require` 전에 `dotenv`가 실행된다(의도된 패턴). 반면 ESM 환경에서는 다를 수 있으나 현재 NestJS 프로젝트는 CommonJS이므로 문제없다.
  - 제안: 이상 없음.

- **[WARNING]** `queue.close()` 실패 시 에러가 무시될 수 있음
  - 위치: `main()` 함수 finally 블록 (lines 1763–1765)
  - 상세: `Promise.all(queues.map(({ queue }) => queue.close()))` 에서 `close()` 중 하나가 reject되면 `main().catch`가 잡아 `process.exit(1)`로 종료된다. 그러나 sweep이 성공했더라도 close 실패만으로 exit(1)이 발생해 운영자가 혼란스러울 수 있다. summaries 출력도 finally 이후이므로 close 실패 시 JSON summary가 출력되지 않는다.
  - 제안: `finally` 블록에서 `queue.close()` 실패를 warn으로만 처리하고 summary 출력이 항상 실행되도록 개선 검토. 또는 summaries 출력을 finally 내부로 이동.

---

### [파일 7] migrate-button-ids.spec.ts

- **[INFO]** import 경로 수정 (`../../scripts/` → `./`)
  - 위치: diff 라인
  - 상세: 스크립트 파일이 `backend/scripts/`에서 `backend/src/scripts/`로 이동함에 따라 spec 파일 import 경로가 올바르게 수정됨.
  - 제안: 이상 없음.

---

### [파일 8] migrate-button-ids.ts (신규)

- **[WARNING]** `DRY_RUN` / `CLI_WORKSPACE_ID` / `CLI_USER_ID`가 모듈 최상위에서 `process.argv`를 즉시 파싱함
  - 위치: lines 2111–2125
  - 상세: 모듈이 `import` 되는 순간 `process.argv`를 파싱하므로, 테스트에서 이 모듈을 import하면 테스트 프로세스의 `process.argv`가 오염되거나 예상치 못한 `DRY_RUN=false` 상태가 될 수 있다. `dotenv`는 `loadDotenv()`로 지연하면서 이 파싱은 즉시 실행하는 것이 모순이다.
  - 제안: `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 파싱을 `main()` 또는 `loadDotenv()` 내부로 이동하거나 최소한 `require.main === module` 가드 뒤에서만 실행하도록 리팩토링한다.

- **[INFO]** audit_log의 `resource_id`가 NULL로 기록됨
  - 위치: lines 2352–2364
  - 상세: audit_log row에 `resource_id = NULL`로 삽입된다. 여러 노드를 한꺼번에 업데이트하므로 단일 resource_id를 지정하기 어렵다는 점에서 의도적일 수 있으나, audit 추적성이 감소한다.
  - 제안: `metadata` 필드에 `nodes_updated`와 nodeId 목록이 담기므로 현재 수준으로도 추적 가능하다. 다만, 감사 정책이 엄격하다면 `resource_id` 컬럼의 NOT NULL 제약 여부를 확인한다.

- **[INFO]** `backfillButtonIds`에서 `config.items[*]`가 배열이 아닌 경우(객체, null 등) 방어됨
  - 위치: lines 2219–2221
  - 상세: `!item || typeof item !== 'object' || !Array.isArray(item.buttons)` 가드로 비정상 entry를 건너뛴다. 적절한 방어 코드이다.
  - 제안: 이상 없음.

- **[INFO]** `isValidExistingId`가 `isValidStablePortId`의 alias임이 주석으로 명시됨
  - 위치: line 2148
  - 상세: 단일 출처 원칙(drift 방지)이 주석으로 설명되어 있어 의도 파악이 용이하다.
  - 제안: 이상 없음.

---

### [파일 9] migrate-node-output-refs.spec.ts

- **[INFO]** import 경로 수정 (`../../scripts/` → `./`)
  - 위치: diff 라인
  - 상세: 파일 7과 동일한 이유로 경로 수정. 올바름.
  - 제안: 이상 없음.

---

## 요약

전체적으로 이번 변경의 핵심은 (1) 큐 cleanup 유틸리티를 테스트 가능한 구조로 분리(`cleanup-invalid-jobs.util.ts`)하고, (2) 기존 스크립트의 경로를 `backend/src/scripts/`로 통일하며, (3) background-runs 서비스의 미사용 import와 포맷을 정리한 것이다. 기능 완전성 측면에서 의도한 요구사항(dry-run/apply, TOCTOU 방어, 페이지네이션, 에러 허용 계속 집계)은 대부분 충족되어 있다. 다만 두 가지 주의 사항이 있다: `migrate-button-ids.ts`의 모듈 최상위 `process.argv` 즉시 파싱은 테스트 격리를 깨뜨릴 수 있으며(WARNING), `cleanup-invalid-queue-jobs.ts`의 queue.close() 실패 시 JSON summary가 출력되지 않는 흐름은 운영 가시성을 저해할 수 있다(WARNING). `CLEANUP_QUEUE_STATES`에서 `active` 상태를 제외한 이유가 코드에 설명되어 있지 않은 점도 미래 유지보수에서 혼란을 줄 수 있다(WARNING).

## 위험도

MEDIUM
