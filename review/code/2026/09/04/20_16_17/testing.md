# 테스트(Testing) 코드 리뷰

## 범위

실질 코드/테스트 변경은 다음 4개 파일이다 (그 외 `review/**` 하위 신규 파일들은 이전 라운드의
리뷰 산출물 재커밋으로, 테스트 관점의 리뷰 대상이 아니다):

1. `CHANGELOG.md` — 문서
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string`
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 신규 술어 `findNumericAsNumber`
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 회귀 테스트
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 계획 문서(코드 아님)

가설 검증을 위해 `swagger-dto-contract-guard.ts` 를 스크래치 디렉터리에 `cp` 로 백업한 뒤
`findNumericAsNumber` 를 `return [];` 로 뮤테이션해 테스트 스위트를 재실행했고, 즉시 `cp` 로
원복했다(`git status --short` 로 저장소 클린 확인 완료 — 잔여물 없음).

## 발견사항

- **[WARNING]** `findNumericAsNumber` 의 엔티티 컬럼 추출이 **정규식**인데, 같은 파일 바로 위
  `findSwaggerContractMismatches` 의 헤더 주석이 "정규식으로 세 번 틀렸다"며 AST 채택 근거로
  드는 것과 **같은 부류의 실패를 재현**한다. 실측으로 확인: `NUMERIC_COLUMN` 정규식은
  (a) `@Column({ type: 'numeric', ..., transformer: { to: ..., from: ... } })` 처럼 옵션에
  **중첩 객체**가 있으면 `[^}]*` 가 첫 내부 `}` 에서 멈춰 매치 실패, (b) `@Column` 과 필드 선언
  사이에 `@Index()` 등 **다른 데코레이터가 끼어들면** `\s*\n\s*` 가 곧바로 식별자를 기대하므로
  역시 매치 실패한다. 두 경우 모두 실제 `numeric`/`decimal` 컬럼이 "numeric 아님"으로 조용히
  분류돼, 그 필드를 응답 DTO 가 `number` 로 잘못 문서화해도 **가드가 못 잡는다** — 이 가드의
  존재 이유 자체를 무력화하는 시나리오다. 이 두 형태에 대한 테스트가 전무하다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-217`
    (`NUMERIC_COLUMN` 정규식), `:219-269` (`findNumericAsNumber`)
  - 검증: 스크래치에서 재현 스크립트로 두 케이스 모두 매치 0건 확인(대조군으로 함께 넣은
    `simple`/`multilineOK` 는 정상 매치).
  - 제안: `NUMERIC_COLUMN` 을 AST 기반(entity 파일도 `ts.createSourceFile` 로 파싱해
    `@Column` 데코레이터 인자에서 `type` 프로퍼티를 읽는 방식)으로 교체하거나, 최소한
    `swagger-dto-contract.spec.ts` 의 대조군에 "중첩 객체 옵션을 가진 numeric 컬럼"·"다른
    데코레이터가 끼어든 numeric 컬럼" 두 케이스를 추가해 현재의 알려진 한계를 캐너리로 고정.

- **[WARNING]** `findNumericAsNumber` 의 DTO↔엔티티 짝짓기 휴리스틱(`dto.replace(/Dto$/, '')`)
  이 응답 DTO 클래스명이 정확히 `<Entity>Dto` 형태일 때만 작동한다는 **구조적 한계**에 대한
  테스트가 없다. 저장소에는 이미 이 패턴을 벗어나는 응답 DTO 가 실재한다
  (`StatisticsResponseDto` — `LlmUsageLog.costUsd` 를 집계해 노출하는 자매 numeric 컬럼의
  DTO). 지금은 `statistics.service.ts` 가 `SUM(...)::float`+`Number(...)` 로 명시 변환해
  무해하지만, 만약 어떤 신규 모듈이 엔티티를 그대로 반환하면서 DTO 이름이 `<Entity>Dto`
  관례를 벗어나면(흔한 패턴 — `XxxResponseDto`, `XxxSummaryDto` 등) 이 가드는 **조용히
  통과**시킨다. `swagger-dto-contract-guard.ts` 는 `@Transform` 예외처럼 알려진 한계를
  명시하고 경계를 캐너리로 고정하는 관행이 있는데(`:101-120`), 이 축에는 그 관행이 적용되지
  않았다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:258-261`
    (`const entity = dto.replace(/Dto$/, ''); const numeric = numericFields.get(entity); if (!numeric) continue;`)
  - 제안: 함수 docstring 에 이 이름 관례 의존을 명시하고, `<Entity>Dto` 가 아닌 이름의 DTO 가
    엔티티를 그대로 반환하는 픽스처(현재 발견 안 됨을 보여주는 음성 대조군)를 최소 하나
    추가해 한계를 문서화·고정.

- **[INFO]** `numericFields`/`dtoFields` 는 **파일 경로가 아니라 클래스명만으로** 키를 잡는
  `Map` 이다(`numericFields.set(cls, found)`, `dtoFields.set(cls, fields)`). 서로 다른 모듈에
  동명 엔티티/DTO 클래스가 생기면 나중 파일이 앞 파일을 조용히 덮어써 오탐/누락이 생길 수
  있다. 실측: 현재 저장소의 `entities/`·`dto/responses/` 전체에서 클래스명 중복은 0건(grep
  확인)이라 지금 당장의 결함은 아니지만, 이 저장소는 "동명 충돌"을 별도 축으로 캐너리
  테스트하는 관행이 이미 있다(관계 데코레이터 동명 충돌 대조군 선례) — 이 술어에는 그 관행이
  적용되지 않았고 회귀 테스트도 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:222-223`,
    `:239`, `:248`
  - 제안: 우선순위는 낮음(현재 무해). 여유가 되면 `Map<string, ...>` 키를 파일 경로 접두로
    바꾸거나, 최소 docstring 에 "클래스명 유일성 가정"을 명시.

