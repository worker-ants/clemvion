# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** SQLSTATE 22P02(비-UUID → DB 파싱 실패) 방어가 공유 예외 매핑 계층 대신 호출부마다 반복 배치된다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:44`(`HttpException` 분기) · `:70`(`isPostgresUniqueViolation`, 23505) · `:76`(그 외 `Error`, http-error-like 만 처리) — 이 세 분기 외에는 전부 500 `INTERNAL_ERROR` 로 떨어진다. 이번 PR 의 수정 지점은 `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe)` 추가).
  - 상세: `GlobalExceptionFilter` 는 닫힌 3분기 dispatch 이고 Postgres `invalid input syntax for type uuid`(22P02)에 대한 분기가 없다. 그 결과 "caller-controlled 문자열이 `uuid` 컬럼으로 흘러가는 모든 경로"가 개별적으로 사전 검증을 기억해야 하는데, 이 저장소에는 이미 같은 클래스의 방어가 최소 3곳에 독립적으로 존재한다 — `common/utils/uuid.ts`, `common/utils/workspace-context.util.ts`(X-Workspace-Id 헤더 조기 거부), 그리고 이번 PR 의 `rotateBotToken`. 이번 PR 이 추가한 `param-uuid-pipe` AST 가드는 이 패턴을 다시 반복하지 않도록 강제하는 좋은 보완책이지만, 스캔 대상이 `src/modules/**/*.controller.ts` 의 `@Param()` id-형 파라미터로 한정된다 — `@Query()` 파라미터, `@IsUUID()` 없이 body 필드를 그대로 `where: { id }` 조회에 쓰는 경로, raw QueryBuilder 사용 등 다른 유입 지점은 여전히 같은 방식으로 500 마스킹될 수 있다. 즉 이번 수정은 **말단(리프)에서의 규율**을 정적 가드로 강제하는 것이지, **공유 seam(GlobalExceptionFilter)의 근본 공백**을 닫는 것은 아니다.
  - 제안: 후속으로 `GlobalExceptionFilter` 에 Postgres `invalid_text_representation`(22P02) 매핑 분기(→ 400 `VALIDATION_ERROR`)를 한 번 추가하면, 개별 파라미터·필드마다 파이프/검증을 기억해야 하는 부담과 그것을 강제하는 가드의 필요성 자체를 구조적으로 줄일 수 있다. 지금의 개별 파이프 + AST 가드 조합은 유지하되, 이를 "최후 방어선"이 아니라 "문서화/린트 수준의 이중 방어"로 격하시키는 방향.

