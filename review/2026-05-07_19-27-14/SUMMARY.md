파일 쓰기 권한이 필요합니다. 아래에 통합 보고서 전문을 출력합니다.

---

# Code Review 통합 보고서

> **대상 변경**: AI Agent 핸들러의 provider tool 병렬 실행(Promise.all) 전환, batch truncate, chunkId dedup, KB 검색의 능동적 의도 분해 전략 전환, 관련 테스트 및 스펙 문서 갱신

## 전체 위험도
**MEDIUM** — 핵심 구현은 안전하나, 중복 코드 블록(DRY 위반)과 multi-turn 경로의 테스트 갭이 향후 유지보수 위험을 높임

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **Maintainability / Architecture** | `executeSingleTurn`과 `processMultiTurnMessageInner` 양쪽에 `providerBudget` 계산 → slice truncate → `Promise.all` → 결과 누적 → truncated 회신 블록(~30줄)이 복제됨. 두 번째 블록 주석 자체가 "single-turn과 동일하게"라 명시하여 중복을 인지하고도 추출하지 않은 상태. | `ai-agent.handler.ts` — `executeSingleTurn` ~L566, `processMultiTurnMessageInner` ~L954 | `executeProviderToolBatch(providerToolCalls, budget, runCtx)` private 헬퍼로 추출. `turnIndex`·`config` 참조 이름만 파라미터화하면 단일 경로로 합칠 수 있음 |
| 2 | **Security** | `KbToolProvider.execute()` 내 검색 실패 catch 블록이 `e.message`를 가공 없이 LLM tool_result에 포함함. handler 레벨 `sanitizeToolError()`는 이 경로(throw 없이 return)를 커버하지 못해, DB 연결 문자열·내부 호스트명 등 인프라 정보가 LLM 응답에 인용될 수 있음 | `kb-tool-provider.ts` — `execute()` catch 블록 | `message: msg` → `'KB search is temporarily unavailable'` 또는 `sanitizeToolError(e)` 로 교체; 원시 메시지는 logger.warn에만 기록 |
| 3 | **Requirement / Concurrency** | `normalToolCalls` 루프는 동일 이터레이션 내 provider budget 소진 후에도 `toolCallCount++`를 계속 수행해 `maxToolCalls`를 초과 가능. spec §3.f–g "KB·MCP·일반 호출 모두 합산"과 충돌. 기존 동작이나 새 truncate 로직이 부분 보호만 제공한다는 점이 명확하지 않음 | `ai-agent.handler.ts` `normalToolCalls` 처리 루프 (단일·멀티 턴 양쪽) | 루프 진입 전 `toolCallCount < maxToolCalls` 체크 추가, 또는 spec에 "일반 도구는 이터레이션 내 추가 budget 검사 없이 실행" 정책 명시 |
| 4 | **Testing / Requirement** | multi-turn 경로(`processMultiTurnMessageInner`)의 batch truncate 테스트 없음. 동일 truncate 로직이 독립된 코드 블록으로 존재하나, 회귀 가드가 없어 한쪽만 수정 시 불일치를 감지 불가 | `ai-agent.handler.spec.ts` (multi-turn describe 블록) | `resumeState.maxToolCalls=2`에서 3개 tool_use emit → search 2회 + tc-3이 `tool_call_budget_exceeded`로 회신되는지 검증하는 테스트 추가 |
| 5 | **Database** | `KbToolProvider.execute()`가 매 tool 호출마다 `findById(kbId)` 재조회. `buildTools()` 시점에 이미 동일 KB row를 일괄 조회했으나 결과를 재사용하지 않음. `Promise.all` 병렬화 이후 동일 KB에 대한 DB 쿼리가 N건 동시 발행됨 | `kb-tool-provider.ts` — `execute()` 내 `knowledgeBaseService.findById()` | `buildTools()` 조회 결과를 `Map<kbId, KbMeta>`로 provider context에 전달하거나 provider 인스턴스에 단기 캐싱 |
| 6 | **Side Effect** | `Promise.all` 전환으로 WS 이벤트 발행 순서 변경. 이전엔 직렬 발행이었으나, 이제 N개 STARTED가 거의 동시에 발행되고 COMPLETED는 완료 순서(비결정적)로 도착. 클라이언트 타임라인 UI가 이벤트 도착 순서에 의존한다면 렌더링 불일치 위험 | `ai-agent.handler.ts` — `runProviderTool` 내 `emitExecutionEvent` 호출 | 프론트엔드 WS 소비 로직이 `toolCallId` 키로 개별 상태를 관리하는지 확인; 미검증 시 spec에 "WS 이벤트 도착 순서는 비결정적" 명시 |
| 7 | **Database** | `_resumeState.ragSources`가 chunkId dedup만 적용할 뿐 총 개수 상한이 없음. `turnDebugHistory`는 `MAX_TURN_DEBUG_HISTORY=50`으로 cap됐으나 `ragSources`에는 동일한 보호가 없어, 장기 multi-turn 대화에서 `outputData` JSONB가 무제한 증가 | `ai-agent.handler.ts` — `processMultiTurnMessageInner` `_resumeState.ragSources` | `ragSources`도 최근 N건 또는 총 X KB 상한 설정, 또는 `content` 필드를 제외한 경량 객체만 state에 저장 |
| 8 | **Maintainability** | multi-turn 병렬 테스트의 `resumeState` 리터럴 객체(~20개 필드)가 인라인 하드코딩됨. 상태 구조 변경 시 수동 동기화 필요, 필드 누락 시 런타임 캐스트가 타입 오류를 숨김 | `ai-agent.handler.spec.ts` — `runs provider tools in parallel on multi-turn resume too` | `makeResumeState(overrides?)` 팩토리 헬퍼를 파일 상단에 두어 공통 필드는 기본값, 테스트별 필드만 override |
| 9 | **Maintainability** | `inFlight`/`maxInFlight` 카운터 + `setTimeout(30ms)` + 반환값 구성 패턴이 단일 턴·멀티 턴 병렬성 검증 테스트에 동일하게 복제됨 | `ai-agent.handler.spec.ts` — 두 병렬성 검증 테스트 | `makeParallelTrackingMock(delayMs = 30)` 헬퍼로 추출, `{ mock, getMaxInFlight }` 형태로 반환 |
| 10 | **Documentation** | `jest-e2e.json`의 `transformIgnorePatterns`에 ESM-only 패키지를 열거한 이유가 어디에도 기록되지 않음. 신규 ESM 패키지 도입 시 목록 확장 기준을 알 수 없음 | `backend/test/jest-e2e.json` | `app.e2e-spec.ts` 블록 주석 또는 `backend/README.md`에 "ESM-only 패키지 추가 시 이 목록에 함께 등록" 안내 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **Architecture** | `turnIndex: 1` 하드코딩. single-turn은 항상 1이나, 헬퍼 추출 시 의미가 불명확해질 수 있음 | `ai-agent.handler.ts` — `executeSingleTurn` 내 `runProviderTool` 호출 | `const SINGLE_TURN_INDEX = 1` 상수화 또는 헬퍼 추출 시 명시적 인자로 파라미터화 |
| 2 | **Architecture / Testing** | `processMultiTurnMessage` 직접 호출에 `handler as unknown as { ... }` 타입 캐스팅 사용. 메서드가 `public`이므로 캐스팅 불필요, rename 시 컴파일 에러 없이 런타임 오류로만 발견됨 | `ai-agent.handler.spec.ts` ~L2240 | `resumeState` 타입을 올바르게 정의하거나 올바른 public 타입으로 직접 호출 |
| 3 | **Performance** | `Promise.all`에 동시성 상한선 없음. `maxToolCalls`를 크게 설정하거나 LLM이 많은 tool_use를 emit하면 임베딩 API rate-limit과 DB 커넥션 풀 압박이 동시 발생 가능. 현재 기본값 기준으로는 실질 위험 낮음 | `ai-agent.handler.ts` — `Promise.all(providerToRun.map(...))` | 스케일업 시 `p-limit` 또는 청크 단위 분할 헬퍼로 동시성 제한 검토. 현재는 즉각 조치 불필요 |
| 4 | **Performance / Testing** | 병렬성 검증 테스트에서 실제 OS 타이머(`setTimeout 30ms`) 사용. CI 극단적 부하 시 `maxInFlight=1`로 관측되는 간헐적 플레이크 가능성 | `ai-agent.handler.spec.ts` — 두 병렬성 검증 테스트 | `jest.useFakeTimers()` + `jest.runAllTimersAsync()` 조합으로 결정론적 검증 전환 |
| 5 | **API Contract** | `output.result.messages`에 내부 프로토콜 메시지(`role: 'tool'`, `{error: 'tool_call_budget_exceeded'}`)가 포함되어 소비자에게 노출됨 | `ai-agent.handler.ts` — `providerTruncated` 처리 블록 | 스펙에 이 에러 코드를 공개 계약으로 명시하거나, 반환 전 내부 프로토콜 메시지를 필터링하는 레이어 도입 검토 |
| 6 | **API Contract** | 배치 내 실행 건수 시맨틱 변경: 신규 코드는 잔여 한도만큼만 실행해 `meta.toolCalls`가 보수적으로 카운팅됨 | `ai-agent.handler.ts` — `providerBatchResults` 루프 | CHANGELOG에 "동일 배치 내 잔여 한도 초과 시 실행 건수 감소 가능" 명시 |
| 7 | **Requirement** | `maxToolCalls=0` 엣지 케이스: while 루프 미진입 → tool_result 없는 메시지가 LLM에 전달 → Anthropic API 400 가능 | `ai-agent.handler.ts` — while loop 조건 | spec에 최솟값 1 명시, 또는 루프 탈출 시 미처리 tool_use에 `tool_call_budget_exceeded` 추가 |
| 8 | **Testing** | `isolates partial failures` 테스트가 실패 tool call의 `ragDiagnostics` 누적을 검증하지 않음 | `ai-agent.handler.spec.ts` | `expect(meta.ragDiagnostics.queriesUsed)` 및 `resultCount` assert 추가 |
| 9 | **Testing** | `dedupes ragSources`, `isolates partial failures` 테스트에 `meta.toolCalls` 검증 없음 | `ai-agent.handler.spec.ts` | `expect(meta.toolCalls).toBe(2)` assert 추가 |
| 10 | **Testing** | 멀티 턴 간 chunkId dedup(`RagAccumulator.fromState()` 경로) 테스트 없음 | `ai-agent.handler.spec.ts` — multi-turn describe 블록 | `resumeState.ragSources`에 기존 chunkId 포함 후, 새 턴에서 동일 chunkId 반환 시 1건만 존재하는지 assert |
| 11 | **Side Effect** | 단일 턴 vs 멀티 턴의 `conditionToolCalls` `toolCallCount` 증가 비대칭(단일 턴은 카운트 안 함, 멀티 턴은 카운트). 실제 문제는 없으나 의도된 설계인지 불명확 | `executeSingleTurn` vs `processMultiTurnMessageInner` | 두 경로의 정책 통일 또는 각 경로 주석에 의도 명시 |
| 12 | **Documentation** | `KB_TOOL_GUIDANCE` 상수에 JSDoc 없음. 문구 변경 시 LLM 응답에 미치는 영향과 연관 파일 일관성 유지 요건을 파악하기 어려움 | `ai-agent.handler.ts:113` | JSDoc 추가: 주입 목적, agentic RAG 유도 방식, 변경 시 동기화해야 할 연관 파일 명시 |
| 13 | **Documentation** | `KbToolProvider` 클래스 JSDoc이 query 단위 의도 분해 전략을 반영하지 않음 | `kb-tool-provider.ts` 클래스 JSDoc | "각 tool 호출은 단일 지식 단위 query만 담으며, LLM이 의도 분해 후 병렬 호출하도록 유도" 추가 |
| 14 | **Documentation** | `app.e2e-spec.ts`의 `describe.skip` 해제 조건 미기재. 영구 skip 방치 위험 | `backend/test/app.e2e-spec.ts:8` | 주석에 해제 조건 명기 (docker compose 환경 + GET / 라우트 추가 시) |
| 15 | **Dependency** | `p-limit`/`yocto-queue`가 어느 업스트림 패키지의 전이적 의존성인지 추적 불가 | `backend/test/jest-e2e.json` | `npm ls p-limit`로 출처 확인 후 기록 |
| 16 | **Scope** | E2E 테스트 인프라 수정이 핵심 기능 변경과 혼재하나 별도 커밋으로 분리됨 — 추적성 확보됨 | `backend/test/app.e2e-spec.ts`, `jest-e2e.json` | PR 설명에 "test infra fix 포함" 명시 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Maintainability | **MEDIUM** | provider batch 실행 블록 ~30줄 DRY 위반 (두 경로 복제) |
| Requirement | **MEDIUM** | multi-turn batch truncate 테스트 누락, normalToolCalls budget 초과 가능 |
| Security | **LOW** | KB 검색 실패 시 원시 예외 메시지가 LLM tool_result에 노출 |
| Architecture | **LOW** | DRY 위반 (maintainability와 동일 이슈), turnIndex 하드코딩 |
| Database | **LOW** | KB 메타 이중 조회(N+1 유사), ragSources 무제한 누적 |
| Performance | **LOW** | Promise.all 동시성 상한 없음, 테스트 실제 타이머 사용 |
| Testing | **LOW–MEDIUM** | multi-turn truncate 테스트 누락, 부분 실패 diagnostics 미검증 |
| Side Effect | **LOW** | WS 이벤트 순서 비결정성, normalToolCalls budget 비대칭 |
| Concurrency | **LOW** | normalToolCalls budget 미적용 (기존 동작), 그 외 설계 안전 |
| API Contract | **LOW** | tool_call_budget_exceeded 메시지 노출, toolCalls 시맨틱 변경 |
| Documentation | **LOW** | jest-e2e.json ESM 목록 근거 누락, KB_TOOL_GUIDANCE JSDoc 없음 |
| Dependency | **LOW** | 프로덕션 신규 의존성 없음, ESM 패키지 출처 미기록 |
| Scope | **LOW** | 변경 범위 잘 통제됨, E2E 인프라 수정 별도 커밋으로 분리 |

