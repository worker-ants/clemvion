# Security Review — trigger-uuid-and-guide-codes

## 발견사항

- **[INFO]** `ParseUUIDPipe` 존재 판정이 텍스트 부분일치라 별칭 import 에 미탐 가능 (자체 문서화된 한계)
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:173` (`pipes.includes('ParseUUIDPipe')` 판정부, 함수 `collectMethodViolations`)
  - 상세: 신규 정적 가드가 `@Param('id', ParseUUIDPipe)` 축의 존재 여부를 심볼 해석이 아니라 텍스트 부분일치(`call.arguments.slice(1).map(a => a.getText(sf)).join(',')` 안에 `'ParseUUIDPipe'` 문자열이 있는지)로 판정한다. `import { ParseUUIDPipe as UuidPipe } from '@nestjs/common'` 같은 별칭 import 를 쓰면 실제로는 파이프가 붙어 있어도 가드가 위반으로 오탐하거나, 반대로 다른 이름에 그 문자열이 우연히 포함되면 미탐할 수 있다. 이는 가드(정적 분석 커버리지) 자체의 한계이지 런타임 취약점은 아니며, 코드 주석에도 이미 명시(저장소 실측상 별칭 0건)되어 있어 현재는 안전하다.
  - 제안: 현재 스코프에서는 조치 불필요(자체 인지·문서화된 한계). 별칭 import 가 실제로 등장하면 타입 체커 기반 판정으로 승격을 검토.

## 점검 결과 요약 (발견 없음으로 확인된 항목)

- **입력 검증 / 인젝션**: `rotateBotToken` 의 `:id` 경로 파라미터에 `@Param('id', ParseUUIDPipe)` 를 신규 부착 — 비-UUID 값이 `TriggersService.findById` 까지 흘러 Postgres `QueryFailedError`(SQLSTATE 22P02)를 일으키고 `GlobalExceptionFilter` 의 세 분기(HttpException·http-error-like·unique-violation) 어디에도 안 걸려 `500 INTERNAL_ERROR` 로 마스킹되던 자리를 `400 VALIDATION_ERROR` 로 정확히 분류하도록 고쳤다. 이는 **입력 검증 강화**이며 새 취약점을 만들지 않는다. `ParseUUIDPipe` 의 기본 예외 메시지(`Validation failed (uuid is expected)`, `node_modules/@nestjs/common/pipes/parse-uuid.pipe.js` 확인)는 사용자가 보낸 원본 값을 그대로 echo 하지 않으므로 반사형 정보 노출·로그 인젝션 우려도 없다.
- **인증/인가**: `rotateBotToken` 의 `@Roles('editor')` · `@WorkspaceId()` 데코레이터는 그대로 유지된다 (`codebase/backend/src/modules/triggers/triggers.controller.ts` 258행 부근). NestJS 파이프라인 순서상 Guard(역할 검사)가 Pipe(`ParseUUIDPipe`)보다 먼저 실행되므로 파라미터 파싱 순서 변경으로 인한 인가 우회 경로는 없다. `auth.controller.ts` 의 `switchWorkspace` 변경은 `@ApiParam` 에 `format: 'uuid'` 를 추가한 **문서 전용** 변경이며, 런타임 `ParseUUIDPipe` 는 이 diff 이전부터 이미 붙어 있었다(`auth.controller.ts:447`) — 동작 변화 없음을 확인했다.
- **에러 처리 / 정보 노출**: 변경 전에도 `GlobalExceptionFilter` 는 매핑되지 않은 `Error` 를 `An unexpected error occurred. Please try again later.` 로 마스킹(CWE-209 대응 주석 존재)하고 있어 500 시에도 내부 스택/쿼리 정보가 클라이언트로 새지는 않았다. 이번 변경은 상태 코드(500→400)만 교정하며 새로운 정보 노출 경로를 만들지 않는다.
- **하드코딩된 시크릿**: 신규/변경 테스트 파일(`triggers.controller.spec.ts`)의 `NEW_BOT_TOKEN = '222222222:NewToken'`, UUID 상수들은 형식만 갖춘 테스트 픽스처 값으로, 실제 시크릿이 아니다. 문서(MDX)의 `123456789:ABCdef…` 예시도 동일하게 placeholder.
- **암호화 / 환경설정**: MDX 문서에서 `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 로 환경변수명을 정정한 것은 실제 SSRF 방어 스위치(`common/config/mcp.config.ts`, `common/config/production-guards.ts` — production 에서 강제 차단)의 실명과 문서를 일치시키는 수정으로, 오히려 운영자가 잘못된 변수명으로 오설정할 위험을 줄인다. 코드 쪽 구현은 이 diff 의 대상이 아니며 grep 으로 실명 사용을 확인했다.
- **의존성 보안**: 이번 변경은 신규 의존성 추가 없음 (`@nestjs/common` 의 기존 `ParseUUIDPipe` 재사용, `supertest`/`@nestjs/testing` 은 기존 devDependency).
- **문서-코드 정합(간접 보안 영향)**: `TRIGGER_NOT_FOUND` 를 chat-channel API 코드로 잘못 서술하던 6곳(문서 4 + `backend-labels.ts`/`backend-labels.test.ts` 주석 2) 정정은 클라이언트 개발자가 잘못된 에러 코드를 분기 처리해 실패 케이스를 놓치는 신뢰성 문제를 줄이는 문서 정확성 개선이며, 별도의 취약점은 아니다.

## 요약

이번 diff 의 핵심은 `POST /triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 파라미터에 `ParseUUIDPipe` 를 추가해 비-UUID 입력이 DB 계층까지 흘러 500 으로 마스킹되던 것을 400 `VALIDATION_ERROR` 로 명확히 분류하는 **입력 검증 강화**이며, 형제 엔드포인트와 동일한 형태로 통일하고 회귀 방지를 위한 AST 기반 정적 가드(허용목록 없음, 베이스라인 0)까지 추가했다. 인가 데코레이터(`@Roles`, `@WorkspaceId`)는 그대로 유지되고 파이프 실행 순서상 인가 우회 경로가 생기지 않음을 확인했으며, 에러 메시지는 원본 입력값을 echo 하지 않아 정보 노출 위험도 없다. 나머지 변경(auth.controller.ts 문서 보강, MDX/backend-labels 의 에러 코드·환경변수명 오기 정정)은 코드 동작에 영향이 없는 문서 정확성 개선이다. 하드코딩된 시크릿, 인젝션, 인가 우회, 안전하지 않은 암호화 등 새로운 보안 결함은 발견되지 않았다. 유일한 언급 사항은 신규 가드의 텍스트 부분일치 판정 한계(별칭 import 미탐 가능성)로, 이는 가드 자신의 커버리지 한계일 뿐 런타임 취약점이 아니며 이미 코드 내 주석으로 인지·문서화되어 있다.

## 위험도

NONE
