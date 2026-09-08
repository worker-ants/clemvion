# 정식 규약 준수 검토 — convention_compliance

## 검토 조건 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/**` 델타: **0 파일** — 이 브랜치는 spec 을 바꾸지 않았다. 코드 전용 PR 이므로 이 자체는 정상이며 CRITICAL 근거로 쓰지 않았다.
- 구현 diff: 20개 파일 / 1246줄 (프롬프트 번들은 예산 초과로 diff 본문이 생략돼, 워킹트리에서 `git diff origin/main...HEAD` 를 직접 실행해 실제 변경분을 확인했다).
- 실제로 검토한 코드 변경 파일(주요): `codebase/backend/src/common/filters/http-exception.filter.ts`(+spec), `codebase/backend/src/modules/integrations/integration-oauth.service.ts`, `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`(+spec), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(신규)·`endpoint-path-conflict-wrap.spec.ts`(신규)·`fixtures/endpoint-path-save.fixture.ts`(신규), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(+spec), `codebase/frontend/src/lib/api/workflows.ts`, `CHANGELOG.md`, `plan/in-progress/spec-followups-batch-b.md`.
- 함께 대조한 spec/conventions 문서: `error-codes.md`, `swagger.md` 인용부(spec 본문 경유), `secret-store.md`/데이터 모델 §2.1.1 인용부(spec 본문 경유). 이미 spec 본문에 크로스레퍼런스된 절만 원문 조회, 그 외 274개 conventions 파일은 이번 diff 와 무관해 열지 않았다(cafe24/makeshop API 카탈로그 등).

## 발견사항

없음. 아래는 확인 근거이며 CRITICAL/WARNING 등재 대상이 아니다.

- **에러 코드 명명** — `http-exception.filter.ts` 리팩터(로컬 `isUniqueViolation` → SoT `isPostgresUniqueViolation`)는 raw pg-error 표면(`err.code`)도 409 `RESOURCE_CONFLICT` 로 매핑하도록 판정을 넓혔다. `RESOURCE_CONFLICT`·`INTERNAL_ERROR` 는 이미 `spec/5-system/2-api-convention.md §5.3`(상태코드별 기본값 표)와 `spec/5-system/3-error-handling.md §1.3`(카탈로그)에 등재된 기존 코드이므로, "코드 신설 시 카탈로그 등재 의무"(`2-api-convention.md` §5.3 하단, `error-codes.md`)에 저촉되지 않는다. 신규 코드가 아니라 기존 코드의 발행 표면만 넓어진 것이다.
- **`UPPER_SNAKE_CASE` 준수** — 이번 diff 가 다루는 모든 wire 에러 코드(`RESOURCE_CONFLICT`, `INTERNAL_ERROR`)는 `error-codes.md` §1 규약을 따른다. diff 는 초대 흐름의 `lower_snake_case` historical-artifact 코드를 건드리지 않았고, `1-auth.md §1.5.4`가 인용하는 `error-codes.md §3` 레지스트리 항목도 실제 파일과 문구가 일치함을 직접 대조 확인했다.
- **`User` 비밀 컬럼 노출** — `WorkspacesService.listMembers` 를 `relations: ['user']`(전체 로드 + JS 매핑) 에서 DB 레벨 `select` 투영(`{ id, email, name }`)으로 전환했다. 이는 `spec/1-data-model.md §2.1.1`(응답 노출 금지 민감 7컬럼)과 방향이 일치하는 강화이며, `user-entity-exposure-guard`/`user-secret-absence` 화이트리스트에서도 해당 항목이 함께 빠져 검출기 상태와 실제 코드가 동기화됐다. 규약 위반 방향이 아니라 규약 강화 방향.
- **타입 명명(내부, wire 아님)** — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 백엔드 내부 타입 이름과 프런트 손-미러 타입의 동명 충돌(같은 이름·다른 형태)을 해소하기 위한 것이다. spec/conventions 에는 TS 내부 타입 명명을 규율하는 별도 문서가 없어 이 검토 관점(정식 규약 준수)의 위반 대상이 아니다(참고: 동일 diff 는 `naming_collision` 관점의 별도 리뷰어가 이미 다루고 있다).
- **신규 AST 가드 3파일**(`endpoint-path-conflict-wrap-guard.ts` 등) — `spec/conventions/**` 에 정의된 출력 포맷·API 문서 규약과 무관한 내부 테스트 인프라이며, 형제 가드(`user-entity-exposure-guard.ts`, `swagger-dto-contract-guard.ts`)와 동일한 "파서 순수 로직 vs 소비 spec 분리" 관례를 명시적으로 따른다고 자체 주석에 적혀 있다 — 기존 관례 계승, 신규 위반 없음.
- **DTO/Swagger 데코레이터** — 이번 diff 는 `*.dto.ts` 파일을 하나도 건드리지 않는다(`git diff --stat` 확인). `spec/conventions/swagger.md` 의 데코레이터·nullable 선언 규칙이 적용될 변경분 자체가 없다.
- **문서 구조 규약** — `spec/5-system/*.md` 델타가 0이므로 Overview/본문/Rationale 3섹션·`_product-overview.md`·`0-` prefix 규칙에 대한 신규 준수/위반 판단 대상이 없다. 번들에 포함된 기존 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이미 Overview/본문/Rationale 구조를 갖추고 있고 conventions 크로스레퍼런스가 촘촘해 별도 지적 사항 없음.

## 요약

이번 배치는 `spec/5-system/**` 를 전혀 건드리지 않는 코드 전용 PR 이다. 실제 diff(pg-error SoT 단일화, `listMembers` User 컬럼 투영 전환, workflow-version 타입 개명, 신규 endpoint-path 충돌 래핑 AST 가드)를 직접 대조한 결과 모두 기존 `spec/conventions/error-codes.md`·데이터 모델 §2.1.1(비밀 컬럼 노출 금지)·`swagger.md` 크로스레퍼런스와 방향이 일치하거나 무관하며, 새 wire 에러 코드·DTO·엔드포인트 명명을 도입하지 않아 카탈로그 등재 의무도 발생하지 않는다. 정식 규약 준수 관점에서 이번 델타가 새로 만드는 위반은 없다.

## 위험도

NONE