---

## 발견 없는 에이전트
해당 없음 — 모든 에이전트가 하나 이상의 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시] KB 검색 실패 예외 메시지 새니타이징** — `kb-tool-provider.ts` execute() catch 블록의 `message: msg`를 고정 문자열 또는 `sanitizeToolError(e)`로 교체. 인프라 정보 노출 위험.

2. **[단기] provider batch 실행 블록 private 헬퍼 추출** — `executeSingleTurn`과 `processMultiTurnMessageInner`의 동일 ~30줄 블록을 `executeProviderToolBatch()` 헬퍼로 추출. 현재는 한쪽만 수정하면 동작 불일치가 생기는 구조.

3. **[단기] multi-turn batch truncate 테스트 추가** — `resumeState.maxToolCalls=2`에서 3개 tool_use emit 시나리오로 멀티 턴 경로의 truncate 동작 회귀 가드 확보.

4. **[단기] normalToolCalls budget 초과 처리 명확화** — 루프 진입 전 잔여 budget 체크 추가 또는 spec에 정책 명시.

5. **[중기] KB 메타 이중 조회 제거** — `buildTools()` 조회 결과를 `execute()` 컨텍스트에 전달해 DB 재조회 제거. `Promise.all` 병렬화로 peak 쿼리 수가 증가한 상태.

6. **[중기] ragSources 무제한 누적 상한 설정** — `turnDebugHistory`와 형평을 맞춰 `ragSources`도 최대 건수 또는 크기 상한 적용.

7. **[중기] WS 이벤트 순서 비결정성 클라이언트 검증** — 프론트엔드 WS 소비 로직이 `toolCallId` 기반으로 상태를 관리하는지 확인.

8. **[낮은 우선순위] 테스트 보완** — `meta.toolCalls` 검증 누락 테스트에 assert 추가, 부분 실패 diagnostics 검증, 멀티 턴 간 chunkId dedup 테스트 추가.

9. **[낮은 우선순위] 문서화** — `KB_TOOL_GUIDANCE` JSDoc, `jest-e2e.json` ESM 패키지 목록 근거, `app.e2e-spec.ts` skip 해제 조건 주석 추가.