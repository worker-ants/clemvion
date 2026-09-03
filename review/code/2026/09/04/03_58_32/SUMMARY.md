# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(`masked-reject-callers.spec.ts` 의 JSDoc orphan, 6R 이 새로 만든 문제)이 유일한 실질 지적이고, 나머지는 전부 여러 라운드에 걸쳐 이미 확인·유예된 INFO. 이번 changeset 은 전부 테스트/빌드-타임 전용 정적 가드(`repo-guards/__tests__/`, `common/__test-utils__/`) 리팩터로 프로덕션 런타임 코드를 건드리지 않는다. forced whitelist 7명(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 직전 라운드(6R)가 testing WARNING(`includeSpec: true` 배선 미검증)을 고치며 새 JSDoc+`describe` 블록을 파일 상단에 끼워 넣는 과정에서, 원래 그 자리에 있던 JSDoc(`describe('resolveTriggerParameters 직접 호출부 허용목록', …)`을 설명하던 문서)이 자신이 설명하던 대상 코드로부터 분리(orphan)됐다. 이 changeset 의 1R 에서 `source-scan.ts`(`stripLiterals` 삽입이 `countCalls` JSDoc 을 orphan 시킴)로 이미 한 번 발견·수정된 것과 정확히 같은 실패 모드가 다른 파일에서 재발한 것 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts:11-27`(orphan 된 원본 JSDoc), `:28-41`(6R 신규 JSDoc), `:42-60`(6R 신규 `describe`), `:62`(원본 JSDoc 의 실제 대상) | 11~27줄 JSDoc 을 62줄 `describe` 바로 위로 옮기고, 28~41줄 JSDoc 은 그대로 42줄 `describe` 위에 둔다 — 즉 "새 블록 전체(자신의 JSDoc 포함) → 기존 JSDoc → 기존 describe" 순으로 재배치 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합 (requirement·maintainability·documentation 공통 지적) | `CollectTsFilesOptions.includeSpec` JSDoc·테스트 제목이 "실사례가 하나/유일" 이라고 서술하지만 실제 호출부는 두 곳(`masked-reject-callers-guard.ts:51`, `nullable-type-lie-cast.spec.ts:399`) — 3라운드 전(3R)부터 반복 지적되고 6R RESOLUTION 에서 "검증되지 않는 숫자를 다시 늘려 적지 않겠다"며 명시적으로 유예된 항목. 기능 영향 없음 | `codebase/backend/src/common/__test-utils__/source-scan.ts:213-216`, `source-scan.spec.ts:252` | 조치 불필요(기존 유예 유지). 다음에 이 파일을 만질 때 "실사례 개수" 서술 자체를 빼는 편집 권장 |
| 2 | performance | `nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', …)` 블록이 `collectTsFiles(SRC_ROOT)` 전체 재귀 스캔을 3회(그중 2회는 인자까지 완전 동일) 수행하고, `widenedEntityFields(entities)` 도 두 `it` 에서 각각 재계산한다 — 03_17_44(1R) 부터 지적되고 "테스트 구조 변경은 또 한 라운드를 부른다"는 이유로 의도적으로 유예됨. 절대 비용 작음(스캔 3회 합산 ≈16ms) | `nullable-type-lie-cast.spec.ts:81,396,399`(스캔 3중), `:409,415`(재계산) | 조치 불필요. `describe` 상단에서 `collectTsFiles(SRC_ROOT, { includeSpec: true })` 1회만 수행 후 `.filter()` 로 파생하면 3→1회로 감소하는 순수 리팩터 가능 |
| 3 | performance | `findCastOffenders`/`findUntypedNullableColumns` 가 동일 818개 파일 목록의 내용을 각자 독립적으로 `fs.readFileSync` — 판정 축이 달라 설계상 분리된 것이라 결함은 아니나 디스크 read 2배 | `nullable-type-lie-cast.spec.ts:92,104`, `nullable-type-lie-cast-guard.ts:43-52,104-121` | 조치 불필요 수준. 다음 접촉 시 "파일 목록 → 내용 맵 1회 로드 → 두 함수에 전달" 구조 고려 가능 |
| 4 | architecture | `nullable-type-lie-cast-guard.ts` 한 파일이 층위가 다른 세 검사(이중 캐스트 카운트·TypeORM 메타데이터 정합성·spec 잔재 캐스트)를 담당 — 응집도는 방어 가능하나 배치를 거듭할 때마다 검사 축이 누적되는 추세 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` | 지금은 분리 불필요(246줄, 함수 8개). 네 번째 관련 검사 추가 시 "스캔 대상"(prod-source vs spec) 축으로 분리 고려 |
| 5 | architecture | 같은 guard 계열 안에서 정적 분석 방식이 갈림 — `WIDENED_DECL`/`COLUMN_DECL` 은 정규식, 형제 가드 3개(`masked-reject-callers-guard.ts` 등)는 TS AST. 의도된 트레이드오프이며 docstring 에 판단 근거 명시돼 있으나 계열 전체 일관성 관점에서는 재발 위험(표면이 점진적으로 넓어짐) 잠재 | `nullable-type-lie-cast-guard.ts:168-169` vs `masked-reject-callers-guard.ts:100-131` | 조치 불필요. 데코레이터 2개 이상 스택 형태가 실재하면 AST 전환 재고 |
| 6 | architecture | `source-scan.ts` 가 4개 관심사(문자열 전처리·범용/가드 전용 카운팅·디렉터리 순회)의 공유 커널로 계속 확장 중 — 현재(271줄, 함수 9개)는 문제 아니나 God Module 화 잠재 위험 | `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22` | 다음 프리미티브 추가 시 "여러 가드 공유 축" vs "가드 전용 로직" 구분해 후자가 늘면 파일 분리 고려 |
| 7 | side_effect | 5개 walker 사본이 `collectTsFiles` 하나로 수렴 — 결함 표면(blast radius)이 한 곳으로 합쳐짐(공개 시그니처는 유지돼 breaking change 없음, 전용 테스트로 하드닝됨) | `common/__test-utils__/source-scan.ts`(`collectTsFiles`), 소비처 5곳 | 조치 불필요 — 의도된 DRY 리팩터. 이후 `collectTsFiles` 수정 PR 은 5개 소비처를 함께 인지 필요 |
| 8 | side_effect | 3개 가드(`masked-reject-callers-guard`·`audit-action-binding-guard`·`engine-error-code-anchor-guard`)의 파일 필터링이 `collectTsFiles` 전환으로 조용히 넓어짐(`.d.ts` 배제·vendor skip·정렬이 새로 적용) — 오늘은 파일 집합이 완전 동일함(507/818/1261/818/818)을 실측 기록해 뒀으나, 향후 `.d.ts` 파일이 생기면 조용히 스캔에서 빠지는 잠재적 동작 변화 | `masked-reject-callers-guard.ts`, `audit-action-binding-guard.ts`, `engine-error-code-anchor-guard.ts` | 조치 불필요 — 이미 인지·문서화됨(source-scan.ts docstring "다섯 사본의 차이" 표) |
| 9 | side_effect / scope | `stripComments` 가시성이 module-private → `export` 로 확대(순수 additive, breaking 없음). `masked-reject-callers-guard.listSourceFiles` 의 `.d.ts` 배제·정렬 부수 적용은 이전 라운드(1R)부터 재확인된 위반 아님 항목 | `source-scan.ts`(`stripComments`), `masked-reject-callers-guard.ts`(`listSourceFiles`) | 조치 불필요 |
| 10 | testing | `widenedEntityFields` 의 `@OneToOne` 분기가 유닛/저장소-전수 테스트 어느 쪽으로도 실행되지 않음(저장소에 `@OneToOne` 사용처 없어 경로 자체가 죽어 있음, false-negative 방향) | `nullable-type-lie-cast-guard.ts:169`(`WIDENED_DECL`) | 우선순위 낮음, 조치 불요(6R 유예). `ENTITY` 픽스처에 `@OneToOne` 필드 추가 시 해소 |
| 11 | testing | `isNullableType` 이 `Type | null = <default>`(기본값 붙은 필드) 형태에서 `null` 세그먼트가 `= null` 로 오염돼 매치 실패 — 저장소에 해당 패턴 0건이라 현재는 잠재적 위음성 | `nullable-type-lie-cast-guard.ts:180` | 우선순위 낮음, 조치 불요. 다음 접촉 시 캐너리 고정 권장 |
| 12 | testing | `WIDENED_DECL` "추가 데코레이터 1개까지만" 한계에 `stripLiterals` 와 달리 회귀-고정 캐너리 테스트가 없음 | `nullable-type-lie-cast-guard.ts:160-166` | 우선순위 낮음, 조치 불요. `stripLiterals` 와 대칭 맞추는 것은 다음 접촉 시점 |
| 13 | security | 신규 정규식(`WIDENED_DECL`·`COLUMN_DECL`·`CALL`)이 이론적으로 ReDoS 가능 패턴이나, 입력이 전부 저장소 자신의 `.ts` 소스(신뢰 경계 바깥에서 도달 불가)라 실질 익스플로잇 표면 없음 | `nullable-type-lie-cast-guard.ts:169,78`, `source-scan.ts:158` | 조치 불필요. 향후 외부 코드 스캔 용도로 재사용 시 재검토 |
| 14 | requirement | (관측, 코드 결함 아님) 리뷰 도중 공유 워크트리에서 `masked-reject-callers-guard.ts` 가 일시적으로 수정 상태(`.bak` 파일 포함)였으나 이 리뷰가 만든 뮤테이션이 아니며, 종료 시점엔 저장소가 clean 이었음(병렬 fan-out reviewer 뮤테이션 흔적으로 추정) | `masked-reject-callers-guard.ts`(일시적) | 조치 불필요 — 관측 사실만 기록 |
| 15 | scope | 리뷰 세션 산출물(`review/code/2026/09/04/{01_48_39..03_37_37}/**`)이 코드 변경과 같은 브랜치에 누적 커밋됨 — 이 저장소의 확립된 review-fix-review 루프 관례이며 실질 코드 변경(9개 파일)은 plan 문서의 두 후속 항목에 직접 결속 | `review/code/2026/09/04/**` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 정규식 이론적 ReDoS 있으나 신뢰 경계 없음(INFO). 시크릿/인증/인젝션 해당 없음 |
| performance | LOW | 같은 spec 파일 내 저장소 전수 스캔 3회 중복 등 미해소 INFO 3건(6라운드 전부터 의도적 유예), 절대 비용 무시 가능 |
| architecture | LOW | 신규 CRITICAL/WARNING 없음. 파일 책임 누적·regex/AST 비일관·공유 커널 확장 추세 등 이전부터 관찰된 INFO 3건 재확인 |
| requirement | LOW | 6라운드 수정 전부 반영 확인(119/119 GREEN, tsc/eslint 클린). 잔여는 이미 유예된 JSDoc 개수 서술 INFO 1건 |
| scope | NONE | 실질 코드 변경 9개 파일 전부 plan 문서 두 항목에 직접 결속. 무관한 리팩터/포맷팅 없음 |
| side_effect | LOW | 프로덕션 런타임 코드 무변경. walker 통합으로 결함 표면 집중 + 필터링 조용히 확대 등 INFO 4건, 전부 문서화·실측 근거 있음 |
| maintainability | LOW | **WARNING 1건**(masked-reject-callers.spec.ts JSDoc orphan 재발) — 유일한 신규 실질 지적 |
| testing | LOW | 6R WARNING(`includeSpec` 배선 미검증)을 뮤테이션으로 직접 재현해 해소 확인. 잔여 INFO 3건은 false-negative 방향, 저장소 실사례 0건 |
| documentation | LOW | 이전 6라운드 WARNING 전부 반영 확인(코드 대조). 잔여 INFO 1건(JSDoc 개수 서술, 3라운드 연속 유예) |

## 발견 없는 에이전트

없음 — 9개 실행 reviewer 전원이 최소 INFO 이상을 보고했다(대부분 이전 라운드의 재확인/유예 항목).

## 권장 조치사항
1. `masked-reject-callers.spec.ts` 의 JSDoc orphan(WARNING #1)을 다음 커밋에서 정정 — 원본 JSDoc(11~27줄)을 실제 대상 `describe`(62줄) 위로 옮긴다. 같은 실패 모드가 이 changeset 안에서 두 번째로 재발했으므로("코드 중간에 새 블록을 끼워 넣을 때 앞뒤 JSDoc-선언 결속 미확인"), 이번엔 그 패턴 자체를 인지하고 고칠 것.
2. 그 외 INFO 항목은 전부 여러 라운드에 걸쳐 이미 판단·유예된 것으로 즉각 조치 불필요. 다음에 해당 파일을 만질 기회에 함께 정리 권장(`includeSpec` JSDoc 개수 서술 삭제, 저장소 전수 스캔 3중 → 1회 통합 등).
3. 병합 전 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 두 체크박스(walker 통합, 낡은 spec 캐스트 가드)가 `[x]` 로 반영돼 있음이 이미 확인됨 — 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 changeset 이 패키지/의존성 변경(`package.json` 등)을 포함하지 않음 — 라우터 범위 밖 판단 |
  | database | DB 스키마·마이그레이션·쿼리 로직 변경 없음(정적 파일 스캔 유틸/가드 리팩터) — 라우터 범위 밖 판단 |
  | concurrency | 비동기 동시성 제어·락·트랜잭션 관련 코드 변경 없음 — 라우터 범위 밖 판단 |
  | api_contract | 공개 API 엔드포인트·요청/응답 계약 변경 없음(내부 test-tooling 전용) — 라우터 범위 밖 판단 |
  | user_guide_sync | 사용자 대면 문서·가이드 변경 없음(plan 문서 갱신은 documentation reviewer 가 forced 로 커버) — 라우터 범위 밖 판단 |