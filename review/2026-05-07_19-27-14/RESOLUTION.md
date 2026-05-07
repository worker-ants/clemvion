# Review Resolution — 2026-05-07_19-27-14

리뷰 대상 commit 범위: `67f232fd..HEAD` (Stage 1~3 + e2e infra fix)
원전: [`SUMMARY.md`](./SUMMARY.md)

총 발견사항: Critical 0건 · Warning 10건 · Info 16건
조치 결과: Warning 10건 중 8건 처리 + Info 5건 추가 처리 (테스트 회귀 통과 후 단일 commit 으로 묶음)

---

## Critical (0건)

해당 없음.

---

## Warning 조치 내역

| # | 카테고리 | 발견사항 | 조치 | 위치 |
|---|----------|----------|------|------|
| W1 | Maintainability / Architecture | single-turn / multi-turn 의 provider tool 실행 블록 ~30줄 DRY 위반 | `executeProviderToolBatch()` private 헬퍼로 추출 — Promise.all 병렬 실행 + budget 부분 truncate + 결정적 누적 + budget_exceeded 회신을 단일 진입점으로 통합. 두 호출 사이트가 동일 헬퍼만 호출. | `ai-agent.handler.ts` |
| W2 | Security | `KbToolProvider.execute` catch 블록이 원시 예외 메시지를 LLM tool_result `content.message` 에 노출 | `safeMessage` 고정 사용자 안내 ("KB 검색이 일시적으로 실패했습니다…") 로 교체. 원시 메시지는 `result.error` (turnDebug + WS payload + logger.warn) 에만 보존. 회귀 테스트로 가드 (kb-tool-provider.spec, ai-agent.handler.spec). | `kb-tool-provider.ts` |
| W3 | Requirement / Concurrency | `normalToolCalls` 루프가 잔여 budget 검사 없이 `toolCallCount++` 수행 → `maxToolCalls` 초과 가능 | 루프 진입 전 `toolCallCount >= maxToolCalls` 체크 추가, 초과 시 `tool_call_budget_exceeded` 로 회신해 모든 tool_use ↔ tool_result 매칭 보장. spec §3.f-g 와 일치. | `ai-agent.handler.ts` (single-turn / multi-turn 양쪽) |
| W4 | Testing / Requirement | multi-turn 경로의 batch truncate 회귀 가드 부재 | `truncates within-batch on multi-turn resume too (parity with single-turn)` 테스트 추가 — `resumeState.maxToolCalls=2` + 3개 tool_use → search 2회, tc-r3 가 budget_exceeded 로 회신되는지 검증. | `ai-agent.handler.spec.ts` |
| W5 | Database | `KbToolProvider.execute` 가 매 호출마다 `findById(kbId)` 재조회 → Promise.all 병렬화 후 N+1 동시 발행 | `metaCache: Map<executionId, Map<kbId, {name}>>` 인스턴스 변수 추가. `buildTools` 가 cache 채움, `execute` 가 cache 우선 + miss 시 findById fallback, `cleanup` 이 executionId 단위 entry 제거. 회귀 테스트(`reuses KB metadata cached by buildTools`) 추가. | `kb-tool-provider.ts` |
| W6 | Side Effect | `Promise.all` 전환으로 WS 이벤트 도착 순서 비결정 | spec/4-nodes/3-ai-nodes §3.f 에 "병렬 실행 + 결과 push 순서 결정적" 명시 (Stage 1 commit 에서 이미 반영). frontend WS 소비 로직은 `toolCallId` 기반이라 영향 없음 — 추가 변경 불필요. | `spec/4-nodes/3-ai-nodes.md` |
| W7 | Database | `_resumeState.ragSources` 무제한 누적으로 outputData JSONB 비대화 | `MAX_RESUME_RAG_SOURCES = 200` 상수 도입. 두 resume writeback 지점에서 `slice(-MAX_RESUME_RAG_SOURCES)` 적용. (단, 잘려 나간 청크는 향후 turn 의 chunkId dedup 에서 제외되며 이는 의도된 trade-off — 주석으로 명시) | `ai-agent.handler.ts` |
| W8 | Maintainability | multi-turn 병렬 테스트의 `resumeState` 리터럴 ~20개 필드 인라인 중복 | **미조치** (낮은 우선순위) — 현재 2건의 테스트가 동일 리터럴을 사용 중. 후속 테스트 추가 시 `makeResumeState()` 팩토리 추출 검토. | `ai-agent.handler.spec.ts` |
| W9 | Maintainability | `inFlight`/`maxInFlight` 카운터 + setTimeout 패턴 테스트 간 복제 | **미조치** (낮은 우선순위) — 현재 2건만 사용. 패턴이 더 늘어나면 `makeParallelTrackingMock(delayMs)` 헬퍼 추출. | `ai-agent.handler.spec.ts` |
| W10 | Documentation | jest-e2e.json `transformIgnorePatterns` ESM 패키지 목록 근거 누락 | `app.e2e-spec.ts` JSDoc 의 "Skip 해제 조건" 주석으로 갈음. (jest.config.ts 의 동일 패턴이 이미 주석 보유 — e2e config 가 그것을 미러 하는 구조이므로 단일 SSOT 유지) | `backend/test/app.e2e-spec.ts` |

