# 요구사항 충족 리뷰 — information_extractor persistent 메모리 (memoryStrategy v2)

대상: `git diff 21fa8194..HEAD` (worktree: memory-strategy-extend-ad5987)  
기준 plan: `plan/in-progress/memory-strategy-extend-ie.md`  
검토일: 2026-06-05

---

## CRITICAL

### C-1 multi-turn 종결 push 가 manual 모드에서 발생하지 않음 — spec §4.2 / conversation-thread §2.3 위반

- **위치**: `information-extractor.handler.ts` `buildMultiTurnFinalOutput()` (line ~1201), `information-extractor.memory.spec.ts` line ~230
- **상세**: spec `3-information-extractor.md §4.2 step 3` 과 `conversation-thread.md §2.3` 주석 모두 "multi-turn 종결(`buildMultiTurnFinalOutput`) 후 1회 push 한다 (`completed` / `max_turns` / `user_ended`)" 라고 **memoryStrategy 한정 없이** 기술한다. 두 spec 문서 모두 "종전 v2 limitation 해소"라고 선언한다. 그러나 코드는 `target = threadHolderFromState(state)` 가 설정된 경우에만 push 하며, `conversationThreadRef` 는 `stateBase` 에서 `memoryStrategy === 'persistent'` 일 때만 설정된다(line ~710). 따라서 `manual` 모드 multi-turn 종결에서는 thread push 가 일어나지 않는다. 테스트(`manual (default): recall/extract never invoked, no thread push on completion`) 도 이를 명시적으로 단언(`expect(thread.getThread(context).turns).toHaveLength(0)`)하며, 주석도 "No — push is gated on a thread holder"라고 인정한다.  
  spec §4.2 와 conversation-thread §2.3 은 "이 push 가 다운스트림 contextScope 가시성을 준다" 고 모든 모드에 대해 서술하므로, manual multi-turn 에서도 push 가 발생해야 spec 에 부합한다. Rationale §9.3 의 "persistent 추출의 source" 동기는 부가적이며, 주된 spec 선언("v2 limitation 해소")은 mode 에 무관하게 적용된다.
- **제안**: `buildMultiTurnFinalOutput` 에서 `endReason !== 'error'` 이면 memoryStrategy 와 무관하게 thread push 를 수행하도록 수정한다. push 를 위한 thread holder 는 manual 모드도 context.conversationThread 를 stateBase 에 저장하거나, buildMultiTurnFinalOutput 에 별도 파라미터로 전달한다. 추출 enqueue 는 persistent 에서만 호출한다(현행 유지). 이 경우 spec 텍스트와 완전히 일치한다.  
  *OR* spec §4.2 / conversation-thread §2.3 텍스트를 "`memoryStrategy = persistent` 일 때만 push" 로 한정 수정하고 Rationale 을 명확히 정렬한다. 어느 방향이든 spec-코드 정합을 맞춰야 한다.

---

## WARNING

### W-1 spec §7 하위섹션 번호가 §9 와 중복 — 동일 문서 내 앵커 충돌

- **위치**: `spec/4-nodes/3-ai/3-information-extractor.md` lines 673–689 vs 707–715
- **상세**: `## 7. Persistent 메모리` 하위 섹션이 `### 9.1 회수`, `### 9.2 추출`, `### 9.3 manual 회귀 불변식` 으로 번호가 매겨졌다. 그러나 같은 파일의 `## 9. Rationale` 도 `### 9.1`, `### 9.2`, `### 9.3` 하위섹션을 가진다. 결과적으로 동일 문서 내 `### 9.1` 앵커(Markdown heading)가 두 개 존재해 링크 참조 시 첫 번째가 해소된다. `## 7` 의 하위섹션은 `7.1 / 7.2 / 7.3` 이어야 한다.
- **제안**: `## 7` 하위 섹션 번호를 `### 7.1 회수`, `### 7.2 추출`, `### 7.3 manual 회귀 불변식` 으로 정정한다.

