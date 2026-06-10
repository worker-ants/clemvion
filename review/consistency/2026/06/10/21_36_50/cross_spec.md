# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 범위**: 승인 백로그 묶음 구현 — 03 M-6·m-2(dead code 제거), 06 M-5(parallel branch nodeOutputCache dev/test deep freeze), 04 m-4(integration credential 회전 pub/sub Pool 무효화), 06 M-1(WS resumed ack spec 문구 정리 — planner), review_guard _porcelain_path off-by-one fix

---

## 발견사항

### 1. **[WARNING]** WS §4.2 `resumed` 필드 정의 ↔ §7.5 "ack 에 `resumed: false`" 표현 충돌 (M-1 대상)

- **target 위치**: 구현 항목 06 M-1 — spec 문구 정리(planner 작업). 수정 대상은 `spec/5-system/6-websocket-protocol.md §4.2` + `spec/5-system/4-execution-engine.md §7.5`
- **충돌 대상**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/6-websocket-protocol.md` 라인 241: `resumed | boolean | 재개 성공 여부`
  - `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/4-execution-engine.md` 라인 967: `이 셋 모두 … ack 에 resumed: false + error 객체로 노출된다`
- **상세**: WS §4.2 는 `resumed` 를 "재개 성공 여부" 로 정의하고 있어, gateway 가 enqueue 성공 시점에 `resumed: true` 를 하드코딩하는 실제 동작과 정의가 어긋난다. 실행 엔진 §7.5 는 `RESUME_*` 3건을 "ack 에 `resumed: false`" 로 노출한다고 기술하나, `RESUME_*` 는 비동기 worker 측 실패이므로 동기 ack 시점엔 이를 알 수 없다. 이는 §7.5.1 의 "RESUME_* 는 후행 이벤트" 선언과 내부 충돌이다. M-1 의 권고안(A)은 §4.2 의 `resumed` 를 "재개 시작 수락(enqueue) 여부" 로 재정의 + §7.5 문장을 §7.5.1 과 일치시키는 spec 정정이다.
- **제안**: M-1 planner 작업이 두 위치를 동시 수정해야 단일 진실이 보장된다. `resumed` 재정의 후 EIA `interaction.service` 의 REST 진입점(`409 STATE_MISMATCH`)과 의미적 일관성 추가 확인 권장.

---

### 2. **[WARNING]** database-query spec §4 "credential 회전 시 stale 풀 evict" — 멀티 인스턴스 무효화 조율이 spec 미언급 (m-4 대상)

- **target 위치**: 구현 항목 04 m-4 — pub/sub 전파로 전 인스턴스 Pool 즉시 evict. 수정 대상은 `spec/4-nodes/4-integration/2-database-query.md §4(실행 로직)` + Rationale 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/4-integration/2-database-query.md` 라인 77: `credential 회전 시 stale 풀을 evict 후 새 풀 생성`
- **상세**: 현행 spec 라인 77 은 단일 프로세스 기준 서술로, 멀티 인스턴스 환경에서 다른 인스턴스의 pool 이 stale 자격증명을 유지하는 경우에 대한 기술이 없다. 구현 확정안(A)은 Redis pub/sub 채널을 통해 전 인스턴스에 무효화 신호를 전파하는 새로운 인프라를 추가하며, 이는 spec 에 명시되지 않은 동작이다. 계획 문서(plan/in-progress/refactor/04-security.md:387)도 "spec §2 에 멀티 인스턴스 무효화 + Rationale 추가 필요(planner)" 를 명시하고 있다. 구현만 하고 spec 을 갱신하지 않으면 spec·코드 drift 가 발생한다.
- **제안**: m-4 구현과 함께 `spec/4-nodes/4-integration/2-database-query.md §4` 의 풀 캐시 기술을 "멀티 인스턴스 환경에서는 Redis pub/sub 채널로 integrationId 무효화 신호를 전파해 전 인스턴스 pool 을 즉시 evict" 로 확장하고, §Rationale 에 MTTR 트레이드오프를 추가해야 한다. planner 단계에서 선 spec 갱신 권장.

---

### 3. **[INFO]** parallel spec `nodeOutputCache` shallow copy 결정이 구현 동작(M-5 deep freeze 추가)과 표현상 불일치 가능성

