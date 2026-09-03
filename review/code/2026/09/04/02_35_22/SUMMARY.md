# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(문서화 — docstring 에 검증 안 되는 하드코딩 수치 재도입, 같은 파일이 이미 금지한 패턴). 나머지는 전부 INFO(구조적 관찰·저위험 견고성 다듬기)이며 8개 reviewer(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation) 전원 전문 확보 — forced 화이트리스트(documentation/maintainability/requirement/scope/security/side_effect/testing) 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `widenedEntityFields` docstring 의 "저장소 실측 20건" 이 검증되지 않는 하드코딩 개수 — 같은 파일 `collectScanTargets` docstring 이 "종전 '실측 12건'을 박아 뒀다가 같은 PR 안에서 12→24로 곧바로 낡았다. 검증되지 않는 숫자는 적지 않는다" 고 명시적으로 경고한 바로 그 실수를 재도입. 날짜 헤딩·재현 명령·pinning 테스트 전부 없음(저장소 전수 스위트는 `size > 100` 만 단언, "20건"을 고정하지 않음). nullable 필드가 하나 늘거나 줄면 조용히 틀려진다 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` `widenedEntityFields` 바로 위 docstring | `collectTsFiles` 관례(헤딩에 "2026-09-04 실측" 날짜 명시)를 따르거나, `collectScanTargets` 가 이미 택한 방식대로 개수를 아예 적지 않고 재현 명령(`grep -rn 'null as unknown as' --include='*.spec.ts'` 류 또는 저장소 전수 스위트 결과 로그)만 남긴다. 예시 필드명(`userId`·`workflowId`)만으로도 "이런 형태 충돌이 존재한다"는 근거는 충분 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 이름(문자열)만으로 매칭하는 설계가 이 저장소에서 **두 번째로 같은 결함 클래스**(동명이인 필드 오탐)를 냈다 — 자매 축(DTO nullable 매칭, 직전 PR)에서 48건 중 44건이 이름 매칭 오탐이었는데, 이번 엔티티-대-엔티티 매칭에서도 20건 재현. 현재는 각 가드에서 개별 사후 패치(비-null 이름 전역 제외)로 건전하지만 근본 원인(소유자 컨텍스트 없는 문자열 키)은 공유 유틸로 승격되지 않음 | `nullable-type-lie-cast-guard.ts:165-178` (`widenedEntityFields`) | 조치 불필요(급하지 않음). 세 번째 "이름 기반 매칭" 술어가 생기면 `source-scan.ts` 에 `excludeAmbiguousNames()` 류 공유 헬퍼 승격 검토 |
| 2 | architecture | `nullable-type-lie-cast-guard.ts` 가 이번 diff 로 세 번째 책임(`findStaleSpecCasts`)을 얻어 한 파일이 서로 다른 층위 세 검사(이중 캐스트 카운트/TypeORM 메타데이터 정합성/`.spec.ts` 잔재 캐스트)를 담게 됨. 공통 뿌리는 있어 응집도는 방어 가능하나 배치마다 기능이 누적되는 추세(주석에 "배치 1~3에서 세 번 손으로 찾았다" 자기기록) | `nullable-type-lie-cast-guard.ts:43-52`, `:104-121`, `:209-223` | 지금은 분리 불필요. 네 번째 관련 검사 추가 시 스캔 대상(prod/spec) 축으로 파일 분리 고려 |
| 3 | architecture | 같은 guard 계열 안에서 정적 분석 방식이 갈림 — `masked-reject-callers-guard.ts` 는 반복된 정규식 우회 끝에 AST(`typescript` 컴파일러)로 전환했는데 `nullable-type-lie-cast-guard.ts` 는 여전히 정규식(`WIDENED_DECL` 등). 모듈 docstring 이 이미 트레이드오프를 명시한 **의도된 선택**이지만 계열 전체 일관성 관점에서 기록 | `nullable-type-lie-cast-guard.ts:162-163` vs `masked-reject-callers-guard.ts:100` | 조치 불필요. 데코레이터 2개 스택 형태가 실재하는 날 AST 전환 함께 고려 |
| 4 | maintainability | `\| null` 유니온 판정(`tsType.includes('| null')`)이 부분 문자열 매칭이라 타입 표기 순서·공백에 취약 — `'null | Date'` 나 `'Date|null'` 형태면 위음성으로 새는데, 이 가드의 존재 이유(조용한 누락 방지)와 정면으로 닿는 지점. 현재 저장소는 전부 `Type | null` 순서라 미발현(`grep` 실측) | `nullable-type-lie-cast-guard.ts:172` (`widenedEntityFields`) | `tsType.split('|').map(s => s.trim()).includes('null')` 로 순서·공백 무관 비교로 변경, 또는 최소한 `WIDENED_DECL` docstring "한계" 절에 병기 |
| 5 | maintainability | `WIDENED_DECL` 정규식이 한 줄에 데코레이터 대안·괄호 균형·개행·선택적 2번째 데코레이터·필드명/타입 캡처를 압축해 가독성 낮음. 향후 `(?:...)*` 확장 예고 지점이라 더 늘리면 가독성 악화 우려 | `nullable-type-lie-cast-guard.ts:163-164` | 지금 당장 변경 불필요. 확장 시점에 조각별 상수(`DECORATOR_HEAD` 등)로 분해 고려 |
| 6 | maintainability / documentation | `masked-reject-callers-guard.ts` 의 `listSourceFiles` 로컬 JSDoc(`"src/ 하위 .ts 전수(node_modules·dist 제외)"`)이 이번 diff 로 생긴 새 동작(`.d.ts` 항상 제외)을 반영 못함 — 기능적 영향은 기존 라운드에서 "저장소에 `.d.ts` 0개라 오늘은 무해"로 이미 판정, 이 지적은 그 근거가 된 동작 변화가 이 지역 주석에 아직 안 반영됐다는 좁은 지적 | `masked-reject-callers-guard.ts` `listSourceFiles` 선언부 주석 | 급하지 않음. 다음에 이 함수를 만질 때 `.d.ts` 제외를 명시(예: `audit-action-binding-guard.ts:46` 관례처럼 정확한 제외 목록 명시) |
| 7 | maintainability | 4개 가드 파일(`audit-action-binding-guard.ts`/`masked-reject-callers-guard.ts`/`nullable-type-lie-cast-guard.ts`/`redis-fail-open-catalog-guard.ts`)에 `collectTsFiles` 로 위임하는 이름만 다른 1줄 래퍼(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)가 남음 — 이전 라운드(W5)에서 이미 지적·의도적으로 유예된 사항(호출부가 기존 이름에 의존해 통합 비용 대비 이득 낮음) | 4개 가드 파일 각 래퍼 함수 | 조치 불필요(이미 유예 확정) |
| 8 | testing | `sort()` 회귀 감지 테스트의 판별력이 `fs.readdirSync` 가 알파벳순이 아니라는, POSIX/Node 어디에도 보장되지 않는 성질에 의존 — 로컬(Darwin/APFS) 재현으로 전제 참임을 확인했고 CI(ubuntu ext4)에서도 우연 일치 가능성 낮지만, 이론상 다른 환경에서 뮤턴트를 조용히 통과시킬 수 있음. docstring 이 트레이드오프 일부는 이미 설명(`fs` property non-configurable 이라 spy 실패) | `source-scan.spec.ts:207-250` (`nested-sibling.ts` 픽스처) | 급하지 않음. `readdirSync` 반환을 fake 로 직접 주입하는 대안은 있으나 docstring 이 이미 트레이드오프를 밝혀 재작업보다 CI 이력 신뢰가 합리적 |
| 9 | testing | `stripComments → stripLiterals` 순서의 대칭적 blind spot(문자열 리터럴 안 `//` 를 주석으로 오인해 절단) 에는 `stripLiterals` 자신의 "중첩 백틱" 한계와 달리 pinning 테스트가 없음 — 1R security 리뷰어가 이미 방향(저탐지·무해) 판단 완료, "알려진 한계는 테스트로 고정한다"는 이 PR 자신의 관례가 이 자리에만 비대칭 | `nullable-type-lie-cast-guard.ts:215` (`stripLiterals(stripComments(...))`), 한계 서술은 `source-scan.ts:45-48` | 급하지 않음. 나중에 `[알려진 한계]` 네이밍으로 픽스처 하나 추가해 대칭 맞추기 |
| 10 | testing / requirement | `WIDENED_DECL` 의 "추가 데코레이터 1개까지만 허용" 한계가 pinning 테스트 없이 docstring 서술로만 존재 — 2R 에서 이미 INFO 로 기록·유예된 항목(위음성 방향, 저장소 전수 실측상 2단 스택 조합 없음)이 이번 라운드에도 코드 변경 없이 그대로 남음. 3개 라운드 연속 3명 이상 리뷰어가 공통 지적 | `nullable-type-lie-cast-guard.ts:155-163` | 이미 내려진 유예 결정 존중, 급하지 않음. 저장소에 2단 이상 스택 데코레이터 실재 시 처방 근거로 사용 |
| 11 | requirement | 이 diff(`collectTsFiles` 통합, `widenedEntityFields`/`findStaleSpecCasts` 신설)를 직접 규정하는 `spec/` 본문 없음 — 내부 CI 정적 가드/테스트 인프라라 spec 회색지대이며 spec fidelity 위반 아님 | `spec/conventions/raw-query-results.md:7` 등 코드 링크만 존재 | 조치 불필요 |
| 12 | requirement | plan 문서의 두 개 별도 후속 항목(spec/1-data-model.md §2.9 `next_run_at` 표기 정정, 2-api-convention.md §2.2 `/api/auth/*` 예외 조항)은 이번 diff 범위 밖으로 올바르게 `[ ]`(미완료·planner 턴 대기) 유지 — developer 권한 밖 항목을 임의 완료 처리하지 않은 올바른 처분 | `plan/in-progress/entity-nullable-column-type-mismatch.md:182-194,233-242` | 조치 불필요 |
| 13 | scope / side_effect | `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38}/**` (이전 라운드 산출물)이 diff 에 포함 — 저장소 관례("코드 리뷰 산출물은 `review/code/**`", "마무리 커밋에 리뷰 산출물 동반")에 정확히 부합, 스코프 이탈 아님(직전 라운드에서도 동일 결론) | `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38}/**` (파일 10~33) | 조치 불필요 |
| 14 | side_effect | 5개 구조적 가드가 하나의 공유 함수(`collectTsFiles`)에 위임하므로 향후 그 함수의 결함이 5개 가드에 동시 파급되는 blast radius 확대 — plan 문서에 파일 집합 동일성(507/818/1261/818/818) 실측 기록 + 전용 유닛 테스트로 회귀 방어는 갖춤 | `source-scan.ts` `collectTsFiles`, 소비처 5곳 | 조치 불필요 — 이후 `collectTsFiles` 를 고치는 PR 은 5개 소비처 전부 리뷰 대상임을 인지 |
| 15 | side_effect | `.d.ts`/`node_modules`/`dist` 필터와 `sort()` 가 5개 소비처에 균일 적용되며 일부 소비처(`masked-reject-callers-guard.ts`, `engine-error-code-anchor-guard.ts`, `redis-fail-open-catalog-guard.ts`)는 조용히 동작이 넓어졌다/좁아졌다 — plan 문서·docstring 에 축별 실측과 함께 명시된 의도적 결정, 오늘 시점 관찰 가능한 차이 없음 실측 확인 | 각 가드 파일 워커 위임 지점 | 이미 문서화·검증된 의도적 결정. `src/` 하위 `.d.ts` 발생 시 재검토 |
| 16 | side_effect | `stripComments` 가시성 확대(private → exported)는 순수 additive, 기존 시그니처·동작 불변, 기존 호출자 영향 없음 | `source-scan.ts` `export function stripComments` | 조치 불필요 |
| 17 | side_effect | `widenedEntityFields`/`findStaleSpecCasts` 는 순수 함수(지역 `Set` 만 사용, 전역/모듈 가변 상태 없음), 테스트 fixture 는 전부 `os.tmpdir()` 격리+`finally` 정리, "저장소 전수" 스캔은 읽기 전용으로 기존 관례와 일치 | `nullable-type-lie-cast-guard.ts` (`widenedEntityFields`), `*.spec.ts` fixture 헬퍼 | 조치 불필요 |
| 18 | security | `.d.ts` 필터가 `collectTsFiles` 통합으로 항상 켜지면서 일부 소비처의 스캔 범위가 조용히 좁아짐 — 탐지 대상이 줄어드는 방향(위음성 가능성)이지 인젝션·정보노출 아님. 이전 라운드에서 이미 다뤄지고 무해 판정됨(재확인) | `masked-reject-callers-guard.ts` (구 `listSourceFiles`), `source-scan.ts` `collectTsFiles` | 조치 불필요 |
| 19 | security | `stripLiterals`/`WIDENED_DECL` 정규식은 신뢰된 저장소 자신의 소스만 입력받아 ReDoS 실질 위험 없음(prefix-disjoint 구조, 얕은 1단 중첩만 허용, 공격자 통제 불가 입력) | `source-scan.ts` `stripLiterals`, `nullable-type-lie-cast-guard.ts` `WIDENED_DECL` | 조치 불필요 |
| 20 | security | `collectTsFiles` 는 `path.join` + 호출부 상수 스캔 루트만 사용해 경로 탐색(path traversal) 표면 없음 | `source-scan.ts` `collectTsFiles` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿·인젝션·경로탐색·ReDoS 표면 없음(테스트/빌드타임 정적 분석 도구, 신뢰 입력만) |
| architecture | LOW | 이름-기반 매칭 오탐 결함 클래스가 2회째 재발(아직 공유화 안 됨), 파일 책임 누적·정적분석 방식 계열 내 불일치는 관찰 수준 |
| requirement | NONE | 1R/2R WARNING fix 를 뮤테이션 재현(RED 재확인)으로 직접 검증, plan 수치("135→115") 재현 일치, spec 회색지대 확인 |
| scope | NONE | 두 후속 항목이 plan 사전계획과 정확히 결속, 스코프 이탈 없음 |
| side_effect | LOW | 상태변경·전역변수·네트워크 없음. 공유 스캐너 위임으로 blast radius 확대(회귀 방어 갖춤) |
| maintainability | LOW | `\| null` 부분문자열 매칭 위음성 취약점, 정규식 가독성, 로컬 JSDoc 미반영 |
| testing | LOW | 기존 WARNING(정렬 회귀·동명 필드 오탐) 실제 뮤테이션 재현으로 재확인 완료(57+139 테스트 GREEN). 남은 갭은 환경-의존 판별력·비대칭 pinning 테스트 부재 |
| documentation | LOW | **WARNING**: "저장소 실측 20건" 검증 안 되는 하드코딩(같은 파일이 금지한 패턴 재도입). 그 외 이전 라운드 WARNING 4건 반영 재확인, README/CHANGELOG 갱신 불요 확인 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원 최소 INFO 이상 발견사항 보고.