### W-2 단일 추출(single-turn) watermark 가 `lastExtractionTurnSeq` 없이 호출되어 불완전성

- **위치**: `information-extractor.handler.ts` line ~585 (single-turn `scheduleMemoryExtraction` 호출)
- **상세**: single-turn `scheduleMemoryExtraction` 호출은 `lastExtractionTurnSeq` 파라미터를 전달하지 않는다(undefined). 이 경우 `prevWatermark = undefined` → `fresh = fullThread.turns` (전체) 로 동작해 의도는 정확하다. 그러나 spec `§7 §9.2` 는 "증분 watermark(`lastExtractionTurnSeq`)는 multi-turn state 로 운반되나, multi-turn 추출이 종결 1회라 실무상 전체 thread snapshot 한다" 고 명시해 single-turn 에는 watermark 자체가 없다고 설명한다. 코드는 spec 설명과 동작은 일치하지만, single-turn 경로에서 watermark 가 의미 없음을 표현하는 주석이 없어 이 `undefined` 가 의도인지 누락인지 판단하기 어렵다.
- **제안**: single-turn `scheduleMemoryExtraction` 호출부에 "single-turn 은 watermark 없음 — 전체 thread snapshot" 주석 추가.

### W-3 manual multi-turn 의 미래 push 가능성 대비 `conversationThreadRef` stateBase 미포함 처리 미비

- **위치**: `information-extractor.handler.ts` lines ~710–725 (stateBase persistent 분기)
- **상세**: C-1 이 "intentional" 방향(manual 은 push 안 함)으로 확정될 경우, stateBase 에 `conversationThreadRef` 가 persistent 전용으로만 포함된 설계는 명시적 의도의 표시가 충분하지 않다. 현재 `// (manual 이면 미사용)` 주석은 존재하지만, C-1 방향이 spec 과 정합되지 않음을 인지한 상태에서 코드를 그대로 두면 후속 작업자가 동일 이슈를 재발견할 위험이 있다.
- **제안**: C-1 해결 방향에 따라 주석 또는 코드를 갱신한다.

### W-4 `resolveMemoryStrategy` 기본값 전략 — `config.memoryStrategy` 가 `null` 일 때 `manual` 처리

- **위치**: `information-extractor.handler.ts` `resolveMemoryStrategy()` (line ~257)
- **상세**: `config.memoryStrategy === 'persistent' ? 'persistent' : 'manual'` 패턴은 `null` / `undefined` / 미설정 모두 `manual` 로 안전하게 폴백한다. 스키마 default 가 `'manual'` 이므로 정상 경로에서는 이슈가 없다. 단, `memoryStrategy: 'summary_buffer'` 가 직렬화된 이전 config(ai_agent 에서 복사된 경우)가 우연히 IE 에 주입된다면 `manual` 로 무음 폴백된다. 이는 요구사항상 summary_buffer 가 IE 에 없으므로 올바른 동작이나, 경고 로그 없이 silent fallback 하는 점이 디버깅을 어렵게 할 수 있다.
- **제안**: `memoryStrategy` 가 `'manual'` / `'persistent'` 외 값이면 warn 로그 후 `manual` 반환.

---

## INFO

### I-1 spec §7 §9.1 recall API 명세와 실제 서비스 호출 시그니처 미세 차이

- **위치**: `spec/4-nodes/3-ai/3-information-extractor.md §7 §9.1`, `information-extractor.handler.ts` line ~311
- **상세**: spec 은 `recall(workspaceId, scopeKey, queryText, {topK, threshold, embeddingModel})` 로 기술하지만, 실제 호출은 4번째 arg 에 `{llmConfigId, embeddingModel}`, 5번째 arg 에 `{topK, threshold}` 로 분리한다. 이는 `AgentMemoryService.recall` 의 실제 시그니처를 반영한 것이므로 구현 오류가 아니다. 그러나 spec 서술과 실제 파라미터 구조가 다르면 spec 을 보고 구현을 작성할 때 오해를 유발할 수 있다.
- **제안**: spec `§7 §9.1` 에 실제 호출 시그니처(`{llmConfigId, embeddingModel}` + `{topK, threshold}` 분리)를 반영하거나 `AgentMemoryService.recall` 참조를 명시한다.

