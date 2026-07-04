# 동시성(Concurrency) 코드 리뷰

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit, admission gate 파라미터 순서/cap 매핑 회귀 + admission 결과별 3-way 분기 회귀)
- e2e: 동시성 cap admission gate 스펙 파일 — workspace-level cap 단독 검증 신규 케이스 (TEST-ONLY 대상)
- `review/consistency/2026/07/04/20_09_53/SUMMARY.md` (문서, 동시성 관점 해당 없음)

특별 지시에 따라 workspace-level cap e2e (`workspace-level cap 초과 → 다른 workflow 실행도 pending → 슬롯 해제 시 admitted`)를 중점 검토했다. production 코드(`admitExecutionOrDefer`, `execution-limits.ts`)와 `docker-compose.e2e.yml`, `jest-e2e.json` 을 함께 대조했다.

## 발견사항

- **[INFO]** workspace-level cap e2e 는 advisory-lock 직렬화 자체를 직접 증명하지 않고 최종 상태(cap 초과 시 pending 유지 → 해제 후 admitted)만 증명한다
  - 위치: e2e 신규 케이스 `workspace-level cap 초과 → 다른 workflow 실행도 pending → 슬롯 해제 시 admitted`
  - 상세: `pg_advisory_xact_lock` 은 "같은 workspace 의 두 admission 이 COUNT 스냅샷을 동시에 보고 둘 다 통과하는 TOCTOU"를 막기 위한 것(ai-review CRITICAL 이력, `execution-engine.service.ts:2612-2657` 주석 참조)이다. 이 e2e 는 blocker 1개 + 신규 실행 1개만 존재하는 순차 시나리오라 "직렬화가 없었다면 실패했을 것"이라는 인과를 직접 보이지 않는다 — 오히려 workspace COUNT join 이 **다른 workflow**의 running 행까지 정확히 세는지(스코프 정합성)를 검증하는 데 집중돼 있다. TOCTOU race 자체의 실증은 기존 두 sibling 테스트(같은 파일, per-workflow cap)와 프로덕션 코드 주석에 위임되어 있고, 이번 신규 케이스가 그 계약을 깨지는 않는다.
  - 제안: 현재로도 회귀 방지 목적(“workspace COUNT 가 다른 workflow 를 놓치지 않는다”)은 충분히 달성한다. advisory lock의 동시-경합 자체를 e2e 로 실증하려면 별도로 동일 workspace 에 대해 두 개의 신규 실행을 `Promise.all` 로 동시 트리거해 최종 admitted count 가 cap 과 정확히 일치하는지 보는 편이 더 강한 회귀 가드가 되겠지만, 이는 기존 커밋들(#800/#801)에서 이미 별도로 다뤄졌을 가능성이 높은 확장 제안이며 이번 diff 의 범위를 넘는다.

- **[INFO]** 타이밍 상수 간 마진은 기존 sibling 테스트와 동일한 패턴으로 안전하게 유지된다
  - 위치: `insertRunningBlocker` → `execute` 후 `setTimeout(1500)` pre-check, `poll(..., 20_000, wsCapId)`
  - 상세: `EXECUTION_ADMISSION_RETRY_DELAY_MS = 2_000`(ms), `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` e2e 오버라이드 `8000`(ms). pending 확인용 1500ms 대기는 첫 재큐 tick(2000ms) 이전에 관찰하므로 "아직 admitted 되지 않았다"는 assertion 이 재큐 타이밍과 경합하지 않는다(1500 < 2000, 여유 500ms). 슬롯 해제 후 20_000ms poll 은 2000ms 재큐 tick 대비 10배 마진이라 CI 부하 환경에서도 충분히 안정적이다. 기존 두 sibling 케이스(`cap 초과 → pending 대기...`, `cap 초과 지속 → ... EXECUTION_QUEUE_WAIT_TIMEOUT`)와 정확히 같은 상수·마진 패턴을 재사용하므로 신규 케이스만의 고유한 플레이키 요인은 없다.

- **[INFO]** 테스트 격리 — 신규 workspace 로 이전 테스트의 잔여 running blocker 간섭을 원천 차단
  - 위치: `createTeamWorkspace(BASE_URL, ownerToken, uniqueName('WSCAP'))` 로 별도 workspace 생성 후 `db.query(UPDATE workspace SET settings ...)` 로 cap=1 설정
  - 상세: advisory lock 키가 `exec-cap:<workspaceId>` (workspace 스코프)이므로, 같은 파일의 앞선 두 sibling 테스트가 공유하는 `workspaceId`(=`beforeAll` 에서 1회 생성)와 락 키가 겹치지 않는다. 또한 workspace COUNT 서브쿼리(`w.workspace_id = $2`)도 workspace 단위로 스코프되므로 이전 테스트가 심어둔 blocker(동일 파일 앞 두 케이스는 각자 새 workflow 를 만들지만 같은 `workspaceId` 공유)와 COUNT 가 섞이지 않는다. `jest-e2e.json` 의 `maxWorkers: 1` 로 파일 간 워커 병렬성도 없어, cross-test 오염 경로가 없다.
  - 결론: 격리 설계가 정확하며 flakiness 유발 요소를 찾지 못했다.

- **[INFO]** `insertRunningBlocker` 가 심는 행이 admission COUNT 쿼리 요건을 정확히 충족
  - 위치: `INSERT INTO execution (id, workflow_id, status, started_at, queued_at) VALUES ($1, $2, 'running', NOW(), NOW())`
  - 상세: production 의 워크스페이스/워크플로 COUNT 서브쿼리는 `status = 'running'` 만 검사하며 `workflow_id`/workspace join 을 통해 스코프한다(`execution-engine.service.ts:2664-2668`). blocker 행이 정확히 이 조건(같은 workflow, running)을 만족하므로 워크스페이스 cap=1 을 정확히 소진시킨다. `queued_at` 컬럼 포함은 admission 로직상 불필요하지만 스키마 NOT NULL 제약(다른 sibling 테스트와 동일 패턴, V104 이력 참고) 대응으로 보이며 무해하다.

## 요약

이번 diff 의 핵심 동시성 코드 변경은 없다 — unit spec 은 이미 존재하는 `admitExecutionOrDefer`의 원자 UPDATE 파라미터 순서/advisory-lock 키 스코프 및 3-way 결과 분기(admitted/deferred/cancelled)에 대한 순수 회귀 고정(mock 기반)이고, e2e 신규 케이스는 workspace-level cap 이 **다른 workflow** 의 running 행까지 정확히 세는지를 검증하는 보강 시나리오다. 지시된 TEST-ONLY 평가 결과, 신규 e2e 는 기존 두 sibling 케이스와 동일한 타이밍 상수(재큐 tick 2000ms 대비 pre-check 1500ms/poll 20000ms)와 workspace 단위 격리(신규 workspace 생성 + advisory lock 키 스코프 일치)를 그대로 재사용하고 있어 추가적인 flakiness 요인이 없다. 다만 이 테스트는 advisory-lock 의 "동시 경합 직렬화" 자체보다는 "workspace COUNT 스코프 정합성"을 증명하는 데 가깝다는 점은 테스트 명세상 명확히 인지해 둘 만하다(차단 사유는 아님).

## 위험도
NONE

STATUS: SUCCESS
