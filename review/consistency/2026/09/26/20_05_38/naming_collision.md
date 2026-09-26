# 신규 식별자 충돌 검토 — request-body-guard

## 점검 범위

- spec 델타: `spec/conventions/swagger.md` (26줄, §5-4 체크리스트 1항목 + Rationale 1절 + frontmatter `code:` 1항목)
- 코드 델타: 6개 파일 / 506줄
  - `codebase/backend/src/common/pipes/validation.pipe.ts` / `.spec.ts` — `UNVALIDATED_METATYPES` 신설
  - `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` (신규) — `RequestBodyViolation` · `RequestBodyScan` · `scanRequestBodyAdvertised` · 로컬 상수 `SWAGGER_API_PARAMETERS` · `SWAGGER_EXCLUDE_ENDPOINT` · `SWAGGER_EXCLUDE_CONTROLLER`
  - `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` (신규) — fixture 클래스(`FixtureBodyDto` · `BodyFixtureController` · `AlphaBodyFixtureController` · `ExcludedBodyFixtureController` · `BareRouteController`)
  - `codebase/backend/src/shared/testing/swagger-probe.ts` / `.spec.ts` — `bodyArgIndexes` 신설
- plan: `plan/in-progress/request-body-guard.md`, `plan/in-progress/spec-draft-swagger-request-body.md` (신규 파일)

각 신규 식별자를 워킹트리(HEAD) 전체(`codebase/`, `spec/`)에서 grep 하여 기존 사용처와의 의미 충돌 여부를 확인했다.

## 발견사항

충돌 없음. 신규 식별자별 확인 결과는 다음과 같다.

- `UNVALIDATED_METATYPES` — `validation.pipe.ts` 신설, 타 파일에서 동일 이름 기존 정의 없음(grep 전수 일치, 전부 이번 diff 참조).
- `bodyArgIndexes` — `swagger-probe.ts` 신설, 기존 `bodyParamDesignType` 의 리팩터 파생 함수로 그 파일 내부에서만 새로 쓰임. 동명 기존 함수 없음.
- `scanRequestBodyAdvertised` / `RequestBodyViolation` / `RequestBodyScan` — 신규. 형제 가드(`forbidden-response-codes-guard.ts` 의 `ForbiddenCodeViolation`/`ForbiddenCodeScan`, `http-status-advertised-guard.ts` 의 `HttpStatusViolation`/`HttpStatusScan`, `param-uuid-pipe-guard.ts` 의 `UuidParamViolation`/`UuidParamScan`, `workspace-param-binding-guard.ts` 의 `WorkspaceParamBindingViolation`/`WorkspaceParamBindingScan`)과 `<Domain>Violation`/`<Domain>Scan` 명명 패턴이 일치하며, prefix(`RequestBody`)가 겹치는 기존 항목은 없다.
- `SWAGGER_API_PARAMETERS` — 신규(값 `'swagger/apiParameters'`). 기존 사용처 없음.
- `SWAGGER_EXCLUDE_ENDPOINT` / `SWAGGER_EXCLUDE_CONTROLLER` — 동일한 이름·문자열 값의 `const` 가 형제 파일 `forbidden-response-codes-guard.ts` 에도 있다(둘 다 모듈 스코프 비-export `const`, 패키지가 `dist/constants` 를 열지 않아 값을 복붙한다는 동일 사정을 diff 주석이 명시). 두 파일 다른 모듈이라 실제 이름공간 충돌은 없고, 값도 동일해 의미 충돌도 아니다 — 저장소가 이미 채택한 "형제 가드마다 상수를 복제한다" 관행의 반복이다(신규 위반 아님).
- 파일 경로 — `request-body-advertised-guard.ts` / `request-body-advertised.spec.ts` 는 형제 `http-status-advertised-guard.ts` / `http-status-advertised.spec.ts` 와 동형 명명(`<name>-guard.ts` + `<name>.spec.ts`, `-advertised` 접미)이며, frontmatter glob `request-body-advertised*.ts` 도 다른 glob 과 겹치지 않는다.
- fixture 클래스명(`FixtureBodyDto`, `BodyFixtureController`, `AlphaBodyFixtureController`, `ExcludedBodyFixtureController`, `BareRouteController`) — 신규 spec 파일 내부에 로컬 선언, 저장소 전체에 동명 클래스 없음.
- §5-4 — 기존 "새 엔드포인트 체크리스트" 섹션 번호를 그대로 쓰며 새 하위 ID 를 만들지 않는다(체크리스트 항목 1개 추가 + 기존 §5-4 제목 아래 Rationale 절 추가). 요구사항 ID 신설이 아니므로 ID 충돌 대상 자체가 없다.
- API endpoint / 이벤트·메시지명 / ENV var·config key — 이번 변경은 순수 문서 규칙 추가 + reflection 기반 저장소 가드이며, 신규 HTTP endpoint·webhook/queue/SSE 이벤트·환경변수를 도입하지 않는다.

## 요약

target 이 도입하는 식별자(`UNVALIDATED_METATYPES`, `bodyArgIndexes`, `scanRequestBodyAdvertised`, `RequestBodyViolation`, `RequestBodyScan`, `SWAGGER_API_PARAMETERS`, 신규 파일 `request-body-advertised{-guard,}.ts`, plan 파일 2건)를 워킹트리 전체에서 대조한 결과 기존 사용처와의 의미 충돌은 발견되지 않았다. `SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER` 상수명이 형제 가드 파일과 동일하게 재선언되지만, 모듈 스코프 비공개 상수이고 값도 동일하며 저장소가 이미 채택한 "가드마다 복제" 관행을 그대로 따른 것이라 충돌로 보지 않는다. `*Violation`/`*Scan` 타입 명명, `-guard.ts`/`.spec.ts` 파일 명명, §5-4 체크리스트 확장 방식 모두 기존 형제 가드(`forbidden-response-codes`, `http-status-advertised`, `param-uuid-pipe`, `workspace-param-binding`)의 컨벤션과 일관된다. 새 요구사항 ID·엔드포인트·이벤트명·환경변수도 도입되지 않았다.

## 위험도

NONE
