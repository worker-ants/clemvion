# Documentation Review

## 발견사항

### [INFO] `AgentMemoryExtractionProcessor` 클래스 JSDoc — AGM-10/11 신규 동작 미반영
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` L836-847 (클래스 수준 JSDoc)
- 상세: 클래스 JSDoc 의 3단계 목록 (`1. transcript 렌더 → 2. JSON 배열 파싱 → 3. saveMemories`) 은 변경 전 동작 기준이다. 이번 변경으로 (a) `parseExtractionResponse` 반환 타입이 `string[]` → `ExtractedItem[]` 로 바뀌고, (b) `ttlDays` 가 `saveMemories` 5번째 인자로 추가됐다. 현재 JSDoc 은 이 두 가지를 언급하지 않아 "JSON 배열 파싱" 설명이 여전히 문자열 배열을 암시한다.
- 제안: 3번 단계를 "JSON `{content, kind}` 배열 파싱 (문자열 shape 하위호환)" 으로 수정하고, TTL 전달 흐름(`ttlDays → saveMemories`) 을 한 줄 추가.

### [INFO] `findSimilarInBatch` private 메서드 JSDoc — 한 줄 요약만 존재
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L467
- 상세: `/** batch 내 직전 처리한 fact 중 cosine 유사도 ≥ 임계치인 row id (AGM-09). */` 한 줄 주석만 있다. 파라미터(`seen` 배열의 의미)와 반환값(null = 미발견) 설명이 없어 `findSimilarFact` 와의 역할 분담이 독스트링만으로는 구별되지 않는다.
- 제안: `@param seen` 과 `@returns` 을 추가하거나, 현재 한 줄 요약에 "DB 조회 없이 in-memory 비교" 임을 명시.

### [INFO] `insertMemory` / `updateMemory` private 메서드 — `expiresAtSql` 파라미터 문서 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L482-530
- 상세: `insertMemory` 와 `updateMemory` 의 한 줄 JSDoc(`/** 단일 fact INSERT ... */`, `/** 유사 기존 fact 를 최신 content ... */`)은 파라미터 목록을 나열하지 않는다. 특히 `expiresAtSql: string | null` 파라미터는 "SQL 리터럴" 임을 알아야 하는 특이한 타입이라 설명이 필요하다.
- 제안: `expiresAtSql` 파라미터에 `@param expiresAtSql SQL 절대시각 리터럴 또는 null (무만료)` 주석 추가.

### [INFO] `EXTRACTION_SYSTEM_PROMPT` 상수 — JSDoc 가 v1 동작을 묘사
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` L1312-1316 (전체 파일 컨텍스트 L1312)
- 상세: `EXTRACTION_SYSTEM_PROMPT` 위 JSDoc 은 "간결한 문장 목록(JSON 배열)으로 뽑게 한다" 고 적혀 있다. 이번 변경으로 LLM 은 `{content, kind}` 객체 배열을 반환하도록 프롬프트가 바뀌었으나, JSDoc 은 여전히 "문장 목록"·"문자열들의 배열" 을 암시하는 v1 설명을 유지한다.
- 제안: JSDoc 을 "`{content, kind}` 객체 배열을 반환하게 한다" 로 수정.

### [INFO] `ai-agent.handler.ts` `scheduleMemoryExtraction` — 반환 타입 변경 미문서화
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- 상세: `scheduleMemoryExtraction` 메서드 시그니처가 `Promise<void>` → `Promise<number | undefined>` 로 변경됐다. 메서드 수준 JSDoc 이 없어 반환값(`새 watermark seq 또는 undefined`) 의 의미를 주석 없이는 호출부 코드에서 추론해야 한다. 반환값의 의미·용도(`_resumeState.lastExtractionTurnSeq` 로 영속) 는 인라인 주석으로만 설명되고 있다.
- 제안: 메서드에 JSDoc 추가. 최소한 `@returns 새 watermark seq (undefined = 추출 skip 또는 non-persistent)` 한 줄 추가.

