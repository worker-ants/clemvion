# 부작용(Side Effect) 리뷰 결과

**대상**: KB 검색 불가(재임베딩 필요/진행 중) 신호화 + 목록 경고 (PR `kb-unsearchable-warning`)
**리뷰 일시**: 2026-06-06

---

## 발견사항

### [INFO] `SearchWithMetaResult` 타입에 `unsearchable` 필드 추가 — 기존 호출자 영향
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `SearchWithMetaResult` 타입 정의
- 상세: `unsearchable?: { kbId: string; reason: KbUnsearchableReason }[]` 가 optional 필드로 추가됐다. 기존 `SearchWithMetaResult` 소비자(`KbToolProvider`, `searchWithRerank` 내부 래핑 경로)는 이 필드를 무시하거나 undefined 로 처리하면 되므로 역호환성이 유지된다. `withUnsearchable` 헬퍼가 결과 spread 를 통해 추가하는 패턴도 새 필드를 기존 result shape 에 혼입하는 방식으로, 기존 소비자 코드가 구조 분해 할당을 사용할 경우 예상치 못한 필드 추가로 인한 TypeScript strict 경고가 발생하지 않는 수준이다. 인터페이스 확장이 additive 하므로 기존 동작 변경 없음.
- 제안: 없음.

### [INFO] `KbUnsearchableReason` 타입 export 추가 — 새 공개 API 심볼 도입
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (line 157–159)
- 상세: `export type KbUnsearchableReason = 'reembedding_in_progress' | 'reembedding_required'` 가 새 공개 심볼로 추가됐다. 이 타입이 `kb-tool-provider.ts` 에서 `SearchWithMetaResult['unsearchable']` 타입 추론을 통해 간접 소비되고 있다. 명시적 export 이므로 의도된 공개 API 확장이며 부작용 없음.
- 제안: 없음.

### [INFO] `RagAccumulator` 클래스에 인스턴스 변수 2개 추가 — 클래스 상태 확장
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `RagAccumulator` (line 373–374)
- 상세: `diagnosticCount` 와 `unsearchableCount` 가 private 인스턴스 변수로 추가됐다. 이 클래스는 handler 내부에서 `new RagAccumulator()` 로 생성되며 외부 공유 상태가 아니다. 전역 변수 오염 없음. 초기값이 `0` 으로 명확히 설정되어 있어 stale 상태 진입 경로가 없다.
- 제안: 없음.

### [INFO] `skipReason` 로직 변경 — `resultCount === 0` 시 기존 `no_results` 고정값에서 조건 분기로 변경
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `RagAccumulator.build()` (line 463–398)
- 상세: 이전에는 `resultCount === 0` 이면 항상 `skipReason = 'no_results'` 가 세팅됐다. 변경 후에는 `diagnosticCount > 0 && unsearchableCount === diagnosticCount` 조건이 충족될 때만 `kb_unsearchable` 이 세팅되고, 그 외에는 `no_results` 가 유지된다. 기존 `empty_kb_list` 경로(attempted=false 시 set)는 이 코드 블록 밖에서 처리되므로 변경 없음. 이 변경은 `skipReason` 의 의미를 정확하게 하는 것이지만, 기존 소비자(예: 외부 API를 통해 `ragDiagnostics.skipReason` 을 읽는 클라이언트)가 `no_results` 만을 기대하고 있었다면 새 값 `kb_unsearchable` 을 처리하지 못할 수 있다.
- 제안: `skipReason` 값을 소비하는 외부 API 응답 포맷 정의(`spec/5-system/14-external-interaction-api.md` 또는 Frontend API 타입)에 `kb_unsearchable` 이 추가됐는지 확인 필요. 본 PR의 백엔드 TypeScript 타입 변경(line 363)은 완료됐으나, 외부 계약 문서 갱신 여부를 검증해야 한다.

### [INFO] `KbSearchDiagnostic` 인터페이스에 `unsearchable?: boolean` 추가 — 공개 인터페이스 확장
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` (line 426)
- 상세: `KbSearchDiagnostic` 인터페이스에 optional 필드가 추가됐다. 이 인터페이스를 구현하거나 소비하는 기존 코드가 추가 필드를 `undefined` 로 처리하므로 하위 호환성 유지. `RagAccumulator.accumulate()` 에서 `d.unsearchable` 을 읽는 코드가 정확히 이 필드를 소비한다.
- 제안: 없음.

### [INFO] `KbToolProvider.execute()` 에 새 조기 반환 경로 추가 — 기존 로직 흐름 분기
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` (line 546–565)
- 상세: `unsearchableHit && results.length === 0` 조건의 조기 반환이 추가됐다. 이 경로는 `ragSourcesDelta` 를 세팅하지 않는다(정상 경로는 세팅). 이는 의도된 것으로 `unsearchable` KB 에서는 소스 참조가 없어야 한다. 기존 `grounding:"none"` 조기 반환 경로와 동일 패턴이다. 단, 이 분기가 `rerankDiagnostics` 세팅 이후 실행되는 구조이므로, `unsearchable` KB 에서 `rerank` 응답이 있는 케이스는 현실적으로 발생하지 않지만, 코드 구조 상 `rerankDiagnostics` 변수가 undefined 로 남는 것이 보장된다(try-catch 내에서 `meta.rerank` 를 읽지 않은 경우). `results.length === 0` 조건이 추가된 것은 방어적 설계로 적절하다.
- 제안: 없음.

