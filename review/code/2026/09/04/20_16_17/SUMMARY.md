# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 신규 회귀 방지 가드 `findNumericAsNumber` 가 같은 파일이 스스로 명시한 "정규식이 아니라 AST" 원칙을 어기고 정규식으로 구현되어, 중첩 객체 옵션·같은 줄 선언·인접 데코레이터·non-POSIX 경로 등 특정 조건에서 조용히(예외·실패 테스트 없이) 무력화될 수 있는 구조적 결함이 3개 reviewer(requirement/maintainability/testing)에 걸쳐 실측(스크래치 스크립트) 확인됨. 추가로 DTO 이름 매칭 휴리스틱의 관례 의존, 런타임(직렬화) 계약 테스트 부재도 WARNING 등급. **forced(router_safety) 7개 reviewer 전원 결과 확보됨 — 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 유지보수성/테스트 | 신규 가드 `findNumericAsNumber` 의 엔티티 컬럼 탐지가 정규식(`NUMERIC_COLUMN`)으로 구현돼, 같은 파일이 스스로 문서화한 "정규식으로 세 번 틀렸다 — AST 사용" 원칙을 위반한다. 실측(뮤테이션/재현 스크립트, 3개 reviewer 독립 확인)으로 다음 false-negative 확인: (1) `@Column` 옵션에 중첩 객체(예: `transformer: {...}`)가 있으면 `[^}]*` 가 안쪽 `}` 에서 멈춰 매칭 실패, (2) `@Column` 과 필드 선언이 같은 줄이면 `\s*\n\s*` 가 개행을 강제하므로 매칭 실패, (3) 필드 앞 접근 제한자(`public` 등, `readonly` 만 허용)나 (4) `@Index()` 등 다른 데코레이터가 사이에 끼면 매칭 실패. 네 경우 모두 실제 numeric 컬럼이 "numeric 아님"으로 조용히 분류돼, 이 가드의 존재 이유(응답 DTO 의 numeric→number 오문서화 재발 방지)가 해당 스타일에서 무력화된다. 현재 저장소의 두 numeric 컬럼은 우연히 이 함정을 피하는 스타일이라 지금은 오탐 없음. 대조군 테스트 없음. | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-217`(정규식), `:236-239`(사용처) | DTO측처럼 AST(`ts.isPropertyDeclaration`+`callDecorators`/`readBooleanOption` 패턴 확장)로 `@Column({...})` 의 `type` 프로퍼티를 읽도록 교체. 최소한 위 4가지 케이스를 대조군에 추가해 현재 한계를 캐너리로 고정 |
| W2 | 유지보수성 | 파일 역할 판별(`file.includes('/entities/')`, `file.includes('/dto/responses/')`)이 원본 절대경로(플랫폼 구분자 미정규화)에 대해 이뤄져, 같은 파일이 이미 확립한 `toPosixRelative`/`toPosixPath` 정규화 관례("`path.relative` 단독이면 윈도우에서 `\` 를 남긴다")를 신규 함수만 따르지 않는다. `path.sep` 가 `\` 인 환경에서는 매칭이 항상 실패해 `numericFields` 가 통째로 비어, 이 가드 축 전체가 에러·실패 테스트 없이 "위반 0건"으로 조용히 무력화된다. | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:236`, `:240` | 분류 전 `toPosixPath(file)` 또는 `toPosixRelative` 적용. 왜 이 축만 형제 함수(`findSwaggerContractMismatches`)와 다른 정규화 경로를 택했는지 근거를 주석으로 남긴다 |
| W3 | 테스트 | `findNumericAsNumber` 의 DTO↔엔티티 짝짓기가 `dto.replace(/Dto$/, '')` 이름 관례에 전적으로 의존한다. 저장소에 이미 이 관례를 벗어나는 응답 DTO(`StatisticsResponseDto` — `LlmUsageLog.costUsd` 자매 numeric 컬럼 노출)가 실재하며, 현재는 서비스가 `SUM(...)::float`+`Number(...)` 로 명시 변환해 무해하지만, 향후 `<Entity>Dto` 관례를 벗어난 이름으로 엔티티를 그대로 반환하는 신규 DTO가 생기면 이 가드는 조용히 통과시킨다. 이 한계에 대한 docstring 명시나 음성 대조군이 없다(이 파일의 `@Transform` 예외 캐너리 관행이 이 축에는 미적용). | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:258-261` | 함수 docstring 에 `<Entity>Dto` 이름 관례 의존을 명시하고, 이를 벗어난 이름의 음성 대조군 픽스처를 최소 하나 추가해 한계를 캐너리로 고정 |
| W4 | 테스트 | 이번 수정이 되잡는 것은 선언 시점(정적) 불일치뿐이며, 실제 `/api/alerts` 엔드포인트가 `threshold` 를 문자열로 **직렬화**하는지 검증하는 런타임 테스트(컨트롤러 unit·통합·e2e 어느 층위도)가 여전히 없다. `alerts.controller.spec.ts`/`alerts.service.spec.ts` 부재 확인, e2e 스펙에 `/api/alerts` 경로 참조 없음 — 직전 라운드 WARNING 이 요구한 대안 중 "런타임 축"은 채택되지 않았다(정적 가드만 추가, 유효한 트레이드오프이나 갭은 남음). | `codebase/backend/src/modules/alerts/alerts.controller.ts`, `alerts.service.ts` (테스트 파일 부재) | `alerts.controller.spec.ts` 에 응답 `threshold` 가 `typeof === 'string'` 임을 단언하는 얕은 테스트 최소 1건 추가, 또는 대표 엔드포인트 e2e 추가(plan 후속 체크리스트 (b) 항목과 일치) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 유지보수성 | 신규 함수가 파일의 기존 스타일(헬퍼 분리)과 달리 3가지 책임(엔티티 컬럼 수집·DTO 필드 수집·교차 판정)을 한 함수(~50줄)에 인라인 | `swagger-dto-contract-guard.ts:219-269` | `collectEntityNumericFields`/`collectDtoFieldTypes`/`matchOffenders` 세 헬퍼로 분리(W1·W2 수정과 함께 적용 가능) |
| I2 | 유지보수성 | 판정을 좌우하는 디렉터리 문자열(`/entities/`, `/dto/responses/`)이 이 파일의 상수화 관례(`API_DECORATORS` 등)를 따르지 않고 리터럴로 인라인됨 | `swagger-dto-contract-guard.ts:236`, `:240` | `ENTITY_DIR`/`RESPONSE_DTO_DIR` 명명 상수로 추출 |
| I3 | 테스트 | `numericFields`/`dtoFields` Map 키가 파일 경로가 아니라 클래스명뿐이라, 동명 엔티티/DTO 클래스가 생기면 나중 파일이 앞 파일을 조용히 덮어쓸 수 있음(현재 중복 0건 실측 확인). 저장소에 "동명 충돌" 캐너리 관행이 있으나 이 술어엔 미적용 | `swagger-dto-contract-guard.ts:222-223,239,248` | 우선순위 낮음(현재 무해) — 키를 파일 경로 접두로 바꾸거나 docstring 에 클래스명 유일성 가정 명시 |
| I4 | 유지보수성 | `AlertRuleDto.threshold` JSDoc 이 다른 필드 대비 5배 이상 김(이전 라운드에서 이미 INFO, 이번 diff 로 변경 없음) | `alert-rule-response.dto.ts:20-29` | 조치 불요, 차기 접촉 시 정리 |
| I5 | API계약 | `@ApiProperty({ type: String, example: '10.0000' })` 에 `pattern` 등 스키마 레벨 힌트가 없어, 코드젠 도구가 문자열 형태(십진수)를 스키마만으로 검증기에 살리지 못할 수 있음 | `alert-rule-response.dto.ts:28` | 우선순위 낮음, 필요 시 `pattern: '^-?\\d+(\\.\\d+)?$'` 정도 검토(이번 PR 요구사항 아님) |
| I6 | 문서화 | 소스 주석·plan 문서가 내부 리뷰 라운드 ID(`19_43_18`, `20_05_42` 등)를 직접 인용 — git 이력으로 역추적 가능하나, 리뷰 이력에 접근하지 않는 독자에겐 타임스탬프 자체가 설명력이 낮음 | `alert-rule-response.dto.ts:20-23`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요(관례 준수). 누적되면 CHANGELOG/plan 링크만 남기는 방식도 고려 |
| I7 | 부작용 | `NUMERIC_COLUMN` 정규식이 module-level `g` 플래그 상수 — 현재 유일한 사용처가 `matchAll`(내부 복제 의미론)이라 `lastIndex` 누적 부작용은 없음을 확인. 향후 `.test()`/`.exec()` 로 재사용되면 즉시 재발 가능 | `swagger-dto-contract-guard.ts` (`NUMERIC_COLUMN`) | 선택: 함수 내부 지역 변수로 이동하거나 "matchAll 전용" 주석 명시 |
| I8 | API계약 | 읽기(`AlertRuleDto.threshold: string`)/쓰기(`CreateAlertRuleDto.threshold: number`) 비대칭은 이번 diff 범위 밖의 기존 의도된 설계로 재확인됨(요청 검증 문제 없음) | `dto/responses/alert-rule-response.dto.ts` vs `dto/alert-rule.dto.ts` | 조치 불요(범위 밖) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | DTO 타입 정정은 인가/검증/SQL 경로에 영향 없음, 신규 가드는 개발-시점 전용(외부 입력 표면 없음), 하드코딩 시크릿 없음 |
| requirement | LOW | 핵심 변경(threshold DTO·엔티티·서비스·프런트엔드·spec 쓰기 DTO) 전수 대조 정합 확인. 정규식 가드의 스타일 의존(W1) 1건 |
| scope | NONE | 3커밋 전부 단일 결함(threshold)과 그 재발방지에만 결속, 무관한 파일/영역 수정 없음, review artifact 커밋은 저장소 표준 관례 |
| side_effect | LOW | breaking-but-already-true 확인(유일한 내부 소비자·평가 로직 모두 이미 string 전제), `g`-플래그 정규식 재사용 현재는 안전 |
| maintainability | MEDIUM | 신규 가드가 파일 자신의 AST 원칙(W1)·경로정규화 관례(W2)를 어겨 특정 조건에서 조용히 무력화 가능. 구조 분리·상수화 INFO 다수 |
| testing | MEDIUM | 정규식 취약성 뮤테이션으로 재현 확인(W1) + DTO 이름관례 의존(W3) + 런타임 직렬화 계약 테스트 부재(W4). 대조군 3방향 설계 자체는 견고함을 뮤테이션으로 긍정 확인 |
| documentation | NONE | 이전 두 라운드(코드리뷰·consistency) WARNING 전부 소스 대조로 반영 확인, 이번 diff 5개 실질 파일에서 신규 결함 없음 |
| api_contract | LOW | 계약 정합 재확인, 가드 스코프(`<Entity>Dto` 이름 대응)는 의도적으로 좁고 현재 실질 갭 없음, 경미한 스키마 힌트 개선 제안(I5) |

## 발견 없는 에이전트

security, scope, documentation — 세 reviewer 모두 위험도 NONE 이며, 보고된 항목은 전부 "실측 결과 문제 없음" 확인성 INFO(조치 불요)로, 신규 결함을 지적하지 않았다.

## 권장 조치사항

1. `findNumericAsNumber` 의 엔티티 컬럼 탐지를 정규식에서 AST 기반으로 교체한다(W1) — 이 가드의 존재 이유인 "재발 방지" 자체가 특정 코딩 스타일(중첩 객체·같은 줄 선언·인접 데코레이터)에서 조용히 무력화될 수 있는 구조적 결함이라 가장 시급하다.
2. 파일 역할 판별에 `toPosixRelative`/`toPosixPath` 정규화를 적용한다(W2) — non-POSIX 환경에서 가드 전체가 조용히 무력화되는 것을 방지.
3. DTO↔엔티티 이름 매칭의 `<Entity>Dto` 관례 의존을 docstring 에 명시하고, 이를 벗어난 이름의 음성 대조군을 추가한다(W3).
4. 대표 엔드포인트에 대한 런타임 계약 테스트(컨트롤러 unit 또는 e2e)를 추가해 "직렬화 축"을 마감한다(W4) — plan 후속 체크리스트 (b) 항목과 일치.
5. (낮은 우선순위) 헬퍼 함수 분리, 매직 문자열 상수화, Map 키 유일성 문서화 등 INFO 항목(I1~I3) 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨, 미이행 없음**
  - **제외**: 6명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 이 문서/타입 정합화·정적분석 가드 중심이라 성능 표면 낮음으로 제외 (개별 사유 미제공, 라우터 결정 원문 기준) |
  | architecture | router 판단 — 구조적 변경 없음(append-only, 기존 아키텍처 불변)으로 제외 |
  | dependency | router 판단 — 신규 의존성 도입 없음으로 제외 |
  | database | router 판단 — DB 스키마/마이그레이션 변경 없음(엔티티 타입 자체는 불변)으로 제외 |
  | concurrency | router 판단 — 동시성 관련 코드 경로 없음으로 제외 |
  | user_guide_sync | router 판단 — 사용자 가이드 동기화 대상 변경 없음으로 제외 |