# 신규 식별자 충돌 검토 — exec-park-durable-resume (plan draft)

검토 모드: `--plan`
Target: `plan/in-progress/exec-park-durable-resume.md`
대상 코퍼스: `spec/5-system/4-execution-engine.md` (SoT), `spec/conventions/conversation-thread.md`, `spec/1-data-model.md`, `plan/in-progress/execution-engine-residual-gaps.md`, 실제 구현 (`codebase/backend/src/modules/execution-engine/**`).

## 요약

본 plan 은 **대부분 기존 식별자를 참조/조작**한다 (제거·강등·일원화 대상). 신규 식별자 도입은 거의 없고, 도입되는 것도 미해결 결정(D1/A2)에 묶여 아직 확정 이름이 아니다. **Critical 충돌 없음.** 정합성 차원의 Warning 1건(D1 영속 매체 위치가 기존 convention 이 예고한 컬럼명과 어긋날 소지) + Info 2건.

## 점검 결과

### 1. 요구사항 ID 충돌 — 없음
plan 은 요구사항 ID(`NAV-*`/`ED-*`/`ND-*` 등)를 신규 부여하지 않는다. PR 라벨(PR-A1/A2/A3/B)·결정 라벨(D1~D4)은 plan-local 식별자로 spec 요구사항 ID 네임스페이스와 무관.

### 2. 엔티티/타입명 충돌 — 없음
plan 이 언급하는 모든 타입/심볼이 **이미 존재**(신규 도입 아님):
- `firstSegmentBarriers` / `armFirstSegmentBarrier` / `settleFirstSegment` / `signalParkBarrier` / `pendingContinuations` / `applyContinuation` / `rehydrateAndResume` / `rehydrateContext` / `buildRetryReentryState` / `createEmptyConversationThread` — 모두 `codebase/backend/src/modules/execution-engine/**` 에 기존 존재. plan 은 이들을 **제거/강등/단순화** 대상으로 다루므로 collision 이 아니라 기존 식별자 정리.
- `_resumeCheckpoint` / `_resumeState` / `_retryState` — execution-engine §1.3 에 기존 정의. plan 은 견고화(A2)만 다룸.
- A2 의 "checkpoint 버전 필드 추가" 는 신규 필드명 도입 가능성이 있으나 plan 에 구체 키명 미명시 → 충돌 판정 불가(이름 확정 시 `_resumeCheckpoint` shape 내부 필드이므로 top-level 식별자 네임스페이스 영향 없음).

### 3. API endpoint 충돌 — 없음
plan 은 신규 REST/WS endpoint 를 도입하지 않는다. 재개 경로는 기존 `execution-continuation` 큐 + 기존 WS continuation 명령(§7.4 6종)을 재사용.

### 4. 이벤트/메시지명 충돌 — 없음
- 큐: `execution-run` / `execution-continuation` / `background-execution` 기존 3종 재사용. plan B2 의 "모든 재개 = `execution-continuation` job 일원화" 는 기존 큐 의미 강화이지 신규 큐명 도입 아님.
- 재개 실패 코드 `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` / `RESUME_FAILED` — 모두 execution-engine §7.5 + data-model §2.13 `error.code` 에 기존 등록. plan 은 신규 코드를 만들지 않고 기존 코드의 발생 빈도("상시화 회피")만 논함.

### 5. 환경변수·설정키 충돌 — 없음
plan 본문에 신규 ENV/config 키 도입 없음. A1 의 직렬화 매체 결정(D1)이 컬럼/테이블을 낳더라도 ENV 키는 아님. 기존 키(`CONTINUATION_SEQ_TTL_SECONDS`, `RESUME_BULLMQ_ATTEMPTS`, `EXECUTION_RUN_WORKER_CONCURRENCY` 등)와 겹치는 신규 키 제안 없음.

