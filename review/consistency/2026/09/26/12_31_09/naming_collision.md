# 신규 식별자 충돌 검토 — forbidden-desc-codes

## 검토 범위

본 PR(`forbidden-desc-codes`)은 `@ApiForbiddenResponse` 설명 129곳을 가드 거부 코드(`NOT_A_MEMBER` / `EDITOR_REQUIRED` /
`ADMIN_REQUIRED`)를 싣도록 고치고, 공용 헬퍼와 reflection 기반 저장소 가드를 신설한다. spec 변경은
`spec/conventions/swagger.md` §5-4 + Rationale 한 곳(`spec_impact`)이며, 코드 diff 는 32개 파일 · 835 삽입 / 172 삭제
(`git diff origin/main...HEAD -- codebase`, 워킹트리 실측)다.

신규로 도입되는 식별자를 실제 워킹트리(절대경로 `Read`/`grep`)에서 직접 확인했다:

- `FORBIDDEN_NOT_A_MEMBER` (const), `forbiddenForRole(role)` (function) — 신설 `codebase/backend/src/common/swagger/forbidden-descriptions.ts`, `index.ts` 에서 `export *`
- `lowestRequiredRole(requiredRoles)` (function) — 기존 파일 `codebase/backend/src/common/constants/workspace-roles.ts` 에 추가(파일 자체는 기존)
- `ROLE_SHORTFALL` (module-local, unexported) — `forbidden-descriptions.ts` 내부
- 저장소 가드 신설 파일 쌍: `src/repo-guards/__tests__/forbidden-response-codes-guard.ts` / `forbidden-response-codes.spec.ts`, 내부 export `ControllerClass` / `RouteHandler` / `ForbiddenCodeViolation` / `ForbiddenCodeScan` / `loadControllers` / `collectRouteHandlers` / `guardRejectionCodes` / `scanForbiddenResponseCodes`
- 모듈 로컬 신규 상수: `workspaces.controller.ts` 의 `FORBIDDEN_OWNER_OR_PERSONAL`, `workflow-test-datasets.controller.ts` 의 `FORBIDDEN_EDITOR_OR_NOT_OWNER`, `integrations.controller.ts` 의 `FORBIDDEN_MEMBER_OR_ORG_ADMIN` / `FORBIDDEN_EDITOR_OR_ORG_ADMIN` / `FORBIDDEN_MEMBER_OR_ADMIN`(값만 헬퍼 참조로 교체, 이름 자체는 유지)
- 새 spec 파일 경로 없음(기존 `spec/conventions/swagger.md` 본문 확장 + frontmatter `code:` 라인 추가)

각 관점에 대해 아래와 같이 확인했다.

## 발견사항

없음 — 6개 관점 모두 실측으로 충돌을 배제했다. 근거는 아래와 같다.

- **요구사항 ID 충돌**: 이 PR 은 새 요구사항 ID(NAV-\*, WH-\*, CCH-\* 류)를 발급하지 않는다. 사용하는 에러 코드
  `NOT_A_MEMBER` / `EDITOR_REQUIRED` / `ADMIN_REQUIRED` 는 전부 기존 `ROLE_REQUIRED` 테이블(`workspace-roles.ts`)에서
  가져온 기존 코드이며 의미 변경 없이 설명 문구에만 반영했다.
- **엔티티/타입명 충돌**: `grep -rln "forbidden-descriptions|forbiddenForRole|FORBIDDEN_NOT_A_MEMBER|forbidden-response-codes"`
  를 `codebase/frontend`·`codebase/packages` 전체에 돌려 0건 — 백엔드 밖에서 동명 사용 없음. 백엔드 내에서도
  `common/swagger/index.ts` 가 재수출하는 `api-wrapped.ts`(`wrapDataSchema` 등)·`error-response.dto.ts`(`ErrorResponseDto` 등)
  export 이름과 겹치지 않는다. 옛 지역 상수(`FORBIDDEN_MEMBER_ROUTE` / `FORBIDDEN_ADMIN_ROUTE` / `FORBIDDEN_OWNER_ROUTE` /
  `FORBIDDEN_MEMBER`)는 diff 로 전부 삭제됐고 `grep -rn '\bFORBIDDEN_MEMBER\b' src` 도 0건 — 동명이의로 남은 잔재 없음.
  새 module-local 상수(`FORBIDDEN_OWNER_OR_PERSONAL` 등)는 각 컨트롤러 파일 스코프의 비-export `const`라 교차 충돌 여지가 없다.
  신규 repo-guard 파일 쌍의 `ControllerClass`/`RouteHandler`/`loadControllers` 등은 이 두 파일 사이에서만 쓰이며, 다른 24개
  기존 guard 쌍(`swagger-dto-contract-guard.ts` 등)이 이미 따르는 "가드마다 자기 완결형 helper 재정의" 컨벤션(의도된 중복,
  cafe24/makeshop 미러 패턴과 동일 계열)과 일치한다 — 이름이 겹쳐도 각 파일 스코프 안에서만 유효해 실질 충돌이 없다.
- **API endpoint 충돌**: 이 PR 은 라우트를 추가·변경하지 않는다 — 동작(상태 코드·본문·인가)은 diff 전 구간에서 불변이고
  `@ApiForbiddenResponse` **설명 문자열**만 바뀐다(코드 diff 32파일 확인). 신규 `POST`/`GET` 등 method+path 없음.
- **이벤트/메시지명 충돌**: webhook·queue·sse 이벤트 이름 변경/신설 없음(diff 범위 밖).
- **환경변수·설정키 충돌**: 신규 ENV var·config key 없음(diff 범위 밖).
- **파일 경로 충돌**: 신규 파일은 `src/common/swagger/forbidden-descriptions.ts`(+`.spec.ts`) 와
  `src/repo-guards/__tests__/forbidden-response-codes-guard.ts`(+`.spec.ts`) 두 쌍뿐이다. 후자는 기존 저장소 가드 24쌍이
  따르는 `<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션(`ls src/repo-guards/__tests__/` 로 확인)과 정확히 일치하고, 기존
  파일과 이름이 겹치지 않는다. `spec/conventions/swagger.md` frontmatter 의 신규 glob 라인
  `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts` 은 인접한 다른 glob(`param-uuid-pipe*`,
  `http-status-advertised*` 등)과 접두사가 겹치지 않아 이중 매치 없음. spec 문서 자체의 새 파일 경로 신설은 없다(기존
  `swagger.md` 본문 확장).

## 요약

diff 32개 파일을 절대경로로 직접 읽어 6개 관점을 모두 실측 확인한 결과, 이 PR 이 새로 들여오는 식별자(`FORBIDDEN_NOT_A_MEMBER`·
`forbiddenForRole`·`lowestRequiredRole`·신규 repo-guard 파일 쌍·모듈 로컬 상수들)는 기존 사용처와 이름·의미 양쪽에서 충돌하지
않는다. 옛 동의어 로컬 상수(`FORBIDDEN_MEMBER` 등)는 완전히 제거됐고 잔존 참조가 없어 "동명이인" 위험도 없다. 새 파일 경로는
기존 저장소 가드 명명 컨벤션을 그대로 따른다. 신규 식별자 충돌 관점에서 이 PR 을 막을 사유가 없다.

## 위험도

NONE
