# 성능(Performance) 리뷰

리뷰 대상: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (PR-B2, exec-park D4)
리뷰어: performance sub-agent
일시: 2026-06-06

---

## 발견사항

### **[INFO]** `rehydrateContext` 내 N+1 DB 쿼리 (기존 코드, PR-B2 유지)

- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1392–L1419
- **상세**: `executionNodeLogRepository.find(...)` 로 log rows 를 일괄 조회한 후, 각 고유 nodeId 마다 `nodeExecutionRepository.findOne(...)` 을 루프 안에서 순차 호출한다. 완료 노드가 N 개면 DB 왕복이 N+1 회 발생한다. PR-B2 가 이 경로를 직접 수정하지 않았으나, 새 `processAiResumeTurn` slow-path 가 `rehydrateContext` 를 경유하므로 AI 멀티턴 재개마다 동일 패턴이 실행된다.
- **제안**: `nodeExecutionRepository.find({ where: { executionId, status: COMPLETED, nodeId: In(uniqueNodeIds) }, order: { startedAt: 'DESC' } })` 로 단일 배치 쿼리 후 nodeId 별 최신 row 를 JS 레벨에서 선택. N+1 → 1+1 로 축소 가능. (이 개선은 PR-B2 범위 밖이나 slow-path 빈도 증가로 영향도 상승.)

---

### **[INFO]** `reparkAiResumeTurn` 에서 `cloneThread` 딥 클론 + DB save — 매 turn 재파크 시 반복

- **위치**: L5387–5397 (`reparkAiResumeTurn`), L9020–9025 (`stageDurableResumeSnapshot`)
- **상세**: `reparkAiResumeTurn` → `stageDurableResumeSnapshot` → `cloneThread(context.conversationThread)` 순으로 호출돼 대화 스레드 전체를 매 turn 재파크마다 깊은 복사한다. 대화가 길어질수록 `conversationThread` 배열이 커지고 클론 비용도 선형 증가(O(n) where n = 메시지 수)한다. 또한 매 re-park 마다 `updateExecutionStatus` 를 통해 `Execution` 행을 save 하므로 DB write I/O 가 turn 수에 비례한다. 이는 옛 장수 루프와 비교해 turn 당 왕복 수가 동일하거나 약간 많다(루프는 중간 save 없이 마지막에만 park).
- **제안**: 단기적으로는 허용 수준. `conversationThread` 가 매우 긴 대화(수십 메시지 이상)에서 클론 비용이 의미 있을 경우, `cloneThread` 를 shallow-first + 변경 시 deep copy 패턴(copy-on-write)으로 대체 검토. DB write 최소화를 위해 `conversation_thread` + `user_variables` 변경 여부를 dirty flag 로 관리해 변경 없는 re-park 시 Execution 컬럼 update 생략 고려.

---

### **[INFO]** `processAiResumeTurn` 에서 `action.type` 분기 시 `payload as ContinuationPayload` 타입 단언 후 연속 타입 체크

- **위치**: L5292–5373 (`processAiResumeTurn`)
- **상세**: `payload: unknown` 을 `payload as ContinuationPayload` 로 단언 후 `action.type` 를 세 번 분기한다(`ai_end_conversation`, `ai_message || form_submitted`, `button_click`, else). 런타임 비용 자체는 무시할 수준이나, 분기가 늘수록 유형별 런타임 가드(`zod` 등)를 통한 일회성 파싱으로 교체하면 early-exit 패턴이 단순해진다. 현 구조에서는 성능상 문제 없음.
- **제안**: INFO 수준. 현재 코드 유지 가능.

---

### **[INFO]** `firePayload` 폴링 루프 (`setTimeout` 체인, 최대 250회 × 20ms = 5초) — AI 경로에서 skip 됐으나 form/button 경로 잔류

- **위치**: L1839–1870 (`resumeFromCheckpoint` 내 firePayload)
- **상세**: PR-B2 변경으로 AI 멀티턴 경로(`isAiConversation === true`)에서는 `firePayload` 스케줄이 생략돼 `setTimeout` 체인이 이벤트 루프에 쌓이지 않는 것을 올바르게 처리했다. form/button 경로에는 여전히 최대 250회 × 20ms 간격의 `setTimeout` 재귀 체인이 남아있다. 동시 resume 이 많은 경우 이벤트 루프에 setTimeout 콜백이 누적될 수 있으나, PR-B1 코드와 동일 수준이며 PR-B2 가 이를 악화시키지 않았다.
- **제안**: PR-B2 범위 밖. 옛 `pendingContinuations` 제거(PR-B2 이후 예정) 시 이 폴링 메커니즘 전체가 삭제됨을 코드 주석(L1836)이 이미 문서화하고 있음.

---

### **[INFO]** `waitForAiConversation(parkMode='release')` 에서 `runAiConversationLoop` 진입 전 조기 반환 — 비효율 없음

- **위치**: L5018–5033 (`waitForAiConversation`)
- **상세**: `parkMode === 'release'` 시 `emitAiWaitingForInput` 호출(DB save + event emit) 이후 즉시 `PARK_RELEASED` 를 반환해 `runAiConversationLoop` 장수 루프에 진입하지 않는다. 이것이 PR-B2 핵심 성능 개선으로, 옛 구조에서 루프가 대화 수명 내내 `await` 를 유지하며 in-process 코루틴과 `conversationThread` 메모리를 점유하던 문제를 제거했다.
- **제안**: 설계가 올바름. 추가 조치 불필요.

---

### **[INFO]** `driveResumeDetached` — `payload: opts.payload` 전달 시 추가 직렬화/역직렬화 없음

- **위치**: L1899–1903, L1942
- **상세**: `opts.payload` 가 `unknown` 타입으로 `driveResumeDetached` 내부까지 전달되어 `processAiResumeTurn` 에서 `as ContinuationPayload` 로 단언한다. BullMQ 잡 직렬화(Redis) 이후 역직렬화된 객체이므로 추가 직렬화 비용은 없다. 다만 `form_submitted` 액션에서 `JSON.stringify(action.formData ?? {})` (L5313)로 formData 를 다시 문자열로 직렬화해 LLM 에 전달하는 부분이 있다. 이는 옛 `runAiConversationLoop` (L5209)와 동일 패턴이며 PR-B2 도입 비용이 아님.

---

## 요약

PR-B2 의 핵심 변경(top-level 멀티턴 AI를 장수 루프에서 turn-단위 park-and-release 구조로 전환)은 성능 측면에서 명확한 개선이다. 가장 중요한 효과는 Worker 슬롯을 대화 수명 내내 점유하던 코루틴이 제거되어 동시 처리량이 bounded 됐고, in-process `conversationThread` 메모리 점유가 각 재개(continuation job) 구간으로 한정됐다는 점이다. 기존 코드에서 유래된 `rehydrateContext` 내 N+1 DB 쿼리 패턴이 slow-path 빈도 증가로 영향도가 다소 높아졌으나 PR-B2 도입 비용이 아니며 CRITICAL 임계가 아니다. 매 re-park 마다 발생하는 `cloneThread` 딥 클론 + `Execution` DB save 는 긴 대화에서 선형 증가 비용이 있으나 운영 허용 범위 내다. 전반적으로 PR-B2 변경은 메모리·슬롯 누수 구조를 정상화하는 방향으로 성능을 개선했으며, 신규 도입된 경로에 CRITICAL 또는 WARNING 수준의 성능 결함은 발견되지 않았다.

## 위험도

LOW

STATUS: OK