- **[INFO]** `ERROR_KO` 가 서로 다른 서브시스템의 에러 코드를 구조 구분 없이 한 flat map 에 섞고, 귀속을 프로즈 주석에만 의존한다
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:568` (`export const ERROR_KO: Record<string, string> = {`), 이번 diff 는 그 안의 `TRIGGER_NOT_FOUND` 주석 귀속을 정정한다(게이트 605~613 부근, `INVALID_BOT_TOKEN`/`TRIGGER_NOT_FOUND`/`CHAT_CHANNEL_NOT_CONFIGURED` 사이).
  - 상세: `ERROR_KO` 는 chat-channel REST API 에러 코드와 hooks webhook 인입 경로 에러 코드처럼 소유 서브시스템이 명확히 다른 키들을 같은 `Record<string, string>` 에 담고, 그 경계는 오직 "아래부터 다시 chat-channel API 코드" 류의 블록 헤더 주석으로만 표시된다. 이 PR 의 plan 이 스스로 기록하듯, 그 구조가 실제로 4개월간 조용한 오귀속을 방치했고 같은 저장소 안에 서로 모순되는 두 주석 블록(`backend-labels.ts` 와 `backend-labels.test.ts`)을 만들어냈다. 이번 수정은 프로즈를 정정할 뿐 구조는 그대로 남기므로, 새 키가 블록 헤더 아래(또는 위) 엉뚱한 자리에 추가되면 같은 클래스의 드리프트가 재발할 수 있다 — 타입 시스템이나 구조가 소유권을 강제하지 않는다.
  - 제안: 키 단위로 소유 서브시스템을 명시하는 형태(예: 서브시스템별 상수를 만들어 병합하거나 `{ [code]: { message, owner } }` 형태)로 바꾸면 구조가 소유권을 강제한다. 최소한 블록 헤더 주석 대신 각 키 옆 줄에 출처 주석을 붙이면, 블록이 커지면서 헤더와 실제 내용이 갈릴 여지를 없앨 수 있다.

- **[INFO]** 신규 HTTP 왕복 테스트가 `@Roles('editor')` 를 검증하는 전역 가드 없이 컨트롤러만 부트스트랩한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` 의 `Test.createTestingModule({ controllers: [TriggersController], providers: [...] })` (신규 `describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)'` 블록, beforeAll).
  - 상세: `rotateBotToken` 핸들러에는 `@Roles('editor')` 가 붙어 있지만, 그 데코레이터를 실제로 집행하는 `RolesGuard`(및 JWT 인증 가드)는 `AppModule` 에서 `APP_GUARD` 로 전역 등록된다(`codebase/backend/src/app.module.ts:213`) — 이번에 새로 만든 좁은 `TestingModule` 에는 포함되지 않는다. 파일 헤더 docstring 은 "진짜 Nest 파이프라인을 태울 수 있다"고 설명하는데, 실제로 태우는 것은 `ParseUUIDPipe` 층뿐이고 같은 핸들러가 선언한 인가 계층은 이 테스트의 요청 파이프라인에서 조용히 빠져 있다. 이번 PR 이 검증하려는 범위(:id 파이프)에는 문제가 없지만, `TriggersController` 의 전체 계약(인가 포함)은 `AppModule` 수준 cross-cutting provider 없이는 독립적으로 재현할 수 없다는 모듈 경계 특성을 드러낸다.
  - 제안: 이번 PR 범위에서는 조치 불필요. 같은 패턴을 다른 곳에 재사용할 때는 docstring 을 ":id 파이프만 검증, 인가는 별도"로 좁혀, "진짜 파이프라인"이라는 표현이 실제로 스킵한 계층(가드)까지 포함하는 것처럼 읽히지 않게 할 것.

## 요약

핵심 프로덕션 변경(`triggers.controller.ts` 의 `ParseUUIDPipe` 추가, `auth.controller.ts` 의 `@ApiParam format` 보강)은 형제 엔드포인트와 일관된 형태를 따르고 컨트롤러는 여전히 얇은 위임 계층으로 유지된다. 신규 `param-uuid-pipe-guard.ts` 는 순회(traversal)와 판정(collectMethodViolations)을 분리하고, 이름 허용목록 대신 구조(`@ApiExcludeEndpoint`)로 예외를 두는 등 이전 라운드 피드백을 반영해 SRP 를 잘 지킨 형태다. 순환 의존성이나 레이어 위반은 발견되지 않았다. 다만 이번 수정은 "비-UUID 문자열이 uuid 컬럼까지 흘러 500 으로 마스킹된다"는, 이 저장소에 이미 반복 등장한 결함 클래스를 또 하나의 호출부에서 개별적으로 막는 방식이라 — 공유 `GlobalExceptionFilter` 의 근본 공백은 그대로 남아 있고, 새 AST 가드가 `@Param()` 이외의 유입 경로까지 보장하지는 않는다. `backend-labels.ts` 의 `ERROR_KO` 도 구조적 네임스페이스 없이 프로즈로만 소유권을 나누고 있어 같은 종류의 드리프트가 재발할 여지가 있다. 둘 다 이번 PR 이 새로 만든 문제는 아니며, 이번 PR 은 오히려 그 격차를 드러내고 부분적으로 보강했다.

## 위험도

LOW
