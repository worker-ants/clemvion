# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 은 실질적으로 동일한 문제(3R 이 고친 규칙 위반이 같은 파일의 다른 두 자리에 재발 — 그중 하나는 존재하지 않는 대상을 가리키는 깨진 상호 참조)를 requirement/testing/documentation 3개 reviewer 가 각각 지적한 것으로, 중복 제거 후 1건으로 집계된다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보 확인, 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/정합성 | 3R 커밋(`df552e4c8`)이 `widenedEntityFields` docstring 에서 검증 안 되는 "실측 20건" 하드코딩을 제거했으나, 같은 커밋 묶음(2R `79bce075e`)이 함께 심었던 동일 값의 다른 두 자리는 손대지 않았다. `findStaleSpecCasts` docstring 은 "그 근거와 실측 20건은 **그쪽 docstring 에 있다**"고 적는데, 그 대상(`widenedEntityFields` docstring)에서 이미 그 숫자가 삭제돼 **존재하지 않는 것을 가리키는 거짓 참조**가 됐다. `nullable-type-lie-cast.spec.ts` 의 테스트 docstring 도 같은 "20건" 하드코딩을 그대로 갖고 있어(날짜·재현 명령·pinning 테스트 없음) 3R 이 스스로 세 번째 위반이라 자인했던 패턴의 네 번째 재발이다. 기능 회귀는 없음(202건 GREEN, 판정 로직 불변). | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:218-220` (`findStaleSpecCasts` JSDoc), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:312` (`describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', …)` docstring) | guard.ts:220 을 "그 근거는 그쪽 docstring 에 있다"(개수 언급 삭제)로 수정해 깨진 참조부터 해소. spec.ts:312 도 "20건" 을 빼고 예시 필드명만 남기거나 재현 명령을 추가해 `widenedEntityFields`/`collectScanTargets` 가 이미 채택한 관례(낡지 않는 서술)와 맞춘다. `grep -rn '20건' codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast*` 로 세 자리를 한 번에 확인 후 일괄 수정 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 신규 정규식(`WIDENED_DECL`/`stripLiterals`)이 이론적으로 backtracking 특성을 가지나, 입력이 전부 신뢰된 저장소 소스 파일이라 익스플로잇 경로가 없다(prefix-disjoint 분기라 다항조차 아님). | `codebase/backend/src/common/__test-utils__/source-scan.ts` (`stripLiterals`), `nullable-type-lie-cast-guard.ts` (`WIDENED_DECL`) | 조치 불요. |
| 2 | 부작용/보안 | `collectTsFiles` 통합으로 `masked-reject-callers-guard.ts`/`audit-action-binding-guard.ts`/`engine-error-code-anchor-guard.ts` 3개 가드의 파일 필터링이 조용히 넓어졌다(`.d.ts` 항상 제외 + `node_modules`/`dist` skip + `sort()` 추가 — 원래 각 가드는 이 축들을 갖고 있지 않았음). 저장소에 `src/` 하위 `.d.ts` 0개임을 실측해 오늘은 동작 불변이지만, 향후 `.d.ts` 가 추가되면 세 가드가 조용히 그 파일을 안 보게 되는 잠재적 커버리지 축소. | `masked-reject-callers-guard.ts:47-52`, `audit-action-binding-guard.ts:46-48`, `engine-error-code-anchor-guard.ts:157`, `source-scan.ts` `collectTsFiles` 정의부 | 조치 불요(문서화됨). `src/` 에 `.d.ts` 가 실제로 생기면 커버리지 가정 재검토. |
| 3 | 보안 | `findStaleSpecCasts` 가 `stripComments`→`stripLiterals` 순서를 상속해, 문자열 리터럴과 같은 줄의 낡은 캐스트를 놓칠 수 있는 기존 blind spot(저탐지 방향, 공격 표면 아님). | `nullable-type-lie-cast-guard.ts` `findStaleSpecCasts` | 조치 불요. |
| 4 | 아키텍처 | `nullable-type-lie-cast-guard.ts` 한 파일에 서로 다른 층위의 검사 3종(`findCastOffenders`/`findUntypedNullableColumns`/`findStaleSpecCasts`)이 누적돼 god-module 경향. | `nullable-type-lie-cast-guard.ts` (해당 3개 함수) | 4번째 관련 검사 추가 시 "스캔 대상(prod/spec)" 축으로 파일 분리 고려. |
| 5 | 아키텍처 | 필드 **이름**을 전역 키로 쓰는 매칭 설계가 이 저장소에서 두 번째로 같은 결함 클래스(동명이인 오탐)를 냈다(직전 PR 자매 축에서 48건 중 44건 오탐 선례). 각 가드가 개별 사후 패치로 대응했으나 근본 원인(소유자 컨텍스트 없는 문자열 키 매칭)은 공유 유틸로 미승격. | `nullable-type-lie-cast-guard.ts:185-198` (`widenedEntityFields`) | rule of three 적용 — 세 번째 이름-기반 매칭 술어 발생 시 `source-scan.ts` 로 공유 헬퍼 승격. |
| 6 | 부작용 | 5개 repo-guard 의 독립 walker 사본이 `collectTsFiles` 하나로 수렴해 결함 표면(blast radius)이 한 곳으로 합쳐짐. 노출 시그니처는 유지되고 전용 테스트(`source-scan.spec.ts`)로 하드닝돼 있어 실질 위험 낮음. | `source-scan.ts` `collectTsFiles`, 5개 소비 가드 | 조치 불요 — 향후 `collectTsFiles` 수정 PR 은 5개 소비처를 함께 인지할 것. |
| 7 | 부작용 | `stripComments` 가 module-private → `export` 로 가시성 확대(순수 additive, 기존 소비처 영향 없음). | `source-scan.ts:53` | 조치 불요. |
| 8 | 부작용 | `describe(...)` 블록이 `it()`/`beforeAll` 밖(Jest 테스트 수집 시점)에서 저장소 전체 재귀 스캔 수행 — 읽기 전용이나 예외 발생 시 그 파일의 전체 테스트 수집이 한꺼번에 실패할 수 있음(기존 관례와 동일 패턴, 신규 아님). | `nullable-type-lie-cast.spec.ts:394-400` | 조치 불요(기존 관례 유지). |
| 9 | 유지보수성 | `collectTsFiles` 로 위임하는 1줄 래퍼가 4개의 서로 다른 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로 남아 있어, 실제로는 동의어인데 서로 다른 필터 로직을 가진다고 오인하기 쉬움. 2R/3R 에서 이미 검토 후 "지금 통일하면 5개 가드 공개 표면을 동시에 바꾸는 별건" 이라는 근거로 유예 확정. | `audit-action-binding-guard.ts`(`collectSourceFiles`), `masked-reject-callers-guard.ts`(`listSourceFiles`), `nullable-type-lie-cast-guard.ts`(`collectScanTargets`), `redis-fail-open-catalog-guard.ts`(`listProductionSources`) | 이번 라운드 조치 불요. 5개 가드 파일 중 하나라도 다시 만질 기회에 이름 통일 고려. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 대상 전부 CI 전용 정적 스캐너, 사용자 입력/네트워크/DB/인증 접촉 없음. CRITICAL/WARNING 없음 |
| architecture | LOW | god-module 경향(INFO)·이름 매칭 오탐 재발(INFO). 이전 3R 조치 반영 재확인 |
| requirement | LOW | 3R 규칙 위반 재발(WARNING, 위 1번에 통합) + 숫자 실측 검증(135→115, 20건 일치) |
| scope | NONE | 45개 diff 파일 전부 plan 등록 항목에 결속, 스코프 드리프트 없음 |
| side_effect | LOW | collectTsFiles 통합에 따른 blast radius 확대·필터링 조용한 확장 등 INFO 다수, CRITICAL/WARNING 없음 |
| maintainability | NONE | 이전 WARNING 4건 전부 코드 반영 확인. 1줄 래퍼 이름 불일치는 기유예 INFO |
| testing | LOW | 3R 수정이 같은 파일 다른 두 자리는 안 고침(WARNING, 위 1번에 통합). 202건(60+142) GREEN 재확인 |
| documentation | LOW | testing 과 동일 WARNING(교차 참조 파손) 재확인, 근거 서술 자기모순 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 기록, 단 CRITICAL 은 전원 0건).

## 권장 조치사항
1. `nullable-type-lie-cast-guard.ts:220` 의 "그 근거와 실측 20건은 그쪽 docstring 에 있다"에서 존재하지 않는 대상을 가리키는 개수 언급을 제거(예: "그 근거는 그쪽 docstring 에 있다").
2. `nullable-type-lie-cast.spec.ts:312` 의 "20건 실재한다" 문구도 같은 관례(개수 삭제 + 낡지 않는 예시/재현 명령)로 맞춰, `widenedEntityFields`/`collectScanTargets` 가 이미 채택한 규칙과 파일 전체를 일관시킨다.
3. (저강도, 선택) INFO 9건은 대부분 이전 라운드에서 이미 검토·유예된 항목이므로 이번 라운드 즉시 조치는 불필요 — 각 항목에 명시된 트리거(4번째 검사 추가, 3번째 이름-매칭 술어, `.d.ts` 실제 추가, 5개 가드 재수정 시점)가 발생하면 그때 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보 확인 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(정적 파일 스캔 유틸 통합)과 무관 |
  | dependency | 신규 의존성 없음 |
  | database | DB 쿼리/스키마 변경 없음(테스트 스캐너/문서 변경) |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API/DTO 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 문서 변경 없음(내부 test-tooling) |