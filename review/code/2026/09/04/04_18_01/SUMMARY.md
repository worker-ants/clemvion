# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 1건(`testing`: `findUntypedNullableColumns` 가 같은 파일에서 이미 하드닝한 `| null` 노테이션 판정을 쓰지 않고 옛 naive 판정을 그대로 써 자신이 막으려는 사고를 놓칠 수 있음). 나머지 6개 reviewer(`security`/`requirement`/`scope`/`side_effect`/`maintainability`/`documentation`)는 NONE~LOW 로, 전부 INFO 이하. forced(router_safety) whitelist 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `findUntypedNullableColumns` 가 같은 파일 `isNullableType` 이 이미 하드닝해 둔 `\| null` 노테이션-강건 판정을 쓰지 않고 옛 naive `tsType.includes('\| null')` 를 그대로 씀. `Date\|null`(공백 없음)·`null \| Date`(순서 반대) 표기의 nullable 컬럼에서 `type:` 누락을 놓쳐, 이 가드가 막으려는 TypeORM 부팅 크래시(`DataTypeNotSupportedError`)를 조용히 통과시킬 수 있음(false negative). 저장소 전수에 그런 표기 변형이 현재 0건이라 라이브 회귀는 아니나, 자매 함수 `widenedEntityFields` 는 동일 변형을 `it.each` 캐너리로 고정해 뒀는데 이 함수만 테스트도 하드닝도 안 됨 — 이 changeset 이 반복 지적해 온 "자매 함수 중 하나만 고치는" 패턴의 재발 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:113` (`findUntypedNullableColumns`), 대조: `:172-185`(`isNullableType` docstring+하드닝 구현) | `:113` 의 `!tsType.includes('\| null')` 를 `!isNullableType(tsType)` 호출로 교체(함수가 같은 파일에 이미 있어 비용 0). 교체 후 `widenedEntityFields` 의 `it.each` 와 대칭인 노테이션-변형 캐너리 2~3건을 `findUntypedNullableColumns` 쪽에도 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `findUntypedNullableColumns` 의 "`type:` 명시 여부" 판정이 따옴표로 시작하는 문자열 리터럴만 인식 — 비-문자열 `type:` 값은 "타입 미지정"으로 오판 가능(위음성 방향, 저장소 전수 실재 0건) | `nullable-type-lie-cast-guard.ts` (`type:` 판정문) | 조치 불필요. 이 파일의 다른 함수처럼 "값이 리터럴이 아니면 놓친다 — 실재 없음(실측일)" 한 줄 문서화 고려 |
| 2 | requirement | 이 changeset(내부 test-tooling/repo-guard) 을 직접 규정하는 `spec/` 본문 없음 — 회색지대, spec fidelity 위반 아님 | `spec/conventions/raw-query-results.md` 등 참조 문서만 존재 | 조치 불필요 |
| 3 | scope | `collectTsFiles` 통합이 `masked-reject-callers-guard.listSourceFiles` 에 `.d.ts` 배제·정렬을 부수적으로 새로 추가(누적 재확인, 위반 아님) | `masked-reject-callers-guard.ts` (`listSourceFiles`) | 조치 불필요 |
| 4 | scope | 리뷰 세션 산출물(8라운드분, 86개 파일)이 코드 변경과 같은 브랜치에 누적 커밋됨 — 확립된 관례 | `review/code/2026/09/04/{01_48_39..03_58_32}/**` | 조치 불필요 |
| 5 | side_effect | `stripComments` 가 모듈-비공개에서 공개 export 로 승격(신규 export 추가, 파괴적 변경 없음) | `source-scan.ts:53` | 조치 불필요, 참고 기록 |
| 6 | side_effect | walker 통합으로 2개 가드(`engine-error-code-anchor-guard`, `masked-reject-callers-guard`)의 파일 목록 반환 순서가 DFS 순서 → 정렬 순서로 변경(의도된 설계, 테스트 회귀 없음) | `engine-error-code-anchor-guard.ts:157`, `masked-reject-callers-guard.ts:48-51` | 조치 불필요. 향후 실패 메시지 스냅샷 테스트 추가 시 순서 변경 인지 필요 |
| 7 | side_effect | `.d.ts` 필터가 `masked-reject-callers-guard` 스캔 범위에 신규 적용(현재 0건 무영향). 4개 가드가 이제 단일 필터 함수를 공유해 향후 결함 전파 반경(blast radius) 확대 | `masked-reject-callers-guard.ts:48-51` | 조치 불필요, 이미 문서화된 결정 |
| 8 | maintainability | "1단 균형 괄호" 매칭 정규식 조각(`(?:[^()]\|\([^()]*\))*`)이 `COLUMN_DECL`(기존)과 신규 `WIDENED_DECL` 사이에 리터럴로 3회 반복 — 이 changeset 이 해결하려던 "한쪽만 하드닝하면 나머지가 뒤처진다" 패턴이 파일 내부에서 소규모 재발 | `nullable-type-lie-cast-guard.ts:78,169` | 조치 불필요. 다음에 데코레이터 파싱 축을 만질 때 공유 상수(`BALANCED_PARENS`)로 묶는 것 고려 |
| 9 | maintainability | `collectTsFiles` 위임 한 줄 래퍼가 4개의 다른 이름(`collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`)으로 남아 있음 — 1R 부터 유예 유지, 새 위험 증가 없음 | `audit-action-binding-guard.ts`, `masked-reject-callers-guard.ts`, `redis-fail-open-catalog-guard.ts`, `nullable-type-lie-cast-guard.ts` | 조치 불필요(기존 유예). 해당 파일 개별 수정 시 이름 통일 고려 |
| 10 | testing | `@OneToOne` 분기(`WIDENED_DECL`) 미실행 — 저장소 실사용 0건, 6R/7R 부터 판단 유지 | `nullable-type-lie-cast-guard.ts:169` | 조치 불필요 |
| 11 | testing | `isNullableType` 의 `Type \| null = <default>` 기본값 대입 형태 위음성 — 실재 0건, 판단 유지 | `nullable-type-lie-cast-guard.ts:180` | 조치 불필요 |
| 12 | testing | `WIDENED_DECL` "추가 데코레이터 1개까지만" 한계에 회귀-고정 캐너리 없음 — 3단 이상 스택 조합 실재 0건 | `nullable-type-lie-cast-guard.ts:160-166` | 조치 불필요 |
| 13 | documentation | `CollectTsFilesOptions.includeSpec` JSDoc/테스트 제목이 "실사례 하나"/"유일한 축" 이라 서술하나 실사용처는 이제 2곳(`masked-reject-callers-guard`, `nullable-type-lie-cast.spec.ts`) — 6R 부터 이미 알려져 "파일을 다음에 만질 때 표현을 낮춘다" 조건으로 명시 유예됨, 트리거 미발동 | `source-scan.ts:213-216`, `source-scan.spec.ts:252` | 조치 불필요(기존 유예 유지) |
| 14 | security | 정적 분석 유틸에 shell/`eval` 미사용, 하드코딩 시크릿 없음 확인 | `source-scan.ts`, `nullable-type-lie-cast-guard.ts` | 해당 없음(문제 없음 기록) |
| 15 | security | 정규식 기반 스캔의 ReDoS 형태는 아니며 입력도 공격자 통제 밖(저장소 자체 소스) | `source-scan.ts:79-81`, `nullable-type-lie-cast-guard.ts:168-169` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 attack surface 없음(테스트/빌드 시점 전용 정적 분석), 시크릿·인젝션·ReDoS 실질 위험 없음 |
| requirement | LOW | `type:` 문자열-리터럴 전제(INFO), spec 본문 부재 회색지대(INFO) — Critical/Warning 없음, 8라운드 누적 검증(jest 119/119 재현, plan 수치 135→115 직접 재현) |
| scope | NONE | `.d.ts`/정렬 부수효과·리뷰 산출물 누적 커밋 모두 재확인·의도된 것, 스코프 이탈 없음 |
| side_effect | LOW | `stripComments` export 승격·파일 순서 변경·`.d.ts` 필터 신규 적용 — 전부 의도된 설계, 회귀 없음 |
| maintainability | LOW | "1단 균형 괄호" 정규식 3회 반복(INFO), 래퍼 4종 이름 불일치(기존 유예) — 앞선 WARNING 2건은 반영 재확인 |
| testing | MEDIUM | **WARNING 1건**: `findUntypedNullableColumns` 가 하드닝된 `isNullableType` 미사용, 노테이션 변형에 false negative + 회귀 테스트 없음 |
| documentation | LOW | `includeSpec` "유일한 축" 서술 stale(기존 유예 재확인), 7R JSDoc orphan 수정 정확히 반영 확인 |

