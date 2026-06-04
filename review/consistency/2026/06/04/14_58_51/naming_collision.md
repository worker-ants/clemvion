# 신규 식별자 충돌 분석

## 발견사항

### [WARNING] `EXECUTION_TIME_LIMIT_EXCEEDED` — 기존 `EXECUTION_TIMEOUT` 정의 범위와 의미 중복 위험

- **target 신규 식별자**: `EXECUTION_TIME_LIMIT_EXCEEDED` (엔진 레벨 누적 active-running 시간 초과 전용 코드)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/spec/5-system/4-execution-engine.md` line 937: `최대 실행 시간 초과 → EXECUTION_TIMEOUT 에러` (워크트리 내 §8 표현은 이미 `EXECUTION_TIME_LIMIT_EXCEEDED`로 갱신됨)
  - 상위 main spec `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` line 59: `EXECUTION_TIMEOUT` 을 "워크플로우 또는 노드 실행 타임아웃" 으로 광범위하게 정의 — 엔진 레벨도 포괄하는 정의
  - `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` lines 246, 269, 286: `EXECUTION_TIMEOUT` 이 Code 노드 스크립트 타임아웃 코드로 사용
  - `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` line 387: `EXECUTION_TIMEOUT` 분류 테이블 행 존재
- **상세**: target 은 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 "엔진 레벨 누적 active-running 시간 초과 전용 신규 코드" 로 도입하고, Code 노드의 `EXECUTION_TIMEOUT` 과 의미를 분리한다고 명시한다. 그러나 워크트리 내 `spec/5-system/3-error-handling.md` 는 이미 두 코드를 분리 정의했으나 (line 59~60), target 의 변경 대상인 `spec/5-system/14-external-interaction-api.md §6.4` 는 여전히 `EXECUTION_TIMEOUT` 만 열거하고 있다. target 의 proposed "After" 는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 EIA §6.4 에 추가하는 것이지만, `EXECUTION_TIMEOUT` 항목을 제거하지 않으므로 두 에러 코드가 병기된다. `EXECUTION_TIMEOUT` 의 scope 가 좁아졌음(Code 노드 전용)에도 EIA §6.4 에 계속 노출되면 "어떤 에러 코드가 엔진 레벨 실행 시간 초과를 나타내는가"에 대한 혼동이 남는다.
- **제안**: EIA §6.4 의 error.code 예시 주석에 두 코드의 의미 분리를 인라인으로 명시한다. 즉, `EXECUTION_TIMEOUT` 은 `(Code 노드 스크립트 타임아웃)`, `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `(엔진 레벨 누적 active-running 타임아웃)` 으로 구분 표기. 또한 `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행이 누락되어 있으므로 동시에 추가 여부를 검토해야 한다.

---

### [WARNING] `execution-run` 큐 — `spec/data-flow/0-overview.md §4` 인라인 텍스트(line 93)와 §4 BullMQ 카탈로그 표 모두 미등재 (이 워크트리 기준)

- **target 신규 식별자**: `execution-run` BullMQ 큐 (PR1 에서 구현 완료, target 이 §4 카탈로그에 추가 제안)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/spec/data-flow/0-overview.md` line 93: 현재 등록된 큐 목록에 `execution-run` 미포함 — `execution-continuation` 만 존재
  - `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/spec/data-flow/0-overview.md` lines 168~180: BullMQ 카탈로그 표에 `execution-run` 행 없음
  - 동일 워크트리 `spec/5-system/4-execution-engine.md` §9.3 큐 목록(line 999)에는 `execution-run` 이 이미 등재됨
