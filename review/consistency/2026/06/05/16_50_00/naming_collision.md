# 신규 식별자 충돌 검토 — memory-strategy-extend-ie (diff 21fa8194..HEAD)

검토 범위: `git diff 21fa8194..HEAD` 내 변경된 파일만. diff 밖 귀속 없음.

---

## 발견사항

### INFO: IE memoryStrategy 필드 — ai_agent 와 동일 이름, 의도적 공유 확인

- target 신규 식별자: `memoryStrategy` (IE schema, `information-extractor.schema.ts` line ~143)
- 기존 사용처: `ai_agent` schema (`ai-agent.schema.ts` line 419), `conversation-context-schema.ts` 주석 전반, `spec/4-nodes/3-ai/0-common.md §10`
- 상세: `memoryStrategy` 는 ai_agent 에서 `manual | summary_buffer | persistent` 3값이고, IE 에서 `manual | persistent` 2값으로 enum 범위가 다르다. 동일 필드명을 의도적으로 공유하는 것은 `0-common.md §10` 및 `conversation-context-schema.ts` 의 `gateOnManualMemoryStrategy` 옵션 설계가 입증한다 — "동일 이름, 다른 enum 집합"이 설계 의도임이 spec 에 명시됐다. 충돌 아님.
- 제안: 없음 (의도적 부분집합 공유).

---

### INFO: IE memoryKey / memoryTopK / memoryThreshold / memoryTtlDays / embeddingModel / extractionModel — ai_agent 와 동일 이름, 의도적 공유 확인

- target 신규 식별자: 위 6개 필드 (IE schema, lines ~165–228)
- 기존 사용처: ai_agent schema (`ai-agent.schema.ts` lines 465, 479, 494, 507, 522, 563), frontend i18n `backend-labels.ts` lines 51, 102, 104, 105, 107
- 상세: 6개 필드 모두 ai_agent 에 동일 이름·동일 의미로 이미 존재한다. IE 가 같은 이름으로 같은 의미를 사용하는 것은 `17-agent-memory.md` §2의 "같은 scope key 규칙" 및 `0-common.md §10` 의 설계 의도다. 프론트엔드 i18n 레이블(`Memory Key`, `Memory Top-K` 등)은 이미 등록돼 있어 IE 가 추가 등록 없이 재사용한다. 충돌 없음.
- 제안: 없음.

---

### INFO: IE handler 신규 private 메서드 — resolveMemoryStrategy / resolveMemoryTtlDays / scheduleMemoryExtraction / injectRecallPrefix / pushExtractorTurnTo

- target 신규 식별자: 5개 private 메서드 (`information-extractor.handler.ts` lines 267, 418, 356, 283, 239)
- 기존 사용처:
  - `resolveMemoryStrategy`: ai_agent handler line 665 (동일 이름, 동일 의미)
  - `resolveMemoryTtlDays`: ai_agent handler line 1039 (동일 이름, 동일 의미)
  - `scheduleMemoryExtraction`: ai_agent handler line 950 (동일 이름, 동일 의미)
  - `injectRecallPrefix`: ai_agent에는 없음 — ai_agent는 `injectMemoryContext`(더 넓은 역할) 사용. IE는 recall만 담당하므로 이름을 분리한 것이 적절.
  - `pushExtractorTurnTo`: IE handler 내 새 private variant; 기존 `pushExtractorTurn`을 내부 위임으로 재구성.
- 상세: 세 메서드(`resolveMemoryStrategy`, `resolveMemoryTtlDays`, `scheduleMemoryExtraction`)는 ai_agent handler와 동명이나 각각 별개 클래스(`AiAgentHandler` vs `InformationExtractorHandler`)의 private 메서드이므로 TypeScript 네임스페이스 충돌은 없다. 의미도 동일하게 설계됐고 구현 패턴도 의도적 모방이다(`ai_agent scheduleMemoryExtraction 모방` 주석). 충돌 아님.
- 제안: 없음.

---

