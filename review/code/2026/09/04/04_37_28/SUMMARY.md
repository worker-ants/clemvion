# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(모두 코드 결함이 아니라 ① 신규 테스트의 중복 트리 워크 최적화 여지, ② plan 체크박스 동기화 누락). 강제 화이트리스트(router_safety) 대상 7명(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 신규 "저장소 전수" 테스트가 `SRC_ROOT` 전체를 재귀 워크하는 `collectTsFiles`를 같은 `describe` 블록에서 두 번 호출한다 — `collectTsFiles(SRC_ROOT, {includeSpec:true})` 결과가 `collectTsFiles(SRC_ROOT)` 결과의 상위집합이라 앞 호출은 통째로 중복 작업. 실측 파일 수(818 vs 1261 등) 규모의 트리에서 발생 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:422-427` | `collectTsFiles(SRC_ROOT, {includeSpec:true})` 한 번만 호출해 `all`에 담고 `entities`/`specs`를 그 결과에서 `.filter()`로 파생 |
| 2 | requirement | `plan/in-progress/entity-nullable-column-type-mismatch.md:491`("가드 사각지대 — `.spec.ts` 의 낡은 캐스트")가 이 diff 가 `:264`에서 신설한 자동 가드(`widenedEntityFields`+`findStaleSpecCasts`)로 이미 실질적으로 해소됐는데 여전히 `[ ]`로 남아 있음. 이 plan 문서 자신이 "한 자리만 고치는 버릇"을 6회 자기반성 기록한 것과 같은 패턴의 7번째 사례 | `plan/in-progress/entity-nullable-column-type-mismatch.md:491` (대조 `:264`, `:511`) | `:491`을 `[x]`로 전환하고 "구조적 사각지대는 `:264`의 자동 가드로 최종 닫혔다"는 후기 추가. 코드 변경 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 같은 `describe` 블록 안에서 `widenedEntityFields(entities)`가 두 `it()`에서 각각 재계산(파일 재-read+재파싱)됨 | `nullable-type-lie-cast.spec.ts:434-436, 438-442` | `describe` 스코프 `const widened = widenedEntityFields(entities)`로 1회만 계산해 재사용 |
| 2 | performance | walker 5-사본을 `collectTsFiles`로 통합한 리팩터 자체는 알고리즘적으로 중립(Big-O·호출 빈도 불변) | `source-scan.ts:249-271` 및 5개 소비처 | 조치 불필요 |
| 3 | architecture | `collectTsFiles` 등 공유 primitive가 `common/__test-utils__/`(빌드 비제외 레이어)에 있지만 실제 소비처는 전부 build-exclude 대상(`repo-guards/**`, `*.spec.ts`) — 현재는 devDependency 미import라 무해하나 향후 devDependency 추가 시 재발 소지 | `source-scan.ts:1-22` | 조치 불필요. 향후 devDependency 추가 시 exclude 등재 규율 유지 |
| 4 | architecture | 범용 스캔 primitive(`collectTsFiles`/`stripComments`/`stripLiterals`/`countCalls`)와 도메인-특정 predicate(`countRawUpdateReturning`, `countNullAsUnknownAsCasts`) 2개가 한 모듈에 공존 — junk-drawer화 초기 징후 | `source-scan.ts` | 지금은 분리 비용 > 이득. predicate 3~4개 이상 늘면 파일 분리 고려 |
| 5 | requirement | 이 diff 가 구현하는 walker 통합·spec-cast 가드를 직접 규정하는 `spec/` 본문 없음(회색지대, 참조만 존재) | `spec/conventions/raw-query-results.md:7` 등 | 조치 불필요 |
| 6 | requirement | plan 문서의 나머지 planner-턴 대기 항목(spec 표기 정정 3건)은 이번 diff 스코프 밖으로 올바르게 `[ ]` 유지 | `plan/in-progress/entity-nullable-column-type-mismatch.md:182,190,233` | 조치 불필요 |
| 7 | scope | `collectTsFiles` 통합이 `masked-reject-callers-guard.ts`의 `listSourceFiles`에 `.d.ts` 배제·정렬을 부수적으로 신규 적용(1R~8R 누적 재확인, `.d.ts` 실측 0건이라 무해) | `masked-reject-callers-guard.ts` | 조치 불필요 |
| 8 | scope | 리뷰 세션 산출물(`review/code/2026/09/04/{01_48_39..04_18_01}/**`)이 코드 변경과 같은 브랜치에 9라운드분 누적 커밋됨 — 확립된 관례 | `review/code/2026/09/04/**` | 조치 불필요 |
| 9 | side_effect | `findUntypedNullableColumns`의 nullable 판정이 `isNullableType()`으로 교체되며 인식 범위가 넓어짐(검출 강화, 위음성 감소 방향이라 위험 없음) | `nullable-type-lie-cast-guard.ts:113` | 조치 불필요 |
| 10 | maintainability | `WIDENED_DECL` 상수명이 실제 매칭 범위(nullable 여부 무관 모든 `@Column`/`@ManyToOne`/`@OneToOne` 선언)보다 좁게 읽힘 — 필터링은 호출부에서 별도 수행 | `nullable-type-lie-cast-guard.ts:168-169, 199` | 반복 유예. 다음에 만질 때 이름 변경 또는 주석 1줄 추가 |
| 11 | maintainability | `collectTsFiles`를 그대로 위임하는 1줄 래퍼 함수가 4개의 다른 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로 존재, 1곳은 래퍼 없이 직접 호출 | `audit-action-binding-guard.ts:47-48` 등 5곳 | 반복 유예(5R부터). 지금 통일하면 5개 가드 공개 표면을 동시에 바꾸는 별건이 됨 |
| 12 | testing | `findStaleSpecCasts`가 따옴표로 감싼 객체 키(`'widenedAt': null as unknown as Date`)에서 필드명을 놓침 — `stripLiterals`가 키의 따옴표 내용까지 지워버려 위음성 발생. 저장소 전수 grep 결과 현재 0건이라 미발현 | `nullable-type-lie-cast-guard.ts` (`stripLiterals`+`SPEC_CAST`) | `it.each`로 quoted-key 캐너리 추가하거나 최소 docstring에 한계로 명시 |
| 13 | testing | `SPEC_CAST`를 겨눈 fixture가 전부 단일 줄이라 멀티라인 캐스트가 실제로 잡히는지 캐너리로 고정되지 않음(정적 판단상 동작할 것으로 보이나 미실측) | `nullable-type-lie-cast.spec.ts` | `it.each` 1건으로 멀티라인 fixture 캐너리화. 필수 아님 |
| 14 | documentation | 3개 소비 가드 중 2곳(`masked-reject-callers-guard.ts:47`, `redis-fail-open-catalog-guard.ts:92`)의 한 줄 docstring이 `collectTsFiles`가 이제 항상 적용하는 `.d.ts` 제외를 언급하지 않음 | `masked-reject-callers-guard.ts:47`, `redis-fail-open-catalog-guard.ts:92` | 다음에 이 파일들을 만질 때 docstring 한 줄 보완 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음 — 테스트/빌드타임 정적 분석 도구 리팩터, 외부 입력/인증/시크릿 표면 없음 |
| performance | LOW | 신규 저장소 전수 테스트의 중복 트리 워크(WARNING), `widenedEntityFields` 재계산(INFO) |
| architecture | LOW | dist 포함 vs build-exclude 소비처 비대칭, 범용/도메인 predicate 공존(둘 다 INFO) |
| requirement | LOW | plan 체크박스 stale(WARNING), spec 회색지대·나머지 planner 항목 스코프 정상(INFO) |
| scope | NONE | 8R 대비 신규 커밋은 지적된 지점에 정확히 국한, 스코프 이탈 없음 |
| side_effect | LOW | `findUntypedNullableColumns` 판정 확장(INFO), 그 외 시그니처/전역상태/FS 전부 무변화·격리 확인 |
| maintainability | LOW | `WIDENED_DECL` 명명, 1줄 래퍼 4개 이름 비일관(둘 다 반복 유예 INFO), CRITICAL/WARNING 없음 |
| testing | LOW | `findStaleSpecCasts` quoted-key 위음성, 멀티라인 캐스트 미검증(둘 다 INFO, 저장소 전수 미발현) |
| documentation | NONE | 8라운드 지적사항 전부 반영 확인, 남은 것은 docstring 완전성 INFO 1건 |

