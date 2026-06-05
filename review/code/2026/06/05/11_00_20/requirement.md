# 요구사항 충족 리뷰 — 요약/추출 전용 LLM 모델 옵션 (A3)

worktree: agent-memory-summary-model-fa4efb
diff: origin/main..HEAD
분석 일시: 2026-06-05

---

## 발견사항

### [CRITICAL] 멀티턴 `_resumeState` 에 `summaryModel`·`extractionModel` 미저장 — 두 번째+ turn 에서 전용 모델 무시됨

- 위치: `ai-agent.handler.ts` `executeMultiTurn` 함수 내 `multiTurnStateBase` 객체 (L2152–2191)
- 상세:
  멀티턴 첫 turn 이 `waiting_for_input` 상태를 반환할 때 `_resumeState = { ...multiTurnStateBase, messages, … }` 로 state 를 영속한다. `multiTurnStateBase` 에는 `memoryStrategy`, `memoryTokenBudget`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays` 는 포함되지만 **`summaryModel` 과 `extractionModel` 이 없다**.

  - 요약 경로: `processMultiTurnMessageInner` 에서 `summaryModel: state.summaryModel as string | undefined` (L2527) 를 읽지만, `state.summaryModel` 은 항상 `undefined` 이므로 `args.model`(=state.model) 로 폴백. 사용자가 설정한 `summaryModel` 은 멀티턴 두 번째+ turn 에서 완전히 무시된다.
  - 추출 경로: `scheduleMemoryExtraction` 호출 시 `config: state` (L2869) 를 전달하므로 `args.config.extractionModel` 은 역시 `undefined`. 멀티턴에서 `extractionModel` 도 첫 turn 이후 무시된다.

  단일 턴(`executeSingleTurn`)은 `config` 가 원본이므로 올바르게 동작한다.

  수정: `multiTurnStateBase` 에 두 필드를 추가한다.
  ```ts
  summaryModel: config.summaryModel as string | undefined,
  extractionModel: config.extractionModel as string | undefined,
  ```

- 제안: 위 두 줄을 `memoryTtlDays: config.memoryTtlDays` 다음에 추가. `embeddingModel` 도 동일 패턴으로 누락되어 있지만 이는 이번 변경 전부터의 pre-existing 결함이므로 별도 이슈로 처리.

---

### [WARNING] 멀티턴 전용 모델 state 영속 누락에 대한 테스트 없음

- 위치: `ai-agent.memory.spec.ts` L1253–1400 (신규 A3 테스트 블록)
- 상세:
  새 테스트 3개는 모두 `mode: 'single_turn'` 기반이다. 멀티턴의 두 번째 turn 에서 `summaryModel`·`extractionModel` 이 실제로 사용되는지 검증하는 테스트가 없다. 위 CRITICAL 버그는 현재 테스트로 잡히지 않는다.

  필요한 테스트:
  - `multi_turn + summaryModel set` 시 두 번째 turn 의 요약 LLM 콜이 `summaryModel` 을 쓰는지
  - `multi_turn + extractionModel set` 시 두 번째 turn 의 `scheduleExtraction` payload 에 `extractionModel` 이 담기는지

- 제안: CRITICAL 수정과 함께 멀티턴 케이스를 A3 테스트 블록에 추가.

---

### [INFO] `summaryModel`·`extractionModel` 빈 문자열(`""`) 동작

- 위치: `ai-agent.handler.ts` L952, `agent-memory-extraction.processor.ts` L64–65
- 상세:
  스키마는 `z.string().optional()` 이라 빈 문자열을 허용하지만, 폴백 로직이 `||` 연산자(`extractionModel || model || llmConfig.defaultModel`, `args.summaryModel || args.model`)를 사용하므로 빈 문자열은 falsy 로 처리돼 다음 단계로 자동 폴백한다. 사용자가 의도적으로 빈 문자열을 입력하면 spec 의 "미설정" 과 동일하게 동작한다 — 이는 UI의 placeholder ("Leave empty to reuse the node Model") 와 일치하므로 의도된 동작이다. 별도 수정 불필요.

---

### [INFO] `[SPEC-DRIFT]` spec §3 AGM-04 요구사항 ID 서술이 갱신됐으나 `17-agent-memory.md` 의 기존 "별도 추출 모델 필드 신설 없음" 문장은 이번 diff 에서 이미 수정됨

- 위치: `spec/5-system/17-agent-memory.md` §3, AGM-04 주석 행
- 상세: diff 에서 확인. 이미 수정 완료. 추가 조치 불필요.

---

## 요약

핵심 기능(단일 턴 fallback 체인, processor 추출 모델 폴백, schema visibleWhen, spec 갱신)은 올바르게 구현됐다. 그러나 **멀티턴 `_resumeState` 에 `summaryModel`·`extractionModel` 이 저장되지 않아** 멀티턴 두 번째+ turn 에서 두 전용 필드가 완전히 무시된다. 미설정 시 기존 동작으로 폴백되므로 회귀는 없지만, 사용자가 설정한 전용 모델이 멀티턴에서 작동하지 않는 기능 누락이다. 대응 테스트도 단일 턴에만 국한돼 이 결함을 커버하지 못한다.

## 위험도

**HIGH**

---

BLOCK: YES