### INFO: MultiTurnState 신규 필드 — memoryStrategy / conversationThreadRef / executionId / nodeId / memoryConfig / lastExtractionTurnSeq

- target 신규 식별자: IE handler `MultiTurnState` interface의 6개 신규 필드 (lines 137, 145, 151, 153, 154, 160)
- 기존 사용처:
  - `conversationThreadRef`: ai_agent handler line 587, execution-engine.service.ts line 4442 (동일 패턴 — ai_agent state에서 같은 필드명으로 같은 목적)
  - `lastExtractionTurnSeq`: ai_agent handler line 962 (동일 패턴)
  - `executionId`, `nodeId`: execution-engine.service.ts에서 context 필드로 폭넓게 사용되나, 여기서는 `MultiTurnState` 인터페이스 내 필드이므로 namespace 분리됨
  - `memoryStrategy`, `memoryConfig`: IE state에만 신규
- 상세: IE의 `MultiTurnState`는 `interface MultiTurnState` (line 99)로 IE handler 모듈 내부에 국한된 로컬 타입이다. ai_agent의 상태 필드명과 동명이지만 별개 타입으로 TypeScript 충돌 없음. `conversationThreadRef`와 `lastExtractionTurnSeq`는 ai_agent 패턴을 그대로 재사용하는 것이 `spec/5-system/17-agent-memory.md` §3·§4의 설계 의도다. 충돌 없음.
- 제안: 없음.

---

### INFO: plan 파일명 — memory-strategy-extend-ie.md

- target 신규 식별자: `plan/in-progress/memory-strategy-extend-ie.md`
- 기존 사용처: `plan/complete/memory-autoinject-extend.md`, `plan/complete/ai-context-memory-auto.md`, `plan/in-progress/ai-context-memory-followup-v2.md` 등 유사 접두사 파일 다수
- 상세: `memory-strategy-extend-ie`는 기존 plan 파일과 이름이 겹치지 않는다. `memory-autoinject-extend`(완료)와 전반부가 비슷하지만 명확히 다른 슬러그. plan frontmatter의 `worktree: memory-strategy-extend-ad5987`도 현재 worktree와 일치한다.
- 제안: 없음.

---

### INFO: i18n hint 키 분리 — "manual = manage context ... persistent = cross-session recall + extraction."

- target 신규 식별자: `backend-labels.ts` HINT_KO 키 `"manual = manage context with the fields below. persistent = cross-session recall + extraction."` (line 227)
- 기존 사용처: 기존 키 `"manual = manage context with the fields below. summary_buffer = rolling token-budget summary. persistent = summary buffer + cross-session recall."` (line 224, ai_agent 전용)
- 상세: IE는 `summary_buffer`가 없으므로 hint 문자열을 분리해 별도 키로 등록했다. 두 키는 문자열이 달라 사전 충돌 없음. `OPTION_LABEL_KO`의 `"Persistent — cross-session memory recall + extraction"` 도 기존 `"Persistent — summary buffer + cross-session memory"`와 명확히 다른 키다.
- 제안: 없음.

---

## 요약

diff 범위 내에서 IE가 도입하는 모든 신규 식별자(`memoryStrategy`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `embeddingModel`, `extractionModel`, `resolveMemoryStrategy`, `resolveMemoryTtlDays`, `scheduleMemoryExtraction`, `injectRecallPrefix`, `pushExtractorTurnTo`, `MultiTurnState` 신규 필드 6개, plan 파일명, i18n 키)는 충돌이 없다. ai_agent와 동명인 필드·메서드는 의도적 의미 공유로 spec과 코드 주석에 명시됐으며, 모두 별개 클래스 또는 별개 타입 내부의 private/local 식별자라 TypeScript 네임스페이스 관점에서도 충돌하지 않는다. 비슷한 이름으로 혼동을 유발할 소지도 코드 주석("ai_agent 패턴 모방")과 spec 단일진실 링크로 충분히 문서화돼 있다.

## 위험도

NONE

---

BLOCK: NO