## 발견 없는 에이전트

- security (발견사항 "없음" 명시)

## 권장 조치사항

1. `plan/in-progress/entity-nullable-column-type-mismatch.md:491` 체크박스를 `[x]`로 전환 — `:264`의 자동 가드가 이미 그 사각지대를 닫았음을 후기로 명시 (requirement WARNING)
2. `nullable-type-lie-cast.spec.ts:422-427`의 중복 `collectTsFiles(SRC_ROOT)` 호출을 제거하고 `includeSpec:true` 결과 하나에서 두 축을 `.filter()`로 파생 (performance WARNING)
3. (선택) `widenedEntityFields(entities)`를 describe 스코프 상수로 1회 계산해 재사용 (performance INFO)
4. (선택) `findStaleSpecCasts`의 quoted-key 위음성 경계를 캐너리 또는 docstring으로 고정 (testing INFO)
5. (선택) 다음에 관련 파일을 만질 때 `masked-reject-callers-guard.ts`/`redis-fail-open-catalog-guard.ts` docstring에 `.d.ts` 제외 언급 보완 (documentation INFO)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (9명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(누락 없음)
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이번 diff 에 신규/변경 외부 의존성 없음(devDependency 미도입) |
  | database | router 판단 — DB 스키마/쿼리 변경 없음(정적 분석 테스트 인프라만 변경) |
  | concurrency | router 판단 — 동시성 표면(락, 트랜잭션, 비동기 경쟁) 변경 없음 |
  | api_contract | router 판단 — 공개 API/DTO 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 대면 가이드/문서 영향 없음(내부 테스트 인프라) |