- **상세**: `execution-run` 큐 자체의 명칭 충돌은 없다(기존에 다른 의미로 사용 중인 동일 이름 없음). 그러나 `spec/data-flow/0-overview.md §4` BullMQ 카탈로그와 §1.2 핵심 사실 "Queue" 인라인 목록 모두 미갱신 상태다. target 의 "제안 변경 §2" 는 이 두 위치(인라인 텍스트 line 93, §4 표)를 정확하게 타겟팅하므로 변경 대상 자체는 올바르다. 다만 §4 표의 삽입 위치로 target 은 "첫 행"을 제안하는데, 기존 표는 `execution-continuation` 을 첫 행으로 두고 있다. 알파벳·역할 순서 기준 모두 `execution-continuation` 앞에 `execution-run` 이 오는 것이 일관적이므로 순서 충돌은 없다.
- **제안**: target 의 제안대로 §4 표 첫 행에 `execution-run` 을 삽입하되, §1.2 인라인 목록(`line 93`)에서도 알파벳 순(`execution-continuation` 앞)으로 삽입한다. target After 예시에서 인라인 텍스트는 `execution-continuation` 앞이 아닌 뒤에(`execution-run` 삽입 후 `graph-extraction` 앞) 위치하는데, 알파벳 정렬 기준 `execution-run` > `execution-continuation` 이므로 실제로는 `execution-continuation` 바로 뒤가 맞다. target 의 After 예시가 이 순서를 지키고 있는지 재확인 권장.

---

### [INFO] `EXECUTION_MAX_ACTIVE_RUNNING_MS` — 기존 ENV 목록에 미등재이나 충돌 없음

- **target 신규 식별자**: 환경변수 `EXECUTION_MAX_ACTIVE_RUNNING_MS` (PR2a 구현 완료, `.env.example` 에 추가됨)
- **기존 사용처**: 기존 spec 어느 위치에도 동일 키 없음. `EXECUTION_RUN_WORKER_CONCURRENCY` 등 유사 패턴 키는 있으나 의미가 다름.
- **상세**: target 이 직접 갱신하는 `spec/5-system/4-execution-engine.md §8` 표의 "설정 위치" 컬럼에 이 ENV 명이 등장하며, 의미 충돌 없이 신규 도입이다. 동일 env 키가 다른 목적으로 이미 사용 중인 흔적이 없다.
- **제안**: `spec/5-system/4-execution-engine.md §11` (환경변수 목록 섹션, line ~1099 근방)에 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 행을 추가하는 것이 일관성 있다 — target 의 변경 제안이 §8 표만 포함하고 §11 ENV 표는 명시하지 않았으므로 누락 여부를 확인할 것.

---

### [INFO] EIA §6.4 `execution.failed` — `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 후 코드 어휘 정합성

- **target 신규 식별자**: EIA `execution.failed.error.code` 열거에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/spec/5-system/14-external-interaction-api.md` line 532 — `"code": "EXECUTION_TIMEOUT" | "MAX_ITERATIONS_EXCEEDED" | ...`
- **상세**: target 이 기존 `EXECUTION_TIMEOUT` 뒤에 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 삽입하는 방식은 기존 코드와 충돌하지 않으나, EIA §6.4 주석 "엔진 수준 에러코드 — 정본은 spec/5-system/3-error-handling.md §엔진 수준 에러" 는 3-error-handling.md 가 최신 분리 정의를 반영했을 때만 올바른 참조가 된다. 3-error-handling.md 의 `EXECUTION_TIMEOUT` 설명 갱신(Code 노드 전용으로 축소)과 EIA §6.4 갱신이 동시 커밋이어야 한다.
- **제안**: 본 spec update 커밋에 `spec/5-system/3-error-handling.md §1.4` 변경도 포함되어 있는지 확인. 포함되지 않으면 EIA 주석의 "정본은 3-error-handling.md" 참조가 여전히 구버전 정의를 가리키게 된다.

---

## 요약

target 이 도입하는 신규 식별자(`EXECUTION_TIME_LIMIT_EXCEEDED`, `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `execution-run` 큐, EIA `error.code` 확장)는 기존에 동일 이름이 다른 의미로 사용되는 직접적 충돌이 없다. 가장 주의가 필요한 부분은 `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 도입 시 `EXECUTION_TIMEOUT` 의 정의 범위가 좁아지는 연쇄 효과다 — 현재 `spec/5-system/3-error-handling.md §1.4` 가 이미 올바르게 분리 정의를 반영했으나, `spec/5-system/14-external-interaction-api.md §6.4` 의 인라인 주석과 `spec/conventions/chat-channel-adapter.md` 분류표가 동기화되지 않으면 동일 개념을 두 코드로 나타내는 혼동이 잔존한다. `execution-run` 큐 미등재 문제는 target 이 정확하게 타겟팅하므로 올바른 갱신이다. `EXECUTION_MAX_ACTIVE_RUNNING_MS` env 는 §11 ENV 목록 추가 여부만 보완하면 된다.

## 위험도

MEDIUM