- **[WARNING]** 이번 수정이 되잡는 것은 **선언 시점(정적) 불일치**뿐이고, `GET/POST/PATCH
  /api/alerts/rules` 가 실제로 `threshold` 를 문자열로 **직렬화**하는지 검증하는 런타임
  테스트(컨트롤러 unit, 통합, e2e 어느 층위도)는 여전히 없다. 직전 라운드(`19_43_18`)
  SUMMARY 의 WARNING #1 이 요구한 대안 중 "실제 엔드포인트 e2e/통합 테스트"는 채택되지 않고
  정적 가드만 추가됐다 — 유효한 트레이드오프이긴 하나(정밀도 손실이라는 근본 원인을 구조적으로
  막음), "타입 문서와 wire 가 어긋나도 아무도 못 잡는다"던 원 갭 중 **런타임 축**은 여전히
  열려 있다. 확인: `alerts.controller.spec.ts` 없음, `*.e2e-spec.ts` 어디에도 `/api/alerts`
  경로 참조 없음(`alerts-evaluator` 는 모듈명 나열일 뿐), `alerts.service.spec.ts` 도 없어
  `create`/`update`/`list` 자체도 단위 테스트 커버리지가 0이다.
  - 위치: `codebase/backend/src/modules/alerts/alerts.controller.ts`(테스트 파일 부재),
    `codebase/backend/src/modules/alerts/alerts.service.ts`(테스트 파일 부재)
  - 제안: `alerts.controller.spec.ts` 에 `list()`/`create()`/`update()` 응답의
    `threshold` 가 `typeof === 'string'` 인지 최소 1건씩 단언하는 얕은 테스트를 추가하거나,
    대표 엔드포인트 e2e — plan 문서(`spec-draft-nullable-notation-followups.md`)의
    후속 체크리스트 (b) 항목("대표 엔드포인트에 실제 응답 대조 테스트")과 일치.

## 긍정적 확인 사항

- 신규 테스트(`swagger-dto-contract.spec.ts` 의 `numeric 컬럼을 number 로 문서화한 응답 DTO`
  describe 블록, 게이트 291~346)는 **비어있지 않음을 뮤테이션으로 확인**했다 —
  `findNumericAsNumber` 를 `return [];` 스텁으로 바꾸자 대조군 첫 테스트("numeric 컬럼인데
  DTO 가 number 면 잡는다")가 실제로 RED 로 떨어졌다(23개 중 1개 실패, 나머지 통과 —
  실행 로그 확인). "저장소에 그런 자리가 없다" 단일 테스트만으로는 이 스텁 뮤턴트를
  못 잡지만(빈 배열=빈 배열), 대조군 3방향이 정확히 이 공백을 메운다.
- `withFiles`(`temp-fixture.ts`) 는 `mkdtempSync`+`finally` `rmSync` 로 테스트 간 격리가
  보장되고, thenable 오반환을 명시적으로 throw 하는 등 과거 라운드 발견사항이 이미 잘
  반영돼 있다. 실제 저장소 파일을 변형하지 않는 구조라 다른 테스트/리뷰어와 충돌하지 않는다.
- 대조군 설계(잡는다 / DTO 가 `string` 이면 안 잡는다 / `numeric` 아닌 컬럼은 안 잡는다)는
  분기를 실제로 가르는 fixture 값을 쓰고 있어 mutation 관점에서 견고하다.
- `CHANGELOG.md`(파일 1)가 "list() 만" 언급하던 이전 라운드 WARNING #2 는 이번 diff 에서
  "list·create·update 세 응답 모두"로 정정돼 이미 닫혀 있다(게이트 31~34) — 재차 지적할
  필요 없음.

## 요약

`AlertRuleDto.threshold` 자체의 타입 정정은 실측(엔티티·서비스·프런트엔드 grep)으로 뒷받침되고
회귀를 막는 정적 가드(`findNumericAsNumber`)와 대조군 테스트가 새로 추가돼 이전 라운드
WARNING #1(회귀 테스트 부재)의 취지는 부분적으로 닫혔다. 다만 그 가드 자체가 파일 상단
docstring 이 명시적으로 경계하는 "정규식으로 중첩 문법을 읽으려다 실패" 패턴을 그대로
재도입했음을 실측(스크래치 스크립트)으로 확인했고, DTO 이름 관례·클래스명 유일성 가정 등
추가로 캐너리 처리되지 않은 한계가 있다. 또한 원 결함이 "런타임에 실제로 문자열이 나가는가"를
검증하는 계약/e2e 테스트는 여전히 0건이라, 이 PR 이 닫은 것은 "선언 축"뿐이고 "직렬화 축"은
열려 있다.

## 위험도

MEDIUM
