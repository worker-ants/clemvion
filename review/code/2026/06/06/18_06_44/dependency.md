# 의존성(Dependency) 리뷰 결과

## 발견사항

### 신규 외부 패키지 없음

이번 변경의 핵심 코드 파일은 다음 4개다.

1. `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` — `hnswEfSearchFor` 순수 유틸 함수 추가
2. `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.spec.ts` — 위 함수 단위 테스트
3. `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `searchVectorGroup`을 `dataSource.transaction` 래핑으로 변경
4. `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` — mock 추가

나머지 파일(plan md, review md, docker-compose.e2e.yml)은 의존성과 무관하다.

---

**[INFO] 신규 외부 패키지 없음**
- 위치: 변경된 모든 `.ts` 파일 import 선언
- 상세: `hnswEfSearchFor`는 순수 TypeScript 유틸로 외부 패키지를 전혀 import하지 않는다. `rag-search.service.ts`의 `dataSource.transaction`은 이미 `dependencies`에 있는 `typeorm`(^0.3.28) + `@nestjs/typeorm`(^11.0.0)의 기존 API를 사용한다. 신규 패키지 추가 없음.
- 제안: 해당 없음.

**[INFO] `dataSource.transaction` — TypeORM 기존 의존성 내부 API 사용**
- 위치: `rag-search.service.ts` diff, `this.dataSource.transaction(async (em) => { ... })`
- 상세: TypeORM `DataSource.transaction(cb)` API는 `typeorm ^0.3.28`에 안정적으로 포함된 표준 API다. 새 의존성 도입 없이 기존 ORM 추상화를 활용한 것이며, 트랜잭션 매니저 `em`의 `query()` 메서드도 동일하다.
- 제안: 해당 없음.

**[INFO] `Math.ceil` / `Number.isFinite` — 표준 라이브러리 사용**
- 위치: `dynamic-cut.util.ts`, `hnswEfSearchFor` 함수 본체
- 상세: `Math.ceil`, `Math.min`, `Math.max`, `Number.isFinite` 모두 ECMAScript 표준이다. 외부 수학 라이브러리를 도입하지 않고 표준만으로 구현한 것은 의존성 위생 측면에서 올바른 선택이다.
- 제안: 해당 없음.

**[INFO] 내부 모듈 의존 관계 — 기존 패턴 유지**
- 위치: `rag-search.service.ts` import 추가 (`hnswEfSearchFor` from `./dynamic-cut.util`)
- 상세: `RagSearchService`가 같은 디렉터리의 `dynamic-cut.util`에서 `hnswEfSearchFor`를 import한다. 이미 `applyDynamicCut`, `RAG_RECALL_K` 등을 같은 파일에서 import하고 있으므로 기존 내부 의존 방향과 완전히 일치한다. 순환 의존 없음.
- 제안: 해당 없음.

**[INFO] SET LOCAL SQL 보간 — 파라미터 바인딩 불가 GUC에 대한 정수 보장**
- 위치: `rag-search.service.ts`, `SET LOCAL hnsw.ef_search = ${efSearch}`
- 상세: pgvector GUC(`hnsw.ef_search`)는 `$n` 파라미터 바인딩이 불가하여 SQL에 직접 보간된다. `hnswEfSearchFor`가 `[40, 1000]` 범위의 정수만 반환하도록 `Math.ceil` + `clamp` + `Number.isFinite` 가드로 보장하므로 SQL 인젝션 위험이 없다. 이는 외부 패키지 의존이 아닌 내부 유틸 설계 결정이다.
- 제안: 해당 없음.

**[INFO] `package-lock.json` — 워크트리 신규 파일로 git status에 표시됨**
- 위치: git status `?? package-lock.json` (프로젝트 루트)
- 상세: 현재 worktree에 `package-lock.json`이 untracked 상태로 존재한다. 이번 PR 변경과 무관한 파일이나, 의존성 잠금 파일이 커밋에 포함되는지 확인이 필요하다. 일반적으로 backend `package-lock.json`은 `codebase/backend/` 내에 위치해야 하며, 루트에 위치한 것은 의도치 않은 파일일 수 있다.
- 제안: PR에 이 파일을 포함하려는 의도가 없다면 `.gitignore`에 추가하거나 커밋에서 제외할 것을 권장한다.

---

## 요약

이번 변경(RAG P1 후속 — pgvector ef_search recall 보전)은 새로운 외부 패키지를 전혀 추가하지 않는다. 핵심 변경(`hnswEfSearchFor` 유틸 추가 + `dataSource.transaction` 래핑)은 기존 TypeORM 의존성과 ECMAScript 표준 내장 함수만을 사용하며, 내부 모듈 의존 방향도 기존 패턴과 일치한다. 유일한 주목할 점은 git status에 표시된 루트 `package-lock.json` untracked 파일이나, 이는 이번 코드 변경과 무관한 부산물이다. 의존성 위험 없음.

## 위험도

NONE
