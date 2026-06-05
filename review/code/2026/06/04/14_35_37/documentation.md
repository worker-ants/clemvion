## 발견사항

### [INFO] `execution-limits.ts` — `resolveMaxActiveRunningMs` 반환 의미 설명 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-limits.ts` (전체)
- 상세: 모듈 수준 JSDoc 이 `DEFAULT_MAX_ACTIVE_RUNNING_MS` 상수와 `resolveMaxActiveRunningMs` 함수 각각에 존재하며 내용도 충분하다. 다만 함수 JSDoc 에서 반환값 타입(`@returns`)이 생략되어 있다. 정수 `number` 임이 타입으로 자명하지만 "0=무제한/양수=ms 한도" 라는 의미 구분이 inline 주석으로만 표현돼 있어 JSDoc `@returns` 에 한 줄 설명이 있으면 IDE hover 에서 바로 확인할 수 있다.
- 제안: `@returns 0 if unlimited; positive integer = limit in milliseconds.` 한 줄 추가.

---

### [INFO] `workflow-errors.ts` — `ExecutionTimeLimitError` constructor 파라미터 JSDoc 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 클래스 끝부분)
- 상세: 클래스 JSDoc 은 상세하게 작성되어 있으나 `constructor(activeRunningMs, limitMs)` 두 파라미터 `@param` 이 없다. 다른 에러 클래스(`SubWorkflowTimeoutError`, `InvalidExecutionStateError`)도 `@param` 없이 작성되어 있으므로 프로젝트 관행이라면 무시해도 되지만, 숫자 두 개를 받는 생성자는 용도를 혼동하기 쉽다(누적값 vs 한도 순서).
- 제안: `@param activeRunningMs 누적된 active-running 시간(ms)` / `@param limitMs 설정된 한도(ms)` 추가 또는 기존 관행과 일치시켜 생략.

---

### [INFO] `execution-engine.service.ts` — private 멤버 JSDoc 위치 역전
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (+492~+498 범위)
- 상세: `maxActiveRunningMs`·`segmentStartMs` 선언부 JSDoc(`PR2a — §8 active-running 누적 타임아웃.`) 은 두 private 필드를 묶어 설명하므로 양호하다. 한편 `assertActiveTimeWithinLimit` 의 JSDoc(`+550~+558`)이 바로 위의 `updateExecutionStatus` 기존 JSDoc block(`"WebSocket emit 은…"`) 끝과 물리적으로 붙어 있어, 편집기에서 두 블록이 혼합되어 보일 수 있다(실제 소유 관계는 올바름). 주석이 아닌 빈 줄로 명확히 분리되어 있는지 확인 필요.
- 제안: `assertActiveTimeWithinLimit` JSDoc 앞에 빈 줄 1개가 있는지 확인. diff 상 기존 `updateExecutionStatus` JSDoc 직후 바로 신규 JSDoc 이 붙어 있다 — 빈 줄 삽입 권장.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md §5.2` — `EXECUTION_TIME_LIMIT_EXCEEDED` 에러코드 예시 미반영
- 위치: `spec/5-system/14-external-interaction-api.md §5.2` (파일 미변경, 업데이트 필요)
- 상세: 이번 PR2a 로 새로 추가된 `EXECUTION_TIME_LIMIT_EXCEEDED` 에러코드가 EIA notification payload 예시(`§5.2`)에 반영되지 않았다. `execution-failure-classifier.ts` 에는 올바르게 추가되었으나, EIA spec 예시가 구현보다 뒤처진 상태다. consistency-check SUMMARY W2 에서도 동일 이슈를 WARNING 으로 지적하고 있으며 plan 에는 "PR2 범위" 로 등재되어 있다.
- 제안: `spec/5-system/14-external-interaction-api.md §5.2` notification `code` 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가. 이미 plan `exec-intake-queue-impl.md` 에 항목이 있으므로 PR2 spec 갱신 작업 시 처리.

---

### [WARNING] `spec/data-flow/0-overview.md §4` — `execution-run` 큐 카탈로그 미등재
- 위치: `spec/data-flow/0-overview.md §4` (파일 미변경, 업데이트 필요)
- 상세: PR2a 곁들임으로 `MONITORED_QUEUES`·e2e `EXPECTED_QUEUE_NAMES` 에 `execution-run` 이 추가되었으나, spec 큐 카탈로그(`data-flow/0-overview.md §4`) 와 `data-flow/3-execution.md §1.1` 시퀀스 다이어그램은 업데이트되지 않았다. `system-status.constants.ts` 주석(`큐 추가/삭제 시 data-flow/0-overview.md §4 카탈로그를 먼저 갱신`)이 요구하는 절차가 지켜지지 않은 상태다. consistency-check W1 과 동일.
- 제안: `spec/data-flow/0-overview.md §4` 에 `execution-run` 행 추가 + `spec/data-flow/3-execution.md §1.1` 다이어그램을 `execute() → execution-run queue → Worker → runExecution` 흐름으로 갱신.

---

### [INFO] `.env.example` — `PR2a — §8` 내부 구현 참조 태그가 운영자 가독성 저해 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/.env.example` (신규 블록 +35~+42)
- 상세: 주석 첫 줄 `# PR2a — §8 single-Execution max ...` 에서 `PR2a`·`§8` 은 내부 PR/spec 참조 태그다. `.env.example` 은 운영자·신규 개발자도 읽는 파일이므로 이 태그가 오히려 혼란을 줄 수 있다. 동일 파일의 다른 변수 주석(`W-15 fix (SUMMARY#W-15)` 형식)도 동일 관행을 따르고 있어 일관성 측면에서 위반은 아니나, 프로젝트가 외부 공개 가능성이 있다면 태그 제거나 괄호 처리 권장.
- 제안: 허용 수준이면 현 상태 유지. 외부 공개 시 `PR2a — §8` 제거하고 설명만 유지.

