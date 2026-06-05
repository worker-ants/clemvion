# Cross-Spec 일관성 Check 결과 — `spec/5-system` (--impl-prep)

- **검토 모드**: 구현 착수 전 (--impl-prep, scope=`spec/5-system`)
- **대상 작업**: `exec-park-durable-resume` — park 완전 해제 + slow-path 일원화 (durable resume state). PR-B1(form/button release) 머지 완료, 본 차수는 **PR-B2**(multi-turn AI turn-단위 park + `pendingContinuations`/barrier 제거) 착수 전 검토.
- **SoT 문서**: `spec/5-system/4-execution-engine.md` §1.1/§1.2/§1.3·§4.x·§6.2·§7.4·§7.5·§8
- **판정**: **BLOCK: NO** (Critical 0 / Warning 0 / Info 2)

---

## 요약

`spec/5-system` 의 durable park / continuation bus / rehydration 모델은 인접 영역 spec
(`1-data-model`, `6-websocket-protocol`, `13-replay-rerun`, `14-external-interaction-api`,
`15-chat-channel`, `conventions/conversation-thread`, `4-nodes/3-ai/1-ai-agent`,
`4-nodes/3-ai/3-information-extractor`) 과 **데이터 모델·API 계약·요구사항 ID·상태 전이·
권한·계층 책임 6개 관점 모두에서 충돌 없음**. Phase A(A1~A3) 의 컬럼·복원 약속과 Phase B 의
park-release/slow-path 일원화가 cross-spec 으로 이미 정합화되어 있다. 발견 2건은 모두
**Info (문서 currency 갭)** 수준으로 계약 위배가 아니며 PR-B2 착수를 차단하지 않는다.

---

## 점검 관점별 결과

### 1. 데이터 모델 충돌 — 없음

- `Execution.conversation_thread`(V084)·`Execution.user_variables`(V085)·`active_running_ms`·
  `dry_run` 컬럼 정의가 `1-data-model.md §2.13`(L455/L465/L466) 과 `4-execution-engine.md
  §6.2` 저장 전략 표·§6.1 컨텍스트 구조에서 **동일 의미·동일 nullable·동일 commit 시점
  (park 진입)·동일 소비처(§7.5 rehydration)** 로 일치.
- `error.code` 어휘(`RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`/
  `WORKER_HEARTBEAT_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED`)가 `1-data-model.md §2.13` Execution.error
  행과 `4-execution-engine.md §7.5/§8/§7.1` 에서 일치하며, `6-websocket-protocol.md §4.2`(L296-298)·
  `error-codes.md` 카탈로그(`RETRY_*`/`RESUME_*` 도메인)에도 동일하게 등재.
- `_resumeCheckpoint` allow-list 의 IE 확장(`partialResult`/`collectionRetryCount`)이
  `4-execution-engine.md §1.3` 과 `3-information-extractor.md L376`·`1-ai-agent.md L706` 에서 합집합
  모델로 일관 기술.

### 2. API 계약 충돌 — 없음

- continuation 명령(`submit_form`/`click_button`/`submit_message`/`end_conversation`/
  `retry_last_turn`)의 ack shape·`resumed`/`success` 플래그·에러 코드가 `6-websocket-protocol.md
  §4.2`(L296-352) 와 `4-execution-engine.md §7.4/§7.5` 에서 동형.
- `INVALID_EXECUTION_STATE`(WS) ↔ `INVALID_STATE` 422(REST) ↔ `STATE_MISMATCH` 409(EIA) 의
  3-layer 매핑이 `4-execution-engine.md §7.5.1` 과 `14-external-interaction-api.md §EIA-IN-13/L313`
  에서 정확히 대응. `retry_last_turn` 이 rehydration 경로(`RESUME_*`) 비대상임을 양쪽 모두 명시.
- `execution.waiting_for_input`/`ai_message` 이벤트 페이로드가 EIA SSE/notification webhook 으로
  wrap 되는 계약(`14-external-interaction-api.md §6.2/L548`)이 WS §4.4 와 일관, `llmCalls` strip-only
  결정도 fanout seam 에서 일치.

### 3. 요구사항 ID 충돌 — 없음

- `RR-PL-*`(replay-rerun)·`EIA-*`(external-interaction)·`CCH-*`(chat-channel)·`ND-BG-05`(background)
  ID 네임스페이스가 서로 분리돼 있고, `4-execution-engine.md` 가 이들을 cross-link 만 할 뿐 재정의·
  재부여하지 않음. 본 작업이 신규 요구사항 ID 를 부여하지 않음(plan 의 D1~D5 는 결정 ID, spec 요구사항 ID 아님).

### 4. 상태 전이 충돌 — 없음

- Execution/NodeExecution 상태 머신(`4-execution-engine.md §1.1/§1.2`)의 `waiting_for_input ↔ running`
  /`waiting_for_input → waiting_for_input`(rehydration self-transition)/`failed → running`(retry 재진입)/
  `waiting_for_input → cancelled`(RESUME 실패) 전이가 `1-data-model.md §2.13`(status enum)·
  `6-websocket-protocol.md`·`14-external-interaction-api.md` 와 일치. Phase B "park = 세그먼트 종료"는
  **enum 자체를 바꾸지 않고**(§1.1 주석 명시) 내부 재개 경로만 slow-path 로 일원화 → 상태 모델 무변경.
