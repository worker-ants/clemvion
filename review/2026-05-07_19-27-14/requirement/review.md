### 발견사항

- **[WARNING] 멀티턴 batch truncate 테스트 누락**
  - 위치: `ai-agent.handler.spec.ts` (multi-turn describe 블록)
  - 상세: `truncates within-batch when remaining budget < emitted tool_use count` 는 단일턴(`executeSingleTurn`)에만 작성됨. `processMultiTurnMessageInner`는 동일한 `providerBudget` / `providerTruncated` 코드 패스를 독립적으로 갖고 있으나, 회귀 가드 테스트가 없음. 단일턴 경로와 별개로 멀티턴 state의 `toolCalls`·`maxToolCalls` 역산이 올바른지 검증이 되지 않은 상태.
  - 제안: 단일턴 truncate 테스트와 대칭되는 `runs provider tools with batch truncate on multi-turn resume` 케이스 추가. `resumeState.maxToolCalls=2`에서 3개 tool_use emit → search 2회 + `tc-3`이 `tool_call_budget_exceeded`로 LLM에 회신되는지 확인.

- **[WARNING] 일반 도구(normalToolCalls)는 batch 내에서 provider budget 초과 후에도 계속 실행됨**
  - 위치: `ai-agent.handler.ts:586–604` (single-turn), `994–1010` (multi-turn)
  - 상세: `providerTruncated`가 발생해 `toolCallCount`가 `maxToolCalls`에 도달한 뒤에도, 동일 이터레이션 내 `normalToolCalls` 루프는 `toolCallCount++`를 계속 수행해 `maxToolCalls`를 초과할 수 있음. 예: `maxToolCalls=2`, provider 2건 실행 후 `toolCallCount=2`, 이어서 normal tool 1건이 실행되면 `toolCallCount=3`. spec(§3.f–g)은 "KB·MCP·일반 호출 모두 합산"이라고 명시하므로 일반 도구도 동일 batch 내에서 한도를 공유해야 함.
  - 제안: `normalToolCalls` 루프 진입 전에도 `toolCallCount < maxToolCalls` 체크 또는 잔여 예산을 계산하거나, spec에서 "일반 도구는 batch 내에서 추가 budget 체크 없이 항상 실행"임을 명시적으로 허용 정책으로 기술.

- **[INFO] maxToolCalls = 0 엣지 케이스 미처리**
  - 위치: `ai-agent.handler.ts` while loop 조건 (`toolCallCount < maxToolCalls`)
  - 상세: `maxToolCalls = 0`이면 while 루프가 아예 진입하지 않아 LLM이 `tool_use`를 emit했을 때 대응하는 `tool_result`가 없는 메시지가 다음 LLM 호출로 전달됨. Anthropic API는 `tool_use` ↔ `tool_result` 쌍 불일치 시 400을 반환한다고 spec이 명시. 현재 batch truncate 로직은 루프 내부에서만 동작하므로 `maxToolCalls = 0`이면 적용되지 않음.
  - 제안: spec에서 `maxToolCalls` 최솟값을 1로 명시하거나, while 루프 탈출 시 미처리 tool_use가 있으면 전체에 `tool_call_budget_exceeded`를 추가하는 방어 로직 추가.

- **[INFO] ragDiagnostics 누적이 병렬 실패 케이스 테스트에서 미검증**
  - 위치: `ai-agent.handler.spec.ts`, `isolates partial failures...` 테스트
  - 상세: 실패 tool call(`tc-bad`)에 대해서도 `KbToolProvider`는 `ragDiagnosticsDelta: { kbId, query, resultCount: 0 }`를 반환하므로 `meta.ragDiagnostics.attempted = true`, `resultCount = 1`(성공 1건)이 기대됨. 테스트는 `ragSources`와 `failMsg.content`만 검증하고 diagnostics 누적은 확인하지 않음.
  - 제안: 기존 테스트에 `expect(diag.resultCount).toBe(1)` / `expect(diag.attempted).toBe(true)` 검증 추가.

- **[INFO] WS event 순서 비결정성이 클라이언트 타임라인 렌더링에 영향 가능**
  - 위치: `ai-agent.handler.ts`, `runProviderTool` + `Promise.all` 조합
  - 상세: `Promise.all` 내에서 각 tool의 `tool_call_started` / `tool_call_completed` WS 이벤트가 실행 완료 순서에 따라 interleave 됨. `messages` / `ragSources`는 Promise.all 결과 순서(= LLM emit 순서)대로 직렬 누적되어 결정적이지만, WS 이벤트는 latency 순서로 도착함. spec은 이를 명시하지 않아 프론트엔드가 순서를 기대할 경우 타임라인 표시가 어긋날 수 있음.
  - 제안: spec 또는 WS 이벤트 payload에 `sequenceIndex` 필드를 추가해 LLM emit 순서를 클라이언트에 전달하거나, "WS 이벤트 도착 순서는 비결정적" 임을 spec에 명시.

---

### 요약

핵심 요구사항(병렬 실행, batch truncate, chunkId dedup, 부분 실패 격리, 멀티턴 병렬 회귀)은 구현과 테스트 모두 충실히 반영되어 있으며 스펙 문서도 일관되게 갱신됐다. 주요 미비점은 멀티턴 경로의 batch truncate 테스트 부재와, 일반 도구(normalToolCalls)가 provider budget 소진 후에도 동일 batch에서 카운트를 초과할 수 있는 로직 간극이다. 두 가지 모두 실운영에서 드물게 발생하지만 spec의 "KB·MCP·일반 호출 모두 합산" 정책과 충돌하므로 명확히 해소하거나 정책으로 문서화해야 한다.

### 위험도

**MEDIUM**