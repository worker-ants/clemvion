## Side Effect Code Review

### 발견사항

---

**[WARNING] WS 이벤트 동시 발행 순서 변화**
- **위치**: `ai-agent.handler.ts` — `Promise.all` 블록 내 `runProviderTool` 호출부 (단일 턴 및 멀티 턴 resume 양쪽)
- **상세**: `runProviderTool` 내부에서 `TOOL_CALL_STARTED` / `TOOL_CALL_COMPLETED` WS 이벤트를 직접 emit한다. 이전에는 직렬 `await`로 "tool1 start → tool1 complete → tool2 start → ..." 순으로 발행됐지만, `Promise.all` 전환 이후 N개 도구의 STARTED 이벤트가 거의 동시에 발행되고 COMPLETED 이벤트는 각 비동기 완료 시점에 임의 순서로 온다. 클라이언트 타임라인 UI가 이벤트 도착 순서에 의존해 "pending → success/error" 상태 전이를 추적한다면, 동시 다발 START 이후 순서 보장 없는 COMPLETE 수신 시 렌더링이 어긋날 수 있다.
- **제안**: 프론트엔드 WS 이벤트 소비 로직이 동일 `executionId` 내 `toolCallId` 키로 개별 상태를 관리하는지 확인. 이벤트가 도착 순서가 아닌 `toolCallId` 기준으로 매핑되고 있다면 안전하다.

---

**[WARNING] `providerBudget`이 동일 이터레이션 내 `normalToolCalls` 카운트를 선점하지 않음**
- **위치**: `ai-agent.handler.ts` — 단일 턴 ~L586, 멀티 턴 ~L994
- **상세**: `providerBudget = maxToolCalls - toolCallCount`는 배치 실행 **전** 스냅샷을 기반으로 계산된다. 같은 루프 이터레이션에서 provider 도구 이후 `normalToolCalls`도 `toolCallCount++`를 수행하므로, 한 이터레이션 내 실제 총 카운트가 `maxToolCalls`를 초과할 수 있다(예: budget=2, provider 2건 + normal 2건 → 총 4 카운트). 이는 변경 이전에도 동일하게 존재하던 동작(while 조건은 이터레이션 진입 시점에만 검사)이므로 **회귀는 아니지만**, 새로운 budget truncate 로직이 partial 보호만 제공한다는 점이 명시적으로 문서화되지 않았다.
- **제안**: 해당 while 루프 주석에 "budget은 이터레이션 경계에서 강제되며, 이터레이션 내부에서는 provider 도구만 선제 truncate된다"는 설명 추가.

---

**[WARNING] 단일 턴 vs 멀티 턴의 `conditionToolCalls` `toolCallCount` 증가 불일치**
- **위치**: `executeSingleTurn` vs `processMultiTurnMessageInner`
- **상세**: 단일 턴에서 조건 도구는 `toolCallCount++`를 하지 않는다("does not count toward toolCallCount" 주석). 멀티 턴 resume에서는 조건 도구에도 `toolCallCount++`가 적용된다. 이 기존 비대칭이 새 `providerBudget` 계산에 영향을 준다. 멀티 턴에서 조건+프로바이더 도구가 동일 턴에 혼재할 경우, **조건 도구가 먼저 카운트되지 않지만** 조건 처리 후 provider budget이 남은 한도로 계산되는 순서이므로 실제 문제는 없다. 그러나 의도된 설계인지 우연한 동작인지가 코드상 명확하지 않다.
- **제안**: 조건 도구의 toolCallCount 포함 여부를 두 경로에서 명시적으로 통일하거나, 각 경로의 주석으로 의도를 명시.

---

**[INFO] 내부 메서드 타입 캐스트를 통한 직접 테스트**
- **위치**: `ai-agent.handler.spec.ts` — `runs provider tools in parallel on multi-turn resume too` 테스트
- **상세**: `processMultiTurnMessage`가 `handler as unknown as { processMultiTurnMessage: ... }` 캐스트로 직접 호출된다. 이 메서드의 시그니처가 변경돼도 TypeScript 컴파일러가 잡지 못한다(타입 정보가 소실된 상태).
- **제안**: 허용 가능한 수준의 내부 테스트. 향후 시그니처 변경 시 이 테스트가 런타임 오류로만 발견된다는 점을 인지.

---

**[INFO] `app.e2e-spec.ts` 무기한 skip**
- **위치**: `backend/test/app.e2e-spec.ts`
- **상세**: 인프라 셋업 전까지 스킵 처리. 별도 이슈 트래킹 없이 방치되면 영구 skip이 될 수 있다.
- **제안**: 스킵 주석에 복원 조건(인프라 셋업 완료 기준)이나 Issue 번호를 링크.

---

**[INFO] `jest-e2e.json` ESM 모듈 수동 목록 관리**
- **위치**: `backend/test/jest-e2e.json` — `transformIgnorePatterns`
- **상세**: `uuid`, `p-limit`, `yocto-queue`를 명시적으로 열거한다. 신규 ESM-only 전이 의존성이 추가되면 이 목록도 수동 갱신이 필요하다. 표준적인 접근이지만 유지보수 비용이 있다.
- **제안**: 현재 수준 유지. 신규 ESM 패키지 추가 시 목록을 잊지 않도록 onboarding 노트에 언급.

---

### 요약

이번 변경의 핵심인 `Promise.all` 병렬 실행 전환은 상태 돌연변이(ragGroup, messages, toolCallCount) 전체를 `Promise.all` 완료 이후 입력 순서대로 직렬 적용하여 결정론성을 보존한다. `RagAccumulator`의 `seenChunkIds` dedup과 `providerBatchResults` 인덱스 보존 덕분에 청크 중복 제거와 메시지 순서도 안전하다. 가장 유의미한 부작용은 WebSocket `TOOL_CALL_STARTED/COMPLETED` 이벤트가 병렬로 발행되는 순서 변화이며, 클라이언트가 `toolCallId` 기반으로 상태를 관리하는지 확인이 필요하다. `normalToolCalls`와의 budget 불일치 및 단일/멀티 턴 조건 도구 카운트 비대칭은 기존부터 존재하던 동작으로 회귀가 아니지만, 새 truncate 로직과 병존하는 점에서 명시적 문서화가 필요하다.

### 위험도

**LOW**