---

### [INFO] `V073__execution_active_running_ms.sql` — DOWN 마이그레이션 설명 위치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/migrations/V073__execution_active_running_ms.sql`
- 상세: 파일 헤더 주석에 `-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS active_running_ms;` 가 기술되어 있다. 이는 문서화 관점에서 양호하다. 프로젝트가 Flyway(버전 기반) 를 사용하므로 실제 DOWN 스크립트가 별도 파일로 존재하지 않을 수 있는데, 헤더 주석에 명시한 것은 적절한 관행이다. 추가 사항 없음.
- 제안: 없음.

---

### [INFO] `system-status.e2e-spec.ts` — 큐 개수 설명 주석 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/test/system-status.e2e-spec.ts` (인증 it 블록)
- 상세: e2e 테스트 본문 `it('인증 시 12개 큐의 집계 상태를 반환한다', ...)` 에 "12개 큐" 라고 기술되어 있으나, `execution-run` 이 추가되어 실제 큐는 13개다. `EXPECTED_QUEUE_NAMES` 배열에는 올바르게 13개가 등록되어 있어 실제 assertion 은 정확하지만, `it(...)` 설명 문자열이 구버전 숫자를 사용한다. 이는 오래된 주석/설명과 코드 불일치에 해당한다.
- 제안: `it('인증 시 13개 큐의 집계 상태를 반환한다', ...)` 로 숫자 수정. 실제 큐 수를 문자열에 하드코딩하는 대신 `EXPECTED_QUEUE_NAMES.length + '개'` 형태의 동적 표현도 고려 가능.

---

## 요약

PR2a(active-running 누적 타임아웃) 변경은 전반적으로 문서화 품질이 높다. `execution-limits.ts` 모듈 JSDoc, SQL 마이그레이션 헤더 설명, `execution-engine.service.ts` 의 private 멤버·private 메서드 JSDoc, `error-codes.ts` 의 새 에러코드 주석 모두 적절히 작성되어 있다. 주요 문서화 갭은 두 곳이다: (1) e2e 테스트 `it()` 설명의 큐 개수 불일치(12→13, INFO 수준이나 독자 혼란 가능), (2) `spec/data-flow/0-overview.md §4` 큐 카탈로그와 `spec/5-system/14-external-interaction-api.md §5.2` 에러코드 예시가 구현보다 뒤처진 상태(WARNING — plan 에 이미 등재된 후속 항목). `spec/5-system/16-system-status-api.md` 도 `execution-run` 모니터링 큐 미등재 상태로 동일한 후속 처리 필요. 코드 주석 정확성 관점에서는 `assertActiveTimeWithinLimit` JSDoc 의 물리적 위치(기존 블록에 연속 배치) 가 편집기 표시상 혼동을 줄 수 있으나 논리 오류는 아니다.

## 위험도

LOW
