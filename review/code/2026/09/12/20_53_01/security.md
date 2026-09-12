# 보안(Security) 코드 리뷰

## 검토 범위

`rotateBotToken` 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 를 추가하고(비-UUID 입력이 DB 레벨
`QueryFailedError`(SQLSTATE 22P02)로 흘러 `GlobalExceptionFilter` 의 500 기본값으로 마스킹되던
결함을 400 `VALIDATION_ERROR` 로 정정), 동일 계약을 강제하는 AST 기반 repo-guard 를 신설하고,
그 과정에서 발견된 유저 가이드 MDX·i18n 매핑 파일의 잘못된 식별자(에러 코드·환경변수명) 서술을
정정한 변경이다. `codebase/backend/src/modules/auth/auth.controller.ts` · `triggers.controller.ts`
· `triggers.controller.spec.ts` · 신규 `repo-guards/__tests__/param-uuid-pipe*` 3파일, 그리고
`codebase/frontend` 의 문서(MDX)·i18n 라벨 파일, `CHANGELOG.md`·`plan/**` 를 확인했다.

## 발견사항

- **[INFO]** 신규 fixture 에 `backdoor` 라는 이름의 라우트가 있으나 프로덕션에 배선되지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (`excluded`/`excludedPipeless` 메서드, `@Post(':id/_test/backdoor')` · `@Post(':workspaceId/_test/backdoor-pipeless')`)
  - 상세: `ParamUuidFixtureController` 는 `@ApiExcludeEndpoint()` 면제 판정을 검증하기 위한
    대조군 fixture다. `grep` 으로 확인한 결과 이 클래스·파일은 어떤 `*.module.ts` 에도
    import/등록되지 않고, 가드의 프로덕션 스캔 루트(`src/modules`) 밖에 위치해 실제 애플리케이션
    라우트로 노출되지 않는다. 정적 시크릿/취약점 스캐너가 파일명·라우트 문자열만 보고 "백도어"로
    오탐할 수 있어 기록해 둔다 — 실질적 보안 결함은 아니다.
  - 제안: 조치 불요. 다만 향후 이 fixture 디렉터리가 실수로 `src/modules` 아래로 이동하거나
    다른 모듈에서 import 되면 그 순간 실제 라우트가 되므로, 그런 이동이 생기면 재검토할 것.

- **[INFO]** `ParseUUIDPipe` 부재로 인한 500 마스킹은 정보 노출이라기보다 관측성 문제였고, 이번
  수정이 그 자체로 방어를 강화함
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken()` 의
    `@Param('id', ParseUUIDPipe) triggerId: string` (신규 파이프 인자)
  - 상세: 종전에는 비-UUID `:id` 가 `TriggersService.findById` 까지 흘러 Postgres 가 SQLSTATE
    22P02 로 거부했는데, `GlobalExceptionFilter` 가 그 예외 갈래를 분기하지 않아 500
    `INTERNAL_ERROR` 로 응답했다(스택트레이스나 쿼리 원문이 클라이언트로 노출된다는 근거는 diff
    범위에서 확인되지 않음 — `GlobalExceptionFilter` 자체는 이번 변경 대상이 아니다). 이번
    수정은 입력 검증을 요청 파이프라인 앞단으로 당겨 형식 오류를 400 으로 정확히 분류한다.
    `@Roles('editor')` 가드는 그대로 유지되어 있어(파이프는 Guard 이후 단계에서 실행되므로)
    인가 체크 순서에는 영향이 없다.
  - 제안: 없음 — 이 변경 자체가 개선이다. 참고로 형제 엔드포인트 6곳과 동일한 형태로 통일되었고,
    베이스라인 0 을 강제하는 AST 가드(`repo-guards/__tests__/param-uuid-pipe*`)가 회귀를 막는다.

- **[INFO]** 유저 가이드 문서의 잘못된 식별자 정정 — 보안 관련 오정보 축소
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
    (`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`), `telegram{,.en}.mdx` §6·
    `02-nodes/triggers{,.en}.mdx` Callout (`TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`)
  - 상세: MCP "평문 HTTP 허용" 안전장치를 가리키는 환경변수명이 문서에서 실제 코드와 달랐다.
    이 오기로 인해 사용자가 그 변수를 잘못 설정해 의도치 않게 보안을 낮추는 방향의 위험은
    없다(존재하지 않는 변수명을 설정해도 아무 효과가 없어 기본값인 "차단" 상태가 유지된다) —
    오히려 반대로 "설정했는데 반영이 안 된다"는 혼란을 줄 뿐이었다. `TRIGGER_NOT_FOUND` →
    `RESOURCE_NOT_FOUND` 정정은 실제 API 가 트리거 미존재와 워크스페이스 비멤버를 **구분하지
    않고 동일한 404 코드로 응답**한다는 사실(리소스 존재 여부를 노출하지 않는 정상적인 방어)을
    문서가 이제 정확히 반영한다.
  - 제안: 없음 — 문서 정확도 개선이며 보안 통제 자체의 변경은 아니다.

- **[INFO]** 테스트 코드 내 고정 문자열은 시크릿이 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` — `VALID_UUID` ·
    `WORKSPACE_UUID` · `newBotToken: '222222222:NewToken'` 등
  - 상세: 텔레그램 봇 토큰 형식(`\d+:영숫자`)을 모사한 목(mock) 값이며 실제 자격 증명이 아니다.
    `X-Workspace-Id` 헤더를 테스트에서 직접 주입하는 것도 해당 테스트 모듈에 인증/인가 가드를
    등록하지 않은 격리된 유닛 성격의 HTTP 왕복 테스트라 문제 없다(인가 로직 자체는 이 diff
    대상이 아니며 변경되지 않았다).
  - 제안: 없음.

인젝션(SQL/커맨드/경로탐색)·인증 우회·안전하지 않은 암호화·에러 메시지의 민감정보 노출·알려진
취약 의존성 사용 등 CRITICAL/WARNING 급 결함은 diff 범위에서 발견되지 않았다. `repo-guards`
신규 스캐너는 저장소 소스 파일(`*.controller.ts`)만 `ts.createSourceFile` 로 파싱하는 빌드타임
도구이며 사용자 입력을 처리하지 않아 별도 공격 표면이 아니다.

## 요약

이번 변경의 핵심은 `rotateBotToken` 엔드포인트에 누락되어 있던 `ParseUUIDPipe` 를 형제
엔드포인트들과 동일하게 부착해, 잘못된 형식의 `:id` 가 DB 예외를 거쳐 500 으로 마스킹되던
자리를 400 `VALIDATION_ERROR` 로 명확히 분류하는 것으로 — 방어적 입력 검증을 강화하는
개선이며 회귀를 막는 AST 전수 가드가 함께 베이스라인 0 으로 고정되었다. 인가(`@Roles('editor')`)
체크는 그대로 유지되어 파이프 도입으로 인한 권한 검증 순서 변화나 우회는 없다. 나머지 변경은
문서(MDX)·i18n 주석의 잘못된 식별자(존재하지 않는 에러 코드·오기된 환경변수명)를 실제 코드와
일치시키는 정정으로, 정보 노출을 늘리지 않고 오히려 리소스 존재 여부를 숨기는 기존 404 통합
동작을 정확히 문서화한다. 테스트 fixture 의 `backdoor` 명명은 프로덕션에 배선되지 않은
대조군으로 확인되어 실질적 위험이 없다. 전반적으로 보안 관점에서 이 diff 는 중립~긍정적이며
새로 도입된 취약점은 확인되지 않았다.

## 위험도

NONE
