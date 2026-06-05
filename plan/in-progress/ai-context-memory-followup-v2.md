---
worktree: ai-context-memory-9c7e6e
started: 2026-06-03
owner: planner/developer
related_plan: plan/complete/ai-context-memory-auto.md
---

# AI Agent 자동 컨텍스트 메모리 — v2 후속 surface

`ai-context-memory-auto.md` (Phase B~G) 가 구현하는 summary_buffer + persistent 의
**남은 v2 surface**. 본 plan 이 in-progress 인 동안 관련 spec 들은 `status: partial`
을 유지한다 (`1-ai-agent.md` / `0-common.md` / `conversation-thread.md` /
`5-system/17-agent-memory.md` 의 `pending_plans:` 가 본 plan 을 가리킴).

## 미구현 surface (v2)

- [x] **멀티턴 누적 messages 물리 축소** — 2026-06-04 구현 완료. `summary_buffer`/`persistent`
      에서 요약이 오래된 exchange 를 커버하면(`summarizedUpToSeq` 전진) 다음 turn 으로 누적되는
      `state.messages`/`_resumeState.messages` 를 `compactMessagesToTail(messages, keepUserExchanges)`
      로 물리 축소. 페어링은 **`user` 메시지 경계에서만 자르는** 불변식으로 보존(tool_use↔tool_result
      쌍 절대 무손상). `manual` 무영향(회귀 0). spec §6.2 d.6 + §12.14, `meta.memory.compactedMessages`
      노출. 구현: `agent-memory-injection.ts` (순수 함수) + `ai-agent.handler.ts` 멀티턴 경로 배선.
- [x] **persistent 증분 추출 + 구조화 dedup** — 2026-06-04 구현 완료 (AGM-08·AGM-09).
      **증분 추출**: 멀티턴 `_resumeState.lastExtractionTurnSeq` watermark 도입 —
      `scheduleMemoryExtraction` 가 `seq > watermark` turn 만 snapshot 해 enqueue 후
      새 max seq 를 반환하고 `_resumeState` 로 영속(신규 0개면 skip). single-turn 은
      전체 추출 유지. **의미 dedup**: `AgentMemoryService.saveMemories` 가 무조건 INSERT
      대신 `findSimilarFact`(recall cosine SQL 재사용, LIMIT 1, `MEMORY_DEDUP_SIMILARITY=0.85`)
      로 유사 기존 fact 탐색 → 있으면 UPDATE(content/embedding/metadata/updated_at), 없으면
      INSERT. batch 내 중복도 in-memory cosine 으로 방지. spec `17-agent-memory.md §3·§4`.
- [x] **persistent TTL 만료** — 2026-06-04 구현 완료 (AGM-10). 마이그레이션 `V080`
      (`expires_at TIMESTAMPTZ NULL` + partial index `WHERE expires_at IS NOT NULL`).
      노드 config `memoryTtlDays`(Integer optional, visibleWhen persistent) → enqueue
      payload `ttlDays` → processor → `saveMemories(…, ttlDays)` → `expires_at = now()+ttlDays`.
      recall 은 `(expires_at IS NULL OR expires_at > now())` 필터, evict 는 만료 row
      `DELETE WHERE expires_at < now()` 후 기존 FIFO. 미설정=무만료(기존 동작 보존).
- [x] **추출 분류 깊이** — 2026-06-04 구현 완료 (AGM-11). 추출 프롬프트가 `{content, kind}`
      (kind ∈ fact/preference/entity) JSON 반환. `parseExtractionResponse` 가 객체·문자열
      (구 shape, fallback `fact`) 모두 수용. `metadata.kind` 에 분류 저장(기존 hardcoded
      `fact` 대체).
