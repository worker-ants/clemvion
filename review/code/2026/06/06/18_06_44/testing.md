# 테스트(Testing) 리뷰

## 발견사항

### [INFO] hnswEfSearchFor 단위 테스트 — 양수 0 및 음수 경계값 미커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.spec.ts` L73–88
- 상세: 현재 테스트는 NaN/Infinity 방어, 하한(40), 상한(1000), 정수 보장을 잘 커버한다. 다만 `limit=0` (LIMIT×2=0, 하한 clamp → 40)과 `limit=-1` (음수, Math.ceil(-1)=-1, -1×2=-2 < 40 → 40) 케이스가 없다. 함수는 `Number.isFinite` 만 가드하므로 0·음수는 코드상 정상 처리되지만(하한 40 반환), SET LOCAL 에 보간되는 값이 항상 양의 정수임을 보장하는 맥락에서 명시적 테스트가 있으면 더 완결성이 높다.
- 제안: `expect(hnswEfSearchFor(0)).toBe(40)`, `expect(hnswEfSearchFor(-5)).toBe(40)` 케이스를 "비정수·비유한 입력 방어" it 블록 또는 별도 it 에 추가.

### [INFO] hnswEfSearchFor 상수 노출 테스트 없음
- 위치: `dynamic-cut.util.spec.ts` L66–70 ("상수 기본값 노출" 블록)
- 상세: `RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT` 는 상수 값을 pin 하는 테스트가 있다. 그러나 `HNSW_EF_SEARCH_DEFAULT`(40)·`HNSW_EF_SEARCH_MAX`(1000) 는 export 되어 있음에도 상수 pin 테스트가 없다. 이 두 값은 hnswEfSearchFor 의 clamp 경계를 결정하고 SQL 보간 안전성의 근거이므로, 실수로 값이 바뀌었을 때 즉시 회귀로 잡힐 수 있도록 pin 해 두는 것이 권장된다.
- 제안: 기존 "상수 기본값 노출" it 블록에 `expect(HNSW_EF_SEARCH_DEFAULT).toBe(40)`, `expect(HNSW_EF_SEARCH_MAX).toBe(1000)` 추가. `HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX` 도 import 목록에 포함 필요.

### [INFO] off 경로 ef_search 테스트 — mockDataSource.query 두 번째 mock 순서 주석과 실제 동작 간 미묘한 괴리
- 위치: `rag-search.service.spec.ts` L386–402
- 상세: 해당 테스트는 `mockDataSource.query.mockResolvedValueOnce([])` 를 "recall 0건 (em.query 위임)"으로 주석 처리했다. 그러나 `mockEm.query` 는 SET LOCAL이 아닌 SQL을 `mockDataSource.query(sql, params)` 로 위임하므로, recall SQL 결과는 실제로 이 두 번째 `mockResolvedValueOnce([])` 에서 온다. 동작 자체는 올바르나, 주석이 "em.query 위임"이라고만 서술해 recall 결과가 왜 `mockDataSource.query` 에서 소비되는지를 처음 읽는 사람이 오해할 수 있다. recall 결과가 0건인 케이스 자체는 ef_search 순서 단언에 충분하지만, 다른 테스트 케이스에서는 recall 결과가 있어야 후속 로직까지 검증할 수 있다.
- 제안: 주석을 "recall SELECT → em.query 위임 → mockDataSource.query[1] 소비 → 0건 반환" 으로 명확화. 기능적 문제는 아니므로 INFO.

### [INFO] ef_search 상향 후 graph 경로 트랜잭션 미호출 단언 — seedTopK 40 이상 시나리오 테스트 없음
- 위치: `rag-search.service.spec.ts` L455–456
- 상세: graph 경로에서 `expect(mockDataSource.transaction).not.toHaveBeenCalled()` 단언이 추가됐다. 이 단언은 seedTopK 기본값(5) < HNSW_EF_SEARCH_DEFAULT(40) 시 ef_search 상향 불필요 조건을 검증한다. 코드 주석(`dynamic-cut.util.ts` L281–282)에 "seedTopK 를 40 초과로 설정하는 시나리오를 지원하면 hnswEfSearchFor(seedTopK) 적용을 재검토한다"고 명시돼 있어 의도적 미구현이다. 다만 해당 분기에 대한 테스트가 전혀 없어, 미래에 seedTopK가 40을 초과해도 ef_search 미상향이라는 사실이 회귀로 잡히지 않는다.
- 제안: 현재 범위에서는 INFO 수준 처리로 충분. seedTopK≥40 시나리오 지원 여부가 확정될 때 해당 분기 테스트 추가를 함께 검토할 것.

