# 문서화(Documentation) 리뷰

## 발견사항

### [WARNING] `readExtractionWatermark` 구현 파일 JSDoc 미확인
- 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` (diff에 포함되지 않음)
- 상세: `readExtractionWatermark`는 `ai-turn-executor.ts`, `information-extractor.handler.ts`, `agent-memory-injection.spec.ts` 세 파일에서 신규 import·사용되는 공개 export 함수이다. 구현 파일 자체의 diff가 이번 changeset에 포함되지 않아 해당 함수에 JSDoc이 존재하는지 확인할 수 없다. 신 namespace 우선 + 구 평면 키 폴백(하위호환) 동작, 반환 타입, 파라미터 계약을 기술한 JSDoc이 없다면 차후 유지보수 시 동작 의도를 오해할 수 있다.
- 제안: `readExtractionWatermark` 구현에 최소한 다음 내용을 담은 JSDoc을 추가한다 — ① 신 `memoryState.lastExtractionTurnSeq` 우선 읽기, ② 구 평면 키 `lastExtractionTurnSeq` 폴백(I12 하위호환), ③ 두 경로 모두 부재 시 `undefined` 반환.

---

### [INFO] `saveMemories` options 객체 내 `workspaceId`·`scopeKey`·`items`·`embedCfgSource` 파라미터 JSDoc 부재
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, 새 options 객체 시그니처
- 상세: 리팩토링으로 positional 파라미터에서 options 객체로 전환되면서 `ttlDays`에만 인라인 JSDoc(`/** 양수면 INSERT/UPDATE 가 expires_at = now()+ttlDays ... */`)이 추가됐다. `workspaceId`, `scopeKey`, `items`, `embedCfgSource`는 메서드 레벨 JSDoc(기존 유지)에서 설명되지 않는 독립 파라미터로, options 객체 안에 인라인 설명이 없다. 메서드 레벨 JSDoc에 `@param` 절이 없는 현 구조에서는 각 필드의 의미·제약(예: `scopeKey` 형식, `embedCfgSource` 미설정 시 폴백 동작)을 코드 독자가 구현을 탐색해야만 파악할 수 있다.
- 제안: 최소한 `embedCfgSource`에는 "미설정 시 워크스페이스 기본 embedding config 폴백" 동작을 인라인 JSDoc으로 기술한다. `ttlDays`와 동일한 수준의 처리.

---

### [INFO] `memoryState` sub-namespace 상태 스키마 변경에 대한 중앙화된 문서 부재
- 위치: `_resumeState` 구조 전반 (`ai-turn-executor.ts`, `information-extractor.handler.ts`, `ai-agent.memory.spec.ts`)
- 상세: 이번 변경은 `_resumeState`의 `lastExtractionTurnSeq`(평면 키) → `memoryState.lastExtractionTurnSeq`(서브 네임스페이스)로의 스키마 마이그레이션(I12)이다. 각 파일의 인라인 주석에 변경 근거가 기술되어 있으나, `_resumeState` 전체 스키마를 단일 진실로 정의하는 spec 또는 convention 문서가 이번 변경에 반영됐는지 확인이 필요하다. 배포 중 in-flight 파킹 실행의 하위호환 폴백 전략도 외부 문서에 명시될 필요가 있다.
- 제안: `spec/5-system/17-agent-memory.md` 또는 관련 conversation-thread spec에 `_resumeState.memoryState` 서브 네임스페이스 도입과 폴백 전략이 기재됐는지 확인하고, 누락 시 보완한다.

---

### [INFO] 내부 리팩토링 태그(I3, I5, I-7, I12, W-8 등)에 대한 범례 부재
- 위치: 변경된 전 파일의 인라인 주석
- 상세: `I3`, `I5`, `I-7`, `I12`, `W-8` 등의 태그가 인라인 주석에 광범위하게 사용되나, 이를 해독할 수 있는 중앙화된 범례가 코드베이스 어디에 있는지 이번 changeset에서는 확인되지 않는다. 새 기여자나 리뷰어가 태그의 의미를 알려면 `plan/` 또는 `spec/` 내 대응 문서를 별도로 탐색해야 한다.
- 제안: `spec/conventions/` 또는 `plan/` 내 해당 리팩토링 계획 문서에서 태그 범례를 확인하고, 없다면 `I12 = watermark sub-namespace 마이그레이션` 등 한 줄 설명을 추가한다.

---

### [INFO] 제거된 이중 thread 읽기 주석의 명확한 삭제 처리
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`, 제거된 주석 블록
- 상세: 기존에 `getThreadExcludingNode`와 `getThread` 이중 호출이 "중복이 아니다"라고 설명했던 주석 블록이 제거됐다. 새 단일 읽기 경로에 대한 대체 설명은 코드 위에 명확히 기재되어 있어 정확도는 유지된다. 다만 기존 주석의 삭제 이유(W-8: I/O-backed 전환 대비 단일 읽기)가 새 주석에서 충분히 설명되고 있어 별도 조치는 불필요하다. 양호한 처리다.

---

### [INFO] `updateSummaryState`·`buildCosineMatch` 신규 메서드 JSDoc 충실
- 위치: `conversation-thread.service.ts`, `agent-memory.service.ts`
- 상세: `updateSummaryState`는 I-7 단일 변이 경로, Redis 직렬화 영속, DB 컬럼 없음, 캡슐화 근거가 JSDoc에 명확히 기술됐다. `buildCosineMatch`는 파라미터 순서 계약(`$1~$4`), 반환값(`scoreExpr`·`whereClause`), HNSW 인덱스 조건 일치 이유까지 포함한 comprehensive JSDoc을 제공한다. 모두 양호한 수준이다.

---

## 요약

이번 changeset은 `saveMemories` positional→options 객체 전환(I3), cosine 검색 절 빌더 단일화(I5), `updateSummaryState` 단일 변이 경로 도입(I-7), `memoryState` 서브 네임스페이스 마이그레이션(I12)으로 구성된 내부 리팩토링이다. 신규 공개 메서드(`updateSummaryState`, `buildCosineMatch`)에는 충실한 JSDoc이 제공되고, 인라인 주석도 변경된 코드와 잘 일치한다. 다만 `readExtractionWatermark` 구현 파일이 diff에 포함되지 않아 해당 함수의 JSDoc 존재 여부가 확인되지 않으며, `memoryState` 스키마 변경이 외부 spec 문서에 반영됐는지 별도 확인이 필요하다. 전반적인 문서화 수준은 이 프로젝트의 코드 주석 관행에 비추어 양호하다.

## 위험도

LOW

STATUS: SUCCESS