### [INFO] `resolveMemoryTtlDays` private 메서드 — 경계값 정책이 JSDoc 에만 있고 스키마 힌트와 불일치 가능성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1514-1527
- 상세: JSDoc 에 "0/음수/비숫자는 무만료" 라고 명시돼 있다. 그런데 `ai-agent.schema.ts` 의 `memoryTtlDays` Zod 스키마는 `.positive()` 로 0 이상을 막는다. 스키마 수준의 유효성 검사와 핸들러의 방어 코드가 중복·분산돼 있어 어느 쪽이 진실인지 혼동을 줄 수 있다. JSDoc 에 "스키마에서 이미 양수만 허용하지만 방어적으로 검사" 임을 명시하면 중복이 아닌 의도적 이중 방어임을 전달할 수 있다.
- 제안: JSDoc 에 "스키마 레벨에서 `.positive()` 로 보장되나 런타임 방어 코드로 이중 검사" 한 줄 추가.

### [INFO] `spec/5-system/17-agent-memory.md` §6 로드맵 — "v1" 참조 텍스트 잔류
- 위치: `/Volumes/project/private/clemvion/spec/5-system/17-agent-memory.md` §6 (diff `+**실현됨 (v2)**` 직전 텍스트)
- 상세: diff 에서 `- **TTL 기반 만료는 v2 로드맵.**` 문구가 제거됐다. 그러나 §4 본문의 기존 서술에 "TTL 기반 만료는 v2 ([Spec Agent Memory §forgetting])" 표현이 남아 있을 가능성이 있다(제거 diff 에 해당 줄이 포함돼 있어 이번 변경에서 정리됐을 가능성도 있음). 이 항목은 diff 상 정리된 것으로 확인되므로 낮은 위험도.
- 제안: 최종 파일에서 "v2 로드맵" 또는 "v2 로 보류" 잔류 표현이 없는지 교차 확인.

### [INFO] 한국어/영어 문서 대칭 — `ai.en.mdx` 와 `ai.mdx` 동기화 상태 양호
- 위치: `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx`, `ai.mdx`
- 상세: `memoryTtlDays` 필드가 두 파일 모두 FieldTable 과 본문 설명에 동시에 추가됐고, 영문/한국어 설명이 의미상 일치한다. 양 언어 문서가 대칭적으로 업데이트된 것은 긍정적.
- 제안: 없음 (이미 양호).

### [INFO] `MEMORY_KINDS` 내부 Set — 외부 문서(JSDoc) 에서 허용값 목록 중복 열거
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` L1144-1148
- 상세: `MemoryKind` 타입과 `MEMORY_KINDS` Set 이 각각 허용값(`fact/preference/entity`)을 독립적으로 선언한다. JSDoc 과 타입 리터럴 두 곳에서 동일 목록을 열거하고 있어, 향후 kind 를 추가할 때 3곳(타입·Set·JSDoc)을 모두 수정해야 하는 위험이 있다.
- 제안: Set 을 `new Set<MemoryKind>(['fact', 'preference', 'entity'])` 로 바꿔 타입을 단일 진실로 삼고 JSDoc 에서는 타입만 참조하도록 정리 (기능 변경 없는 문서/타입 정합 개선).

---

## 요약

이번 변경은 persistent 메모리의 증분 추출(AGM-08), 의미기반 dedup(AGM-09), TTL 만료(AGM-10), 추출 분류(AGM-11) 네 기능을 한 번에 도입한 대형 PR 이다. 문서화 측면에서 spec(`17-agent-memory.md`, `1-data-model.md`, `1-ai-agent.md`), 사용자 대면 문서(`ai.mdx`, `ai.en.mdx`), 플랜 파일(`ai-context-memory-followup-v2.md`), i18n 레이블까지 동시에 갱신됐고 전반적으로 완성도가 높다. 발견된 이슈는 모두 INFO 수준으로, 주로 (1) 변경된 반환 타입·파라미터가 기존 JSDoc 에 미반영된 부분, (2) 내부 private 메서드의 파라미터 문서 미비, (3) 타입과 JSDoc 간 목록 중복 등 유지보수성 개선 수준의 사항이다. CRITICAL 이나 WARNING 에 해당하는 공개 API 문서 누락이나 오해를 유발하는 오래된 주석은 없다.

## 위험도

LOW
