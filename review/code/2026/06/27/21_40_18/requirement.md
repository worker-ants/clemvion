# 요구사항(Requirement) Review

## 발견사항

### [INFO] `ai-memory-manager.ts` 요약 갱신 가드 조건 변경 — 의미적으로 안전하나 명시성 감소

- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` — `injectMemoryContext` 요약 갱신 분기
- 상세: 이전 코드는 `if (update.summarized && thread)` 로 `getThread()` 반환 참조(`thread`)의 존재를 직접 확인했다. 새 코드는 `if (update.summarized && this.conversationThreadService && args.target)` 로 변경돼 실제 thread 객체 존재 여부를 확인하지 않는다. `fullThread`가 undefined 인 경우(thread 미초기화)에도 조건이 참이 될 수 있다. 그러나 이 경우 `fullTurns = []` → `turns = []` → `buildSummaryBufferUpdate`가 요약하지 않음 → `update.summarized === false` 로 분기 자체가 실행되지 않으므로 기능 결과는 동일하다. `updateSummaryState` 내부는 `context.conversationThread`를 직접 참조하므로 thread가 없는 상태로 진입하면 오류가 나지만, 위 분석대로 그 경로는 닫혀 있다.
- 제안: 현재 구현 안전. 명시성을 높이려면 `if (update.summarized && fullThread && this.conversationThreadService && args.target)` 처럼 `fullThread` 존재도 가드에 포함하면 의도가 더 명확해진다 — 기능 변경 아닌 방어적 표현 개선.

---

### [INFO] `buildCosineMatch` 파라미터 순서 계약 — 테스트 어설션 완전성 확인

- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — I5 테스트 블록
- 상세: 신규 추가된 "I5: buildCosineMatch 파라미터 순서 계약" 테스트가 recall 경로에서 params[0](vector 리터럴), params[1](workspaceId), params[2](scopeKey), params[3](threshold), SQL `$1::` 및 `>= $4` 패턴을 모두 직접 어설션한다. dedup 경로(findSimilarFact) 역시 동일한 어설션이 추가됐다. 이로써 이전 리뷰(W#5)에서 지적한 파라미터 순서 계약 미검증이 완전히 해소됐다.
- 제안: 없음. 두 호출 경로 모두 계약을 명시적으로 커버한다.

---

### [INFO] `readExtractionWatermark` seq=0 경계값 — 테스트 추가로 계약 명시

- 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — `readExtractionWatermark` describe 블록
- 상세: seq=0이 유효한 watermark 임을 `typeof number` 판정으로 보장하고, 이를 명시적으로 테스트한다. falsy 값(0)을 버리는 실수를 회귀로 방지한다.
- 제안: 없음.

---

### [INFO] Spec fidelity — `spec/5-system/17-agent-memory.md` I12 watermark namespace 반영 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/spec/5-system/17-agent-memory.md` §3 L80, §3 요구사항 shorthand L86, §7 실현됨 L141, §7 Rationale L171
- 상세: 이전 리뷰(W#1 SPEC-DRIFT)에서 지적한 spec 불일치를 이번 changeset에서 4개소 모두 갱신했다. 워크트리 실제 파일로 확인:
  - L80: `_resumeState.memoryState.lastExtractionTurnSeq` + in-flight 폴백 병기
  - L86: `memoryState.lastExtractionTurnSeq` watermark 단축 표현
  - L141: `memoryState.lastExtractionTurnSeq` 실현됨 목록
  - L171: `_resumeState.memoryState.lastExtractionTurnSeq` + I12 근거·폴백 설명
  
  코드(ai-turn-executor.ts 쓰기 / readExtractionWatermark 읽기 / IE hydrateState)와 spec 이 line-level 로 일치한다. SPEC-DRIFT 해소 완료.
- 제안: 없음.

---

### [INFO] RESOLUTION.md 모든 항목 이행 확인

- 위치: `review/code/2026/06/27/21_13_52/RESOLUTION.md`
- 상세: 이전 리뷰(21_13_52) RESOLUTION.md의 FIX/채택 항목을 코드 diff에서 전수 확인했다:
  - W#5(buildCosineMatch 파라미터 순서 테스트): 두 경로 모두 추가. ✓
  - W#6(IE hydrateState 폴백 통합 테스트): `information-extractor.memory.spec.ts` 에 "구 평면 키 resume 시 watermark 폴백" 테스트 추가. ✓
  - W#1 SPEC-DRIFT: spec 4개소 갱신. ✓
  - INFO #3(updateSummaryState JSDoc "두 필드 함께"): `conversation-thread.service.ts` JSDoc 에 명시. ✓
  - INFO #5(hydrateState IIFE → const): `information-extractor.handler.ts` 에 `const extractionSeq = readExtractionWatermark(raw)` 분리. ✓
  - INFO #9(seq=0 boundary): `agent-memory-injection.spec.ts` 에 추가. ✓
  - INFO #10(updateSummaryState 빈 객체 클리어): `conversation-thread.service.spec.ts` 에 추가. ✓
  - INFO #11(memoryState 타 키 보존): `ai-agent.memory.spec.ts` 에 I12 테스트 추가. ✓
  - INFO #12(embedCfgSource JSDoc): `agent-memory.service.ts` 옵션 객체 내 인라인 JSDoc 추가. ✓
  - INFO #15(wmOf → getWatermark): `ai-agent.memory.spec.ts` 헬퍼 `getWatermark` 로 개명. ✓
- 제안: 없음.

---

## 요약

이번 changeset은 이전 리뷰(21_13_52)의 모든 FIX/채택 항목을 완전히 이행했다. 기능 완전성 관점에서 I3(saveMemories 옵션 객체화), I5(buildCosineMatch 공유 빌더), I-7(updateSummaryState 단일 변이 경로), W-8(getThread 이중 읽기 → 단일), I12(memoryState sub-namespace + readExtractionWatermark)가 모두 올바르게 구현됐다. 엣지 케이스(빈 content, 빈 workspaceId/scopeKey, seq=0 watermark, in-flight 파킹 실행 하위호환, dedup-drop 시 watermark 불전진)는 전수 테스트로 커버된다. 핵심 비즈니스 규칙(AGM-08 watermark, AGM-09 dedup, AGM-10 TTL, AGM-11 분류)이 코드에 정확히 반영돼 있으며, 모든 경로에서 적절한 반환값이 보장된다. 이전 리뷰에서 SPEC-DRIFT로 지적된 `spec/5-system/17-agent-memory.md` AGM-08 watermark 경로도 4개소 전부 `memoryState` sub-namespace 로 갱신돼 code-spec 불일치가 해소됐다. Critical 및 Warning 발견사항 없음.

## 위험도

NONE
