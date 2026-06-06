# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `hnswEfSearchFor` 함수 — 단일 책임, 간결, 명확. 이상 없음
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L92-98
- 상세: 함수 본체가 3줄이며, 상수 2개(`HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`)가 매직 넘버를 완전히 제거한다. JSDoc 이 반환 범위·정수 보장·SET LOCAL 보간 안전성 근거까지 명시해 의도 전달이 충분하다.
- 제안: 없음.

### [INFO] 상수 네이밍 일관성 — 기존 `RAG_*` prefix 와 신규 `HNSW_*` prefix 혼용
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L81-82
- 상세: 기존 `RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT` 는 `RAG_` prefix 를 쓰고, 신규 `HNSW_EF_SEARCH_DEFAULT`·`HNSW_EF_SEARCH_MAX` 는 `HNSW_` prefix 를 사용한다. 두 prefix 는 서로 다른 기술 도메인(RAG 레이어 vs pgvector HNSW)을 반영하므로 혼용이 의도적이고 적절하다. 동일 파일에 이질 도메인 상수가 공존하는 것이 장기적으로 파일 응집도를 낮출 수 있으나 현 규모에서는 허용 범위다.
- 제안: 추후 pgvector 관련 상수가 늘어나면 `pgvector.const.ts` 또는 `hnsw.const.ts` 로 분리를 검토한다. 현 시점은 INFO 수준.

### [INFO] 테스트 설명 혼용어 — 한국어/영어 혼재
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.spec.ts` L44-57
- 상세: `describe('hnswEfSearchFor', ...)` 블록 내 `it` 설명은 한국어("LIMIT×2 에 기본 40 하한·1000 상한 clamp", "비정수·비유한 입력 방어")로 작성돼 있다. 동일 파일의 기존 `describe('applyDynamicCut', ...)` 도 같은 한국어 스타일을 따르므로 프로젝트 내 일관성은 유지된다.
- 제안: 없음 (기존 컨벤션 준수).

### [WARNING] `rag-search.service.spec.ts` — `mockEm` mock 람다가 `mockDataSource.query` 를 직접 위임하는 방식의 결합도
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` L134-140
- 상세: `mockEm.query` 가 `/^\s*SET LOCAL/i` 여부를 정규식으로 분기해 `mockDataSource.query` 로 포워딩하는 인라인 람다가 `beforeEach` 에 삽입됐다. 이 패턴은 기능적으로 올바르나 다음 두 가지 유지보수 위험이 있다. (1) 실제 구현에서 `SET LOCAL` SQL 포맷이 바뀌면(예: 대소문자, 공백) 정규식이 무음(silent) 실패해 mock 이 올바른 동작을 하지 않아도 테스트가 통과할 수 있다. (2) 이 mock 람다가 `searchVectorGroup` 에 특화된 것임이 `beforeEach` 수준에서 명시적이지 않아, 향후 다른 SQL 패턴이 추가될 때 동일 `mockEm` 을 재사용하면 예상치 못한 포워딩이 발생할 수 있다.
- 제안: 정규식을 명명 상수로 추출하거나(`const SET_LOCAL_PATTERN = /^\s*SET LOCAL/i`), mock 람다에 "이 포워딩은 HNSW ef_search SET LOCAL 전용" 임을 인라인 주석으로 보강한다. 또는 `mockEm` 을 `beforeEach` 대신 해당 `it` 블록 내 지역 변수로 한정해 영향 범위를 명확히 한다.

