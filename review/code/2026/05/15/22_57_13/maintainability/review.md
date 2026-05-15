# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 6: backend/src/scripts/cleanup-invalid-queue-jobs.ts

- **[WARNING]** 모듈 최상위에서 실행되는 암묵적 블록 스코프로 `.env` 로드
  - 위치: 라인 25-29 (`{ const envPath = ...; dotenv.config(...); }`)
  - 상세: `cleanup-invalid-queue-jobs.ts` 는 익명 블록(`{ ... }`)을 통해 모듈 임포트 시점에 `.env` 를 로드한다. 이 패턴은 `migrate-button-ids.ts` 의 `loadDotenv()` 함수 방식과 불일치한다. 같은 `scripts/` 폴더 안에서 두 가지 다른 패턴이 공존하면 유지보수자가 혼란을 겪고, 익명 블록은 함수보다 리팩터링 단위로 분리하기 어렵다.
  - 제안: `loadDotenv()` 함수를 추출하여 `main()` 내부에서 호출하도록 통일. `migrate-button-ids.ts` 와 동일 패턴 적용.

- **[INFO]** `createQueue` 에 하드코딩된 기본 포트 `6379`
  - 위치: 라인 42 (`const port = Number(process.env.REDIS_PORT ?? 6379);`)
  - 상세: `cleanup-invalid-queue-jobs.ts` 의 `createQueue` 와 `cleanup-invalid-jobs.util.ts` 의 `CLEANUP_PAGE_SIZE = 1000` 은 각각 잘 명명된 상수이나, 포트 기본값 `6379` 는 인라인 매직 넘버로 남아있다. 단독으로는 명확하지만 상수로 분리된 `CLEANUP_PAGE_SIZE` 와의 일관성이 부족하다.
  - 제안: `const DEFAULT_REDIS_PORT = 6379;` 상수로 추출하거나, 이 정도 널리 알려진 기본값은 현 상태 유지도 허용 가능 (LOW 우선순위).

---

### 파일 8: backend/src/scripts/migrate-button-ids.ts

- **[WARNING]** 모듈 최상위 전역 상수에서 `process.argv` 즉시 평가
  - 위치: 라인 2111-2125 (`const DRY_RUN = ...`, `const CLI_WORKSPACE_ID = ...`, `const CLI_USER_ID = ...`)
  - 상세: `DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID` 가 모듈 임포트 시점에 `process.argv` 를 읽어 고정된다. 이로 인해 단위 테스트에서 `process.argv` 를 모킹하거나 변경하기 어렵고, 동일 스크립트를 프로그래매틱하게 호출하는 상황에서 재사용이 불가능하다. `loadDotenv()` 를 `main()` 내부로 격리한 것과 원칙적으로 모순된다 (주석에서 W-9 언급).
  - 제안: `parseCliArgs()` 함수를 만들어 `main()` 내에서 호출하고, 결과를 `runMigration(ds, args)` 에 인자로 전달. `backfillButtonIds` 는 이미 순수 함수이므로 해당 부분은 좋음.

- **[WARNING]** `backfillButtonIds` 함수 내 세 군데 버튼 처리 블록의 구조적 중복
  - 위치: 라인 2174-2258 (`config.buttons`, `config.itemButtons`, `config.items[*].buttons` 처리 블록)
  - 상세: 세 블록 모두 동일한 패턴을 반복한다:
    1. null/undefined entry 방어
    2. `isValidExistingId(b.id)` 검사
    3. fallback id 생성 및 `hits.push(...)`
    4. changed flag 설정 후 새 객체 반환
    `config.buttons` 와 `config.itemButtons` 블록은 prefix 문자열(`btn_` vs `itemBtn_`) 과 location 문자열만 다를 뿐 로직이 동일하다. `items[*].buttons` 는 중첩이 한 단계 더 있지만 내부 로직은 동일하다.
  - 제안: `backfillButtonArray(buttons, prefixFn, locationFn, workflowId, nodeId, hits)` 형태의 헬퍼 함수로 공통 로직을 추출. 현재 ~85줄 함수를 세분화하면 각 블록의 의도가 명확해지고 버그 수정 시 한 곳만 변경하면 된다.

- **[WARNING]** `changed` 플래그 관리의 미묘한 비대칭성
  - 위치: 라인 2191 (`if (changed) ensureCopy().buttons = newButtons;`) vs 라인 2210-2213 (`if (itemBtnChanged) { ensureCopy().itemButtons = newButtons; changed = true; }`)
  - 상세: `buttons` 블록은 바깥 `changed` 를 직접 설정하지만, `itemButtons` 블록은 로컬 `itemBtnChanged` 를 쓰고 나중에 `changed = true` 로 병합한다. `items` 블록도 별도 `itemsChanged` 를 사용한다. 패턴이 혼재되어 새 블록 추가 시 실수하기 쉽다.
  - 제안: 세 블록 모두 동일한 패턴(로컬 flag → 바깥 flag 병합)을 사용하거나, 전부 바깥 `changed` 직접 설정으로 통일.