## 발견 없는 에이전트

security(위 정책상 문제 없음 확인만 기록), scope(위반 없음, INFO 재확인만).

## 권장 조치사항

1. **(WARNING, 권장)** `nullable-type-lie-cast-guard.ts:113` `findUntypedNullableColumns` 의 `!tsType.includes('| null')` 를 같은 파일의 `!isNullableType(tsType)` 호출로 교체 — 비용은 함수 호출 1줄 치환이며, `widenedEntityFields` 와 대칭인 노테이션-변형(`Date|null`, `null | Date`) 캐너리 테스트 2~3건을 함께 추가할 것.
2. (선택, INFO 누적) 이 changeset 은 이미 8라운드 리뷰-수정 루프를 거쳐 수렴 단계 — 위 WARNING 1건 조치 후 나머지 INFO 14건은 전부 기존에 판단·유예되었거나 저장소 전수 실측으로 현재 무영향임이 확인된 항목이므로 추가 라운드 없이 종결 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 = 실행 전원과 동일) — **forced whitelist 7명 전원 결과 확보됨**, 강제 화이트리스트 미이행 없음.
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(테스트 인프라 리팩터링)와 무관 |
  | architecture | 동상 |
  | dependency | 동상 |
  | database | 동상 |
  | concurrency | 동상 |
  | api_contract | 동상 |
  | user_guide_sync | 동상 |