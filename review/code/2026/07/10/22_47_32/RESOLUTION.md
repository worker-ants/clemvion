# RESOLUTION — `getStatus()` 2단계 컬럼 projection

리뷰 SUMMARY: `review/code/2026/07/10/22_47_32/SUMMARY.md` (Critical 0 / Warning 4)
처리 방식: 수동 (developer SKILL §REVIEW WORKFLOW step 5)

## 조치 항목

| SUMMARY # | 내용 | 조치 | commit |
| --- | --- | --- | --- |
| W-1 (testing) | stage-2 쿼리의 `where`(executionId) 미단언 — 인가 경계 무검증 | `'2단계 조회는 1단계와 동일한 executionId 로 스코프된다 (인가 경계)'` 테스트 신설. 1·2단계 execution 쿼리 `where` + `nodeExecution` 쿼리 `where` 전부 단언 | (본 commit) |
| W-2 (maintainability) | projection 리터럴 3중 SoT + 컬럼명 오기 시 침묵 회귀 | 모듈 상수 `STATUS_PROJECTION_COLUMNS` + `satisfies (keyof Execution)[]`. **컴파일 타임 차단 실증**: `'outputData'`→`'output_data'` 오기 시 `TS2820: Type '"output_data"' is not assignable to type 'keyof Execution'. Did you mean '"outputData"'?` (tsc 로 직접 확인 후 원복) | (본 commit) |
| W-3 (testing) | 기존 waiting 테스트 4건이 stage 를 구분 못함 (vacuous 위험) | `DURABLE_THREAD` 선언부에 "이 테스트들은 `mockResolvedValue` 라 stage 구분 못함 — 2단계 조회·마스킹 배선은 아래 projection describe 가 select 분기 mock 으로 가드" 명시 주석 | (본 commit) |
| W-4 (performance) | `Promise.all` 상쇄 주장의 주석 표현 부정확 | 주석을 "쿼리 수는 2→3 으로 늘지만 **왕복 depth 는 2 로 그대로**(종전에도 execution→nodeExecution 순차 2회). 늘어난 1회는 PK 단건 조회" 로 정밀화. performance F2 와 database reviewer 판단은 각각 총 쿼리 수 vs latency depth 를 말한 것으로 모순 아님 | (본 commit) |
| INFO (requirement) | JSDoc 의 "500 turn × turn 당 4000자" 가 서로 다른 두 cap 의 합성 | **검증 후 반영**: `MAX_TURN_TEXT_CHARS=4000` 은 `thread-renderer.ts:106` 의 LLM 주입 시점(§5.3) cap 이고 `applyCharCaps` 는 render 경로 — append 시 truncate 없음. 주석을 "turn 최대 500개(§4 storage cap), turn 텍스트는 저장 시 truncate 되지 않아 행이 수 MB 까지 자란다" 로 정정 | (본 commit) |
| INFO (testing) | `expect.arrayContaining` 은 초과 컬럼을 못 잡음 | 정확 집합 비교(`select.slice().sort()` vs `BASE_COLUMNS.slice().sort()`) 로 강화. 테스트의 `BASE_COLUMNS` 는 구현 상수를 import 하지 않고 독립 재기술(black-box) | (본 commit) |
| INFO (testing) | `waiting` + 대기 nodeExec 없음 + thread 존재 조합 미검증 | `'waiting + 대기 nodeExec 없음 — thread 가 있어도 context/currentNode 는 null'` 테스트 신설로 현재 동작 고정 | (본 commit) |

### 기각 / 기록만

- **performance F5 (LEFT JOIN 단일 쿼리 병합)** — 채택하지 않음. 이득이 서브ms 수준인 반면 `nodeExecution` 은 `relations: ['node']` 를 쓰는 별도 repo 조회라 병합 시 쿼리 복잡도가 급증한다.
- **performance F4 (상태별 호출 비중 계측)** — 계측 인프라가 없어 본 PR 범위 밖. 후속 plan 신설 없이 SUMMARY 에 기록만. F6(다른 jsonb 컬럼 `input_data`/`error`/`user_variables`/`resume_call_stack` 도 함께 제외돼 실제 절감은 서술보다 큼)이 F4 의 우려를 상당 부분 상쇄한다.
- **performance F8 (`redactThreadForPublic` O(thread) 반복)** — 변경 전부터 존재한 동작이라 회귀 아님. 기록만.
- **maintainability (헬퍼 추출)** — 현시점 YAGNI. 분기 수·중첩 깊이 불변.

## TEST 결과

fix 반영 후 TEST WORKFLOW 전체 재수행:

- **lint**: 통과 (`_test_logs/lint-20260710-230238.log`, 52s)
- **unit**: 통과 (`_test_logs/unit-20260710-230337.log`, 104s). 대상 spec `interaction.service.spec.ts` 43/43 (신규 2건 추가)
- **build**: 통과 (`_test_logs/build-20260710-230526.log`, 129s) — `satisfies (keyof Execution)[]` 타이핑 유효성 확인
- **e2e**: **통과** (`_test_logs/e2e-20260710-231316.log`, 304s, 43 suite · 249 test, 0 fail)
  - `execution-park-resume.e2e-spec.ts` PASS · `external-interaction.e2e-spec.ts` PASS (사용자 지목 상태전이 회귀 확인)

### e2e 1차 실패 → 환경 원인 규명 기록 (은폐 금지)

fix 직후 첫 e2e 실행(`_test_logs/e2e-20260710-230836.log`)은 **113 failed / 136 passed** 로 실패했다. 조사 결과:

- 모든 실패가 `registerAndLogin` 의 `register failed: 500 INTERNAL_ERROR` 로 수렴하고, 그 하류에서 `TypeError: Cannot read properties of undefined (reading 'id')` 로 연쇄. 실패 스펙은 `notifications-dismiss` / `schedule-trigger` / `session-revocation` / `integration-usage-mcp` 등 **`getStatus` 와 무관한 auth 의존 스펙**.
- 컨테이너는 전부 `Healthy` 로 기동(로그 164-193행) — 기동 실패 아님.
- 직전 통과 실행(`e2e-20260710-224350.log`, 249/249)과의 코드 delta 는 **모듈 상수·주석·단위 테스트 2건**뿐으로 런타임 경로 무변경. 즉 코드 회귀로 설명되지 않음.
- `make e2e-down`(`down -v --remove-orphans`)으로 이전 실행의 잔존 볼륨·컨테이너를 정리한 뒤 재실행 → **249/249 통과**.

결론: 코드 회귀가 아니라 이전 e2e 스택의 잔존 상태(볼륨 미정리로 인한 migrate/DB 부정합)에 의한 환경 실패. 복구는 `make e2e-down` 선행. 동일 증상 재발 시 같은 순서로 처리한다.

## 보류·후속 항목

없음. 별도 plan 으로 이관한 항목 없음.
