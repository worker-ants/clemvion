# 신규 식별자 충돌 검토

검토 대상 변경셋: `workflow-resumable-phase3-a4ea4a` vs `origin/main`

검토 대상 식별자:
- `InvalidExecutionStateError` (class)
- `ContinuationDlqMonitorService` (class)
- `CONTINUATION_DLQ_ALARM_THRESHOLD` (env var)
- `CONTINUATION_DLQ_MONITOR_INTERVAL_MS` (env var)
- `CONTINUATION_DLQ_ALARM_COOLDOWN_MS` (env var)
- `CONTINUATION_DLQ_MONITOR_ENABLED` (env var)

---

## 발견사항

### 충돌 없음 — InvalidExecutionStateError

- **target 신규 식별자**: `InvalidExecutionStateError` (class) — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:282`
- **기존 사용처**: `origin/main` 의 동일 파일에는 `ExecutionCancelledError` (line 218) 와 `RehydrationError` (line 254) 만 존재. `InvalidExecutionStateError` 는 origin/main 에 없음.
- **상세**: 이 클래스가 담는 에러 코드 `INVALID_EXECUTION_STATE` 는 origin/main 의 `spec/5-system/4-execution-engine.md §7.5.1` 및 `spec/5-system/3-error-handling.md §1.5` 에 이미 WS ack 전용 코드로 정식 등록된 상태이다. 본 diff 는 해당 spec 정의를 코드로 구현한 것이므로 의미 충돌이 없다. 다른 모듈에서 동일 이름의 클래스나 동일 코드 문자열을 사용하는 곳은 존재하지 않는다.
- **판정**: 이상 없음.

---

### 충돌 없음 — ContinuationDlqMonitorService

- **target 신규 식별자**: `ContinuationDlqMonitorService` (class) — `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts`
- **기존 사용처**: `origin/main` 전체 codebase 에 `Monitor` 접미사를 가진 서비스 클래스가 없음. `DLQ` / `Dlq` 접두어를 가진 클래스도 없음.
- **상세**: `Continuation` 네임스페이스 내부 파일(`continuation-bus.service.ts`, `continuation-execution.processor.ts`)과 명명 패턴이 일관된다. `continuation-dlq-monitor.service.ts` 파일명도 kebab-case 규약을 따른다. 동일 기능을 다른 이름으로 정의한 기존 서비스가 없다.
- **판정**: 이상 없음.

---

### 충돌 없음 — CONTINUATION_DLQ_* 환경변수 4종

- **target 신규 식별자**:
  - `CONTINUATION_DLQ_ALARM_THRESHOLD`
  - `CONTINUATION_DLQ_MONITOR_INTERVAL_MS`
  - `CONTINUATION_DLQ_ALARM_COOLDOWN_MS`
  - `CONTINUATION_DLQ_MONITOR_ENABLED`
- **기존 사용처**: `.env.example`, `.env`, 전체 `*.ts` 소스에서 `CONTINUATION_DLQ_` 접두어를 가진 환경변수가 origin/main 에 전혀 없음. 기존 `CONTINUATION_` 접두어 상수는 `CONTINUATION_EXECUTION_QUEUE`(큐 이름 상수) 와 `CONTINUATION_QUEUE_DEFAULT_OPTS` (객체 상수) 두 개만 존재하며, 모두 환경변수가 아닌 TS 상수이고 의미 영역이 다르다.
- **상세**: 패턴 `CONTINUATION_DLQ_<목적>` 은 기존 패턴(`SIGTERM_GRACE_MS`, `RESUME_BULLMQ_ATTEMPTS` 등)과 마찬가지로 모듈 접두어 + 기능 설명자 형식을 따른다. `CONTINUATION_DLQ_MONITOR_ENABLED` 의 기본값 의미("활성")는 boolean string 패턴 중 `'false'` 로 비활성화하는 방식인데, 다른 환경변수 중 `'false'` 비활성 패턴과 동일하여 일관성이 있다.
- **판정**: 이상 없음.

---

### [INFO] `parsePositiveInt` 파일-로컬 함수 — 재사용 기회

- **target 신규 식별자**: `parsePositiveInt` (module-private 함수) — `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-phase3-a4ea4a/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts:138`
- **기존 사용처**: 기존 코드베이스에 동일 이름의 함수가 없다. 단, 동일 로직(`SIGTERM_GRACE_MS` 파싱)이 `execution-engine.module.ts:93-96` 에 인라인으로 구현되어 있다. 소스 주석(`SHUTDOWN_GRACE_MS 의 W-2 fix 와 동일 방어`)이 이를 인지하고 있음.
- **상세**: 의미 충돌은 없다. 다만 동일 방어 패턴이 2곳에 분산됨. 향후 동일 필요가 추가될 경우 공용 유틸로 추출이 권장된다.
- **제안**: 현재 범위에서는 충돌 없음. 차후 리팩토링 시 `execution-engine/utils/parse-positive-int.ts` 등으로 추출하면 중복 제거 가능.

---

### [INFO] `INVALID_EXECUTION_STATE` 코드 문자열 — 세 진입점 간 의도적 비대칭

- **target 신규 식별자**: `InvalidExecutionStateError.code = 'INVALID_EXECUTION_STATE'` (WS ack 용)
- **기존 연관 식별자**: REST 422 응답의 `INVALID_STATE`, EIA 409 응답의 `STATE_MISMATCH`
- **상세**: 동일 도메인 상황(execution 이 waiting_for_input 아님)에 대해 3가지 코드가 사용된다. 이 분리는 spec `4-execution-engine.md §7.5.1` 과 `3-error-handling.md §1.5` 에 의도적으로 문서화되어 있고 cross-link 로 보강된 설계 결정이다. 신규 코드가 기존 코드를 덮어쓰거나 충돌하는 것이 아니라, 기존 spec 정의를 구현한 것이므로 식별자 충돌에 해당하지 않는다.
- **제안**: 현 설계 의도(WS / REST / EIA 진입점 별 코드 분리)를 유지하되, 클라이언트 구현 가이드에 세 코드의 의미 동치를 명시하면 혼선을 방지할 수 있다.

---

## 요약

이번 변경셋이 도입하는 신규 식별자(`InvalidExecutionStateError`, `ContinuationDlqMonitorService`, `CONTINUATION_DLQ_*` 환경변수 4종)는 origin/main 의 어떠한 기존 식별자와도 이름·의미 양면에서 충돌하지 않는다. `INVALID_EXECUTION_STATE` 에러 코드 문자열은 이미 spec 에 정의된 WS 전용 코드를 구현으로 실현한 것이며, 기존 REST(`INVALID_STATE`) 및 EIA(`STATE_MISMATCH`) 코드와의 비대칭은 spec 에 의도적으로 문서화된 설계이다. `parsePositiveInt` 의 로컬 중복은 INFO 수준 개선 사항이다.

## 위험도

NONE