- **target 위치**: 구현 항목 06 M-5 — dev/test 한정 branch clone 직후 `nodeOutputCache` 값 deep `Object.freeze`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/1-logic/10-parallel.md` 라인 14: `nodeOutputCache 는 shallow copy 로 격리된다`
- **상세**: 구현 확정안(A)은 spec 의 shallow copy 결정을 변경하지 않고, dev/test 환경에서만 branch clone 직후 deep `Object.freeze` 를 적용해 invariant 위반을 테스트 시 즉시 탐지하는 방어적 추가다. spec `10-parallel.md` 의 "shallow copy 로 격리" 기술은 production 동작으로서 여전히 정확하다. 다만 dev/test 환경에서의 freeze 동작에 대한 언급이 spec 에 없어, 향후 spec 을 읽는 사람이 dev/test 의 예외 동작을 발견하지 못할 수 있다.
- **제안**: spec `10-parallel.md` 의 해당 줄에 주석 수준의 인라인 언급("dev/test 환경에서는 값에 `Object.freeze` 를 적용해 mutate invariant 를 즉시 검출한다") 을 추가하면 코드를 읽는 사람과 spec 을 읽는 사람 모두에게 일관된 정보를 제공한다. 필수 사항은 아니나 단일 진실 원칙 관점에서 권장.

---

### 4. **[INFO]** dead code 제거(M-6·m-2) 후 execution-engine spec §7.4/§7.5 서술이 in-memory 경로 언급을 포함하지 않는지 사후 확인 필요

- **target 위치**: 구현 항목 03 M-6(registerContinuationHandlers·on() 제거), m-2(toEiaEvent·system-status 상수 2건 제거)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/4-execution-engine.md` §7.4/§7.5 (전이 서술 영역)
- **상세**: plan/in-progress/refactor/03-maintainability.md:237 는 "§7.5 단일 경로 서사와 코드 불일치"를 제거 근거로 명시한다. 제거 후에도 spec 이 "in-memory `registerContinuationHandlers` 경로를 fallback 으로 지원" 과 같은 표현이 남아 있다면 dead 코드 제거 후 spec 이 사라진 경로를 기술하는 역방향 drift 가 생길 수 있다. 현재 spec §7.4/§7.5 는 분산 BullMQ 경로만 기술하고 있어 직접 충돌은 없으나, PR 리뷰 시 spec 에 남은 "in-memory" 언급 잔재가 있는지 grep 점검이 필요하다.
- **제안**: `registerContinuationHandlers` 제거 PR 에서 `spec/5-system/4-execution-engine.md` 를 grep(`registerContinuationHandlers|in-memory.*continuation|on().*bus`) 하여 잔여 언급을 일괄 정리하는 단계를 체크리스트에 추가.

---

### 5. **[INFO]** `system-status.constants.ts` 상수 2건 삭제(m-2)와 spec 16-system-status-api.md §1 MONITORED_QUEUES 갭 주석의 관계

- **target 위치**: 구현 항목 03 m-2 — `system-status.constants.ts:117-119` 상수 2건 삭제
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/16-system-status-api.md` 라인 40: `코드의 MONITORED_QUEUES(system-status.constants.ts) 에는 makeshop-token-refresh 와 agent-memory-extraction 이 아직 미등재`
- **상세**: spec 16-system-status-api.md:40 은 `system-status.constants.ts` 의 `MONITORED_QUEUES` 를 직접 참조하며 구현 갭을 기록하고 있다. 제거 대상 상수 2건(라인 117-119)이 `MONITORED_QUEUES` 와 관련이 없다면 충돌 없음. 그러나 삭제 대상이 queue 목록 관련 상수라면, spec 의 V-15 갭 추적이 유효한 상태에서 코드가 제거되어 spec 언급 코드가 부재 상태가 되는 dead reference 가 생길 수 있다.
- **제안**: m-2 에서 삭제할 상수 2건이 `MONITORED_QUEUES` 나 큐 레지스트리와 무관한지(계획에 따르면 `toEiaEvent` alias + `system-status.constants.ts:117-119` 두 상수) 확인 후 진행. 무관하면 INFO 수준이나, 관련 있다면 spec 16 라인 40 의 갭 주석도 함께 갱신 필요.

---

## 요약

구현 대상 백로그 묶음(03 M-6·m-2, 06 M-5, 04 m-4, 06 M-1, review_guard fix)은 각각 spec 이 이미 제거·수정을 예약했거나 plan 문서가 spec 갱신 필요를 명시한 항목들이다. 직접 충돌(두 spec 영역이 동시에 존재할 수 없는 모순)은 발견되지 않았다. 주요 위험은 두 가지다: (1) 06 M-1(WS resumed ack)에서 `spec/5-system/6-websocket-protocol.md §4.2` 와 `spec/5-system/4-execution-engine.md §7.5` 사이에 이미 존재하는 spec 내부 충돌로, M-1 planner 작업이 두 위치를 동시에 수정해야 해소된다. (2) 04 m-4(pub/sub 전파)에서 구현이 spec 에 미기술된 멀티 인스턴스 동작을 추가하므로, 구현 전 혹은 동시에 `spec/4-nodes/4-integration/2-database-query.md §4` 갱신이 동반되어야 spec 단일 진실 원칙이 유지된다. 나머지 항목(M-6·m-2 dead code, M-5 freeze, _porcelain_path fix)은 spec 충돌이 없으며 사후 spec 정리 수준의 권고 사항만 남는다.

## 위험도

**LOW**

STATUS: OK
