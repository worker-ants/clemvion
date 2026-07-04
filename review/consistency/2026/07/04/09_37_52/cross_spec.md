# Cross-Spec 일관성 검토 — cross_spec

검토 모드: --impl-done (comment-only .ts + spec drift cleanup)
Target: `spec/5-system/4-execution-engine.md` (diff-base: origin/main)
구현 SoT: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-06-c3-a1b2c3` (HEAD 워킹트리)

## 검토 범위 요약

이번 변경은 두 부분으로 구성된다.

1. **spec 본문 드리프트 제거** (`spec/5-system/4-execution-engine.md` §6.2 저장 전략 표 / §7.5 rehydration 절차 / §9.1 sub 예시 / §9.2 Redis 키 표 / §Rationale 신규 항목): Phase-1 시절 서술("실행 컨텍스트 Redis 저장", `exec:{ws}:execution:{id}:context/:status/:output/:heartbeat/:lock`, `queue:priority` 등 미구현 Redis 키 6종)을 실제 아키텍처(in-memory segment-local `ExecutionContext` + PostgreSQL durable 컬럼 + §7.5 rehydration)로 정정.
2. **코드 주석(comment-only) 2건**: `execution-context.service.ts` 클래스 doc, `execution-engine.service.ts` `segmentStartMs` 필드 doc — 둘 다 실제 로직 변경 없이 spec 정정과 표현을 맞춤 (PR3/PR4 트리거 분리·under-count 미해소 정정 반영).

`plan/in-progress/spec-draft-c3-context-drift.md` 에 따르면 이 작업은 `refactor/06-concurrency.md` C-3 항목이며, 사전에 2-agent 코드 조사로 제거 대상 Redis 키 6종의 코드 사용 0건을 확인했고, 별도 `/consistency-check --spec` (`review/consistency/2026/07/04/09_27_49`) 에서 cross_spec 은 이미 NONE 판정을 받은 이력이 있다.

## 점검 내용

### 1. 데이터 모델 충돌
- `spec/1-data-model.md` §2.13 Execution 의 `error` 필드 설명(`WORKER_HEARTBEAT_TIMEOUT` — PR4 예약, PR3 기간 미발동)이 이번 diff 로 갱신된 `4-execution-engine.md` §7.1/§Rationale 의 PR3/PR4 구분과 문구까지 정확히 일치. 충돌 없음.
- Execution/NodeExecution 관련 다른 컬럼 정의(`conversation_thread`/`user_variables`/`resume_call_stack`)도 "in-memory 소멸 + durable 컬럼에서 rehydration 복원" 모델과 일관.

### 2. API 계약 충돌
- 해당 없음 — 본 변경은 endpoint/DTO 변경을 포함하지 않는다.

### 3. 요구사항 ID 충돌
- 신규 요구사항 ID 부여 없음.

### 4. 상태 전이 충돌
- Execution 상태 전이(§1.1)나 case A/B rehydration 분기는 변경 대상 밖이며, 변경된 서술(§7.5 "항상 DB 에서 복원")은 기존 case B(§7.5, PR3 크래시 re-drive) 절차와 상충 없이 오히려 "Redis context 우선" 이라는 존재하지 않던 분기를 제거해 절차를 단순화·명확화한다.

### 5. 권한·RBAC 모델 충돌
- 해당 없음.

### 6. 계층 책임 충돌
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` 의 "Redis 미채택" 클래스 doc 정정은 `spec/conventions/execution-context.md` 의 in-memory `Map` 라우팅 서술과 이미 일치했다(해당 규약 문서는 애초 Redis 를 전제하지 않았음 — 드리프트는 `4-execution-engine.md` 에만 있었다).

## 발견사항

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` §12.13 잔존 "Redis" 문구 — 본 diff 범위 밖 사전 존재 드리프트
  - target 위치: (참고용, target 자체 변경분 아님) `spec/5-system/4-execution-engine.md` §Rationale 신규 "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택"
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §12.13 "요약 보관 필드 유실 시 fallback" — "그 구간에서 TTL 만료 / Redis·프로세스 장애로 ExecutionContext 가 유실되고" 문구
  - 상세: 이번 diff 로 `4-execution-engine.md` 는 "Redis context store 를 두지 않는다"(park-release 이중화 위험으로 미채택)를 명시적으로 확정했다. 그런데 `1-ai-agent.md` §12.13 은 여전히 "TTL 만료 / Redis 장애로 ExecutionContext 유실"을 실패 시나리오로 언급한다 — ExecutionContext 는 애초 Redis 에 있었던 적이 없으므로 "Redis 장애로 유실"이라는 표현은 이제 spec 상으로 성립하지 않는 표현(과거 Phase-1 설계를 전제로 쓰인 잔존 문구로 추정)이다. 실제 유실 조건은 "프로세스 크래시/재시작(in-memory 소멸)" 만이며 TTL 개념 자체도 in-memory Map 에는 없다.
  - 이는 본 PR 의 diff 범위(`4-execution-engine.md` 본문 + 2개 코드 주석) **밖**에 있는 기존 드리프트이며, `spec-draft-c3-context-drift.md` 가 스스로 "재확인 대상"으로 나열한 파일 목록(`data-flow/3-execution.md`·`execution-context.md`·`9-observability.md`·`16-system-status-api.md`)에 `1-ai-agent.md` 는 포함되지 않아 이번 조사에서 놓친 것으로 보인다.
  - 제안: 후속 spec PR(작은 draft) 에서 `1-ai-agent.md` §12.13 의 "TTL 만료 / Redis·프로세스 장애" → "in-memory ExecutionContext 가 프로세스 크래시/재시작으로 소멸"로 정정 권장. 차단 사유는 아님 (본 PR 의 diff 범위 밖, 기능 영향 없음).

## 요약

이번 변경은 `spec/5-system/4-execution-engine.md` 가 서술하던 미구현 Phase-1 Redis 실행상태 모델(컨텍스트·상태·출력·heartbeat·lock·priority 큐 Redis 키)을 실제 구현(in-memory segment-local ExecutionContext + PostgreSQL durable 컬럼 + §7.5 rehydration)으로 정합화하는 순수 spec 드리프트 정리이며, 동반된 두 코드 주석 변경은 로직 변경 없이 문구만 spec 과 맞췄다. `spec/1-data-model.md`(Execution.error 코드 정의)·`spec/conventions/execution-context.md`(in-memory Map 라우팅 규약)·`spec/conventions/conversation-thread.md`(v1 in-memory only 전제) 등 인접 영역과 신구 서술 모두 정확히 일치하며 새로 도입되는 모순은 없다. 유일하게 발견된 사항은 diff 범위 밖의 사전 존재 잔존 문구(`4-nodes/3-ai/1-ai-agent.md` §12.13 의 "Redis 장애" 언급) 로, 이번 PR 이 만든 문제가 아니며 차단 사유가 되지 않는다.

## 위험도

NONE