- [x] **메모리 가시화 UI**: workspace 어드민이 scope 별 누적 메모리 조회/삭제. 2026-06-05 완료 (A1 #471, AGM-12/13·NAV-AM).
- [x] **contextScope 자동주입 두 노드 확장** — 2026-06-05 완료 (A2 #480, 공유유틸 추출).
- [ ] **memoryStrategy(summary_buffer/persistent) 자동메모리 두 노드 확장** — v2 (상태누적이라 ai_agent multi-turn 라이프사이클과 결합, 별도 설계).
- [ ] **provider tokenizer-exact 토큰 카운트**: 현재 char/4 근사. 모델별 정확 토큰화.
- [x] **요약/추출 전용 저비용 모델 옵션**: 현재 노드 `model` 재사용. 별도 모델 필드 검토. 2026-06-05 완료 (A3 #473, summaryModel/extractionModel, fallback 체인).

> 위 항목들은 본 PR(`ai-context-memory-auto.md`) 범위 밖. 우선순위·picking 후 개별 착수.

## spec 정밀화 백로그 (코드 리뷰 도출, 경미)

> 아래 8건은 2026-06-03 spec 보정 PR 에서 모두 반영 완료.

- [x] `0-common.md §10` memoryStrategy 행에 `[AI Agent §12.9]` 근거 링크(W-11), `includeToolTurns`
      행에 push/inject 분리 한 줄(W-12).
- [x] `1-ai-agent.md §7` Config echo 열거에 memory 5필드 추가(impl-done W-3).
- [x] `0-common.md §10` 첫 단락 "v1 세 노드 모두 push 출하, ai_agent 만 inject" 로 정밀화(W-7).
- [x] `1-ai-agent.md §6.2 d.5` summary_buffer(1.5만, 1.3·2.7 미적용) vs persistent(1.3+1.5+2.7) 분기 명시(W-8).
- [x] `5-system/_product-overview.md` 에 AGM-01~07 등재(W-10).
- [x] `conversation-thread.md §7` Token-aware cap 에 "tokenizer-exact 는 v3 잔존" 명시(SPEC-DRIFT I-11) — 기존 문구로 이미 충족.
- [x] `1-ai-agent.md §12.12` 에 요약/추출 LLM 모델 재사용(별도 필드 없음) Rationale 소항(I-6).
- [x] `1-ai-agent.md §12.13` Redis TTL 만료 시 runningSummary 유실 fallback 정책 명시(W-6).

## v2 코드 리뷰 도출 백로그 (멀티턴 물리압축 후속)
- [ ] `injectMemoryContext` 의 `getThread`/`getThreadExcludingNode` 이중 쿼리 단일화(I/O-backed 전환 대비, W-8).
- [ ] `ConversationThreadService.updateSummaryState()` 신설 — runningSummary/summarizedUpToSeq 단일 변이 경로(I-7).
- [x] `buildSummaryBufferUpdate` rolling 루프 토큰 재계산 O(n²)→O(1) 증분(perf I-11). 2026-06-05 완료 (B3 #474, bit-identical 증분).
- [ ] `meta.memory.compactedMessages` 를 `_product-overview` ND-AG-30 열거에 등재(naming I-7).
- [ ] §6.2 d.5 본문에 auto-memory multi-turn 실행 경로 부연(SPEC-DRIFT I-2).

## persistent 고도화 코드 리뷰 도출 백로그
- [ ] SPEC-DRIFT: `17-agent-memory.md §3 AGM-04` "scheduleBackgroundBody snapshot" 표현 → 전용 BullMQ 큐(`agent-memory-extraction`, concurrency=2) 로 갱신(I1).
- [ ] V080 `expires_at` 인덱스 무중단 배포 시 `CREATE INDEX CONCURRENTLY` 분리(V080a/b, executeInTransaction=false)(I9).
- [ ] TTL 파싱(resolveMemoryTtlDays) 핸들러→AgentMemoryService/유틸 이전(I2).
- [ ] saveMemories 포지셔널 5파라미터 → 옵션 객체(I3). cosine SQL WHERE 빌더 추출(I5).
- [ ] `_resumeState.lastExtractionTurnSeq` → `memoryState` sub-namespace(I12).
- [ ] `§7.1 meta.memory` 열거에 `compactedMessages?` + node-output Principle 2 에 meta.memory(impl-done W-1).

## A1 가시화 UI / A2 contextScope 확장 도출 백로그 (2026-06-05)
- [ ] listScopes ORDER BY MAX(updated_at) filesort 인덱스 (`(workspace_id, scope_key, updated_at)`, CREATE INDEX CONCURRENTLY) — A1 backlog.
- [ ] AgentMemoryAdminService 분리 (SRP, admin read/delete 를 런타임 메모리 서비스에서 분리) — A1 backlog.
- [ ] agent-memory `page.tsx`(412줄) 컴포넌트 분해 + 프론트 page 컴포넌트 테스트 — A1 backlog.
- [ ] agent-memories pagination offset→프로젝트 표준 page DTO 정렬 — A1 backlog.
- [ ] clearScope 0건 삭제 시 toast 중립화/X-Deleted-Count — A1 backlog.
- [ ] information_extractor §5.4/§5.5 meta 표에 contextInjection 행(waiting/resumed) — A2 backlog(minor).
