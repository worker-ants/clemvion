# 보안(Security) 코드 리뷰

## 리뷰 범위

- `rotateBotToken`(`triggers.controller.ts`) `:id` 경로 파라미터에 `ParseUUIDPipe` +
  `@ApiParam({format:'uuid'})` 추가, 및 이를 전수로 강제하는 신규 정적 가드
  (`param-uuid-pipe-guard.ts` / `param-uuid-pipe.spec.ts` / fixture)
- `auth.controller.ts` `switchWorkspace` 의 `@ApiParam` 문서 축 보강 (`format: 'uuid'`)
- 신규 HTTP 왕복 테스트 (`triggers.controller.spec.ts`)
- 유저 가이드(MDX) · `backend-labels.ts`/`.test.ts` 의 오기 식별자 정정
  (`TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND`, `MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)
- `CHANGELOG.md`, `plan/**` 문서 갱신

## 발견사항

- **[INFO]** `GlobalExceptionFilter` 의 SQLSTATE 22P02(`invalid_text_representation`) 미분류는
  `:id` 외 경로(예: `@Query()`, body 필드로 조회되는 UUID)에는 여전히 남아 있다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`catch` 메서드, `HttpException`
    · unique-violation(23505) · http-error-like 세 분기만 존재 — 본 PR 에서 수정되지 않음)
  - 상세: 이번 PR 은 `rotateBotToken` 의 `:id` 를 `ParseUUIDPipe` 로 막아 그 자리의 500 마스킹만
    닫았다. 필터 자체를 확인한 결과 매핑되지 않은 내부 `Error` 는 이미 `UNHANDLED_ERROR_MESSAGE`
    고정 문구로 마스킹되어(CWE-209 대응 주석 존재) 클라이언트에 DB 스택·쿼리 내용이 노출되지는
    않는다 — 즉 정보 노출 취약점은 아니다. 다만 파싱 불가 값이 파이프를 거치지 않는 다른 진입점
    (`@Query()` 등)으로 들어오면 여전히 불필요한 500 + `logger.error` 스택 로그가 발생해
    운영 가시성 저하·로그 노이즈/잠재적 소규모 DoS(반복 요청으로 에러 로그 유발) 여지가 남는다.
    이 갭은 PR 이 새로 만든 것이 아니라 이미 존재하던 것이며, `plan/in-progress/
    trigger-uuid-and-guide-error-codes.md` §C 및 `spec-draft-nullable-notation-followups.md`
    에 "필터 자체는 그대로다 — 전 엔드포인트 실패 분류를 바꾸는 변경이라 전수 선행 필요" 로
    이미 등재·유예되어 있다.
  - 제안: 현재 유예 사유(전수 영향 분석 선행)는 타당하다. 후속 PR 에서 22P02 → 400
    `VALIDATION_ERROR` 공용 분기를 추가하기 전, 내부 조회(사용자 입력이 아닌 UUID)에도
    동일 분기가 적용되어 4xx/5xx 분류가 뒤바뀌는 자리가 없는지 실측을 선행할 것.

- **[INFO]** 신규 가드 fixture 에 `_test/backdoor`, `_test/backdoor-pipeless` 라는 이름의
  엔드포인트가 등장한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
    (`excluded`, `excludedPipeless` 메서드)
  - 상세: 실제 보안 결함은 아니다 — `grep` 로 확인한 결과 `ParamUuidFixtureController` 는
    어떤 `@Module()` 에도 등록되어 있지 않고, 파일 자체도 가드의 프로덕션 스캔 루트(`src/modules`)
    밖(`src/repo-guards/__tests__/fixtures/`)에 있어 런타임에 라우팅되지 않는다. `@ApiExcludeEndpoint()`
    가 붙은 핸들러에서도 `ParseUUIDPipe` 런타임 축은 면제하지 않는다는 것을 검증하는 의도적
    "반대 방향 캐너리" fixture 다.
  - 제안: 기능상 조치 불필요. 다만 이런 이름은 시크릿/보안 스캐너의 자동 grep(`backdoor` 등
    키워드)에서 오탐을 유발할 수 있으므로, 유지보수자가 놀라지 않도록 파일 상단 주석(이미 존재)
    수준의 설명이면 충분하다.

- **[INFO]** `MCP_ALLOW_INSECURE_URL` 관련 문서 오기 정정은 보안 통제 자체를 바꾸지 않는다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
  - 상세: 실제 환경변수명(`MCP_ALLOW_INSECURE_URL`)과 문서가 지금까지 어긋나 있었던 것을
    맞춘 것뿐이며, "평문 HTTP 는 그 변수가 켜져 있을 때만 허용" 이라는 기존 통제(fail-closed
    기본값)는 변경되지 않았다. 오히려 잘못된 변수명을 문서가 적고 있던 종전 상태가 운영자
    혼선을 유발할 여지가 있었으므로 이번 정정은 보안 관점에서 중립~긍정적이다.

## 긍정적으로 확인된 사항 (참고)

- `rotateBotToken` 은 `@Roles('editor')` · `@ApiUnauthorizedResponse` · `@ApiForbiddenResponse`
  가 diff 이후에도 그대로 유지되어 인가 체계가 훼손되지 않았다 (`triggers.controller.ts` 직접
  확인).
- `ParseUUIDPipe` 추가는 입력 검증 강화(fail-fast)로, 종전에 비-UUID 값이 `findById` 까지
  흘러 Postgres 레벨 예외(SQLSTATE 22P02)로 처리되던 것을 애플리케이션 경계에서 400 으로
  조기 차단한다 — 순수 보안 개선(방어 심층화)이며 회귀는 없다.
- 신규 정적 가드(`param-uuid-pipe`)는 향후 같은 클래스의 결함(경로 파라미터 UUID 검증 누락)
  재발을 AST 전수 스캔 + 베이스라인 0 으로 차단한다. 예외는 허용목록이 아니라
  `@ApiExcludeEndpoint()` 구조로만 면제되며, 그 경우에도 런타임(`ParseUUIDPipe`) 축은
  면제하지 않는다는 것을 반대 방향 캐너리로 검증했다.
- 테스트에서 사용된 토큰류 값(`222222222:NewToken`, UUID 등)은 전부 합성 테스트 데이터이며
  하드코딩된 실제 시크릿은 발견되지 않았다.
- 문서 내 curl 예시는 `<your-token>` 등 placeholder 를 사용하며 실제 자격 증명을 노출하지
  않는다. `botToken` 은 응답에 절대 노출되지 않고 AES-256-GCM 암호화 보관된다는 기존 서술도
  이번 diff 로 훼손되지 않았다.
- SQL 인젝션/커맨드 인젝션/XSS/경로 탐색 벡터: 이번 diff 는 TypeORM 파라미터 바인딩·NestJS
  데코레이터·정적 문서(MDX)만 다루며 원시 쿼리 조합이나 사용자 입력을 셸/파일 경로에 직접
  삽입하는 코드가 없다.

## 요약

이번 변경은 신규 취약점을 도입하지 않았고, 오히려 `rotateBotToken` 엔드포인트의 `:id` 경로
파라미터에 `ParseUUIDPipe` 를 추가해 입력 검증 누락(500 마스킹) 문제를 해소한 보안 개선
커밋이다. 인가(`@Roles`)·인증 데코레이터는 그대로 유지되었고, 신규 정적 가드는 같은 클래스의
재발을 구조적으로 차단한다. 테스트·fixture·문서 변경에서 하드코딩된 시크릿이나 인젝션·XSS
벡터는 발견되지 않았다. 유일한 잔여 이슈(`GlobalExceptionFilter` 가 `:id` 외 경로의 22P02 를
여전히 500 으로 마스킹하는 것)는 이번 PR 이 만든 것이 아니라 사전에 존재했고, 클라이언트에
내부 정보를 노출하지 않는 것으로 확인되었으며 이미 plan 에 후속 과제로 등재되어 있어 즉시
차단 사유는 아니다.

## 위험도

NONE
