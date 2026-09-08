# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO]** Postgres 에러 판정이 `pg-error.ts` SoT 로 정확히 수렴 — DIP/DRY 개선
  - 위치: `codebase/backend/src/common/db/pg-error.ts:18-30`(`pgErrorCode`/`isPostgresUniqueViolation`), `codebase/backend/src/common/filters/http-exception.filter.ts:12,70`, `codebase/backend/src/modules/integrations/integration-oauth.service.ts:31-34`(import), `:1271-1273`·`:1825-1827`(사용)
  - 상세: 종전 `http-exception.filter.ts` 는 로컬 `isUniqueViolation`(`err instanceof QueryFailedError` 선행 요구)을 갖고 있었고, `integration-oauth.service.ts` 는 두 자리(cafe24/makeshop 설치 경로)에서 `constraint`/`driverError.constraint` 추출 로직을 손으로 복제하고 있었다. 이번 diff 는 셋 모두 `pg-error.ts` 의 `isPostgresUniqueViolation`/`pgErrorConstraint` 하나로 교체했다 — 프레젠테이션 경계(전역 예외 필터)와 비즈니스 레이어(OAuth 서비스) 두 곳에 흩어져 있던 "Postgres 에러 표면 판정"이라는 하나의 개념을 단일 모듈로 역전시켰다(DIP). `pg-error.ts` 자체는 외부 의존이 없는 순수 함수 모듈이라 순환 의존 위험도 없다.
  - 제안: 없음(긍정 기록). 다만 `instanceof QueryFailedError` 타입 가드에서 구조적(duck-typed) `err.code` 매칭으로 넓어진 점은, 전역 `@Catch()` 필터라는 가장 넓은 경계에서 "Postgres 가 아닌데 우연히 `.code === '23505'` 를 가진 객체"까지 같은 분기를 타게 만드는 의도된 트레이드오프다. 두 방향(23505→409/23502→500) 회귀 테스트로 고정돼 있고 문서화된 판단이라 조치는 불요하나, 이런 duck-typing 확장이 향후 또 필요해지면 판정 축(SQLSTATE 형태 검증 등)을 좀 더 좁히는 것을 고려할 만하다.

- **[INFO]** 형제 AST 가드의 중복 워커(`enclosingName`)를 공용 유틸로 승격 — 응집도 개선
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:75-131`(`enclosingScopeName` 신설), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:11-14,342`(자체 구현 제거 후 교체), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:12-15,141`(신규 가드가 처음부터 공용 함수 사용)
  - 상세: `user-entity-exposure-guard.ts` 가 갖고 있던 "노드를 감싸는 스코프 이름을 찾는" AST 워커를 신규 `endpoint-path-conflict-wrap-guard.ts` 가 처음엔 각자 재구현했다가(이전 리뷰 라운드 WARNING), 이번엔 두 구현의 판정 순서 차이(메서드 우선 vs 변수 우선)까지 문서화하며 하나(`source-scan.ts::enclosingScopeName`)로 합쳤다. 승격 과정에서 추가했던 "함수 초기자 변수 우선" 분기는 뮤테이션 테스트(`isFn` 을 상수 `false` 로 바꿔도 두 소비 스위트 전부 GREEN)로 죽은 코드임이 실측되어 제거됐다 — 검증되지 않은 분기를 남기지 않는 규율이 적용됐다.
  - 제안: 없음(긍정 기록).

- **[INFO]** `WorkspacesService.listMembers`/`WorkflowVersionsService.findOne` — JS 단 매핑에서 DB 레벨 `select` 투영으로 전환. 레이어 책임 배치가 개선됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`
  - 상세: 종전에는 `relations: ['user']` 로 `User` 엔티티 전 컬럼을 로드한 뒤 서비스(비즈니스 레이어)의 `.map` 이 필드를 골랐다. 그 형태에서는 `user-entity-exposure-guard`(구조 가드)가 **로드 형태**만 검사하므로 매핑이 넓어져도 잡지 못했다 — 방어가 "강제"가 아니라 "검출"에 그쳤다. 이번 변경은 컬럼 선택 책임을 리포지토리 쿼리(데이터 접근 레이어)로 내려, 민감 컬럼이 애초에 애플리케이션 메모리로 올라오지 않게 한다. 가드의 `hasProjectionFor` 판정 로직(`select` 값이 boolean 이 아니면 투영으로 인정)이 이 형태를 정확히 인식해 화이트리스트에서 해당 항목이 빠지는 것으로 전환이 기계적으로 검증된다 — 레이어 경계를 지키는 좋은 리팩터다.
  - 제안: 없음(긍정 기록).

