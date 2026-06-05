# RESOLUTION — review/code/2026/06/05/11_00_20

A3 (요약/추출 전용 저비용 모델 `summaryModel`/`extractionModel`) 리뷰 SUMMARY 의
Critical 1건 + Warning 4건을 같은 세션에서 수정 완료했다. BLOCK:YES → 해소.

## 발견 → 조치

| SUMMARY # | 분류 | 발견 | 조치 |
|-----------|------|------|------|
| C1 | Critical / Correctness | `executeMultiTurn` 의 `multiTurnStateBase`(`_resumeState`) 에 `summaryModel`/`extractionModel` 미저장 → 멀티턴 turn2+ resume 에서 `state.summaryModel`(요약 콜) / `state.extractionModel`(추출 enqueue, `config: state`) 이 undefined → 노드 `model` 로 silent 폴백. 핵심 기능이 멀티턴에서 무효 | `multiTurnStateBase` 에 `summaryModel`/`extractionModel` 2필드 추가 (기존 `memoryTtlDays` 등과 동일 `as string \| undefined` 스타일). `ai-agent.handler.ts` L2185~2186 |
| W1 | 추적성 / Cross-Spec | `1-ai-agent §12.12` 가 전제한 `conversation-thread §7 v2 로드맵` 의 "요약/추출 전용 저비용 모델" 항목이 §7 에 부재(유령 참조) | `conversation-thread.md §7` 에 strikethrough "채택 완료" 항목 1행 추가 (기존 "DB 컬럼 신설 → 채택 완료" 패턴 동형). 앵커 `#1212-…` 는 `5-system/17-agent-memory.md` 기존 링크와 일치 검증 |
| W2 | 테스트 갭 | 요약 fallback 3단째(`model`+`summaryModel` 모두 미설정 → `llmConfig.defaultModel`) 미커버 | `ai-agent.memory.spec.ts` 에 single-turn 테스트 추가 — 둘 다 생략 시 요약 콜이 `gpt-4o`(llmConfig 기본)를 쓰는지 단언 |
| W3 | 가독성 | 요약 경로 `args.summaryModel \|\| args.model` 인라인 vs 추출 경로 named-var(`resolvedExtractionModel`) 불일치 | `injectMemoryContext` 에 `resolvedSummaryModel` named 변수 분리(동작 불변), `buildSummaryBufferUpdate` 호출부에서 사용. `ai-agent.handler.ts` ~L945 |
| W5 | 테스트 정리 | `makeJob` 헬퍼가 `extractionModel` 미수용 → 캐스트 주입(`(job.data as …).extractionModel = …`) | `makeJob` 에 `extractionModel` 전파(`'extractionModel' in data` 시만 포함) 추가, 해당 테스트의 캐스트 주입 제거. `agent-memory-extraction.processor.spec.ts` |

### C1 회귀 테스트 (필수)
`ai-agent.memory.spec.ts` 에 멀티턴 시나리오 추가 — multi_turn `execute` 로 첫 park
후 `processMultiTurnMessage` 로 turn1·turn2 resume 실행. 단언:
- `_resumeState.summaryModel === 'cheap-mini'`, `_resumeState.extractionModel === 'cheap-extract'` (영속 직접 확인).
- turn2 요약 LLM 콜 model === `cheap-mini`(summaryModel), 메인 콜 === `gpt-4o`(노드 model).
- turn2 추출 enqueue payload `.extractionModel === 'cheap-extract'`, `.model === 'gpt-4o'`.

회귀 핀 유효성 검증: C1 fix 를 일시 revert 한 상태에서 본 테스트가
`Expected "cheap-mini" / Received undefined` 로 실패함을 확인 후 fix 복원.

## TEST 결과

| stage | status | 통과수 | 로그 |
|-------|--------|--------|------|
| lint  | PASS | backend 0 err (pre-existing warnings 무관) | `_test_logs/lint-20260605-112411.log` |
| unit  | PASS | backend jest 6125 passed (1 skipped) / frontend vitest 3936 passed / 그 외 suite 포함 전 GREEN. 영향 spec 직접 재실행 47 passed | `_test_logs/unit-20260605-112449.log` |
| build | PASS | exit 0 | `_test_logs/build-20260605-112537.log` |
| e2e   | PASS | 168 passed (docker; `docker info` OK) | `_test_logs/e2e-20260605-112640.log` |

docs/label 가드 (`frontend vitest src/lib/docs/__tests__ + ui-label-parity`): 1940 passed.

## 보류 (미수정 — backlog)

- **W4** (maintainability): `embeddingModel` widget 'text' vs 신규 'expression' 불일치(#467 선존) — 본 A3 변경과 독립, 별도 정리 백로그.
- **I-1/I-2/I-3** (maintainability INFO): fallback 주석 4중복 / `as`-cast / schema order 소수점 — 가독성 미세 개선, 후속.