### [INFO] SQL 쿼리에 `reembed_status AS "reembedStatus"` 컬럼 추가 — DB 쿼리 변경
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (line 187)
- 상세: `knowledge_base` 테이블 SELECT 쿼리에 `reembed_status AS "reembedStatus"` 컬럼이 추가됐다. 이 컬럼은 V021 마이그레이션에서 추가된 기존 컬럼이므로 스키마 변경 없이 읽기만 한다. 쿼리 결과 크기가 미세하게 증가하지만 단일 문자열 컬럼이므로 무시 가능한 수준이다.
- 제안: 없음.

### [INFO] `kbs` → `searchableKbs` 필터링으로 변수 흐름 변경 — rerank/vector/graph 분기 영향
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (line 222–254)
- 상세: rerank 분기 조건(`kbs.length === 1`)과 vectorKbs/graphKbs 필터링이 모두 `searchableKbs` 기준으로 변경됐다. 이 변경은 의도된 것으로 `embedding_dimension=NULL` KB 가 vector/graph 검색에 참여하는 것을 차단한다. 기존에는 `embedding_dimension=NULL` KB 가 `vectorKbs` 또는 `graphKbs` 에 포함됐다가 각 경로 내부에서 자연 배제됐다면(이전 silent 경로), 이제는 `searchableKbs` 단계에서 사전 차단된다. 두 경로의 최종 결과는 동일하나, 사전 차단이 더 명시적이고 안전하다. 부작용 없음.
- 제안: 없음.

### [INFO] 프론트엔드 i18n dict에 새 키 추가 — 양 locale에 동시 추가됨
- 위치: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`, `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts`
- 상세: `reembeddingRequired`·`reembeddingInProgress` 키가 en/ko 양 locale에 동시 추가됐다. i18n dict는 정적 객체이므로 런타임 부작용 없음. 두 locale이 동시에 추가됐으므로 누락된 번역(fallback 문자열 키 노출) 위험도 없다.
- 제안: 없음.

### [INFO] 프론트엔드 `page.tsx`에 `AlertTriangle` 아이콘 import 추가 — bundle 크기 변화
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx`
- 상세: `lucide-react` 에서 `AlertTriangle` 아이콘이 추가 import됐다. tree-shaking이 적용된 환경에서는 단일 아이콘 추가이므로 bundle 크기 변화가 미미하다. 이미 같은 파일에서 `Loader2`를 import하고 있어 동일 패턴의 확장이다. 부작용 없음.
- 제안: 없음.

### [INFO] plan 파일 frontmatter에 `spec_impact` 필드 추가 (`plan/complete/` 2개 파일)
- 위치: `plan/complete/spec-update-pr2a-active-running-invariants.md`, `plan/complete/spec-update-pr2a-timeout.md`
- 상세: 이미 `complete/` 에 있는 plan 파일의 frontmatter에 `spec_impact` 필드가 추가됐다. 이는 Gate C 통과 요건 보강으로 문서 메타데이터 변경이며 코드 동작에는 영향이 없다. `plan-frontmatter.test.ts` 빌드 가드가 있다면 `complete/` 파일도 검증할 수 있으나, 필드 추가는 스키마 위반이 아니라 보강이므로 문제없다.
- 제안: 없음.

---

## 요약

이번 변경은 `embedding_dimension=NULL` KB를 silent 스킵에서 명시적 `unsearchable` 신호로 전환하는 additive 확장이다. 전역 상태·환경 변수·파일시스템·네트워크 호출·이벤트 발생에 대한 의도치 않은 부작용은 발견되지 않았다. 주요 인터페이스 변경(`SearchWithMetaResult.unsearchable`, `KbSearchDiagnostic.unsearchable`, `skipReason` 신규 값 `kb_unsearchable`, `RagDiagnostics.skipReason` 타입 확장)은 모두 optional 추가 또는 enum 확장으로 기존 소비자 코드의 하위 호환성이 유지된다. `skipReason='kb_unsearchable'` 이 외부 API 응답에 노출될 수 있는 신규 값임을 외부 클라이언트 계약(EIA spec 또는 OpenAPI)에서도 반영했는지 확인하는 것이 권장되나, 코드 변경 자체의 의도치 않은 부작용은 없다.

---

## 위험도

LOW
