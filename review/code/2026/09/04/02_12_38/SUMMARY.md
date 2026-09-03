# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `findStaleSpecCasts` (신설 가드)가 필드 이름만으로 nullable 여부를 판정해, 서로 다른 엔티티의 동명 필드 충돌(저장소 실측 20건)에서 정당한 캐스트를 오탐으로 잡을 수 있음을 requirement·testing·documentation 세 reviewer 가 각각 독립적으로 재현·확인했다. 오늘 시점 실피해(잔존 offender)는 0이며 범위도 CI 가드/테스트 인프라에 한정되지만, 이 PR 이 스스로 자매 축(DTO 필드명 매칭)에서 "다른 엔티티 동명 충돌로 원리적으로 못 만든다"고 결론 내린 바로 그 실패 모드를 신설 가드가 그대로 재도입했다는 점에서 방치할 수 없다. forced reviewer 7명 전원 결과 확보 — 라우터 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / testing / documentation (3중 중복 발견, 통합) | `findStaleSpecCasts`/`widenedEntityFields` 가 넓혀진(`\| null`) 필드를 **필드 이름만으로** 전역 `Set<string>` 판정하여, 엔티티 귀속을 확인하지 않는다. 이 PR 이 같은 plan 문서에서 스스로 반증·포기한 "필드 이름만으로는 서로 다른 엔티티의 동명 충돌을 가른다" 실패 모드를 그대로 재도입했다. 저장소 정적 스캔으로 동명 필드가 한 엔티티는 nullable, 다른 엔티티는 non-null 인 충돌이 **20건** 실측됨(`userId`, `workflowId`, `expiresAt`, `createdBy`, `content`, `title`, `triggerId`, `scope`, `resourceId`, `resourceType`, `trigger` 등). scratch 재현(저장소 비변경, `ts-node` import 또는 픽스처 엔티티)으로 `EntityB.foo`(non-null, 캐스트 필요)가 `EntityA.foo`(widened)와 이름이 같다는 이유만으로 `findStaleSpecCasts` 에 offender 로 오탐됨을 직접 확인. docstring "## 왜 오탐이 없나" 절의 "판정이 기계적이다 … 걸린 자리는 예외 없이 제거 가능하고, 실제로 제거하면 `tsc` 가 통과한다"는 주장은 이 반례에서 **거짓**(제거하면 오히려 `tsc` 오류 발생) — 문서화된 보장이 구현보다 넓다. 오늘 저장소에 잔존 offender가 0인 것은 우연(이름 충돌이 존재하지 않아서)이지 설계가 막아서가 아니며, CI 배선(`nullable-type-lie-cast.spec.ts` "저장소 전수" 블록, `toEqual([])`)에 상시 걸려 있어 향후 20개 충돌 필드 중 하나에 정당한 캐스트가 추가되면 즉시 RED + 잘못된 처방(캐스트 제거 유도)이 나간다. | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:144-154`(`widenedEntityFields`, 엔티티 정보 없이 전역 `Set` 반환), `:159-181` 특히 `:172-178`("왜 오탐이 없나" docstring), `:183-197`(`findStaleSpecCasts` 본문, `widened.has(field)` 만으로 판정). 테스트 갭: `nullable-type-lie-cast.spec.ts:215-335`(`describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', …)` — 전 케이스가 단일 `ENTITY` fixture만 사용, "같은 필드명·다른 엔티티" 조합 미검증) | `widenedEntityFields` 가 필드명이 아니라 `(엔티티 클래스명/파일, 필드명)` 쌍을 반환하도록 바꾸고, `findStaleSpecCasts` 도 spec 캐스트가 겨눈 엔티티(캐스트 대상 타입 또는 파일명 컨벤션)와 대조해 쌍이 일치할 때만 offender로 잡도록 스코프를 좁힌다. 근본 수정이 급하지 않다면 최소 조치로 (a) 이 반례를 겨눈 대조군 테스트를 추가하고, (b) docstring "왜 오탐이 없나" 절에 이 스코프 한계(판정은 필드 *이름* 단위이지 (엔티티,필드) 쌍 단위가 아님)를 명시하며 "예외 없이"·"기계적" 같은 절대적 표현을 낮춘다 — `WIDENED_DECL`의 "데코레이터 1개까지" 한계를 문서화한 것과 동일한 관례를 여기에도 적용. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `WIDENED_DECL` 정규식에 괄호 균형용 중첩 정량자 형태(`(?:[^()]|\([^()]*\))*`)가 있으나, 대안이 서로 배타적이라 catastrophic backtracking은 아니고 저장소 자신의 `.entity.ts`(신뢰된 고정 크기 소스)에만 적용되는 빌드/테스트 전용 가드라 외부 입력 경로 없음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`WIDENED_DECL` 선언부) | 조치 불필요. 향후 사용자 입력/대용량 비신뢰 텍스트에 재사용될 경우에만 재평가 |
| 2 | maintainability | `WIDENED_DECL` 상수명이 실제 매칭 범위(nullable 여부 무관하게 모든 `@Column`/`@ManyToOne`/`@OneToOne` 필드 선언에 매치)보다 좁게 읽힘 — 실제 widened 필터링은 별도로 `widenedEntityFields` 내부 `if (tsType.includes('| null'))`에서 이뤄짐 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:141-142` | 상수명을 `COLUMN_OR_RELATION_DECL` 등으로 변경하거나, 선언부 위에 "이 정규식 자체는 nullable 여부를 가리지 않는다" 한 줄 추가 |
| 3 | maintainability | DRY 통합 이후에도 `collectTsFiles` 를 그대로 위임하는 1줄 래퍼 함수가 4개의 서로 다른 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로 남아 있고, 한 곳(`engine-error-code-anchor-guard.ts`)은 래퍼 없이 직접 호출 — 지금은 전부 동의어인데 이름이 달라 다음 독자가 로직이 다르다고 오인할 수 있음 | `audit-action-binding-guard.ts:47-48`, `masked-reject-callers-guard.ts:48,51`, `nullable-type-lie-cast-guard.ts:38-40`, `redis-fail-open-catalog-guard.ts:93-94`, `engine-error-code-anchor-guard.ts:157` | 지금 당장 조치 불필요. 다음에 이 파일들을 만질 때 래퍼 이름을 하나로 통일하는 후속 정리 고려 |
| 4 | side_effect | `collectTsFiles` 공유화로 5개 walker 사본의 동작이 바뀜(반환 항상 정렬, `.d.ts`/`node_modules`/`dist` 필터 항상 적용) — 외부 노출 시그니처는 유지되나 내부 순서·필터 변화가 있음. plan 문서에 파일 집합 동일성(507/818/1261/818/818)을 실측 기록해 회귀 없음을 확인 | `codebase/backend/src/common/__test-utils__/source-scan.ts:249`(`collectTsFiles`), 소비부 5곳 | 현재 문제 없음. 순서 의존 assertion이 있는 스펙이 있는지만 확인해 두면 충분 |
| 5 | side_effect | `stripComments` 가 `source-scan.ts` 내부 함수에서 `export` 로 가시성 확대됨(공개 표면 확장) — 순수 함수이고 기존 소비처 영향 없음 | `codebase/backend/src/common/__test-utils__/source-scan.ts:53` | 조치 불필요 |
| 6 | side_effect | `nullable-type-lie-cast.spec.ts` 의 "저장소 전수" `describe` 블록이 `it()` 밖에서 저장소 전체 트리 스캔 + 전수 `readFileSync` 수행(읽기 전용, 테스트 로드 시점 실행) | `nullable-type-lie-cast.spec.ts` `describe('저장소 전수', ...)` 블록 | 조치 불필요(참고 기록) |
| 7 | side_effect | 픽스처 파일시스템 쓰기는 전부 `os.tmpdir()` 격리 + `try/finally`/`afterEach` 정리로 저장소 실파일 불변 — 과거 실제 서비스 파일을 직접 변형했다가 복원 실패한 사고의 재발 방지 방향 | `source-scan.spec.ts`, `nullable-type-lie-cast.spec.ts` (`withFiles` 헬퍼) | 조치 불필요 — 개선으로 평가 |
| 8 | testing | `WIDENED_DECL` 의 "추가 데코레이터 1개까지" 알려진 한계는 이미 docstring 기재로 처분됐으나, 같은 diff의 `stripLiterals` 한계와 달리 RED 방향 pinning 테스트가 없어 두 "알려진 한계"의 엄격도가 다름 | `nullable-type-lie-cast-guard.ts:134-142`; 대응 테스트 부재 자리 `nullable-type-lie-cast.spec.ts:231-236` | 낮은 우선순위. 다음에 만질 때 `it.skip`/`[알려진 한계]` 네이밍으로 2단 스택 데코레이터 fixture 추가 고려 |
| 9 | scope / side_effect / maintainability (공통) | `review/code/2026/09/04/01_48_39/`·`01_49_18/` 하위 이전 리뷰 세션 산출물 13개 파일이 diff에 포함 — 프로젝트 관례상 `review/`는 gitignore 대상이 아닌 정상 커밋 대상이며 마무리 커밋에 plan 체크박스·리뷰 산출물을 함께 담는 것도 기존 관례임 | 파일 10~22 (`review/code/2026/09/04/01_48_39/**`, `01_49_18/**`) | 조치 불필요 — 스코프 이탈 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 빌드/테스트 전용 가드, 외부 입력 경로 없음. 정규식 구조 INFO 1건만 |
| requirement | MEDIUM | `findStaleSpecCasts` 필드명 전역 매칭이 자매 축(DTO 매칭)에서 이미 반증된 "동명 충돌" 실패 모드를 재도입(20건 실측 + 재현) |
| scope | NONE | 실질 변경 9개 파일 전부 plan에 명시된 두 후속 항목(walker 통합, 낡은 캐스트 가드) 범위 내. 스코프 이탈 없음 |
| side_effect | LOW | 순수 함수·읽기 전용 스캔, 노출 시그니처 유지, tmpdir 격리로 실파일 불변. INFO 5건(참고성) |
| maintainability | LOW | 문서화 규율 우수, 이전 라운드 WARNING 전부 해소 확인. INFO 2건(상수명, 래퍼 이름 불일치) |
| testing | LOW | 이전 라운드 W1/W2 뮤테이션 재검증으로 실제 회귀 방어 확인(GREEN/RED 재현). 신규 WARNING 1건(엔티티 무관 전역 매칭 오탐 반례 재현), INFO 1건 |
| documentation | LOW | 이전 라운드 W1/W2/W4 수정 반영 확인. WARNING 1건("왜 오탐이 없나" 절이 구현보다 넓게 주장) |

## 발견 없는 에이전트

security, scope — 실질 결함 없음(security는 INFO 1건만, 실질 위험 NONE).

## 권장 조치사항
1. `findStaleSpecCasts`/`widenedEntityFields` 의 필드명 전역 매칭을 엔티티(클래스/파일) 스코프로 좁히거나, 최소한 docstring "왜 오탐이 없나" 절에 20건 동명 충돌 사례와 그 위험을 명시해 "예외 없이 제거 가능" 같은 반증된 절대적 표현을 낮춘다 (requirement·testing·documentation 3중 확인, WARNING #1).
2. (낮은 우선순위) `WIDENED_DECL` 상수명을 실제 매칭 범위에 맞게 개명하거나 주석 보강.
3. (낮은 우선순위) 4개 서로 다른 이름의 `collectTsFiles` 1줄 래퍼를 다음 기회에 통일.
4. (낮은 우선순위) `WIDENED_DECL` 데코레이터 스택 한계에도 `stripLiterals`와 동일하게 RED pinning 테스트 추가해 표기 수준 대칭화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(빌드/테스트 전용 가드, 읽기 전용 파일 스캔)에 성능 영향 표면 낮음 |
  | architecture | 아키텍처 레벨 변경 없음(내부 test-utils 리팩터) |
  | dependency | 신규 외부 의존성 없음 |
  | database | DB 접근 코드 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없는 내부 인프라 변경 |