### 6. 파일 경로 충돌 — 없음
- plan 파일 `plan/in-progress/exec-park-durable-resume.md` 는 기존 파일과 미충돌(신규).
- spec 변경 대상(`4-execution-engine.md §4.x/§7.5`, `conversation-thread.md`)은 모두 **기존 문서 in-place 개정** — 신규 spec 파일 생성 없음. 명명 컨벤션 위배 없음.

---

## Warning — DB 컬럼명/위치 결정(D1)이 기존 convention 의 예고 식별자와 어긋날 소지

`conversation-thread.md §4` (L211) 는 conversationThread durable 영속을 이미 예고하며 **구체 컬럼명·위치를 명시**해 두었다:

> "v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음. 향후 사용자 요구 명확해지면 **`Execution.conversation_thread jsonb NULL`** 컬럼 마이그레이션 검토."

그러나 본 plan 의 D1 후보 집합은:

> "conversationThread 영속 매체 — **JSONB 컬럼(node_execution)** / 별도 테이블 / `_resumeCheckpoint` 포함"

즉 plan A1 은 영속 위치를 **`node_execution`** JSONB 컬럼으로 적고, convention 이 예고한 **`Execution.conversation_thread`** (Execution 레벨) 위치는 후보에서 누락됐다. 이는 hard 식별자 충돌(같은 이름 다른 의미)은 아니지만:

1. **컬럼 위치 불일치**: convention 은 `Execution` 레벨 컬럼을 예고, plan 은 `node_execution` 레벨을 제안. 둘 다 채택되면 의미 중복 컬럼이 두 테이블에 생길 위험.
2. **예고된 이름 미승계**: convention 이 이미 `conversation_thread` 라는 컬럼명을 박아 둔 상태이므로, D1 이 `node_execution` 을 택하더라도 컬럼명은 `conversation_thread` 로 정렬하고 위치 차이를 명시적으로 해소해야 한다. 그렇지 않으면 두 문서가 서로 다른 영속 위치를 SoT 로 주장하게 된다.

권고: D1 해결 시 (a) convention §4 L211 의 `Execution.conversation_thread` 예고를 **채택/번복 중 하나로 명시 정리**하고, (b) 채택 위치(Execution vs node_execution)와 최종 컬럼명을 두 문서가 동일하게 참조하도록 plan §3 spec 변경 항목에 추가. plan §3 에 이미 "conversation-thread.md 정책 재검토 반영" 항목이 있으나, **컬럼명/위치 정렬**을 명시 과업으로 끌어올릴 것.

> 참고: §6.2/§7.5 의 rehydration 은 conversationThread 를 `NodeExecution.outputData` 에서 로드하도록 기술돼 있어(execution-engine §7.5 시퀀스 "NodeExecution.outputData 에서 ... conversationThread 로드"), 영속 위치를 node_execution 으로 둘 코드 측 근거는 있다. 다만 convention 의 `Execution.conversation_thread` 예고와의 충돌은 위처럼 별도 정리가 필요.

---

## Info

- **I1 (네임스페이스 안전 확인)**: §9.2 Redis 키 `exec:run:seq` / `exec:cont:seq` 는 `run` vs `cont` 로 namespace 분리돼 있다. plan 이 신규 Redis 키를 도입하지 않으므로 이 네임스페이스와 충돌 없음.
- **I2 (상태 enum 무변경 확인)**: plan B 의 "park 즉시 해제" 는 `waiting_for_input` 상태 enum 자체를 바꾸지 않는다(§1.1 rehydration 도 enum 불변 명시). 신규 상태값 도입 없음 → data-model/2-navigation 필터 enum 과 충돌 없음.
- **I3 (information_extractor 확장, A2)**: A2 가 `information_extractor` 멀티턴에도 checkpoint 저장을 확장할 때, execution-engine §1.3 "`_resumeCheckpoint` 는 `ai_agent` 노드 한정" 문구와의 정합은 spec 갱신으로 다뤄야 함(식별자 충돌 아님 — 동일 `_resumeCheckpoint` 식별자의 적용 범위 확대). plan §3 에 §1.3 적용범위 갱신 항목을 추가 권고.

STATUS: WARN
