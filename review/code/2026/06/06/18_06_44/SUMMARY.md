# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — PR 핵심 구현(HNSW ef_search recall 보전)은 안전하고 올바르나, `exec-park-b2a-followup` worktree 산출물이 이 PR 브랜치에 다수 혼입되어 있어 범위(scope) 관리 상 MEDIUM 위험.

---

## Critical 발견사항

_Critical 수준 발견사항 없음._

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | SCOPE | `exec-park-b2a-followup` 산출물 이종 혼입 — `execution-park-resume.e2e-spec.ts`, `docker-compose.e2e.yml`, `review/code/2026/06/06/17_27_54/` 디렉토리 전체, `review/consistency/` 두 세션, `spec/5-system/14-external-interaction-api.md §8.3`, `spec/5-system/7-llm-client.md §7.1`, `spec/data-flow/3-execution.md` 가 ef_search PR 브랜치에 포함됨. plan 메모의 "orphaned #2/#3 diff → fresh main 재상륙" 과정에서 두 worktree 커밋이 하나의 브랜치에 묶인 것으로 판단. | `codebase/backend/test/execution-park-resume.e2e-spec.ts`, `docker-compose.e2e.yml`, `review/code/2026/06/06/17_27_54/`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/3-execution.md` | 커밋 히스토리를 확인해 의도적 포함 여부를 검토. ef_search PR은 RAG 코드만 포함하는 것이 범위 관리상 바람직. 단, 기능 동작 자체에는 문제 없으므로 이력 정리는 차기 PR 또는 squash merge 시 처리 가능. |
| W2 | ARCHITECTURE | 서비스 레이어에 SQL GUC 보간 로직 인라인 포함 — `SET LOCAL hnsw.ef_search = ${efSearch}` SQL 문이 서비스 메서드에 직접 작성됨. 이 패턴이 향후 다른 서비스에 복제될 경우 정수 clamp 보장 함수 누락 위험. | `rag-search.service.ts` (diff 내 SET LOCAL 라인) | 단기 수용 가능. 중기적으로 `searchVectorGroup` 로직이 별도 repository/query-object로 분리될 때 GUC 적용도 함께 이전 고려. |
| W3 | SIDE_EFFECT | SQL 직접 보간 방어 심도 — `efSearch` 정수 보장이 `hnswEfSearchFor` 구현에 암묵적으로 위임되어 있어, 함수 변경 시 방어가 깨질 수 있음. 현재 구현은 안전하나 방어 심도 강화 권장. | `rag-search.service.ts` L428 | `hnswEfSearchFor` 반환 직전 또는 SET LOCAL 보간 직전에 `Number.isInteger` + 범위 어서션을 추가하거나, branded integer 반환 타입으로 타입 레벨 제약. |
| W4 | REQUIREMENT | `hnswEfSearchFor` 음수 입력 처리 미명시 — `limit < 0` 입력 시 결과적으로 하한 40이 반환되어 SQL 보간은 안전하지만, 이 동작이 명시적으로 보장된 계약인지 불명확. 음수 LIMIT 가 호출 경로에서 발생할 가능성은 낮으나 함수 계약 완전성 관점에서 미명시. | `dynamic-cut.util.ts` L32-38, `rag-search.service.ts` L428 | `hnswEfSearchFor(-5)` → `40` 케이스 테스트 1건 추가하여 계약 명시화. 코드 자체는 안전하므로 선택적 개선. |
| W5 | MAINTAINABILITY | `rag-search.service.spec.ts` `mockEm` 람다 묵시적 결합 — `/^\s*SET LOCAL/i` 정규식 분기 로직이 묵시적 결합을 만들어, SQL 포맷 변경 시 무음(silent) 실패 위험. `beforeEach` 레벨에서 영향 범위가 명시적이지 않아 향후 다른 SQL 패턴 추가 시 예상치 못한 포워딩 발생 가능. | `rag-search.service.spec.ts` L134-140 | 정규식을 명명 상수로 추출(`const SET_LOCAL_PATTERN = /^\s*SET LOCAL/i`)하거나, mock 람다에 "HNSW ef_search SET LOCAL 전용" 인라인 주석 보강. 또는 `mockEm`을 해당 `it` 블록 내 지역 변수로 한정. |
| W6 | DOCUMENTATION | `spec/5-system/9-rag-search.md §3.4`가 `HNSW_EF_SEARCH_DEFAULT`(40)·`HNSW_EF_SEARCH_MAX`(1000)를 매직 넘버로 직접 기재 — 상수값 조정 시 spec-코드 drift 여지. | `spec/5-system/9-rag-search.md §3.4` | spec §3.4에 한 줄 추가: "`HNSW_EF_SEARCH_DEFAULT(40)`·`HNSW_EF_SEARCH_MAX(1000)`은 `dynamic-cut.util.ts`에 명명 상수로 정의돼 있어 조정 시 단일 지점에서 변경 가능." (선택사항이나 spec-as-SoT 원칙상 권장) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SECURITY | `SET LOCAL hnsw.ef_search = ${efSearch}` 직접 보간 안전 확인 — `hnswEfSearchFor`의 [40, 1000] 정수 clamp + `Number.isFinite` 가드로 인젝션 벡터 원천 차단. `topK`는 외부 사용자 입력이 아닌 서버 내부 상수에서 유래. `SET LOCAL` 트랜잭션 스코프로 커넥션 풀 오염 없음. | `rag-search.service.ts` diff +258, `dynamic-cut.util.ts` diff +92-98 | 추가 조치 불필요. |
| I2 | PERFORMANCE | `dataSource.transaction` 래핑 오버헤드 — `BEGIN`/`COMMIT` 2회 라운드트립 + 커넥션 점유 시간 증가. `Promise.all` 병렬 실행 경로에서 동시 트랜잭션 수가 벡터 그룹 수만큼 증가. HNSW recall@LIMIT 정확도 보전이라는 correctness gain과 충분히 trade-off 성립. | `rag-search.service.ts` diff +257 | 고부하 시 커넥션 풀 포화가 관측되면 QueryRunner 명시적 커넥션 재사용 패턴으로 전환 검토. |
| I3 | ARCHITECTURE | e2e 테스트 DB 직접 INSERT 우회 제거 개선 — `POST /api/llm-configs` 공개 API 경로로 교체. 테스트가 내부 DB 스키마 직접 의존에서 서비스 레이어 공개 인터페이스로 올바르게 정렬됨. | `test/execution-park-resume.e2e-spec.ts` diff | 없음. |
| I4 | SPEC-DRIFT | [SPEC-DRIFT] spec §3.4 "(follow-up)" → "구현됨" 갱신 — 코드가 선행하고 spec이 이 PR에서 동기화됨. 이 PR로 SPEC-DRIFT 해소. | `spec/5-system/9-rag-search.md §3.4` diff | 코드 유지 + 이 PR의 spec diff 이미 반영. |
| I5 | TESTING | `HNSW_EF_SEARCH_DEFAULT`(40)·`HNSW_EF_SEARCH_MAX`(1000) 상수 pin 테스트 없음 — 기존 `RAG_*` 상수는 pin 테스트 있음. 이 두 값은 SQL 보간 안전성 근거이므로 값 변경 시 즉시 회귀 감지 필요. | `dynamic-cut.util.spec.ts` L66-70 | "상수 기본값 노출" it 블록에 `expect(HNSW_EF_SEARCH_DEFAULT).toBe(40)`, `expect(HNSW_EF_SEARCH_MAX).toBe(1000)` 추가. |
| I6 | TESTING | `limit=0`, `limit=-1` 경계값 테스트 미커버 — 코드상 하한 40 반환으로 올바르게 처리되나 명시적 테스트 없음. | `dynamic-cut.util.spec.ts` | `expect(hnswEfSearchFor(0)).toBe(40)`, `expect(hnswEfSearchFor(-5)).toBe(40)` 추가 권장. |
| I7 | MAINTAINABILITY | `setLocal!` non-null 단언 사용 — `setLocal`이 undefined 시 런타임 오류로 테스트 실패하나 실패 메시지가 직관적이지 않을 수 있음. | `rag-search.service.spec.ts` L215, L576-579 | `expect(setLocal).toBeDefined()` 를 `!` 접근 앞에 명시적으로 추가. |
| I8 | MAINTAINABILITY | 서비스 인라인 주석 7줄 — `hnswEfSearchFor` JSDoc과 내용 중복. | `rag-search.service.ts` L250-256 | 서비스 쪽 인라인 주석을 "(§3.4 ef_search recall 보전 — 상세는 `hnswEfSearchFor` JSDoc 참조)" 1~2줄로 압축. |
| I9 | DEPENDENCY | 루트 `package-lock.json` untracked 파일 — git status에 표시됨. PR 변경과 무관하나 의도치 않은 파일일 수 있음. | 프로젝트 루트 `package-lock.json` | PR에 포함 의도가 없다면 `.gitignore`에 추가하거나 커밋에서 제외. |
| I10 | SCOPE | `plan/complete/fix-carousel-waiting-status.md` `spec_impact` frontmatter 소급 추가 — 2줄 변경이며 기능 동작과 무관. plan lifecycle 규약상 완료 plan 문서 수정 최소화 권장이나 메타데이터 보완 목적으로 수용 가능. | `plan/complete/fix-carousel-waiting-status.md` | 영향 극소, 수용 가능. |
| I11 | CONCURRENCY | `searchVectorGroup` 트랜잭션 래핑으로 SET LOCAL 격리 — 병렬 요청 간 커넥션 풀 오염 경쟁 조건 원천 방지. `hnswEfSearchFor`는 순수 함수로 공유 상태 없음. async/await 순서 보장 명확. | `rag-search.service.ts` diff | 없음. |
| I12 | SIDE_EFFECT | `searchGraphKb` ef_search 미상향 — `seedTopK` 기본 5 < `HNSW_EF_SEARCH_DEFAULT`(40) 전제. 현재 정상이나 `vectorSeedTopK` 상향 시 런타임 검사 없이 recall 저하 잠재. | `rag-search.service.ts` L515-517 | 향후 `vectorSeedTopK` 상향 시 `if (seedTopK > HNSW_EF_SEARCH_DEFAULT)` 경고 로그 또는 `hnswEfSearchFor(seedTopK)` 분기 준비. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 직접 보간 안전(정수 clamp 보장), 커넥션 풀 오염 없음, 추가 위협 표면 없음 |
| performance | LOW | `dataSource.transaction` 래핑으로 BEGIN/COMMIT 오버헤드 + 커넥션 점유 시간 증가 (correctness gain과 trade-off 성립) |
| architecture | NONE | SOLID 준수, 트랜잭션 스코프 패턴 적절. SQL GUC 보간이 서비스 레이어에 인라인된 점은 중기 리팩터링 권고 수준 |
| requirement | LOW | ef_search 기능 완전성 충족. 음수 입력 처리 계약 미명시가 유일한 개선 여지 |
| scope | MEDIUM | exec-park-b2a-followup 산출물(e2e, docker-compose, review 디렉토리, spec 일부) 이종 혼입 |
| side_effect | LOW | SQL 보간 안전성이 함수 구현에 암묵 위임, 향후 변경 시 방어 약화 가능성 |
| maintainability | LOW | 핵심 코드 유지보수성 우수. mockEm 람다 묵시적 결합, non-null 단언 소수 지적 |
| testing | LOW | 테스트 전반 우수. HNSW 상수 pin 테스트 부재, 0·음수 경계값 미커버 등 소소한 보완 여지 |
| documentation | LOW | 전반 문서화 우수. spec §3.4 매직 넘버 잔류로 상수값 조정 시 drift 여지 |
| dependency | NONE | 신규 외부 패키지 없음. 루트 package-lock.json untracked 파일 확인 필요 |
| database | NONE | SET LOCAL 트랜잭션 격리 올바름, e2e DB 직접 INSERT 제거는 개선 |
| concurrency | NONE | 순수 함수 + 트랜잭션 격리로 동시성 위험 없음 |

---

## 발견 없는 에이전트

- **security**: OWASP Top 10 해당 항목 없음 (모두 INFO 수준 분석)
- **database**: 인덱스·N+1·마이그레이션·스키마 관련 문제 없음
- **concurrency**: 공유 변수·락·병렬 접근·이벤트 루프 블로킹 없음
- **dependency**: 신규 외부 패키지 없음

---

## 권장 조치사항

1. **(W1) PR 범위 정리 검토** — `exec-park-b2a-followup` 산출물(e2e 테스트, docker-compose, `review/code/17_27_54/`, consistency 리뷰 세션, `spec/14-external-interaction-api.md`, `spec/7-llm-client.md §7.1`, `spec/data-flow/3-execution.md`)이 이 PR에 포함된 것이 의도적인지 확인. 기능 동작에는 문제 없으므로 이력 정리는 차기 PR에서 수행 가능.
2. **(W3) SQL 보간 방어 심도 강화** — `hnswEfSearchFor` 반환 직전 `Number.isInteger` 어서션 추가 또는 branded integer 타입으로 타입 레벨 제약. 현재 안전하나 회귀 방어용.
3. **(W4 + I6) `hnswEfSearchFor` 테스트 보완** — 음수 입력(`-5 → 40`), 0 입력(`0 → 40`) 케이스 테스트 추가하여 함수 계약 명시화.
4. **(I5) HNSW 상수 pin 테스트 추가** — `expect(HNSW_EF_SEARCH_DEFAULT).toBe(40)`, `expect(HNSW_EF_SEARCH_MAX).toBe(1000)` 단언 추가.
5. **(W5 + I7) 테스트 유지보수성 개선** — `mockEm` SET LOCAL 정규식을 명명 상수로 추출, `expect(setLocal).toBeDefined()` non-null 방어 명시화.
6. **(W6) spec §3.4 상수 참조 보강** — 매직 넘버 40·1000을 명명 상수 참조로 보강하는 1줄 추가.
7. **(W2) 중기 아키텍처 개선 메모** — SQL GUC 보간 로직을 서비스 레이어에서 repository/query-object로 분리 시 함께 이전.
8. **(I9) 루트 package-lock.json 처리** — 의도치 않은 파일이면 `.gitignore` 추가 또는 커밋 제외.

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency
- **강제 포함 (router_safety)** (8명): dependency, documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외** (2명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| api_contract | 라우터 판단으로 생략 |
| user_guide_sync | 라우터 판단으로 생략 |