### [INFO] rerank ef_search 테스트 — setLocal 단언에 non-null assertion(!) 사용
- 위치: `rag-search.service.spec.ts` L576–579
- 상세: `const setLocal = mockEm.query.mock.calls.find(...)` 후 `setLocal![0]` 로 non-null assertion을 사용한다. `setLocal` 가 undefined이면(즉 SET LOCAL 호출이 없으면) TypeScript 런타임에서 `Cannot read properties of undefined` 에러가 발생해 테스트가 실패한다. 기능적으로는 실패가 명확히 드러나지만, assertion 의도(SET LOCAL이 호출됐음을 먼저 단언)를 명시적으로 표현하면 실패 메시지가 더 직관적이다.
- 제안: `expect(setLocal).toBeDefined()` 를 `setLocal![0]` 사용 전에 삽입하면 undefined 시 "Expected undefined to be defined" 라는 명확한 메시지를 얻을 수 있다.

### [INFO] e2e 테스트 llm-config 정식 경로 커버 — 생성 API 응답 body 타입 단언
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L339
- 상세: `(llmCreateRes.body.data as { id: string }).id` 패턴은 기존 코드 전체에서 반복되는 관용구이며 신규 변경이 이를 답습한 것이다. 기능에는 문제없다. 유지보수성 리뷰에서도 언급된 패턴으로 여기서는 테스트 관점에서만 확인: `expect(llmConfigId).toBeDefined()` 단언이 실제로 id 의 shape을 검증하지 않으므로, `llmCreateRes.body.data.id` 가 string 이 아닌 값으로 반환될 경우 후속 테스트 단계에서 간접 실패한다. 명시적 shape 단언(`expect(typeof llmConfigId).toBe('string')`)을 추가하면 더 조기에 실패를 잡는다.
- 제안: `expect(llmConfigId).toBeDefined()` 다음 줄에 `expect(typeof llmConfigId).toBe('string')` 추가. 선택사항.

### [INFO] e2e 테스트 ENCRYPTION_KEY 교정 — 다른 e2e suite 에 대한 AES-256 경로 회귀 단언 없음
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 전체, `docker-compose.e2e.yml`
- 상세: ENCRYPTION_KEY 64-hex 교정이 dockerized 전 suite 176 pass 로 무회귀 확인됐다는 것은 RESOLUTION.md W4 에 기술돼 있다. e2e 레벨에서의 회귀 증거는 충분하다. 단, `POST /api/llm-configs` 경로를 커버하는 테스트가 `execution-park-resume.e2e-spec.ts` 단독이어서, llm-config CRUD 의 다른 경로(수정/삭제/조회)에 대한 전용 e2e 테스트가 별도로 있는지 확인이 필요할 수 있다. 현재 변경 범위에서는 INFO.
- 제안: 현재 범위 외. llm-config API의 전용 e2e 스펙 존재 여부를 별도 확인 권장.

## 요약

이번 변경의 테스트 품질은 전반적으로 우수하다. `hnswEfSearchFor` 유닛 테스트는 LIMIT×2 clamp 로직, 비정수 입력(ceil), NaN/Infinity 방어를 모두 커버한다. `rag-search.service.spec.ts` 는 `mockEm` 트랜잭션 래핑 패턴을 도입해 기존 mock 구조를 최소한으로 변경하면서 SET LOCAL 호출 순서와 ef_search 값을 명시적으로 단언하고, graph 경로에서 트랜잭션 미호출을 음성 단언으로 검증한다. e2e 레벨에서는 DB 직접 insert 우회를 정식 API 경로로 교체해 암호화 경로까지 실제 커버한다. 개선 여지는 소소하다: HNSW 상수 pin 테스트 부재, 0·음수 limit 경계값 미커버, rerank ef_search 단언의 non-null assertion 방어 명시성이 주요 INFO 항목이다. Critical·Warning 수준의 테스트 갭은 없다.

## 위험도

LOW
