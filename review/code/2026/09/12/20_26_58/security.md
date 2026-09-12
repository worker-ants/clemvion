# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `ParseUUIDPipe` 추가는 실질적인 보안 개선(입력 검증 강화)이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 종전에는 비-UUID `:id` 가 파이프 없이 `TriggersService.findById` → TypeORM `findOne` 까지 흘러 Postgres 가 SQLSTATE 22P02 로 거부했고, `GlobalExceptionFilter` 가 이를 분기하지 못해 500 `INTERNAL_ERROR` 로 마스킹됐다(클라이언트 입력 오류가 서버 장애로 오인됨). 이번 변경으로 요청 경계에서 즉시 400 `VALIDATION_ERROR` 로 차단되며, `ParseUUIDPipe` 는 내부 구현 세부(DB 드라이버·SQLSTATE 등)를 노출하지 않는 정형화된 메시지만 반환하므로 정보 노출 위험도 없다. TypeORM 파라미터 바인딩을 그대로 사용하므로 SQL 인젝션 경로도 아니다.
  - 제안: (해당 없음 — 개선 사항으로 기록)

- **[INFO]** `GlobalExceptionFilter` 의 근본 갭(SQLSTATE 22P02 미분기)은 이번 diff 로 완전히 닫히지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (신규 가드), `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`)
  - 상세: 이번 PR 은 "모든 id-형 `@Param` 에 `ParseUUIDPipe` 를 붙인다" 는 관례를 AST 가드로 베이스라인 0 에 고정하는 방식으로 문제를 우회했다. 즉 컨트롤러 경계에서 입력을 미리 걸러 `GlobalExceptionFilter` 가 `QueryFailedError`(22P02) 를 볼 일이 없게 만든 것이지, 필터 자체가 그 SQLSTATE 를 여전히 분류하지 못하는 상태는 그대로다. 가드는 CI 시점(`repo-guards/__tests__`)에만 작동하므로, 향후 새 엔드포인트에서 파이프 부착을 실수로 빠뜨리면(가드가 우회되거나 스캔 루트 밖에 위치하면) 같은 500-마스킹 클래스가 재발할 수 있다.
  - 제안: 이번 배치 범위는 아니지만, `GlobalExceptionFilter` 에 22P02(invalid_text_representation) 같은 파싱 계열 SQLSTATE 를 400 으로 분기하는 방어선을 추가하면 파이프 부착 누락에 대한 이중 방어가 된다(참고: plan 문서가 이미 이 트레이드오프를 인지하고 있음).

- **[INFO]** MCP "None" 인증 문서의 환경변수명 정정은 보안 통제 자체를 바꾸지 않는 문서 정합화다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`, `mcp-servers.en.mdx:28`
  - 상세: `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 로 정정. 실제 코드(`mcp.config.spec.ts`, `mcp-tool-provider.ts`, `.env.example`)의 식별자와 맞춘 것으로, "평문 HTTP 는 기본 차단, opt-in 환경변수로만 허용" 이라는 기존 secure-by-default 정책 자체는 변경되지 않는다.
  - 제안: 없음(정정만으로 충분).

- **[INFO]** `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 문서 정정은 리소스 존재 여부를 숨기는 기존 동작을 정확히 반영한다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:130`, `telegram.en.mdx:117`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`, `triggers.en.mdx` (해당 Callout 블록)
  - 상세: "트리거 미존재" 와 "워크스페이스 권한 없음" 을 동일한 404 `RESOURCE_NOT_FOUND` 로 묶어 응답하는 기존 컨트롤러 동작(`@ApiNotFoundResponse` 문면)에 문서를 맞춘 것이다. 이는 존재하지 않는 리소스와 접근 권한 없는 리소스를 구분하지 못하게 해 리소스 나열(enumeration) 공격 표면을 줄이는 방향이며, 이번 변경은 그 동작을 바꾸지 않고 문서만 사실에 맞춘다.
  - 제안: 없음.

- **[INFO]** `ERROR_KO`/`backend-labels.test.ts` 주석 귀속 수정은 순수 문서·테스트 주석 변경이며 런타임 동작에 영향 없음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO` 블록, `TRIGGER_NOT_FOUND` 항목 주변), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
  - 상세: `TRIGGER_NOT_FOUND` 가 chat-channel API 코드가 아니라 hooks webhook 인입 경로 코드라는 사실을 주석으로 재귀속했을 뿐, 매핑 테이블의 키/값 자체나 `translateBackendError` 로직은 변경되지 않았다. plan 문서(`trigger-uuid-and-guide-error-codes.md`)가 별도로 지적한 "`ERROR_KO` 를 읽는 프로덕션 호출부가 0건" 이슈는 정보 노출/은폐 여부와 무관한 배선(wiring) 문제이며 이번 diff 범위 밖으로 명시적으로 defer 되어 있다.
  - 제안: 없음(이번 PR 범위 아님, 이미 별도 항목으로 등재됨).

- **[INFO]** 신규 가드 코드(`param-uuid-pipe-guard.ts`)는 텍스트 부분일치 기반이라 별칭 import 시 우회 가능하나, 저장소 실측상 위험 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`pipes.includes('ParseUUIDPipe')` 판정부)
  - 상세: `ParseUUIDPipe as X` 같은 별칭 import 를 쓰면 가드가 파이프가 없는 것으로 오탐(false positive)하거나, 이름에 `ParseUUIDPipe` 문자열을 포함하는 무관한 심볼이 있으면 미탐(false negative)할 수 있다. 다만 이는 프로덕션 런타임 코드가 아니라 CI 전용 정적 가드이고, 주석에 이 한계가 명시되어 있으며 저장소 실측상 별칭 0건이다. 보안 취약점이 아니라 가드의 커버리지 한계로 분류.
  - 제안: 없음(문서화된 알려진 한계, 이번 리뷰의 조치 대상 아님).

## 요약

이번 변경은 새로운 취약점을 도입하지 않으며, 오히려 `rotateBotToken` 엔드포인트에 `ParseUUIDPipe` 를 추가해 비-UUID 입력이 DB 계층까지 흘러 500 으로 마스킹되던 입력 검증 공백을 400 명시적 검증 오류로 전환한 **보안 개선**이다. TypeORM 파라미터 바인딩을 그대로 사용해 SQL 인젝션 경로가 아니며, `ParseUUIDPipe` 는 내부 구현 세부를 노출하지 않는 정형 오류만 반환한다. 함께 포함된 MDX 문서·i18n 주석 수정은 모두 실제 코드 동작(환경변수명, 404 코드 통합에 의한 리소스 존재 은폐 등)에 문서를 맞추는 정정이며 보안 통제 자체를 바꾸지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등은 발견되지 않았다. 유일한 잔여 관찰 사항은 `GlobalExceptionFilter` 가 SQLSTATE 22P02 를 여전히 분류하지 못한다는 근본 갭이 가드(CI 시점)로만 방어되고 있다는 점으로, 실질적 위험이 아닌 방어 심층화 제안 수준이다.

## 위험도
NONE
