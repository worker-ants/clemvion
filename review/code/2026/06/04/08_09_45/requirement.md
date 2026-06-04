# Requirement Review — 멀티턴 누적 messages 물리 압축 (followup-v2)

## 발견사항

### [INFO] `assertPairingIntact` 내 고아 시작 방지 루프가 빈 구현체
- 위치: `agent-memory-injection.spec.ts` 라인 78–84 (`for (const m of messages.slice(1)) { if (m.role === 'tool') { /* 빈 블록 */ } }`)
- 상세: 두 번째 내부 루프는 "고아 tool 로 시작하지 않음" 을 검증하겠다고 주석을 달았으나 실제 `expect` 없이 빈 블록만 있다. 첫 번째 외부 루프에서 이미 `expected.has(id)` 로 대부분 커버하지만, `messages[1].role === 'tool'` 인 케이스 (system 바로 다음이 고아 tool 인 경우) 는 외부 루프가 `assistant` 메시지를 먼저 만나야 expected set 을 만들기 때문에 실제로 걸리지 않는다. 검증 의도가 주석과 코드가 일치하지 않아 silent 통과.
- 제안: 빈 블록 대신 `if (i === 1 && m.role === 'tool') fail('First non-system message must not be a tool message')` 또는 루프 바깥에서 `expect(messages[1]?.role).not.toBe('tool')` 로 명시적 assertion 추가. 혹은 빈 블록을 제거해 주석과 구현의 괴리를 없앨 것.

### [INFO] `meta.memory` 필드가 `spec/4-nodes/3-ai/1-ai-agent.md` §7 출력 표에 미등재
- 위치: 코드 — `ai-agent.handler.ts` (memoryMeta 반환); spec — `1-ai-agent.md §7.1` 메타 필드 표 (라인 480–490)
- 상세: `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages?}` 는 코드에서 노출되고 테스트(`ai-agent.memory.spec.ts`)에서도 검증되지만, §7.1 메타 필드 표에 해당 행이 없다. 이전 리뷰(W-3)에서 "§7 Config echo 열거에 memory 5필드 추가" 완료로 체크됐으나, 현재 spec 파일의 §7.1 메타 표에 `meta.memory` 행이 존재하지 않는다. `plan/in-progress/ai-context-memory-followup-v2.md` 에도 W-3 를 완료 체크했으나 실제 반영 여부는 확인이 필요하다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 메타 필드 표에 `meta.memory` 행 (및 `compactedMessages?` 하위 필드) 추가 여부를 project-planner 에서 확인. 반영이 안 됐다면 spec 갱신 필요. 코드·테스트는 정확하므로 코드 변경 불필요.

### [WARNING] `keepUserExchanges` 도출 로직이 `conversationThreadService` 미주입 시 `turns` (self-excluded) 로 fallback — ai_user turn 미포함으로 keepUserExchanges = 0 이 될 수 있음
- 위치: `ai-agent.handler.ts` 라인 1261–1272 / 2295–2307
  ```ts
  const fullTurns: readonly ConversationTurn[] = fullThread
    ? fullThread.turns
    : turns;   // turns 는 self-excluded — ai_user turn 불포함
  ```
- 상세: `conversationThreadService` 가 없거나 `args.target` 이 없으면 `fullTurns` 는 `turns` (self 노드 제외) 로 fallback 된다. `turns` 에는 에이전트 자신의 `ai_user` turn 이 없으므로 `keepUserExchanges` 가 항상 0 이 된다. 0 이면 `compactMessagesToTail` 가 보수적으로 무변경 반환하므로 압축 자체는 안전하게 skip 된다. 그러나 이 fallback 경로에서 실제 압축이 기대되는 상황에서 압축이 전혀 일어나지 않는다.
  - 실제 배포 환경(conversationThreadService 주입)에서는 이 경로에 들어오지 않으므로 **운영 영향은 없다**. 단, 코드 주석("summarization 에 쓰는 `turns` 는 self 노드를 제외하므로")이 fallback 경로의 한계를 설명하고 있어 의도된 trade-off로 보인다. 테스트 코드에서도 conversationThreadService 를 항상 주입하므로 회귀 위험은 낮다.
- 제안: fallback 경로에 debug 로그를 추가(`keepUserExchanges=0 due to missing service/target, compaction skipped`) 해 운영에서 예기치 않게 이 경로에 진입할 경우 조기 발견 가능하게 할 것.