- **[INFO]** `runMigration` 함수가 여러 책임을 담당
  - 위치: 라인 2290-2372 (`runMigration` 함수 전체)
  - 상세: `runMigration` 은 (1) DB에서 노드 조회, (2) backfill 계산, (3) 콘솔 출력, (4) DB 트랜잭션 적용 + audit_log 기록까지 한 함수에서 담당한다. 현재 ~80줄 규모로 향후 대상 노드 타입 추가 등 확장 시 복잡도가 높아질 수 있다.
  - 제안: `fetchButtonNodes(ds)`, `printPlan(hits, pendingUpdates, dryRun)`, `applyUpdates(ds, pendingUpdates, hits, workspaceId, userId)` 로 분리 고려. 즉각적 리팩터링 필수는 아니지만 중·장기 유지보수성 향상 목적의 권고.

---

### 파일 5: backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts

- **[INFO]** `CleanupSummary` 유니온 타입의 두 멤버 간 판별 방식이 암묵적
  - 위치: 라인 1411-1423 (`export type CleanupSummary = ...`)
  - 상세: `CleanupSummary` 는 `queue: string` 을 가진 버전과 `total: true` 를 가진 버전의 유니온이다. `total` 이 선택적이지 않고 `true` 리터럴 타입이므로 판별 자체는 가능하지만, 타입 이름이 두 역할을 하나로 합친 것이어서 `queue` 버전과 `total` 버전을 별도 타입(`QueueCleanupSummary`, `TotalCleanupSummary`)으로 명명하면 의도가 더 명확해진다. `formatSummaryLine` 이 둘을 함께 받는 것은 합리적이나 네이밍이 구분을 숨긴다.
  - 제안: 현 상태 유지는 무방하나, 향후 타입 분리 시 판별 유니온(discriminated union) 으로 정리하면 `'queue' in summary` 같은 런타임 체크 없이 타입 좁히기가 가능해진다.

- **[INFO]** `runSweep` 내부 함수가 비공개이지만 테스트에서 간접 검증에만 의존
  - 위치: 라인 1456-1658 (`async function runSweep(...)`)
  - 상세: `runSweep` 은 모듈 내부 함수로 직접 export 되지 않아 테스트는 `sweepInvalidJobs` 를 통해 간접 검증한다. 현재 테스트 커버리지는 충분하며 이 패턴 자체는 바람직하다. 단, `sweepInvalidJobs` 와 `runSweep` 의 파라미터가 다소 중복 (name, queue, apply, logger) 되어 향후 파라미터 추가 시 양쪽을 동기화해야 한다.
  - 제안: `SweepOptions` 를 `runSweep` 에도 전달하거나, `runSweep` 을 `sweepInvalidJobs` 내부로 인라인하는 방향 고려. 현 상태는 허용 가능.

---

### 파일 3: backend/src/modules/executions/background-runs/background-runs.service.ts

- **[INFO]** 변경은 코드 포맷 정리(줄바꿈, 들여쓰기 교정)와 미사용 import 제거에 국한됨 — 유지보수성 관점에서 긍정적
  - 위치: 전체 diff
  - 상세: `BackgroundRunNodeExecutionsPageDto` 미사용 import 제거, `.where()` / `.orderBy()` 체인 포맷 정렬, 주석 들여쓰기 교정. 모두 가독성 향상에 기여하며 로직 변경 없음.
  - 제안: 없음.

---

### 파일 2: backend/scripts/cleanup-invalid-queue-jobs.ts (삭제)

- **[INFO]** 이전 스크립트 삭제 — 구버전 코드 정리
  - 위치: 파일 전체 삭제
  - 상세: `backend/scripts/` (루트 레벨 근방) 에 있던 구버전 스크립트가 삭제되고 `backend/src/scripts/` 로 이동·리팩터링됨. 이 과정에서 `ts-node` 전용이던 코드가 컴파일된 `dist` 경로를 통한 운영 실행을 지원하도록 개선됨. 기술 부채 해소.
  - 제안: 없음.

---

### 파일 7: backend/src/scripts/migrate-button-ids.spec.ts

- **[INFO]** import 경로 수정 (`../../scripts/` → `./migrate-button-ids`)
  - 위치: 라인 2928
  - 상세: 상대 경로 오류 수정. 유지보수성 향상.
  - 제안: 없음.

---

## 요약

이번 변경은 전반적으로 기존 인라인 스크립트를 테스트 가능한 유틸 모듈(`cleanup-invalid-jobs.util.ts`)과 진입점 스크립트로 분리한 구조 개선이다. `cleanup-invalid-jobs.util.ts` 는 의존성 주입 가능한 `CleanupLogger` 인터페이스, 명명된 상수(`CLEANUP_PAGE_SIZE`, `CLEANUP_QUEUE_STATES`), 단일 책임 함수들로 구성되어 유지보수성이 우수하다. 주요 개선 여지는 두 곳이다: (1) `cleanup-invalid-queue-jobs.ts` 의 `.env` 로드 패턴이 같은 폴더의 `migrate-button-ids.ts` 와 불일치하여 일관성이 낮고, (2) `backfillButtonIds` 내 세 버튼 처리 블록이 구조적으로 중복되어 향후 위치 추가 시 버그 유입 가능성이 있다. `background-runs.service.ts` 의 변경은 순수 포맷 정리로 유지보수성에 긍정적이다.

## 위험도

LOW
