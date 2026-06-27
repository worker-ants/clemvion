# 요구사항(Requirement) Review

## 발견사항

### [SPEC-DRIFT] [WARNING] `spec/5-system/17-agent-memory.md` — AGM-08 watermark 경로 명세가 구 flat 키 기준

- 위치: `spec/5-system/17-agent-memory.md` §3 (AGM-08 요구사항 본문), §7 "실현됨 (v2)" 항목, §7 Rationale "증분 추출 watermark (AGM-08)" 절
- 상세: 세 곳 모두 watermark 위치를 `_resumeState.lastExtractionTurnSeq` (flat 키) 로 명시한다.
  - §3: "멀티턴 `_resumeState.lastExtractionTurnSeq` 가 직전 추출이 커버한 마지막 turn 의 `seq` 를 watermark 로 영속하며..."
  - §7 실현됨: "멀티턴 watermark(`lastExtractionTurnSeq`) 로 신규 turn 만 추출 (AGM-08)"
  - §7 Rationale: "`_resumeState.lastExtractionTurnSeq` 를 watermark 로 두고..."

  코드(I12)는 이를 `_resumeState.memoryState.lastExtractionTurnSeq` sub-namespace 로 이전했다. `ai-turn-executor.ts` 쓰기 경로, `information-extractor.handler.ts` `MultiTurnState` 타입·hydrate, 공유 `readExtractionWatermark` 헬퍼 모두 새 namespace 를 기준으로 하고 구 flat 키는 in-flight 하위호환 폴백으로만 남긴다. 이전 자체는 합리적이고 의도적이며, 테스트(`ai-agent.memory.spec.ts`의 `wmOf`·직접 대입, `agent-memory-injection.spec.ts`의 `readExtractionWatermark` 테스트)가 회귀를 보장한다 — 코드를 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 반영. 갱신 대상 spec 위치:
  1. `spec/5-system/17-agent-memory.md §3` AGM-08 본문: `_resumeState.lastExtractionTurnSeq` → `_resumeState.memoryState.lastExtractionTurnSeq` (하위호환 폴백 내용 병기).
  2. `spec/5-system/17-agent-memory.md §7` "실현됨 (v2)" AGM-08 항목: watermark 경로 갱신.
  3. `spec/5-system/17-agent-memory.md §7 Rationale "증분 추출 watermark (AGM-08)"`: `_resumeState.lastExtractionTurnSeq` → `_resumeState.memoryState.lastExtractionTurnSeq` 로 수정.

---

### [INFO] `updateSummaryState` — 두 필드를 동시에 unconditional 할당 (부분 업데이트 시 의도치 않은 undefined 주입 가능성)

- 위치: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` `updateSummaryState`
- 상세: 메서드 시그니처가 `{ runningSummary?: string; summarizedUpToSeq?: number }` 로 둘 다 optional 이지만, 구현 내부에서는 `thread.runningSummary = state.runningSummary; thread.summarizedUpToSeq = state.summarizedUpToSeq;` 를 무조건 대입한다. 한 필드만 전달하면 나머지가 `undefined` 로 덮인다. 현재 유일한 호출부(`ai-memory-manager.ts` 내 `update.summarized` 가드 아래)는 항상 두 필드를 동시에 전달하므로 실제 경로에서는 안전하다. 향후 호출부가 부분 업데이트를 시도하면 silent 손실이 발생할 수 있다.
- 제안: 현재 호출 패턴 및 summary state 의 원자 일관성(두 필드는 항상 쌍으로 유효해야 함) 관점에서 설계상 의도적이다. 버그로 판단하지 않으나, JSDoc 에 "두 필드는 항상 함께 제공해야 한다 — 단독 제공은 나머지를 undefined 로 초기화한다" 를 명시하면 미래 호출부 오용을 예방할 수 있다.

---

### [INFO] `buildCosineMatch` 파라미터 순서 계약 — 호출부 일치 확인 완료

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`
- 상세: `buildCosineMatch` JSDoc 은 파라미터 순서를 `$1=vector, $2=workspaceId, $3=scopeKey, $4=threshold` 로 명시한다. `recall` 호출부(`[vectorStr, workspaceId, scopeKey, threshold, topK]`)와 `findSimilarFact` 호출부(`[vectorStr, workspaceId, scopeKey, MEMORY_DEDUP_SIMILARITY]`) 모두 계약을 준수한다. 이슈 없음.

---

### [INFO] `saveMemories` 옵션 객체화 (I3) — spec 에 시그니처 명세 없어 spec drift 아님

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`
- 상세: `spec/5-system/17-agent-memory.md` §3·§4 는 `saveMemories` 의 콜링 컨벤션(포지셔널 vs 옵션 객체)을 명시하지 않는다 — 행위 레벨(TTL 전달, 임베딩 config 전달)만 규정한다. 옵션 객체화는 내부 API 품질 개선이므로 spec 갱신 불필요.

---

### [INFO] IE `MultiTurnState.lastExtractionTurnSeq` → `memoryState` 타입 전환 — hydrate 하위호환 정확

- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` `hydrateState`
- 상세: `readExtractionWatermark(raw)` 가 구 평면 키(배포 중 in-flight 파킹 실행)와 신 namespace 양쪽을 수용해 watermark 를 정규화한 뒤 `{ lastExtractionTurnSeq: seq }` 로 `memoryState` 슬롯에 재배치한다. 폴백 우선순위(신 namespace > 구 flat 키)가 `readExtractionWatermark` 와 일치한다. 이슈 없음.

---

## 요약

이번 변경(Batch 2)은 계획된 5개 항목(I3, I5, I-7, W-8, I12)을 모두 구현했다. `saveMemories` 옵션 객체화·`buildCosineMatch` 공유 빌더·`updateSummaryState` 단일 변이 경로 신설·단일 `getThread` 읽기 최적화·watermark sub-namespace 이전이 기능적으로 완전하고 엣지 케이스(빈 content, empty embedding, in-flight 파킹 실행 하위호환, dedup-drop 시 watermark 불전진)가 모두 테스트로 커버된다. 유일한 조치 필요 항목은 AGM-08 spec 본문 세 곳에 watermark 위치를 `memoryState` 신 namespace 로 갱신하는 것(SPEC-DRIFT)이며, 이는 코드가 아니라 `spec/5-system/17-agent-memory.md` 문서의 수정 사항이다.

## 위험도

LOW
