# 보안(Security) 리뷰

## 발견사항

### [INFO] buildCosineMatch — dim 값의 SQL 직접 보간
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` private 메서드
- 상세: `dim` 값이 SQL 문자열에 직접 보간된다(`vector_dims(am.embedding) = ${dim}`, `${cast}(${dim})`). `dim` 은 `queryEmbedding.length`(JavaScript 배열의 `.length`, 항상 양의 정수)에서 유래하므로 SQL 인젝션 문자를 포함할 수 없어 실질 위험은 없다. `findSimilarFact` 경로에서는 `SUPPORTED_EMBEDDING_DIMS.has(dim)` 화이트리스트 검사가 선행되며, `recall` 경로에서도 `dim` 은 숫자 리터럴이다. 현재 코드는 안전하다.
- 제안: 방어 심층화를 원한다면 `buildCosineMatch` 내부에 `if (!Number.isInteger(dim) || dim <= 0) throw new Error(...)` assertion 을 추가하면 화이트리스트 검사를 우회하는 미래 경로에도 보호가 적용된다. 현재 위험도는 없음.

### [INFO] 벡터 문자열 구성 — 숫자 배열의 문자열 보간
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `recall`, `findSimilarFact` 메서드 내 `vectorStr = \`[${queryEmbedding.join(',')}]\``
- 상세: 이 변경은 신규가 아닌 기존 패턴이나 리뷰 대상 경로에 포함된다. `queryEmbedding` 은 LLM 임베딩 서비스가 반환한 `number[]` 타입이므로 `.join(',')` 결과는 부동소수점 숫자와 쉼표만 포함한다. 파라미터 바인딩(`$1`)으로 전달되므로 SQL 인젝션 위험 없음.
- 제안: 없음. 현재 구조 안전.

### [INFO] memoryState spread — 신뢰되지 않은 소스에서 오는 경우 키 오염 가능성
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — watermark 영속 spread 블록
- 상세: 기존 `state.memoryState`(타입: `unknown`, `as Record<string, unknown>` 캐스트)를 신규 `memoryState` 객체에 spread 한다. `state` 가 외부 HTTP 요청 페이로드나 사용자 조작 가능한 소스에서 오는 경우 의도치 않은 키가 `memoryState` 에 전파될 수 있다. 그러나 `_resumeState` 는 서버 내부에서 직렬화·역직렬화되는 세션 상태로 신뢰 경계 내부에 있으며, 사용자가 직접 조작하기 어렵다. 실질 위험도는 낮다.
- 제안: `memoryState` 구성 시 spread 이후 명시적으로 허용된 키만 pick 하는 방식(`{ lastExtractionTurnSeq: ... }` 만 포함)이 더 명시적이나 현재도 기능적 위험은 없다.

### [INFO] 간접 프롬프트 인젝션 — 회수 메모리/요약의 시스템 프롬프트 삽입 (기존 한계)
- 위치: 전체 메모리 recall/summary 삽입 경로
- 상세: 이번 변경은 직접적으로 프롬프트 주입 경로를 추가하거나 변경하지 않는다. 기존에 문서화된 구조적 한계(W-2)로, DATA_FENCE 완화책이 적용 중이다. 본 리뷰 대상 diff 와 무관.
- 제안: 없음. 기존 로드맵 항목으로 처리 중.

### [INFO] hydrateState 내 타입 캐스트 — 입력 검증 없는 as 캐스트
- 위치: `/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `hydrateState` 메서드
- 상세: `raw.model as string`, `raw.llmConfigId as string | undefined` 등의 캐스트는 이번 변경(I12 신규 추가 `readExtractionWatermark`)과 별개로 기존부터 존재하던 패턴이다. `readExtractionWatermark` 자체는 `typeof ns.lastExtractionTurnSeq === 'number'` 런타임 타입 검사를 사용하므로 신규로 추가된 코드는 안전하다. 기존 캐스트 패턴의 위험은 이번 변경과 무관.
- 제안: 장기적으로 Zod 등 런타임 스키마 검증 도입을 검토할 수 있으나 이번 PR 범위 밖.

---

## 요약

이번 변경(Batch 2)은 `saveMemories` API 시그니처 옵션 객체화(I3), cosine SQL WHERE 빌더 추출(I5), `updateSummaryState` 단일 변이 경로(I-7), `memoryState` sub-namespace 마이그레이션(I12)으로 구성된 내부 리팩토링이다. 하드코딩된 시크릿, 신규 인증/인가 경로 변경, 안전하지 않은 암호화 알고리즘 사용은 없다. SQL 쿼리에서 `dim` 값이 직접 보간되나 JavaScript `.length` 속성이 항상 정수를 반환하므로 인젝션 불가능하다. `readExtractionWatermark` 는 `typeof === 'number'` 런타임 타입 검사를 일관되게 사용해 타입 강제 공격에 안전하다. 신규 에러 메시지에 민감 정보 노출 없음. 외부 입력 새니타이징 변경 없음. 전반적으로 보안 관점의 취약점 유입이 없는 안전한 리팩토링이다.

## 위험도

LOW

STATUS: SUCCESS
