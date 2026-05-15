## 발견사항

**[WARNING] `KbToolProvider.execute()`에서 KB 메타데이터 반복 조회 (N+1 유사 패턴)**
- 위치: `kb-tool-provider.ts` — `execute()` 내 `this.knowledgeBaseService.findById(kbId, ctx.workspaceId)`
- 상세: `buildTools()`에서 이미 모든 KB 메타데이터를 `Promise.allSettled`로 일괄 조회해 ToolDef를 구성하지만, `execute()`가 매 tool 호출마다 동일 KB row를 다시 `findById`로 조회함. agentic RAG 설계 의도상 같은 KB를 여러 쿼리로 반복 호출하는 것이 정상 경로(예: `query="교환정책"` + `query="반품정책"`이므로, `Promise.all` 병렬화 이후 동일 KB row에 대한 DB 쿼리가 N건 동시에 발행됨.
- 제안: `buildTools()` 호출 결과(혹은 KB 메타)를 provider context(`ProviderExecCtx`)에 포함시켜 `execute()` 단계에서 재사용. 또는 `execute()` 내 `findById`를 `kbName`의 fallback용으로만 쓰고 있으므로 in-memory cache나 `buildTools` 시점의 KB name을 tool call arguments에 포함시키는 방식으로 쿼리 제거 가능.

---

**[INFO] `Promise.all` 병렬화로 인한 커넥션 풀 동시 점유 증가**
- 위치: `ai-agent.handler.ts` — `providerBatchResults = await Promise.all(providerToRun.map(...))`
- 상세: 직렬 실행 시 각 `runProviderTool` → `findById` + `ragSearchService.search()` (pgvector 쿼리)가 순차 발행되었으나, 병렬화 이후 한 턴의 N개 tool 호출이 동시에 커넥션을 점유함. 단일 workflow 실행에서는 문제없지만, 다수의 실행이 동시에 진행될 경우 커넥션 풀 사용량이 `(동시 실행 수) × (batch 크기)` 배수로 증가.
- 제안: 즉각적 대응은 불필요하나, pgvector 쿼리가 느린 환경(대용량 KB)에서는 `maxToolCalls` 상한 외에 `Promise.all` 동시성을 제한하는 concurrency limiter(`p-limit` 등) 도입을 고려.

---

**[INFO] `_resumeState.ragSources` 무제한 누적**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessageInner` — `_resumeState: { ..., ragSources: ragAcc.getSources(), ... }`
- 상세: `turnDebugHistory`는 `MAX_TURN_DEBUG_HISTORY = 50`으로 cap되어 JSONB 팽창 문제가 해결됐으나(`// WARN #5 (DB)` 주석 참조), `ragSources`는 chunkId dedup만 적용할 뿐 총 개수에 상한이 없음. 장기 multi-turn 대화에서 매 턴마다 새 청크가 유입되면 `outputData` JSONB가 지속 증가. 동일 문제가 `ragSources`에는 아직 해결되지 않음.
- 제안: `ragSources`도 최근 N건 또는 총 X KB 제한을 두거나, `ragSources`의 `content` 필드(이미 200자로 truncate됨)를 제외한 경량화 객체만 state에 저장.

---

## 요약

직접적인 스키마 변경이나 마이그레이션은 없으나 DB 쿼리 패턴에 두 가지 주의 사항이 있다. `KbToolProvider.execute()`에서 `buildTools()` 시점에 이미 조회한 KB 메타데이터를 매 tool 실행마다 재조회하는 패턴은, 동일 KB를 다중 쿼리로 반복 호출하는 agentic RAG의 설계 의도와 맞물려 불필요한 동시 DB 쿼리를 유발한다. `_resumeState.ragSources`의 무제한 누적은 `turnDebugHistory` cap이 도입된 맥락과 형평이 맞지 않아, 장기 대화의 JSONB 팽창 위험이 동일하게 남아있다. 두 사항 모두 현재 운영 환경에서 즉각적인 장애를 유발할 수준은 아니지만, agentic RAG 사용이 늘어날수록 누적 영향이 커질 수 있다.

## 위험도
**LOW**