### [INFO] `rag-search.service.spec.ts` — `setLocal!` non-null 단언(`!`) 사용
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` L215
- 상세: `expect(setLocal![0]).toContain(...)` 에서 `!` non-null 단언을 사용한다. `setLocal` 이 `undefined` 이면 `![0]` 접근이 런타임 오류를 내는 대신 타입 오류를 숨긴다. 동일 테스트 블록에서 `setLocal` 이 `undefined` 일 때 Jest 에러 메시지가 직관적이지 않을 수 있다.
- 제안: `expect(setLocal).toBeDefined()` 를 `!` 접근 앞에 명시적으로 추가하거나, `expect(setLocal?.[0]).toContain(...)` + 별도 `expect(setLocal).not.toBeUndefined()` 를 사용해 실패 시 명확한 메시지를 얻는다.

### [INFO] `rag-search.service.ts` — 인라인 블록 주석 길이가 길어 가독성 저하
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L250-256
- 상세: 변경된 코드 앞에 7줄짜리 블록 주석이 삽입됐다. 내용(recall 보전 배경, SET LOCAL 트랜잭션 스코프, 정수 보장 근거)은 모두 가치 있으나, 주석이 코드 실행 흐름을 가리는 수준으로 길다. 핵심인 `hnswEfSearchFor` JSDoc 에 이미 동일 내용이 있어 중복이 발생한다.
- 제안: 서비스 구현 쪽 인라인 주석을 "(§3.4 ef_search recall 보전 — 상세는 `hnswEfSearchFor` JSDoc 참조)" 1~2줄로 압축하고, spec 링크만 유지한다. 기술 근거는 util 함수 JSDoc 에 단일 진실로 남긴다.

### [INFO] `execution-park-resume.e2e-spec.ts` — 타입 단언 `as { id: string }` 신규 추가
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff L68 (`(llmCreateRes.body.data as { id: string }).id`)
- 상세: 이 패턴은 기존 파일 전체에서 이미 반복되고 있으며(기존 리뷰 17_27_54 에서도 동일 INFO 제기됨), 신규 diff 가 기존 패턴을 따른 것이다. 유지보수 관점에서 공유 응답 타입(`interface ApiResponse<T> { data: T }`)을 helpers 에 두면 분산된 타입 단언을 일원화할 수 있다.
- 제안: 현 PR 범위에서 강제 사항은 아님. 리팩터링 단계에서 `test/helpers/` 에 공유 타입 도입 고려.

### [INFO] `docker-compose.e2e.yml` — 두 암호화 키의 길이 차이로 인한 가독성 저하
- 위치: `docker-compose.e2e.yml` L368-371 (diff 기준)
- 상세: `ENCRYPTION_KEY`(64-hex=32B)와 `INTEGRATION_ENCRYPTION_KEY`(32-char=16B)가 나란히 있어 의도적인 길이 차이임을 주석 없이 파악하기 어렵다. 변경된 diff 에서 주석 4줄이 이 차이를 충분히 설명하고 있어 현 수준에서는 양호하다.
- 제안: 없음 (주석 충분).

### [INFO] plan 파일(`rag-followup-efsearch.md`) — 체크리스트 항목 2~4가 미완료 상태로 커밋
- 위치: `plan/in-progress/rag-followup-efsearch.md` L24-27
- 상세: 체크리스트 `[ ] 2. TEST WORKFLOW`, `[ ] 3. /ai-review + fix`, `[ ] 4. push + PR` 이 미완료(unchecked) 상태다. 본 리뷰 자체가 단계 3의 일부이므로 이 시점에 미완료 상태는 자연스럽다. plan 파일이 작업 진행 중 진실을 반영하고 있다.
- 제안: 없음 (정상 상태).

---

## 요약

이번 변경의 핵심 코드(`hnswEfSearchFor` 유틸 함수 + 상수 2개)는 유지보수성이 매우 우수하다. 함수가 3줄로 단일 책임을 가지고, 매직 넘버가 전혀 없으며, JSDoc 이 안전성 근거까지 설명한다. 테스트 코드(`dynamic-cut.util.spec.ts`)는 경계값 케이스를 명확히 열거해 의도가 잘 드러난다. 서비스 코드(`rag-search.service.ts`)의 7줄짜리 인라인 주석은 내용이 가치 있으나 `hnswEfSearchFor` JSDoc 과 중복되므로 압축을 권장한다. 통합 테스트(`rag-search.service.spec.ts`)의 `mockEm` 람다는 `SET LOCAL` 정규식 분기 로직이 묵시적 결합을 만들어 향후 SQL 포맷 변경 시 무음 실패 위험이 있으며, non-null 단언(`!`) 사용도 테스트 실패 진단성을 낮춘다. e2e 파일은 기존부터 존재하는 타입 단언 반복 패턴을 따랐으므로 신규 도입이 아니다. 전반적으로 유지보수성 위험은 낮고, 지적 사항 대부분이 INFO 수준이다.

## 위험도

LOW
