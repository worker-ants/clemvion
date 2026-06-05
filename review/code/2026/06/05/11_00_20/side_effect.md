# Side Effect Review — summaryModel / extractionModel (A3)

Worktree: `agent-memory-summary-model-fa4efb`
Diff base: `origin/main..HEAD`
Reviewer role: Side Effect

---

## CRITICAL

없음.

---

## WARNING

### W1 — `summaryModel` 이 멀티턴 resume turn 에서 유실됨 (기능 불동작)

- **위치**: `ai-agent.handler.ts` `multiTurnStateBase` (lines ~2151–2191), `processMultiTurnMessage` line 2527
- **상세**: `executeMultiTurn` 이 첫 turn 에서 생성하는 `multiTurnStateBase` 객체에 `summaryModel` 이 포함되지 않는다. 후속 resume turn 의 `processMultiTurnMessage` 는 `state.summaryModel as string | undefined` 로 직접 접근하므로, 멀티턴 2회차 이후 요약 LLM 콜은 항상 `state.summaryModel === undefined` → 폴백 체인의 `model` 로 동작한다.
  - 결과: `summaryModel` 을 설정해도 멀티턴에서는 **첫 turn 에만 유효**하고 resume turn 에서는 무시된다 (노드 `model` 로 폴백). 엔진이 자동 주입하는 `state.rawConfig.summaryModel` 은 존재하지만 코드는 `state.summaryModel` (직접 키) 을 읽으므로 브리지가 없다.
  - 하위호환 관점에서 기존 동작(model 폴백)은 회귀하지 않으나, 신규 기능(`summaryModel` 지정으로 비용 절감)이 멀티턴 resume에서 침묵하여 동작하지 않는다.
- **제안**: `multiTurnStateBase` 에 `summaryModel: config.summaryModel as string | undefined` 를 추가한다. `embeddingModel`·`memoryTtlDays` 등이 이미 `multiTurnStateBase` 에 포함된 패턴과 동일.

### W2 — `extractionModel` 이 멀티턴 resume turn 에서 유실됨 (기능 불동작)

- **위치**: `ai-agent.handler.ts` `multiTurnStateBase` (lines ~2151–2191), `scheduleMemoryExtraction` 호출 line 2865–2873 (`config: state`)
- **상세**: `scheduleMemoryExtraction` 에서 `args.config.extractionModel` 를 읽는데 (line 1146), `config: state` 로 전달된 `state` 는 `multiTurnStateBase` 를 기반으로 하며 `extractionModel` 키가 없다. 따라서 멀티턴 resume 에서 추출 LLM 콜은 `undefined → model → llmConfig.defaultModel` 폴백으로 처리된다.
  - 결과: `extractionModel` 설정이 멀티턴 resume에서 무시된다. 단, 추출 자체(`extractionModel` 없이 `model` 폴백)는 정상 동작하므로 **데이터 유실은 없고 비용 절감만 무효**가 된다.
- **제안**: `multiTurnStateBase` 에 `extractionModel: config.extractionModel as string | undefined` 를 추가한다. `summaryModel` 수정과 함께 처리.

---

## INFO

### I1 — `extractionModel` 구버전 큐 payload 하위호환 확인 (이슈 없음)

- **위치**: `agent-memory-extraction.processor.ts` line 47 `job.data ?? {}`
- **상세**: processor 구조분해 시 `job.data ?? {}` 로 `undefined`-safe 처리되고, 폴백 체인 `extractionModel || model || llmConfig.defaultModel` 이 `undefined` 를 정상 처리한다. 기존 큐에 쌓인 `extractionModel` 필드 없는 구버전 payload 는 기존 동작(`model` 재사용)으로 100% 처리된다. 하위호환 이상 없음.

### I2 — 메인 추론 LLM 콜 영향 없음 (이슈 없음)

- **위치**: `injectMemoryContext` 내 `buildSummaryBufferUpdate` 호출 (line 942–954), 메인 `llmService.chat` 호출
- **상세**: `buildSummaryBufferUpdate` 에 전달되는 `model: args.summaryModel || args.model` 은 요약 LLM 콜 전용이다. 이후 메인 추론 LLM 콜 (`this.llmService.chat(llmConfig, { model: ... })`) 은 `summaryModel` 을 전혀 참조하지 않고 독립적으로 `model`(노드 메인 모델)을 사용한다. 요약/추출 분기와 메인 추론 분기는 완전히 분리되어 있다.

### I3 — `extractionModel` 미설정 시 단일턴/멀티턴 1회차 동작 불변 확인 (이슈 없음)

- **위치**: `scheduleMemoryExtraction` line 1138–1152, processor fallback chain
- **상세**: `extractionModel` 미설정 시 `undefined` → `null` (service 내 `?? null`) → processor `extractionModel || model || llmConfig.defaultModel` 에서 `model` 로 폴백. 기존 동작과 동일하다. 회귀 없음.

### I4 — schema 신규 필드의 config echo / meta 영향 (이슈 없음)

- **위치**: `buildMultiTurnConfigEcho` (line 3421), single_turn config echo (line 1978–1994)
- **상세**: `summaryModel`/`extractionModel` 이 config echo 에 명시적으로 포함되지 않는다. 그러나 기존 memory 필드 전체(`memoryStrategy`, `memoryTokenBudget`, `memoryKey` 등)도 동일하게 config echo 에서 제외되어 있으며, spec §7 Config echo 정책은 "default/미설정 값과 일치하면 echo 에서 생략" 패턴으로 memory 전체를 처리한다. 신규 두 필드도 동일 패턴이므로 기존 계약 위반이 아니다. pre-existing 처리 방식과 일관됨.

### I5 — `AgentMemoryExtractionJob` 인터페이스 선택적 필드 추가 (이슈 없음)

- **위치**: `agent-memory-extraction.queue.ts` `AgentMemoryExtractionJob` interface
- **상세**: `extractionModel?: string | null` 이 optional 로 추가되었고, 기존 타입을 사용하는 모든 생산자/소비자에서 컴파일 에러 없이 처리된다. processor 는 `?? {}` + `||` fallback chain 으로 누락 필드를 방어한다.

---

## 요약

본 변경은 `summaryModel` / `extractionModel` 두 선택적 필드를 추가하여 요약/추출 LLM 콜에 별도 저비용 모델을 지정할 수 있게 한다. 단일턴 경로와 멀티턴 첫 번째 turn(executeMultiTurn) 에서는 두 필드가 정상 전달된다. 그러나 `multiTurnStateBase` 에 두 필드가 포함되지 않아, **멀티턴 resume turn(processMultiTurnMessage) 에서 `summaryModel`/`extractionModel` 이 `undefined` 로 읽히므로 설정한 전용 모델이 무시된다** — 기능이 침묵하여 노드 `model` 로 폴백된다. 기존 동작 회귀(데이터 유실·오동작)는 없고, 구버전 큐 payload 하위호환도 이상이 없으며, 메인 추론 LLM 콜에도 영향이 없다. 단, 멀티턴 resume에서 새 기능이 동작하지 않는 버그(W1, W2)가 존재한다. 수정은 `multiTurnStateBase` 에 두 필드를 추가하는 1-2줄 변경으로 충분하다.

---

## 위험도

MEDIUM

(`summaryModel`/`extractionModel` 설정이 멀티턴 resume에서 침묵-무시되는 기능 버그. 데이터 유실·회귀는 없음.)

---

BLOCK: NO