- **[INFO]** `listMembers` 의 `select: { user: { id, email, name } }` 리터럴이 `workflow-versions.service.ts` 의 이름 있는 SoT `CREATOR_PROJECTION`(같은 값)과 별도로 다시 적혔다 — 단, 직전 리뷰 라운드에서 이미 실측·논의되어 **의도적으로 defer** 된 항목
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-231`(인라인 리터럴) vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:92`(`CREATOR_PROJECTION` 선언)
  - 상세: 직전 라운드(`review/code/2026/09/08/14_01_56` architecture WARNING)가 이 중복을 지적했고, `RESOLUTION.md`(W2)가 저장소 전수 grep 으로 실제 후보 4곳을 찾아 "값이 겹치는 것은 둘뿐"이며 나머지는 서로 다른 계약(`WorkflowVersionCreatorDto` 대조 테스트 vs `listMembers` 6키 반환 vs `notifications.service.ts` 의 발송 대상 셋)에 묶여 있다고 측정했다. 지금 억지로 공용 상수로 합치면 `WorkflowVersionCreatorDto` 가 필드를 늘릴 때 `listMembers` 가 조용히 같은 컬럼을 함께 로드하는, 서로 무관해야 할 바운디드 컨텍스트 간 결합이 생긴다는 근거도 명시했다. `plan/in-progress/spec-draft-nullable-notation-followups.md:792-800`(주변)에 재개 조건("셋째 자리가 같은 값으로 생기거나 두 계약이 실제로 한 개념으로 수렴하면 승격")까지 등재돼 있어, 이 리뷰에서 다시 WARNING 으로 올리지 않는다. 독립적으로 재검토한 결과도 이 판단에 동의한다 — `pg-error.ts` 케이스(같은 개념의 네 사본)와 달리 여기는 "우연히 같은 값"이라 결합의 이득보다 비용이 크다.
  - 제안: 조치 불요. 다음에 셋째 값-일치 사례가 생기면 등재된 재개 조건에 따라 공용 모듈(예: `common/db/user-projection.ts`)로 승격 검토.

- **[INFO]** 백엔드/프런트엔드 `WorkflowVersionDetail` 동명 타입 충돌은 개명으로 해소됐지만, 두 wire 타입을 자동으로 동기화하는 경계 계약은 여전히 없음 — 범위가 명시적으로 좁혀진 기존 부채
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70`(`WorkflowVersionDetailProjection`), `codebase/frontend/src/lib/api/workflows.ts:123`(`WorkflowVersionDetail`)
  - 상세: 개명(`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`)은 증상(이름 충돌로 grep 이 두 선언을 하나로 오판해 세 라운드 연속 "유일 정의" 오판을 낸 것)을 없앴을 뿐, 원인(공유 타입 패키지를 거치지 않는 손-미러, 형태 차이를 강제하는 계약 테스트 부재)은 그대로 남는다. 두 JSDoc 모두 "저쪽을 열어라"고 사람에게 요청할 뿐 자동 검증 장치는 없다. 문서 자신이 "공유 패키지화는 이 PR 범위 밖"이라 명시하고 있어 의도된 축소이며, 이번 diff 가 상황을 악화시키지 않았다.
  - 제안: 조치 불요(범위 밖 명시). 다음에 이 타입을 다시 열 때 e2e 응답 스냅샷이나 프런트 zod 스키마 검증으로 두 선언의 wire 형태 일치를 자동 확인하는 장치를 검토할 것.

- **[INFO]** 신규 `endpoint-path-conflict-wrap-guard.ts`(+ `.spec.ts` + fixture) — 기존 `repo-guards` 아키텍처 관례(스캔 로직/소비 spec 분리, 순수 함수, 매직 문자열 상수화)를 정확히 재현한 "fitness function" 스타일 구조 가드
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(전체, 신규), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts`(전체, 신규), `codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts`(전체, 신규)
  - 상세: 순수 AST 스캔 로직(`findTriggerRepositorySaves`)과 도메인별 기대값 목록을 든 소비 spec 을 분리한 구조가 형제 가드(`user-entity-exposure-guard.ts`, `swagger-dto-contract-guard.ts`)와 일관되고, `CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY` 처럼 오탈자가 fail-open 방향으로 죽지 않도록 문자열을 상수화했다. 처음 등재된 술어("`endpointPath` 를 대입·갱신하는 메서드의 save() 만 래핑 요구")가 실측 결과 두 정답 사이트(`create`/`update`, 둘 다 스프레드로 값이 실려 AST 로 추적 불가)를 하나도 못 잡는 vacuous 술어였음을 확인하고, "모든 save() 를 세고 래핑되었거나 화이트리스트에 사유와 함께 있어야 한다"로 술어를 뒤집은 판단도 견고하다 — 큐레이션된 파일 목록이 아니라 발견 기반 스캔이라 새 지점이 조용히 통과하지 않는다.
  - 제안: 없음(긍정 기록).