### I-2 `memoryTtlDays` schema 의 `order: 14.5` — 소수점 order 값

- **위치**: `information-extractor.schema.ts` line ~202 (`order: 14.5`)
- **상세**: `order` 값이 14.5 로 소수점을 사용한다. 기능적으로 정렬에는 문제가 없으나 다른 필드들이 정수 order 를 사용한다. 일관성 우려이나 실제 기능 문제는 아니다.

### I-3 `embeddingModel` UI widget 이 `text` (리터럴 전용) — 의도적이나 문서화 추가 권장

- **위치**: `information-extractor.schema.ts` lines ~231–240 (NOTE 주석)
- **상세**: 스키마 코드에 설계 근거(`embeddingModel` 은 scope 불변식으로 동적 expression 사용 시 차원 불일치 위험)가 이미 상세히 주석되어 있다. spec `§7` 표에도 "정적 리터럴(text)" 설명이 없다. spec 에서 이 widget 선택 근거를 언급하면 spec 독자가 코드를 보지 않아도 이해할 수 있다.
- **제안**: spec `§7` config 표 `embeddingModel` 행에 "Expression 평가 아닌 정적 리터럴(`text` widget) — scope 저장 메모리와 임베딩 차원 일치 불변식 보호" 를 추가한다 (코드의 NOTE 주석을 spec 에 반영).

### I-4 plan 필드 스키마 항목 확인 — 7필드 일치

- **위치**: plan `memory-strategy-extend-ie.md`, `information-extractor.schema.ts`
- **상세**: plan 에서 요구하는 "IE schema memoryStrategy: manual|persistent + memory 7필드" — 실제 스키마에서 `memoryStrategy`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `embeddingModel`, `extractionModel` 7개 확인. 일치.

### I-5 spec section ordering 참조 변경 필요 — §8 캔버스 요약 → 기존 §7

- **위치**: `spec/4-nodes/3-ai/3-information-extractor.md` line ~691 (`## 8. 캔버스 요약`)
- **상세**: 캔버스 요약 섹션이 §7 → §8 로, Rationale 이 §8 → §9 로 번호가 올라갔다. 문서 내 외부 링크(예: 공통 `0-common.md` 의 캔버스 요약 표)가 이 섹션을 heading number 로 참조하는 경우 갱신 필요. 실제 기능 영향 없음.

---

## 요약

핵심 기능 구현은 plan 요구사항을 대부분 충족한다. `memoryStrategy: manual | persistent` enum (summary_buffer 없음), 7개 메모리 config 필드, recall 이 추출 LLM 콜 전 주입, extraction 이 thread push 직후 enqueue, multi-turn watermark 운반, text_classifier 미영향, 회귀 불변식 테스트 — 모두 확인됐다. 그러나 **C-1** 이 중요하다: spec `§4.2` 와 `conversation-thread.md §2.3` 은 multi-turn 종결 push 를 memoryStrategy 에 무관하게 선언하지만, 코드는 `persistent` 에서만 push 를 수행한다. manual 모드 multi-turn 에서 downstream contextScope 가시성이 spec 약속대로 제공되지 않는다. 이 불일치의 방향(spec 이 옳고 코드를 fix 해야 하는지, 또는 spec 텍스트를 `persistent` 한정으로 좁혀야 하는지)은 의도 명확화 후 해소가 필요하다. 추가로 spec §7 의 subsection 번호가 §9 와 중복되는 W-1 은 문서 앵커 충돌이다.

---

## 위험도

**HIGH** — C-1 (multi-turn push spec 위반) 이 해소되기 전 BLOCK 여부는 의도 확인 후 결정.

---

BLOCK: YES

STATUS: SUCCESS