- chat-channel `sessionExpired`(CCH 텍스트)가 `execution.cancelled` + `RESUME_*` 종착(§7.5)에 정확히
  바인딩(`15-chat-channel.md L253-255`), CCH-CV-03(c) "cancelled → 새 execution" 전이와 정합.
- PR-B2 turn-park 재진입은 표준 continuation 세그먼트(`jobId = executionId` 직렬화, §4.2 불변식)를
  따르므로 동시 active 세그먼트를 만들지 않음 — PR2a active-running 직렬화 불변식(§4.2/§Rationale L385/L1316)
  보존. (불변식 재검증 트리거는 spec 이 이미 "PR2b+ 재진입 경로" 로 명시; PR-B2 의 turn-park 는
  retry 류 동시 spawn 이 아니라 순차 1-세그먼트 재개라 위반 없음.)

### 5. 권한·RBAC 모델 충돌 — 없음

- 본 작업은 RBAC 매트릭스(`1-auth.md §3.2`)·권한 액션을 신설/변경하지 않음. resume/park 는
  기존 Execution 실행 권한 경계 안에서 동작하며 EIA in-process trusted caller 예외(EIA-AU-08)와도
  무관(durable resume 은 인증 레이어를 거치지 않는 worker-side 재구성).

### 6. 계층 책임 충돌 — 없음

- 이벤트 발행 sink 단일화(`WebsocketService` canonical, §4.4)·continuation bus 가 worker 컨텍스트에서만
  재진입(WS gateway 동기 재개 불가, §7.4 L352)·`conversation_thread` durable 컬럼 vs NodeExecution 분산
  SoT 의 소비처 분리(`conversation-thread.md §4/§8.4`)가 서버/클라이언트 및 도메인 모듈 책임 분할 결정과
  일치. `agent_memory` 테이블(persistent 메모리)과 `conversation_thread`(in-flight resume)의 저장소
  분리도 `1-ai-agent.md §12.13 L1277` 에서 명확.

---

## Info (차단 아님 — 문서 currency, 후속 권장)

### I1. `1-ai-agent.md` config-echo 서술의 frozen-snapshot 표현이 D3 fresh-per-turn 을 미언급

`4-execution-engine.md §6.2`(L672)는 Phase B 의 **turn-단위 park(D4) + fresh-config(D3)** 로
"frozen snapshot 은 *한 turn 처리 범위* 한정, park 중 워크플로 편집은 다음 turn 부터 반영"을 명시한다.
반면 `1-ai-agent.md §12` 의 config echo 정책(L438 "수명 내내 raw 값", L687 "`state.rawConfig` frozen
snapshot")은 turn 경계 fresh 재유도를 언급하지 않는다.

- **충돌 아님**: ai-agent 의 진술 대상은 *config echo 가 항상 raw template 을 보존한다*는 직교 불변식이며,
  이는 fresh-per-turn 에서도 그대로 성립한다(echo 는 evaluated 가 아닌 raw 이므로 turn 간 재유도와 무관).
  "수명 내내 raw" 는 *echo 형태(raw vs evaluated)* 에 대한 진술이지 *어느 turn 의 정의인가* 에 대한 진술이 아님.
- **권장(선택)**: PR-B2 의 spec 동기 갱신 시 `1-ai-agent.md §12`(또는 §7 multi-turn 흐름)에서
  `state.rawConfig` frozen snapshot 의 lifecycle 이 Phase B 후 "한 turn 범위"임을 `§6.2` 로 cross-link
  1줄 추가하면 문서 currency 가 완결된다. plan 의 spec 변경 항목(L108-113)이 이미 §6.2/§Rationale 를 다루므로
  ai-agent 측 1줄 reconcile 만 추가하면 됨.

### I2. `13-replay-rerun.md` Multi-turn resume 서술도 동일 frozen-snapshot 표현

`13-replay-rerun.md §6.3 참조`(L446)·§6.3 표 cross-link 가 Multi-turn resume 을 "`state.rawConfig`
frozen snapshot 사용" 으로 기술한다. I1 과 동일하게 **충돌 아님** — replay-rerun 의 핵심 주장은
"Multi-turn resume 은 replay 가 아니다(새 Execution row 미생성, 같은 실행의 다음 turn)" 이고 이는 D3
fresh-per-turn 으로도 불변(turn-fresh 는 *같은 row 안의* 정의 재유도일 뿐 새 실행이 아님). reproducibility
약화는 `4-execution-engine.md §6.2`(L672)가 "turn 단위로 약화되나 의도된 trade-off" 로 이미 수용·기록.

- **권장(선택)**: 영향 없음. replay-rerun 은 §6.3 를 cross-link 하는 소비측이므로 SoT(§6.2) 갱신만으로 충분.
  별도 수정 불요 — Info 로만 기록.

---

## 결론

PR-B2 착수를 차단하는 cross-spec 충돌은 **없음(BLOCK: NO)**. durable park 모델이 6개 인접 영역과
데이터 모델·API·상태 전이·권한·계층 책임 전반에서 정합하며, Phase A 의 복원 약속과 Phase B 의
slow-path 일원화가 이미 cross-spec 으로 reconcile 되어 있다. Info 2건은 frozen-snapshot 표현의 문서
currency 갭으로, PR-B2 의 spec 동기 갱신 단계에서 `1-ai-agent.md` 1줄 cross-link 추가(I1)로 선택적 보완
가능하며 계약 위배가 아니다.

STATUS: SUCCESS BLOCK:NO CRITICAL:0 WARNING:0 INFO:2
