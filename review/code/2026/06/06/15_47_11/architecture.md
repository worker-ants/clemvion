# 아키텍처(Architecture) Review

## 발견사항

### **[INFO]** `applyDynamicCut` 순수 함수 추출 — SRP·테스트 용이성 우수
- 위치: `/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts`
- 상세: 동적 점수 컷 로직을 `dynamic-cut.util.ts` 의 순수 함수 `applyDynamicCut<T extends { content: string }>()` 로 분리했다. 부수효과 없음, 의존성 없음, 제네릭 인터페이스로 벡터/그래프/리랭크 결과 모두 동일 함수 적용 가능. SRP 를 잘 준수하며 단위 테스트 용이성이 높다.

### **[INFO]** `RAG_RECALL_K` / `RAG_INJECT_TOKEN_BUDGET` / `RAG_MAX_INJECT_COUNT` 상수 분리
- 위치: `/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L11-16
- 상세: 세 상수가 `dynamic-cut.util.ts` 내에서 export 되고 `rag-search.service.ts` 와 `rerank.service.ts` 양쪽에서 import 된다. "단일 진실" 원칙 준수. `RAG_INJECT_TOKEN_BUDGET`(8000)이 `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) 와 값이 같지만 별개 상수로 명명함으로써 도메인 혼선을 차단한 결정도 적절하다.

### **[INFO]** `AgentToolProvider` 인터페이스 추상화 — OCP·ISP 준수
- 위치: `agent-tool-provider.interface.ts`, `kb-tool-provider.ts`
- 상세: KB 검색이 `AgentToolProvider` 인터페이스(ISP: build/execute/cleanup 분리)의 첫 구현체로 노출된다. 새로운 tool 유형(MCP server, 외부 vector store, workspace 변수 조회)을 인터페이스 구현만으로 추가할 수 있어 OCP 를 잘 따른다. spec §7 에서 명시한 확장 포인트가 코드 레벨에서도 잘 표현됐다.

### **[INFO]** 레이어 책임 분리 명확
- 위치: `kb-tool-provider.ts` (프레젠테이션/어댑터) → `rag-search.service.ts` (비즈니스) → `dynamic-cut.util.ts` (순수 유틸)
- 상세: `KbToolProvider` 는 LLM tool 인터페이스 변환·args 검증·보안 필터(`MAX_KB_QUERY_LENGTH`, LLM tool name 역추출 검증, 원시 에러 메시지 은닉)에 집중하고, 검색 파이프라인(wide 회수 → 동적 컷)은 `RagSearchService` 가 온전히 소유한다. 각 레이어가 자신의 책임 이외를 알지 않는다.

### **[WARNING]** `searchWithMeta` 반환 타입에서 `rerank?` 가 선택적이지만 호출부에서 부재 케이스 명시 처리 부재
- 위치: `rag-search.service.ts` L97-106, `kb-tool-provider.ts` L241-251
- 상세: `searchWithMeta` 반환 타입 `rerank?: RerankDiagnostics` 는 off 경로에서 `undefined` 가 된다. `KbToolProvider.execute` 에서 `meta.rerank` 가 `undefined` 이면 `ragDiagnosticsDelta` 에 `rerank` 키 자체가 생략되는 구조는 spec §4.2 의 "rerank_mode ≠ off 호출 시에만 존재" 정의와 일치한다. 그러나 `rerank.service.ts` 의 `rerankCandidates` 반환 타입은 `{ results; diagnostics }` 로 항상 존재하는 반면, `searchWithRerank` 는 `rerank: RerankDiagnostics` 를 항상 반환한다. 두 경로(`searchWithMeta` vs `searchWithRerank`)가 반환 타입 signature 에서 asymmetric 하다 — 런타임 버그는 아니지만 TypeScript 타입 레벨에서 두 경로를 명확히 구분하는 판별 유니온(discriminated union) 또는 타입 오버로드가 없어 호출부가 실수로 `undefined` 를 non-null assert 로 사용할 위험이 있다.
- 제안: `searchWithMeta` 반환 타입을 `{ results; graphTraversal?; rerank?: RerankDiagnostics }` 로 유지하되, 리랭크 경로 전용 내부 helper 의 반환 타입(`rerank: RerankDiagnostics`)을 별도 인터페이스로 선언하거나 `searchWithRerank` 반환 타입에 `rerank` 를 `NonNullable` 로 명시해 타입 안전성을 높일 것.

