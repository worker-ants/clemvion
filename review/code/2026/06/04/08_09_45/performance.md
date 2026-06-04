# 성능(Performance) 리뷰 결과

## 발견사항

### [INFO] `compactMessagesToTail` 의 spread 배열 생성 — 소규모 컨텍스트에서 무시 가능
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` line 1151 (`return [messages[0], ...messages.slice(cutIndex)]`)
- 상세: `[messages[0], ...messages.slice(cutIndex)]` 는 새 배열 + `slice` 사본 총 2회 할당이다. 대화 context window 가 수백 메시지로 클 수 있으나, 압축 경로는 이미 "요약 발생 + summarized=true + keepUserExchanges>0" 3중 조건을 만족할 때만 호출된다. 실제로 남기는 배열 크기(휘발성 꼬리)는 일반적으로 수십 개 이하이므로 실용적 부담은 없다. 다만 매우 긴 메시지 배열(tool result 가 대량 포함된 KB-heavy 에이전트)에서 `slice` 사본 크기가 커질 수 있다.
- 제안: 현 구현 유지. 최악 케이스에서 크게 우려되는 경우 `messages.copyWithin` 또는 `messages.splice` 를 통한 in-place 변경으로 교체 가능하나, 불변 반환 의미론(참조 비교로 no-op 탐지)을 깨므로 trade-off 존재 — 현 설계가 더 안전하다.

### [INFO] `injectMemoryContext` 내 `selectVolatileTail` 이중 호출
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 2282 및 2301 (`selectVolatileTail` 두 번 호출)
- 상세: `tail = selectVolatileTail(turns, update.summarizedUpToSeq)` (self-제외 turns) 와 `keepUserExchanges` 도출을 위한 `selectVolatileTail(fullTurns, update.summarizedUpToSeq)` 가 각각 독립적으로 호출된다. `selectVolatileTail` 은 단순 `filter` O(n) 이므로 CPU 비용은 미미하다. 그러나 `fullTurns` 에는 self turn 이 포함되어 목적이 다르므로 통합 불가 — 분리는 의도적이다.
- 제안: 현 구조 유지. 성능 이슈 없음.

### [INFO] `injectMemoryContext` — `fullThread` 호출 추가로 `getThread` 가 매 turn 한 번 더 불림
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 2294–2296
- 상세: `getThread(args.target)` 는 이 메서드 내에서 `thread = args.target?.conversationThread` (line 2246) 로 이미 간접 참조하고 있으나, `keepUserExchanges` 계산에서 `conversationThreadService.getThread(args.target)` 를 추가로 호출한다. 구현체가 in-memory Map 조회라면 O(1) 이므로 영향 없다. `scheduleMemoryExtraction` 에서도 동일 패턴(`getThread` 재호출) 이 존재하며 일관성 있는 관용이다.
- 제안: 현 구조 유지. `getThread` 가 O(1) 임을 전제할 때 무시 가능한 비용이다. `getThread` 가 비싼 연산으로 바뀔 경우 결과를 지역 변수로 캐시해야 함.

### [INFO] `wrapMemoryContent` 에서 `.split().join()` 패턴 사용 (두 번)
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` line 872–876
- 상세: `text.split(MEMORY_OPEN).join(...)` 와 `split(MEMORY_CLOSE).join(...)` 는 각각 O(n) 이며, 두 번 적용해도 총 O(n) 이다. 이 함수는 recall 건수(top-k, 기본 수 개) × per-turn 호출이므로 실용 비용 없음. `.replaceAll()` 로 교체하면 더 직관적이나 기능상 동일하다.
- 제안: 현 구현 유지. 가독성 선호가 있다면 `replaceAll` 로 전환 가능.

### [INFO] `buildSummaryBufferUpdate` 내 rolling window 압축 루프 — 매 iteration `estimateWorkingMemoryTokens(remaining)` 재계산
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` line 1036
- 상세: `while` 루프에서 `oldest = remaining.shift()` 후 매 iteration `estimateWorkingMemoryTokens(remaining)` 를 O(n) 으로 재계산한다. `oldest` 하나를 제거했으므로 증분(delta) 방식으로 `remainingTokens -= estimateTurnTokens(oldest)` 로 O(1) 에 갱신 가능하다. 실제로는 `MIN_RECENT_RAW_TURNS=2` 로 꼬리를 보호하여 루프 반복이 대부분 수 회에 그치고, turns 는 최대 수십~수백 개이므로 실용 영향은 낮다. 그러나 장기 대화(수백 turn) 에서 반복 횟수가 많아질 경우 O(n²) 에 근접한다.
- 제안: 미미한 최적화 기회. `oldest` 를 제거할 때 `remainingTokens -= estimateTurnTokens(oldest)` 로 증분 갱신하면 루프 내부를 O(1) 으로 만들 수 있다. 현재 실용 범위에서는 낮은 우선순위.

### [INFO] `buildSummaryBufferUpdate` — `remaining = [...uncompressed]` 전체 사본
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` line 1026
- 상세: `remaining` 은 `uncompressed` 의 전체 shallow copy 다. `shift()` 를 사용하기 위해 필요하나, 인덱스 포인터 방식으로 대체하면 복사 없이 처리 가능하다. turns 수가 수십 개 이하인 통상 케이스에서는 비용 미미.
- 제안: 성능 임계 구간이 아닌 한 현 구현 유지. 필요 시 `let startIdx = 0` 방식으로 교체.

### [INFO] `messages.length = 0; messages.push(...compacted)` — in-place 교체 패턴
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 2330–2332, 2432–2434
- 상세: `messages` 배열을 `length = 0` 으로 초기화 후 `push(...compacted)` 로 채운다. `...spread` 인자 개수가 JS 엔진 인수 스택 한도(일반적으로 ~65536) 를 넘으면 `Maximum call stack size exceeded` 가 발생할 수 있다. LLM context window 상 실제 messages 배열이 수십~수백 개 수준이므로 실용 케이스에서는 안전하다. 그러나 방어적으로 `for (const m of compacted) messages.push(m)` 또는 `messages.splice(0, messages.length, ...compacted)` 패턴이 더 robust하다.
- 제안: 낮은 위험. 방어 목적으로 loop push 로 교체 권장 (코드 일관성도 향상). 동일 패턴이 두 곳에 존재하므로 헬퍼로 추출 가능.

---

## 요약

이번 변경은 multi-turn LLM 메시지 누적 배열의 물리 압축(`compactMessagesToTail`)과 그 호출 경로를 추가한다. 핵심 알고리즘인 `compactMessagesToTail` 자체는 O(n) 단일 패스로 매우 효율적이며, 압축 조건(summarized=true 등)을 3중으로 걸러 불필요한 실행을 차단한다. `buildSummaryBufferUpdate` 의 rolling 압축 루프 내 반복 토큰 추정(O(n) 재계산)은 증분 방식으로 개선 가능하나 실용 범위에서 영향은 미미하다. `messages.push(...spread)` 패턴은 이론적 스택 오버플로 위험이 있으나 LLM context 크기 제약 상 실제 발생 가능성은 낮다. 전반적으로 성능 관점에서 고위험 이슈는 없으며, 발견된 항목은 모두 낮은 우선순위의 방어적 개선 사항이다.

## 위험도

LOW
