## 발견사항

### [WARNING] `data-flow/0-overview.md §4` BullMQ 큐 카탈로그에 `execution-run` 미등재
- **target 위치**: `spec/5-system/4-execution-engine.md §9.3` — `execution-run` intake 큐를 세 번째 공식 BullMQ 큐로 정의
- **충돌 대상**: `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` (line 93·167 대응 표) — 큐 목록에 `execution-run` 없이 `execution-continuation` 만 등록되어 있음
- **상세**: `execution-engine §9.3` 의 큐 목록에는 `execution-run`(PR1 구현 완료), `execution-continuation`, `background-execution` 3개가 명시됐다. 반면 `data-flow/0-overview.md §4` 큐 카탈로그 표는 `execution-run` 을 포함하지 않는다. `spec/data-flow/3-execution.md` 의 시퀀스 다이어그램도 기존 in-process 흐름 중심이라 `execution-run` intake 분기가 없다. 이 격차는 plan `exec-intake-queue-impl.md §SPEC-DRIFT` 에 "후속 spec 갱신 필요" 로 등재돼 있다.
- **제안**: `spec/data-flow/0-overview.md §4` 큐 카탈로그에 `execution-run` 행 추가. `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램을 `execute() → execution-run → Worker → runExecution` 흐름으로 갱신. (`plan/in-progress/exec-intake-queue-impl.md §SPEC-DRIFT 후속 항목 W1/#2` 와 동일 항목)

---

### [WARNING] `spec/5-system/14-external-interaction-api.md §5.2` 에러 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 미포함
- **target 위치**: `spec/5-system/4-execution-engine.md §8` — `EXECUTION_TIME_LIMIT_EXCEEDED` 를 엔진 레벨 누적 active-running 타임아웃 에러 코드로 정의
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.2` (line 532) — notification payload 의 `code` 예시에 `EXECUTION_TIMEOUT` 만 나열하고 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 없음
- **상세**: EIA §5.2 의 notification payload 예시(`"code": "EXECUTION_TIMEOUT" | "MAX_ITERATIONS_EXCEEDED" | ...`)는 엔진 에러코드를 열거하는 샘플이다. `spec/5-system/3-error-handling.md §1.4` 는 `EXECUTION_TIMEOUT` 을 Code 노드 스크립트 타임아웃 한정으로 범위 축소하고 신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 엔진 레벨 누적 타임아웃으로 분리 정의했으나, EIA 예시에 반영되지 않았다. 실제 notification 소비자(외부 시스템)가 EIA §5.2 만 보면 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 모르게 된다. 이는 plan `exec-intake-queue-impl.md §consistency-check` 의 "PR2 범위 EIA classifier + §5.2 전파" 항목으로 인지된 미갱신이다.
- **제안**: `spec/5-system/14-external-interaction-api.md §5.2` 에러코드 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 (PR2 범위에 포함된 것으로 이미 계획됨).

---

### [INFO] `spec/data-flow/0-overview.md §4` 큐 카탈로그의 `execution-continuation` 설명이 PR1 이후 intake 큐 맥락과 불일치
- **target 위치**: `spec/5-system/4-execution-engine.md §9.3` — `execution-run`·`execution-continuation` 을 함께 "active 세그먼트 운반자" 로 명시
- **충돌 대상**: `spec/data-flow/0-overview.md §4` (line 93) — 큐 설명이 기존 "continuation" 단독 중심 서술이며 `execution-run` 과의 관계(active 세그먼트 분담) 를 언급하지 않음. `spec/data-flow/3-execution.md §Rationale` 도 `execution-continuation` 만을 "Continuation bus" 로 기술
- **상세**: PR1 이후 `execution-run` 이 "첫 active 세그먼트" 를 담당하는 구조가 됐으므로, data-flow 의 continuoation-bus 서술이 두 큐가 대칭 역할을 한다는 점을 반영하지 않아 새로 읽는 개발자가 흐름을 오해할 수 있다.
- **제안**: `spec/data-flow/0-overview.md §4` 큐 카탈로그의 `execution-continuation` 행 설명에 "재개 active 세그먼트 운반 (`execution-run` 이 첫 세그먼트를 담당하는 대칭 구조)" 를 추가. 동시에 §4 에 `execution-run` 신규 행 추가.

---

### [INFO] `spec/5-system/16-system-status-api.md` 의 `MONITORED_QUEUES` 에 `execution-run` 미등록
- **target 위치**: `spec/5-system/4-execution-engine.md §9.3` — `execution-run` 이 공식 큐로 정의
- **충돌 대상**: `spec/5-system/16-system-status-api.md` — system-status API 가 모니터링하는 큐 목록에 `execution-run` 반영 여부 불명확 (plan `exec-intake-queue-impl.md §SPEC-DRIFT W3` 에서 "PR2 범위에서 `MONITORED_QUEUES`+e2e 등록" 으로 defer 됨)
- **상세**: plan 이 명시적으로 PR2 범위로 미룬 항목이나, spec 본문에 이미 `execution-run` 이 공식 큐로 기술돼 있으므로 system-status spec 이 이를 미반영한 상태로 stale 하다. intake burst (waiting>0 && active===0 오탐 note) 에 대한 spec 주석도 누락된 상태.
- **제안**: `spec/5-system/16-system-status-api.md` 에 `execution-run` 을 모니터링 대상 큐로 추가 + intake burst 오탐 note 기재 (PR2 시 함께 반영).

---

## 요약

`spec/5-system/4-execution-engine.md` 는 PR1(`execution-run` intake 큐 구현) 이후 §4·§7.1·§8·§9·§11 이 일관되게 갱신됐고, 의존 spec 인 `spec/1-data-model.md`(Execution.error 코드) 과 `spec/5-system/3-error-handling.md`(`EXECUTION_TIME_LIMIT_EXCEEDED` 추가) 도 동기화됐다. 직접 모순(두 영역 중 하나가 작동 불가)은 없다. 다만 두 개의 WARNING — `data-flow/0-overview.md §4` BullMQ 큐 카탈로그와 `external-interaction-api.md §5.2` 에러코드 예시 — 은 spec-to-spec 동기화 누락으로 향후 혼동·오용 위험이 있다. 두 항목 모두 `plan/in-progress/exec-intake-queue-impl.md` 에 "PR2 시 반영" 으로 이미 계획돼 있어 위험 인지는 되어 있는 상태이며, 구현(PR2b) 착수 전 실제 충돌로 악화될 가능성은 낮다.

## 위험도

LOW

STATUS: SUCCESS