- **[INFO]** provider(cafe24/makeshop) 스펙 파일 간 `raceErrorSurfaces` 픽스처 리터럴 중복 — 기존 provider-미러 중복 정책과 결이 다르지만 저위험
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:602-632`, `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts`(동형 블록)
  - 상세: 이 저장소는 provider 간 구조적 미러 중복(`cafe24-api.client.ts`/`makeshop-api.client.ts`)을 "제3 provider 가 인증·rate-limit 에서 어떻게 발산할지 예측 불가"라는 근거로 의도적으로 유지하기로 확정한 선례가 있다. 여기서 중복되는 것은 provider 고유 로직이 아니라 provider 와 무관한 "Postgres 에러 모양"(flat/wrapped 두 표면)이라 같은 근거가 그대로 적용되는지는 분명치 않다. 다만 같은 diff 가 바로 옆에서 정확히 이 문제(반복되는 테스트 형태)를 `endpoint-path-save.fixture.ts` 라는 공유 fixture 파일로 뽑아 해결하는 패턴도 보여 준다 — 두 접근이 공존한다. 크기(26줄, 2자리)와 기능 영향이 작아 지금 조치가 급하지 않다.
  - 제안: 조치 불요. 다음에 이 배열을 만질 기회가 있으면 `common/db/__tests__/` 류의 공유 fixture 로 추출을 고려.

## 요약

이번 배치(B-1~B-8)는 이미 3라운드의 `/ai-review` 를 거치며 구조적 지적(형제 AST 워커 중복, 죽은 분기, 낡은 docstring)을 대부분 해소한 상태의 최종 diff다. 핵심 아키텍처 방향은 셋 다 긍정적이다 — (1) `pg-error.ts` 를 Postgres 에러 판정의 단일 진실로 삼아 프레젠테이션 경계(`http-exception.filter.ts`)와 비즈니스 레이어(`integration-oauth.service.ts`)에 흩어진 손-작성 사본을 제거(DIP), (2) `enclosingScopeName` 을 공용 AST 유틸로 승격해 형제 구조 가드 간 중복을 제거하고 뮤테이션 테스트로 검증되지 않은 분기까지 정리, (3) `listMembers`/`findOne` 을 JS 단 매핑에서 DB 레벨 `select` 투영으로 옮겨 방어 책임을 올바른 레이어(데이터 접근)로 재배치했고 그 전환이 구조 가드의 화이트리스트 변화로 기계적으로 검증된다. 신규 `endpoint-path-conflict-wrap-guard` 는 기존 `repo-guards` 아키텍처 관례를 정확히 재현한 fitness-function 스타일 가드다. 남은 두 항목 — `listMembers` 인라인 투영 리터럴과 `CREATOR_PROJECTION` 간 값 중복, 그리고 백엔드/프런트 `WorkflowVersionDetail(Projection)` 미러의 자동 동기화 계약 부재 — 은 모두 직전 리뷰 라운드에서 이미 실측을 동반해 의도적으로 defer 되었고 재개 조건이 트래커에 등재돼 있어, 이번 리뷰에서 재상향하지 않는다. 순환 의존성이나 레이어 경계 위반, SOLID 원칙의 명백한 위배는 발견되지 않았다.

## 위험도

LOW
