# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 1. [WARNING] `saveMemories` 공개 메서드 시그니처 파괴적 변경
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 메서드 (파일 2)
- **상세**: 포지셔널 5개 파라미터 `(workspaceId, scopeKey, items, embedCfgSource, ttlDays?)` → 단일 옵션 객체 `({workspaceId, scopeKey, items, embedCfgSource, ttlDays?})`로 변경. 이 diff 범위 내 모든 호출부(processor, 테스트 14곳)는 갱신되었으나, TypeScript 컴파일 시점에 누락 호출부가 있다면 타입 오류로 감지된다. 런타임에서 구 형식으로 잘못 호출될 경우 `args` 파라미터에 문자열이 들어오고 `const { workspaceId } = args` 구조분해가 `undefined`를 반환해 `if (!workspaceId || !scopeKey) return;` 가드로 무음 no-op 처리된다 — 예외 없이 저장이 조용히 스킵된다.
- **제안**: 이미 TypeScript 타입 안전망이 있으므로 컴파일 통과 확인으로 충분하나, 이 서비스를 사용하는 다른 모듈(예: 향후 추가될 호출부)을 위해 JSDoc 이나 코드 주석에 옵션 객체 계약을 명시하는 것이 권장된다.

---

### 2. [INFO] `updateSummaryState` — 의도적 공유 객체 직접 변이
- **위치**: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` 176~1440번 라인 (파일 6)
- **상세**: 새 메서드가 `context.conversationThread as MutableConversationThread`로 캐스팅 후 `runningSummary`/`summarizedUpToSeq`를 직접 교체한다. 이는 설계 의도(단일 변이 경로 I-7)이지만, 해당 thread 객체에 대한 참조를 외부에서 보유하고 있는 코드는 메서드 호출 직후 변경을 즉시 인지한다. `undefined`를 전달하면 기존 값을 `undefined`로 덮어쓰므로 의도적 초기화가 아닌 실수로 `undefined`를 전달하면 요약 상태가 유실된다.
- **제안**: 현재 테스트 3건이 덮어쓰기 동작을 명시적으로 검증하고 있으므로 문서화는 충분하다. 다만 인터페이스 타입(`state: { runningSummary?: string; summarizedUpToSeq?: number }`)이 `undefined`를 허용하므로 호출부가 실수로 빈 객체를 넘기는 시나리오를 고려해 인자 유효성 검증(예: 로깅) 추가를 검토할 수 있다.

---

### 3. [INFO] `buildCosineMatch` 공유 SQL 빌더 — 파라미터 순서 계약 암묵 의존
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` (파일 2)
- **상세**: `$1`=query vector, `$2`=workspaceId, `$3`=scopeKey, `$4`=cosine 임계치 순서를 JSDoc에 명시했으나, 빌더 반환값(`whereClause` 문자열)에는 이 순서가 하드코딩된다. `recall`과 `findSimilarFact` 호출부 둘 다 `[vectorStr, workspaceId, scopeKey, threshold, topK]` 순으로 바인딩하므로 현재는 일치하나, 향후 빌더를 수정하면서 파라미터 순서를 바꿀 경우 모든 호출부가 동시 갱신되어야 한다 — 이 계약이 코드 구조상 강제되지 않고 주석으로만 표현되어 있다.
- **제안**: 현재는 안전하다. 빌더 변경 시 계약 파손이 테스트에서 즉시 감지되므로 중요도 INFO 유지.

---

### 4. [INFO] `memoryState` 네임스페이스 이전 — 구 평면 키 기록 중단
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (파일 9)
- **상세**: 신 코드는 `_resumeState`에 `lastExtractionTurnSeq`(평면 키)를 더 이상 기록하지 않고 `memoryState.lastExtractionTurnSeq`(서브 네임스페이스)만 기록한다. 배포 시점 파킹된(in-flight) 실행의 기존 `_resumeState`에는 여전히 평면 키가 있을 수 있는데, `readExtractionWatermark`가 신 네임스페이스 우선 + 구 평면 키 폴백을 구현해 이를 올바르게 처리한다. 그러나 배포 후 첫 번째 resume에서는 구 평면 키를 읽어 watermark를 복원하고, 이후 _resumeState에는 신 네임스페이스로 기록되므로 1회 전환이 발생한다.
- **제안**: 폴백 로직이 존재하므로 데이터 유실 없음. 다만 IE handler의 `hydrateState`에서도 `readExtractionWatermark`를 통해 정규화하므로 양 핸들러 일관성은 보장된다.

---

### 5. [INFO] `fullTurns`가 turns 배열에 대한 참조 (복사 아님)
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (파일 8)
- **상세**: `const fullTurns = fullThread ? fullThread.turns : []`는 배열 복사가 아닌 내부 turns 배열 참조다. `buildSummaryBufferUpdate` 내부에서 `await` LLM 콜이 발생하는 동안 이론적으로 다른 코루틴이 thread.turns를 변이시킬 수 있다. 그러나 실제로 `appendInternal`만이 turns를 변이하며, 이 메서드는 동일 요청 컨텍스트 밖에서는 호출되지 않는다(NestJS 요청-스코프 패턴). `updateSummaryState`는 `runningSummary`/`summarizedUpToSeq`만 건드리므로 `fullTurns` 참조는 안전하다.
- **제안**: 현재 아키텍처에서 실질적 위험 없음. I/O-backed 전환(W-8) 시 재검토 필요.

---

## 요약

이번 변경의 가장 큰 부작용 위험은 `saveMemories`의 공개 시그니처 파괴적 변경(포지셔널 → 옵션 객체)으로, diff 내 모든 호출부가 갱신되어 있고 TypeScript 컴파일이 누락 호출부를 감지하므로 실질적 위험은 낮다. 나머지 변경(단일 getThread 읽기, updateSummaryState 캡슐화, memoryState 네임스페이스 이전, buildCosineMatch 빌더 추출, readExtractionWatermark 공유 유틸)은 모두 의도된 동작이며 하위호환 폴백과 테스트로 보호된다. 전역 변수 신규 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
