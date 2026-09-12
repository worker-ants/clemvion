# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 추가 — 보안 관점에서 긍정적 변경
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291`
  - 상세: 이전에는 `@Param('id') triggerId: string` 로 UUID 형식을 검증하지 않아, 비-UUID 값이 그대로 `TriggersService.findById` → TypeORM 쿼리까지 흘러가 Postgres 가 SQLSTATE 22P02 로 거부했고, `GlobalExceptionFilter` 가 그 SQLSTATE 를 별도 분기하지 않아 500 `INTERNAL_ERROR` 로 마스킹되는 상태였다(진짜 SQL 인젝션은 아님 — TypeORM 파라미터 바인딩이라 쿼리 자체는 안전했고, 문제는 "클라이언트 입력 오류가 서버 장애로 오분류"되는 에러 처리/정보 노출 성격이었다). `ParseUUIDPipe` 추가로 형식이 잘못된 UUID 는 이제 컨트롤러 경계에서 400 `VALIDATION_ERROR` 로 정상 차단된다.
  - 제안: 조치 완료. 추가로 `repo-guards/__tests__/param-uuid-pipe-guard.ts` + `param-uuid-pipe.spec.ts` 가 전체 `*.controller.ts` 의 id-형 경로 파라미터에 대해 `ParseUUIDPipe`·`@ApiParam({format:'uuid'})` 두 축을 AST 기반으로 전수 강제하므로, 동일 클래스의 재발(신규 엔드포인트가 파이프 없이 추가되는 경우)을 구조적으로 막는다 — 별도 조치 불필요.

- **[INFO]** `auth.controller.ts` `switchWorkspace` — `@ApiParam` 에 `format: 'uuid'` 문서 축 보강
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:433-440`
  - 상세: Swagger 문서화만의 변경으로 런타임 검증 로직에는 영향이 없다(이 엔드포인트는 이미 `ParseUUIDPipe` 를 갖추고 있었다 — plan 문서 §A 표 참조). 보안 취약점 아님.

- **[INFO]** 문서(MDX)·i18n 매핑 코멘트 정정은 순수 문면 수정
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers{,.en}.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
  - 상세: `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 정정, `MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL` 환경변수명 오기 수정, 에러 코드 귀속 주석 정정 등은 전부 기존 동작을 정확히 서술하도록 고치는 것이며 로직·검증·암호화·인가 변경이 없다. curl 예시의 토큰은 모두 `<your-token>`/`<new BotFather token>` 형태의 placeholder 로, 하드코딩된 시크릿은 없다.
  - 제안: 없음(정보성). 다만 `mcp-servers.mdx` 가 "평문 HTTP 는 `MCP_ALLOW_INSECURE_URL` 활성화 시에만 허용" 이라는 기존 기능을 재확인하는데, 이는 이번 diff 가 도입한 것이 아니라 기존 opt-in 기능의 문서 정정이므로 이번 PR 스코프 밖으로 판단한다.

- **[INFO]** 신규 repo-guard(`param-uuid-pipe-guard.ts`)와 fixture 는 순수 정적 분석 도구
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: `fs.readFileSync` 로 읽는 파일 목록은 호출자(`collectTsFiles`)가 리포지토리 내부 고정 스캔 루트(`src/modules`, 자기 `fixtures/` 디렉터리)에서만 수집하며 사용자 입력이나 외부 값에서 오지 않는다 — 경로 탐색(path traversal) 여지 없음. 테스트/개발 전용 코드로 런타임 프로덕션 경로에 배포되지 않는다.

## 요약

이번 변경 셋의 핵심은 (1) `rotateBotToken` 엔드포인트에 누락돼 있던 `ParseUUIDPipe` 를 추가해 비-UUID 입력이 500 으로 마스킹되던 에러 처리 결함을 400 으로 정정한 것, (2) 그 계약(`ParseUUIDPipe` + `@ApiParam format:'uuid'`)을 전수 AST 가드로 고정한 것, (3) 유저 가이드 MDX·i18n 매핑 주석의 사실 오류(존재하지 않는/틀린 에러 코드·환경변수명 귀속) 정정이다. 세 갈래 모두 보안 취약점을 새로 만들지 않으며, 오히려 (1)은 입력 검증 누락을 닫는 보안 개선이고 (2)는 동일 클래스 재발을 구조적으로 방지하는 예방 통제다. 인증/인가 데코레이터(`@Roles('editor')`, `@WorkspaceId()`, `@CurrentUser('sub')`)는 그대로 유지되며, 하드코딩된 시크릿·인젝션 벡터·평문 전송·안전하지 않은 암호화·민감정보 에러 노출은 발견되지 않았다. 문서 수정에 등장하는 토큰 값은 모두 placeholder 다.

## 위험도

NONE
