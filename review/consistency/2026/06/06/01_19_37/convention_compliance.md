# 정식 규약 준수 Check — convention_compliance

- 모드: 구현 착수 전 검토 (`--impl-prep`)
- scope: `spec/5-system` (실작업: `exec-park-durable-resume` — PR-B1 form/button park-release+slow-path 완료, PR-B2 multi-turn turn-park 예정)
- baseline conventions: `spec/conventions/**` (execution-context · node-cancellation · migrations · error-codes · node-output · conversation-thread · cafe24-api-catalog 등)

## 판정: BLOCK = NO (Critical 0 / Warning 2 / Info 3)

검토 결과 `spec/5-system` 의 durable-park-resume 관련 본문·frontmatter 는 `spec/conventions/**` 의 정식 규약과 정합한다. Critical 위배 없음. 아래는 polish 수준의 Warning/Info.

---

## 점검 관점별 결과

### 1. 명명 규약 — PASS

- **에러 코드** (`error-codes.md §1 의미기반 + UPPER_SNAKE_CASE`): 신규/관련 코드 `RESUME_CHECKPOINT_MISSING` · `RESUME_FAILED` · `RESUME_INCOMPATIBLE_STATE` · `INVALID_EXECUTION_STATE` 모두 `UPPER_SNAKE_CASE` + 의미기반(구현경로/역사를 이름에 박지 않음). 코드(`workflow-errors.ts`·chat-channel dispatcher·telegram renderer 테스트)와 spec(`4-execution-engine §7.5`·`6-websocket-protocol L296-298`) 문자열 일치 확인.
- **상태 enum** (`node-execution.entity.ts`/`execution.entity.ts`): `cancelled` · `waiting_for_input` 등 status 값은 `lower_snake_case` — node-cancellation §5.1 / data-model §2.14 와 동일 토큰. status(소문자)와 error code(대문자)의 표기 분리 규약 준수.
- **내부 sentinel** `PARK_RELEASED = Symbol('park_released')` (execution-engine.service.ts:270): 클라이언트 노출 에러코드가 아닌 엔진 내부 sentinel이라 error-codes 규약 적용 대상 아님. 그럼에도 UPPER_SNAKE 식별자 채택으로 코드베이스 관용과 일관.
- **마이그레이션 명명** (`migrations.md §1`): `V084__execution_conversation_thread.sql` · `V085__execution_user_variables.sql` — `V<정수>__<snake_case>.sql` 정수 단조(+ V086 agent-memory 후속까지 gap 없음) 준수.
- **WS 이벤트** (`6-websocket-protocol`): `execution.cancelled` · `execution.node.cancelled` 모두 dot-namespaced lower.case — 프로토콜 컨벤션 일치.

### 2. 출력 포맷 규약 — PASS

- node-cancellation §5.1 의 표준 봉투(`output.error = { code, message }`, `meta.success=false`)를 `execution.node.cancelled` 페이로드(`6-websocket-protocol L174`)가 `error: { code: 'AbortError', message }` 형태로 정확히 인용.
- rehydration 실패 시 "Execution=`cancelled` / 동반 NodeExecution=`failed`" 이분 정책이 node-cancellation §5.2 의 "rehydration 실패는 cancelled 아님(failed)" 단서와 `4-execution-engine §7.5`·§Rationale 에서 상호 일관.

### 3. 문서 구조 규약 — PASS

- `4-execution-engine.md` frontmatter: `id`/`status: partial`/`code:` glob/`pending_plans:` 에 `exec-park-durable-resume.md` 등재 — spec-impl-evidence 의무 충족.
- `1-data-model.md` Execution 행이 `conversation_thread`(V084)·`user_variables`(V085) 두 컬럼을 마이그레이션 버전과 함께 기술. conversation-thread.md §4/§8.4 (DB 컬럼 채택 + derived-view 대안 기각 Rationale) 와 SoT 분리 정합.
- Rationale 섹션("park 즉시 해제 + slow-path 일원화 (Phase B)" 등) 보유 — 3섹션 권장 구조 준수.

### 4. API 문서 규약 — N/A (해당 없음)

- PR-B1/B2 는 신규 REST 엔드포인트를 추가하지 않는다(기존 `POST /executions/:id/stop` 동작 보강만). swagger.md 데코레이터·DTO 신설 surface 없음.

### 5. 금지 항목 — PASS

- migrations.md §3 append-only: V084/V085 는 신규 V번호 추가이며 기존 마이그레이션 수정 없음.
- execution-context.md §원칙 3 "No runtime optional sprawl": durable-park 변경은 `ExecutionContext` 에 새 cross-cutting optional 필드를 추가하지 않고, 영속/복원을 `Execution.conversation_thread`/`user_variables` 컬럼 + `_resumeCheckpoint`(원칙 4 `_`-prefix 엔진 내부 선례) 로 처리 — God Object 누적 회피 규약과 정합.

---

## Warning (2) — polish, 비차단

- **W1 (이미 인지·수용)**: `4-execution-engine §7.4` 의 Worker 동작 서술에 과도기 인라인 주석이 남아 있고, §Rationale 의 단계적 롤아웃(Phase B worker-side fast-path 제거) cross-ref 가 선택 polish 로 미반영. plan `exec-park-durable-resume.md §진행메모`의 `--impl-done` W1 과 동일 항목 — PR-B2(`pendingContinuations`/barrier 완전 제거) 시 자연 정리 대상. 신규 위배 아님.
- **W2 (cross-worktree 운영 리스크)**: `impl-concurrency-cap-pr2b` worktree 가 동일 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 모델로 수정 중일 수 있어, 병합 순서에 따라 Phase B 서술 덮어쓰기 위험. 이는 규약 위배가 아니라 머지 조율 이슈 — plan §157 W4 에 추적·조치(해당 worktree planner 가 rebase 선행)되어 있으며 본 worktree 단독 해소 불가. consistency-check main-baseline FP 패턴(MEMORY: reference_consistency_check_main_baseline_fp)과 동일 계열이므로 거짓 Critical 로 격상하지 않음.

## Info (3)

- **I1**: 마이그레이션 V084/V085 가 `4-execution-engine.md` frontmatter `code:` glob 에는 미포함이나, migrations.md 의 `code: codebase/backend/migrations/**` 와 data-model 본문 기술로 evidence 가 충분. spec-impl-evidence 가 spec 별 `code:` 에 마이그레이션 파일 나열을 강제하지 않으므로 무조치 가능.
- **I2**: `error-codes.md §3 historical-artifact 레지스트리`는 `lower_snake_case` 예외(invitation_* 등)만 등재 — durable-park 신규 코드는 처음부터 `UPPER_SNAKE_CASE` 라 레지스트리 등재 불요(§2 "신규는 처음부터 정확한 이름" 준수). 정상.
- **I3**: PR-B2 착수 시 `pendingContinuations` Map·`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 제거가 예정(plan B3). 제거 후 `4-execution-engine §7.4`·§Rationale "Phase 2 cont 후속 정리"의 잔여 fast-path 서술도 동반 갱신해 spec-impl drift 가 재발하지 않도록 권장(착수 시점 점검).

---

## 결론

`spec/5-system` durable-park-resume 본문·frontmatter 는 명명·출력포맷·문서구조·금지항목 규약을 모두 준수한다. 구현 착수를 차단할 Critical 위배 없음. W1/I3 은 PR-B2 정리 단계에서, W2 는 머지 조율로 다룰 항목이다.

STATUS: DONE BLOCK:NO CRITICAL:0 WARNING:2