### [INFO] [SPEC-DRIFT] `spec §6.2 d.5` 제목이 "Conversation Thread 재주입"이지만 자동 메모리 전략(summary_buffer/persistent)도 이 단계에서 실행됨 — d.6 신설로 d.5 범위 불명확
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.5` (라인 372), 새로 추가된 `d.6` (라인 638)
- 상세: §6.2 의 d.5 는 "Conversation Thread 재주입"만 기술하지만, 코드에서는 자동 메모리 전략(summary_buffer/persistent)도 `d.5` 구간에 해당하는 위치에서 실행된다. §6.1 의 1.3/1.5 기술이 single-turn 기준이고 multi-turn 의 d.5/d.6 구간의 auto-memory 동작은 spec `d.5` 본문에 명시되어 있지 않다. 코드 구현은 `injectMemoryContext` 를 `tailMode: 'system-only'` 로 호출하는 것이 옳고 의도적이므로, spec `d.5` 본문에 auto-memory 전략의 multi-turn 경로가 여기서 실행됨을 보충하거나, 별도 `d.5a` 로 분리하는 것이 spec 본문의 완전성을 높인다.
- 제안: 코드 유지 + `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.5` 에 "(auto-memory 전략 시 system-only mode 로 `injectMemoryContext` 호출 포함)" 부연 또는 d.5a 항 신설. 반영은 project-planner.

### [INFO] 테스트 케이스 `'returns unchanged for keepUserExchanges<=0 or missing system prefix'` — `noSystem` 케이스에서 `compactMessagesToTail(noSystem, 1)` 이 `noSystem` 을 반환해야 함을 명시했으나 구현이 `messages[0].role !== 'system'` 조건으로 early return 하므로 올바름. 단, 빈 배열(`[]`) 케이스는 `messages.length === 0` 조건으로 return 하므로 `toBe(messages)` 가 아닌 `toEqual([])` 로만 검사 — 빈 배열 반환 시 동일 참조 보장이 없어 `toBe` 가 아닌 `toEqual` 로 다르게 검증하고 있음. 의도된 설계이나 주석이 없음.
- 위치: `agent-memory-injection.spec.ts` 라인 215
- 상세: `compactMessagesToTail([], 2)` 는 새 배열을 반환하는지 또는 동일 참조를 반환하는지 spec 에 정의되지 않음. 구현은 `messages.length === 0` 분기에서 `return messages` 로 동일 참조를 반환하나, 테스트가 `toEqual([])` 로만 검사해 동일 참조 보장을 테스트하지 않는다. 일관성 문제이지만 기능상 무해.
- 제안: `expect(compactMessagesToTail([], 2)).toBe(messages_empty_ref)` 로 통일하거나, 현행 유지 시 주석으로 "빈 배열 반환 — 동일 참조 검증 생략" 명시.

### [INFO] `ai-agent.memory.spec.ts` 의 multi-turn 압축 테스트에서 `len2 <= len1` 단언이 압축 발생을 간접 확인하지만, 압축이 일어나지 않으면(keepUserExchanges 계산 결과가 0인 경우) 테스트가 통과될 수 있음
- 위치: `ai-agent.memory.spec.ts` 라인 3091–3093
  ```ts
  const len2 = msgs2.length;
  expect(len2).toBeLessThanOrEqual(len1);
  ```
- 상세: `compactedMessages > 0` 을 먼저 확인하므로 (라인 3086–3089) 실질적으로 압축이 발생했음을 보장한다. 그러나 `len2 <= len1` 은 압축이 일어나도 user+assistant 2개가 추가되어 len2 = len1+2 가 될 수 있다는 점에서 단언이 약할 수 있다. `compactedMessages > 0` 이 이미 강제하므로 실질적 영향은 없다.
- 제안: 현행 유지 또는 `expect(len2).toBeLessThan(len1 + 2)` 로 명시적으로 단조증가 방지를 검증.

## 요약

핵심 기능(멀티턴 누적 messages 물리 압축)은 올바르게 구현되었다. `compactMessagesToTail` 순수 함수는 spec §6.2 d.6 및 §12.14 의 알고리즘(user 경계 절단, 페어링 불변식, keepUserExchanges 기반 컷, idempotent, 방어적 무변경)을 완전히 반영한다. 핸들러 배선은 요약 발생(`mem.memory.summarized && mem.keepUserExchanges > 0`) 시에만 압축을 수행하고 manual 전략은 완전히 우회한다. 테스트는 7개의 unit 케이스와 2개의 integration 케이스(summary_buffer, manual 불변식)로 주요 경로를 커버한다. 발견된 이슈는 모두 INFO/WARNING 수준으로, `meta.memory` 필드 누락 여부에 대한 spec §7.1 테이블 확인이 필요하고, `assertPairingIntact` 내부 빈 루프는 경미한 코드-주석 불일치이며, `keepUserExchanges` fallback 경로의 동작은 의도적이나 진단 로그 보강이 권장된다. spec fidelity 관점에서 코드가 명세에서 정의한 내용을 충실히 구현하고 있으며, d.5/d.6 구조의 spec 기술 완전성 보완만 project-planner 위임으로 남는다.

## 위험도

LOW

STATUS: SUCCESS