## 권장 조치사항

1. **(WARNING 우선 처리)** `nullable-type-lie-cast-guard.ts` 의 `widenedEntityFields` docstring 에서 "저장소 실측 20건" 하드코딩을 제거하거나 `collectTsFiles` 관례대로 날짜 헤딩을 붙인다 — 같은 파일의 `collectScanTargets` 가 이미 겪고 명시적으로 경고해 둔 실수(12→24 로 곧바로 낡음)를 재도입한 것이므로 우선순위가 있다.
2. `\| null` 판정(`tsType.includes('| null')`)을 `split('|').map(trim).includes('null')` 형태로 바꿔 타입 표기 순서·공백 취약점(위음성)을 제거하거나, 최소한 `WIDENED_DECL` docstring 한계 절에 명시한다.
3. `masked-reject-callers-guard.ts` 의 `listSourceFiles` 로컬 주석을 다음에 이 파일을 만질 때 `.d.ts` 제외를 반영하도록 갱신한다(급하지 않음).
4. 이름-기반 매칭 오탐 방지 로직(`nonNull.delete`)이 이 저장소에서 2회째 독립 재발한 것을 인지하고, 세 번째 유사 사례가 생기면 `source-scan.ts` 공유 헬퍼로 승격을 고려한다.
5. 이미 유예된 저위험 갭(WIDENED_DECL 데코레이터 1개 한계 pinning 부재, `stripComments→stripLiterals` 순서 blind spot 비대칭 pinning 부재, `sort()` 테스트의 파일시스템 순서 의존 프레이밍)은 이 영역을 다음에 손댈 때 함께 정리한다 — 지금 병합을 막을 사유는 아니다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(테스트/빌드타임 정적 분석 도구 리팩터)가 런타임 성능 경로를 건드리지 않는다고 판단(구체 사유 텍스트 미제공, reviewer 본문 내용과 정합적) |
  | dependency | router 판단 — 신규 외부 의존성 추가 없음(diff 는 저장소 내부 유틸 통합) |
  | database | router 판단 — DB 스키마/쿼리 변경 없음(정적 소스 스캔 도구) |
  | concurrency | router 판단 — 비동기/동시성 로직 변경 없음(순수 동기 파일 스캔·정규식 판정) |
  | api_contract | router 판단 — API/DTO 계약 변경 없음(내부 테스트 인프라) |
  | user_guide_sync | router 판단 — 사용자 대면 기능·문서 변경 없음(개발자 전용 리포지토리 가드) |