### 미조치 사유 정리
- W8/W9: 테스트 중복은 2건뿐이라 추출 비용이 효익을 초과. 패턴이 3건 이상으로 확장되면 그 시점에 추출 (developer skill 의 "Don't introduce abstractions beyond what the task requires" 원칙).

---

## Info 추가 조치

다음 Info 항목은 즉시 반영했다 (낮은 비용, 즉각 효과):

| # | 카테고리 | 조치 |
|---|----------|------|
| I8 | Testing | `isolates partial failures` 테스트에 `meta.ragDiagnostics.queriesUsed` / `resultCount` assert 추가 |
| I9 | Testing | `dedupes ragSources` / `isolates partial failures` 테스트에 `meta.toolCalls` assert 추가 |
| I12 | Documentation | `KB_TOOL_GUIDANCE` 상수 영향 범위는 Stage 1 commit 의 prompt 의도와 spec §1 에서 이미 SSOT 로 기록 — 별도 JSDoc 추가는 중복 |
| I13 | Documentation | `KbToolProvider` 클래스 JSDoc 에 "atomic knowledge unit per call · cross-call 병합 없음" 정책 명시 |
| I14 | Documentation | `app.e2e-spec.ts` 의 `describe.skip` 해제 조건을 JSDoc 에 명기 (docker compose --profile app + 실제 라우트 검증 채택 시) |

다음 Info 항목은 의도적으로 미조치:

| # | 사유 |
|---|------|
| I1 | `turnIndex: 1` 상수화 — 하드코딩된 곳이 헬퍼 추출 후 1지점으로 줄어 의미 충분 |
| I2 | `processMultiTurnMessage` 캐스팅 — 메서드는 `public` 이며 시그니처 변경 시 다른 사용처와 함께 정비. 본 PR 의 핵심 범위와 별도 |
| I3 | Promise.all 동시성 상한 — 현재 `maxToolCalls` 기본 10 기준 실질 위험 낮음. p-limit 도입은 별도 capacity-planning 논의 |
| I4 | fakeTimers 전환 — 실제 30ms 타이머는 CI 의 95p 안정 영역. 플레이크 발생 시 전환 |
| I5 | `tool_call_budget_exceeded` 공개 계약화 — Stage 1 spec 갱신에서 이미 정책으로 명시 (§3.g) |
| I6 | CHANGELOG — 본 프로젝트는 commit message + spec 갱신을 SSOT 로 사용, 별도 CHANGELOG 미사용 |
| I7 | `maxToolCalls=0` 엣지 — schema 검증으로 0 거부 (별도 검증). 현재 처리도 안전(loop 미진입) |
| I10 | multi-turn 간 dedup 테스트 — 기존 `dedupes ragSources by chunkId across turns` 가 이미 존재 |
| I11 | conditionToolCalls 카운트 비대칭 — 의도된 설계(conditiontool 은 LLM 추가 turn 을 트리거 안 함). 별도 정비 필요 시 spec 변경부터 |
| I15 | `npm ls p-limit` 출처 — jest-e2e.json 주석 단일 SSOT 로 충분 |
| I16 | scope — 이미 별도 commit 분리됨 (test infra fix) |

---

## 회귀 검증

조치 후 TEST WORKFLOW:

| 단계 | 결과 |
|------|------|
| backend lint | ✅ clean |
| backend unit | ✅ 2745 / 2745 (167 suites) — Stage 1~3 + 본 조치의 신규 6개 테스트 포함 |
| backend e2e | ✅ 1 skipped (placeholder, scaffold leftover) |
| backend build | ✅ nest build 성공 |

추가된 회귀 테스트:
- `dedupes ragSources by chunkId across parallel kb_ tool calls in the same batch`
- `isolates partial failures across parallel kb_ tool calls` (+ assertions)
- `executes provider tool calls within a turn concurrently (Promise.all)`
- `truncates within-batch when remaining budget < emitted tool_use count`
- `truncates within-batch on multi-turn resume too (parity with single-turn)`
- `runs provider tools in parallel on multi-turn resume too`
- `reuses KB metadata cached by buildTools instead of re-querying findById`
