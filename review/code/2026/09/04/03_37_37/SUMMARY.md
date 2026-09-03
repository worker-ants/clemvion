# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없다. WARNING 3건(테스트 사각지대 1건 + 같은 plan 문서 내 문서 결함 2건)이 이 라운드의 실질 발견이며, 나머지는 전부 INFO(조치 불요/저우선순위)다. Forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `masked-reject-callers-guard.ts` 의 `listSourceFiles` 가 `collectTsFiles(rootDir, { includeSpec: true })` 로 위임하는데, `includeSpec: true` 옵션이 빠져도(오타·리팩터 실수) 어떤 테스트도 실패하지 않음을 실제 뮤테이션으로 확인(15/15 GREEN 유지). "죽은 항목" 캐너리가 `fs.readFileSync` 를 직접 호출해 `listSourceFiles` 자체를 우회하기 때문. 이 가드가 막으려는 정확한 실패 모드("가드가 조용히 약해져도 아무도 모른다")가 옵션 배선 층위에서 재발할 수 있는 사각지대 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:51` | `listSourceFiles(root)` 가 `.spec.ts` 를 실제로 포함하는지 직접 단언하는 테스트(합성 tmp 픽스처) 추가 |
| 2 | documentation | plan 문서의 "한 자리만 고치는 버릇" 절 헤딩이 "네 번" 이라고 하는데, 같은 최신 커밋(`93cd244af`)이 표에 5번째 행을 추가하며 본문 산문은 이미 "다섯 다" 로 고쳤다 — 헤딩과 본문이 서로 다른 개수를 말함. 이 절 자체가 "한 자리만 고치고 그 클래스를 훑지 않는 버릇"을 다루는 자리에서 같은 결함의 여섯 번째 사례가 됨 | `plan/in-progress/entity-nullable-column-type-mismatch.md:289` (헤딩) vs `:298`/`:300` (표 5번째 행·본문) | 헤딩을 `## 한 자리만 고치는 버릇 — 이 plan 에서 다섯 번 반복했다` 로 정정 |
| 3 | documentation | 같은 표의 4번째-5번째 행 사이에 낀 빈 줄이 GFM 표를 끊어, 5번째 행이 표가 아니라 파이프 문자가 그대로 노출되는 일반 문단으로 렌더링됨(실측: `python-markdown` tables 확장으로 직접 렌더링 확인) | `plan/in-progress/entity-nullable-column-type-mismatch.md:296-298` | `:297` 의 빈 줄 제거해 표를 하나로 연결 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `CollectTsFilesOptions.includeSpec` JSDoc 이 "실사례가 하나 있다" 고 적었지만, 같은 PR 의 바로 다음 커밋(`46f464583`)에서 두 번째 실사례(`nullable-type-lie-cast.spec.ts` 의 '저장소 전수' 테스트)가 생겨 개수가 하나 틀림. 기능 영향 없음(테스트 GREEN) | `codebase/backend/src/common/__test-utils__/source-scan.ts` `CollectTsFilesOptions` JSDoc | "실사례가 둘 있다"로 갱신(주석 정정만) |
| 2 | testing | `widenedEntityFields` 의 `@OneToOne` 분기가 유닛/저장소-전수 테스트 어느 쪽으로도 실행되지 않음(저장소에 `@OneToOne` 사용 엔티티 0개, 로직 자체는 복제 스크립트로 정상 동작 확인) | `nullable-type-lie-cast-guard.ts:169`(`WIDENED_DECL`) | `ENTITY` 픽스처에 `@OneToOne` 필드 추가 또는 별도 `it` 로 최소 커버 |
| 3 | testing | `isNullableType` 이 `Type \| null = <default>`(기본값 대입) 형태에서 `null` 을 인식 못해 위음성 방향으로 누락. 저장소에 해당 패턴 0건이라 현재 실피해 없음, 가드 철학(위음성 방향)과는 일치 | `nullable-type-lie-cast-guard.ts:180`(`isNullableType`) | 낮은 우선순위 — "알려진 한계" 로 docstring 명시 또는 최소 테스트로 고정 |
| 4 | testing | `WIDENED_DECL` 의 "데코레이터 2개 이상 스택 시 조용히 누락" 한계가 `stripLiterals` 의 한계(중첩 백틱)와 달리 회귀-고정 테스트가 없음 — docstring 의 "저장소 전수에 그런 조합 없음" 실측을 지키는 캐너리 부재 | `nullable-type-lie-cast-guard.ts` `WIDENED_DECL` docstring | `it('[알려진 한계] 데코레이터 2개 이상 스택은 조용히 누락한다', …)` 하나 추가(낮은 우선순위) |
| 5 | maintainability | `collectTsFiles` 통합 후에도 소비 파일마다 감싸는 한 줄 래퍼 이름이 4가지로 갈림(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`) — 동의어인데 이름이 달라 다음 사람이 필터 로직이 다르다고 오인할 소지 | `audit-action-binding-guard.ts`, `masked-reject-callers-guard.ts`, `nullable-type-lie-cast-guard.ts`, `redis-fail-open-catalog-guard.ts` | 다음에 개별적으로 만질 기회에 이름 통일 고려 |
| 6 | maintainability | `WIDENED_DECL` 정규식이 파일 내 가장 복잡한 단일 표현식(판정 축이 함수 3개에 걸침). 한계는 이미 docstring 화됨 | `nullable-type-lie-cast-guard.ts` `WIDENED_DECL`/`widenedEntityFields` | 데코레이터 조합 확장 시 AST 판정 전환 고려(형제 가드에 선례 있음) |
| 7 | architecture | `nullable-type-lie-cast-guard.ts` 한 파일이 층위가 다른 세 검사(프로덕션 이중 캐스트·TypeORM 메타데이터 정합성·낡은 spec 캐스트)를 담아 파일 책임이 배치마다 누적 확장 중(재확인, 상태 변화 없음) | `nullable-type-lie-cast-guard.ts:43-52,104-121,231-245` | 네 번째 관련 검사 추가 시 "스캔 대상" 축으로 파일 분리 고려 |
| 8 | architecture | 같은 guard 계열 안에서 정적 분석 방식이 갈림 — 신규 `WIDENED_DECL`/`COLUMN_DECL` 은 정규식, 형제 가드 3개는 AST. 의도된 트레이드오프로 docstring 에 명시됨(재확인) | `nullable-type-lie-cast-guard.ts:168-169` vs `masked-reject-callers-guard.ts:105` 등 | 조치 불요 — 데코레이터 2개 이상 스택 실재 시 AST 전환 재고 |
| 9 | architecture | `source-scan.ts` 가 4개 관심사(문자열 전처리·범용 카운팅·가드 전용 카운팅·디렉터리 순회)의 공유 커널로 계속 확장 중(재확인, 크기 변화 없음) | `source-scan.ts:1-22` 및 전체 export | 다음 프리미티브 추가 시 범용 축 vs 가드 전용 로직 구분해 분리 고려 |
| 10 | side_effect | 5개 walker 사본이 `collectTsFiles` 하나로 수렴 — 결함 표면(blast radius)이 한 곳으로 합쳐짐(시그니처 불변, 전용 테스트로 하드닝됨) | `source-scan.ts:249`, 5개 소비처 | 조치 불요 — 이후 `collectTsFiles` 를 고치는 PR 은 5개 소비처를 함께 인지 |
| 11 | side_effect | 3개 가드의 파일 수집 필터링이 조용히 넓어짐(`.d.ts` 배제·vendor skip·정렬이 원래 없던 가드에 추가됨). 결과 파일 **집합**은 실측(507/818/1261/818/818)으로 리팩터 전후 동일함을 확인, 회귀 없음 | `masked-reject-callers-guard.ts:48-51`, `audit-action-binding-guard.ts:47-48`, `engine-error-code-anchor-guard.ts:157` | 조치 불요 — 이미 문서화·재확인됨 |
| 12 | side_effect | `stripComments` 가 module-private → `export` 로 가시성 확대(순수 additive, breaking 없음) | `source-scan.ts:53` | 조치 불요 |
| 13 | side_effect | `describe('저장소 전수', …)`/`collectScanTargets()` 가 Jest 테스트 **수집 시점**에 저장소 전체 재귀 스캔 수행 — 예외 시 그 파일 전체 테스트가 미보고 처리될 수 있음(기존 관례 반복, 읽기 전용) | `nullable-type-lie-cast.spec.ts:81,396-400` | 조치 불요 |
| 14 | scope | 신규 함수(`collectTsFiles`/`widenedEntityFields`/`findStaleSpecCasts`) 둘 다 이번 배치에서 즉흥 추가된 게 아니라 같은 plan 문서에 이전 라운드부터 체크박스로 걸려 있던 후속 항목이었음(`git show` 로 확인) | `plan/in-progress/entity-nullable-column-type-mismatch.md` | 조치 불요 |
| 15 | scope | plan 문서에 덧붙은 "한 자리만 고치는 버릇" 회고 절(~90줄)은 체크박스 완료에 엄밀히 필요한 서술보다 큼 — 다만 이 plan 문서의 확립된 반복 관례라 돌출 스코프 확장 아님 | `plan/in-progress/entity-nullable-column-type-mismatch.md:289-329` | 조치 불요 |
| 16 | scope | diff 에 `review/code/2026/09/04/{...}/**` 신규 파일 61개(+5,459줄)가 포함 — 각 코드 변경 커밋에 그 라운드 리뷰 산출물이 동봉된 것으로, CLAUDE.md 저장 위치 규약과 일치 | `review/code/2026/09/04/*/**` | 조치 불요 |
| 17 | security | 신규 정규식(`WIDENED_DECL`/`COLUMN_DECL`/`CALL`)이 "균형 괄호 근사" 패턴으로 이론상 ReDoS 형태이나, 입력이 공격자가 아니라 저장소 자신의 `.ts` 소스이고 실행 주체도 로컬/CI `jest` 라 신뢰 경계 바깥에서 도달 가능한 입력이 없음 | `nullable-type-lie-cast-guard.ts`(`WIDENED_DECL`,`COLUMN_DECL`), `source-scan.ts`(`countRawUpdateReturning` 의 `CALL`) | 조치 불요 — 사용자 업로드 코드 스캔 등으로 재사용 시 재검토 |
| 18 | security | `fs.readFileSync`/`fs.readdirSync` 예외 시 파일 절대경로가 에러 메시지에 포함될 수 있으나 로컬 jest 실행 로그에만 노출, 프로덕션 경로 아님 | `nullable-type-lie-cast-guard.ts:46,109,191` | 조치 불요 |
| 19 | documentation | 리뷰 대상 diff **밖**에서, 공유 워크트리에 이 PR 이 만들지 않은 미커밋 로컬 변경(`masked-reject-callers-guard.ts` 에서 `includeSpec: true` 가 빠진 상태)을 일시 관측함 — 다른 세션의 뮤테이션 검증 잔여물로 추정, 리뷰 종료 시점엔 이미 사라짐 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (workspace 상태, 이 diff 소속 아님) | 조치 불요(이 리뷰의 판정 대상 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이론적 ReDoS 형태 있으나 신뢰 경계 밖에서 도달 불가. 하드코딩 시크릿·인젝션 등 해당 없음 |
| architecture | LOW | DRY 통합·단방향 의존 등 긍정적 설계 다수. 재확인된 INFO 3건(파일 책임 확장 추세·정규식/AST 비일관·공유 커널 확장) 상태 변화 없음 |
| requirement | LOW | 5라운드 발견사항(W1~W4 등) 전부 반영 재확인(117/117 테스트, 실측 일치). 신규 INFO 1건(JSDoc 실사례 개수) |
| scope | NONE | 두 신규 기능 모두 이전부터 걸려 있던 후속 항목, 무관한 파일 수정 없음 |
| side_effect | LOW | 프로덕션 런타임 코드 미변경, 파일 쓰기는 tmpdir 격리 확인. 결함 표면 합쳐짐·필터링 확대는 이미 문서화·검증됨 |
| maintainability | LOW | 이전 라운드 WARNING(픽스처 중복·JSDoc orphan) 조치 반영 확인. 잔여 INFO 2건(래퍼 이름 불일치·정규식 복잡도) |
| testing | MEDIUM | WARNING 1건 — `includeSpec: true` 옵션 배선 실수를 잡는 테스트 없음(뮤테이션으로 실증). 182 tests 전부 GREEN, tsc/eslint 클린 |
| documentation | MEDIUM | WARNING 2건 — plan 문서 최신 커밋 자체가 헤딩/본문 개수 불일치 + 표 렌더링 깨짐(빈 줄)을 새로 만듦. 5라운드 이전 지적사항은 전부 반영 재확인 |

## 발견 없는 에이전트

security, scope — Critical/Warning 없음(NONE, 순수 INFO/해당없음).

## 권장 조치사항

1. `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "한 자리만 고치는 버릇" 절 헤딩을 "다섯 번" 으로 정정하고, `:297` 의 빈 줄을 제거해 GFM 표 렌더링을 복구한다(WARNING #2, #3 — 둘 다 같은 절 안의 순수 문서 수정, 5분 내 처리 가능).
2. `masked-reject-callers-guard.ts` 의 `listSourceFiles` 가 `includeSpec: true` 를 실제로 전달하는지 직접 단언하는 테스트를 추가한다(WARNING #1 — 뮤테이션으로 사각지대 실증됨).
3. (낮은 우선순위, 선택) `CollectTsFilesOptions.includeSpec` JSDoc 의 "실사례 하나" 를 "둘" 로 갱신 — 기능 영향 없는 문서 정확도 문제.
4. (낮은 우선순위, 선택) `widenedEntityFields` 의 `@OneToOne` 분기·기본값 대입 위음성·다중 데코레이터 스택 한계 3곳에 최소 회귀-고정 테스트 또는 docstring 명시 추가 — 현재 실피해는 없으나 다음 사람의 재발견 비용을 줄임.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(프롬프트에 구체적 사유 미제공 — 정적 테스트/CI 도구 변경으로 런타임 성능 영향 없다고 판단된 것으로 추정) |
  | dependency | 동상 |
  | database | 동상 |
  | concurrency | 동상 |
  | api_contract | 동상 |
  | user_guide_sync | 동상 |