### **[WARNING]** `RagSearchService` 의 메서드 수 — 단일 책임 경계선 주의
- 위치: `rag-search.service.ts` (664 라인)
- 상세: `searchWithMeta`, `searchWithRerank`, `groupVectorKbs`, `isGraphKbSearchable`, `searchVectorGroup`, `searchGraphKb`, `buildContext` 의 7개 메서드를 하나의 서비스가 보유한다. D1 동적 컷 추가 후 vector·graph·rerank 세 경로 모두가 `RagSearchService` 에 집중됐다. 현재 규모에서는 응집도가 적절하나(모두 "RAG 검색 결과 생성"이라는 단일 책임), graph RAG 확장 시 `searchGraphKb` 와 그 재귀 CTE 가 더 복잡해지면 `GraphRagSearchService` 분리를 고려할 시점이 온다.
- 제안: v1 현 시점은 경고 수준. graph traversal 관련 private 메서드(`searchGraphKb`, `isGraphKbSearchable`)가 200줄 이상으로 성장하면 `GraphSearchStrategy` 로 분리 검토.

### **[INFO]** `cutoffApplied` 진단 필드의 의미 확장 — 제한적 관찰 가능성
- 위치: spec §4.2 `rerank` 서브객체, `rerank.service.ts`
- 상세: `cutoffApplied: true` 는 "θ 컷 / token-budget 컷 / inject-cap 컷 중 어느 것이든 적용" 을 포함한다고 spec 에 정의됐다. off 경로의 동적 컷 적용 여부는 `rerank` 서브객체가 없으므로 v1 에서 진단에 노출되지 않는다(의도적 생략). 이 결정은 "진단 schema 증식 회피" 원칙과 일관이나, 운영 환경에서 off 경로의 token-budget 컷 발생 빈도를 관찰하기 어렵다.
- 제안: v1 범위는 수용 가능. off 경로 token-budget 발동 비율 모니터링이 필요하다고 판단되면 `ragDiagnostics` 루트에 `dynamicCutApplied?` 를 후속 추가.

### **[INFO]** `estimateTokens`(char/3) 의존성 — 도메인 경계 명확
- 위치: `dynamic-cut.util.ts` L1, L54
- 상세: KB 청킹 도메인의 `text-chunker.estimateTokens` 를 재사용하는 것은 "동일 도메인 청크에 동일 추정 함수" 원칙을 따른다. ai-agent working-memory 의 language-aware 추정과 의도적으로 분리함으로써 cross-domain 회귀 위험을 0으로 만든 결정은 의존성 역전·모듈 경계 측면에서 적절하다. 단, `dynamic-cut.util.ts` 가 `chunking/text-chunker` 를 직접 import 함으로써 `search/` 모듈이 `chunking/` 모듈에 단방향 의존을 갖는다. 순환 참조는 없으나 모듈 경계를 엄격히 관리한다면 `estimateTokens` 를 `DynamicCutOptions` 의 외부 주입 함수로 추상화하는 것도 고려 가능.

### **[INFO]** conditional escalate 정량 임계가 module-level 상수로 하드코딩 — 관찰 가능성 제한
- 위치: `rerank.service.ts` L18-19 (`ESCALATE_TOP_SCORE_FLOOR = 0.6`, `ESCALATE_FLAT_REL_GAP = 0.05`)
- 상세: spec Rationale 에서 "provisional default / P0 골든셋 기반 A/B 확정은 후속" 으로 명시됐고, 코드 주석도 동일하게 기술돼 있어 의도적 결정임이 명확하다. 상수가 추후 KB 필드로 승격될 확장 경로도 spec 에 기술됐다. v1 범위에서 아키텍처 위반 없음.

---

## 요약

이번 변경(spec/5-system/9-rag-search.md §3.4 동적 점수 컷 추가, `dynamic-cut.util.ts` 도입, `rag-search.service.ts` wide 회수·동적 컷 적용, `rerank.service.ts` conditional escalate D2, `kb-tool-provider.ts` 진단 확장)은 전반적으로 SOLID 원칙과 레이어 책임을 잘 지킨다. `applyDynamicCut` 의 순수 함수 분리, `AgentToolProvider` 추상화, 레이어 경계(provider → service → util) 는 아키텍처 품질이 높다. 주의할 점은 `searchWithMeta` / `searchWithRerank` 의 반환 타입 비대칭이 TypeScript 타입 안전성 취약 지점으로 남아 있다는 것(WARNING)과, `RagSearchService` 가 vector·graph·rerank 세 경로를 단일 클래스에서 처리해 graph RAG 확장 시 크기 압박이 예상된다는 것(WARNING 수준 선제 경고)이다. 두 사항 모두 런타임 결함이 아닌 설계 개선 포인트이며, 현 v1 범위에서 즉각 차단하는 Critical 이슈는 없다.

## 위험도

LOW
