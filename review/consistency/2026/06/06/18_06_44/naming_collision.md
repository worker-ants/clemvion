# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/9-rag-search.md` 연관 구현 변경 (diff-base=origin/main)
검토 모드: --impl-done

## 신규 도입 식별자 목록

| 식별자 | 종류 | 위치 |
|---|---|---|
| `HNSW_EF_SEARCH_DEFAULT` | 상수 (export const) | `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` |
| `HNSW_EF_SEARCH_MAX` | 상수 (export const) | 동일 |
| `hnswEfSearchFor` | 함수 (export function) | 동일 |
| `mockEm` | 테스트 지역 변수 | `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` |

## 발견사항

충돌로 판정된 항목이 없습니다.

### 검토 내용

**1. 요구사항 ID 충돌**
target diff 는 새 요구사항 ID 를 부여하지 않는다. 코드 주석에서 참조하는 `§3.4` 는 `spec/5-system/9-rag-search.md §3.4 동적 점수 컷` 으로 기존에 해당 섹션이 존재하고 내용이 일치한다.

**2. 엔티티/타입명 충돌**
`HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`, `hnswEfSearchFor` 세 식별자를 프로젝트 전체(spec/, plan/, codebase/)에서 검색한 결과 diff 외에 다른 정의·사용처가 없다. 기존 `dynamic-cut.util.ts` 의 상수들(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`)과 prefix 가 다르고(`HNSW_` vs `RAG_`) 의미 도메인도 분리된다.

**3. API endpoint 충돌**
신규 endpoint 를 도입하지 않는다.

**4. 이벤트/메시지명 충돌**
신규 이벤트·메시지명을 도입하지 않는다.

**5. 환경변수·설정키 충돌**
신규 ENV var 또는 config key 를 도입하지 않는다. `HNSW_EF_SEARCH_DEFAULT`·`HNSW_EF_SEARCH_MAX` 는 모두 module-level 코드 상수이며 환경변수로 노출되지 않는다.

**6. 파일 경로 충돌**
새 파일을 생성하지 않는다. 기존 파일 두 개(`dynamic-cut.util.ts`, `rag-search.service.spec.ts`, `rag-search.service.ts`)에 추가만 한다.

## 요약

이번 변경이 도입하는 신규 식별자(`HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`, `hnswEfSearchFor`)는 프로젝트 전체에서 처음 등장하는 이름이다. 기존 `RAG_*` 상수군과 prefix 가 구분되고, spec 의 `hnsw.ef_search` 언급(`spec/5-system/9-rag-search.md` line 245)이 "후속 조정 필요" 항목으로 예고했던 바와 일치하는 구현이다. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 어느 관점에서도 기존 사용처와 충돌이 없다.

## 위험도

NONE
