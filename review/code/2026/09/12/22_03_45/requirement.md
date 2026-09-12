# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes

## 검증 방법

diff 를 정적으로 읽는 데 그치지 않고 다음을 직접 실행/대조했다 (저장소 파일은 뮤테이션하지 않음, `git status --short` 로 확인):

- `codebase/backend/src/modules/triggers/triggers.controller.ts` 전체 컨텍스트 Read — `rotateBotToken` 의 `@Param('id', ParseUUIDPipe)` · `@ApiParam({format:'uuid'})` · `@ApiBadRequestResponse` 문면 확인
- `GlobalExceptionFilter` 전체 Read — `HttpException` / `isPostgresUniqueViolation`(23505) / http-error-like 세 분기만 있고 `QueryFailedError`(22P02)는 어느 분기에도 안 걸려 기본값 500 `INTERNAL_ERROR` 로 떨어짐을 확인 (CHANGELOG·plan 의 "500 마스킹" 주장이 사실과 일치)
- `triggers.service.ts` `findById`/`findOneDetail` Read — 404 는 `RESOURCE_NOT_FOUND` 이고 `TRIGGER_NOT_FOUND` 는 `hooks.service.ts:120` (인입 webhook) 이 유일한 발신처임을 grep 으로 확인
- `auth.controller.ts` `switchWorkspace` — `@Param('id', ParseUUIDPipe)` 이미 존재(런타임 축은 기존), 이번 diff 는 `@ApiParam` 에 `format:'uuid'` 만 추가(문서 축)
- `mcp.config.ts` — `MCP_ALLOW_INSECURE_URL` 가 실재 env var (`.env.example:331`), `MCP_INSECURE_URL_ALLOWED` 는 코드베이스에 없음
- `chat-channel-card.tsx` — `rotateBotToken` mutation 의 `onError` 가 `err` 를 버리고 고정 문자열 토스트만 띄움 → CHANGELOG 의 "유일한 소비자는 status 를 분기하지 않는다" 주장과 일치
- `spec/5-system/15-chat-channel.md` §5.4 표, `spec/conventions/swagger.md` §5-4 체크리스트 Read — 신규 400 행·`ParseUUIDPipe` 요구 모두 부재 확인 (plan 이 SPEC-DRIFT/planner 항목으로 정확히 분리해 등재했음을 대조)
- `triggers.controller.ts` 의 `@Param(` 7건 전수 grep — 6건은 이전부터 `ParseUUIDPipe` 보유, 이번 diff 가 마지막 1건(`rotateBotToken`)을 채움 → CHANGELOG "형제 6개는 처음부터 파이프를 갖고 있었다" 확인
- 실제 테스트 실행: `param-uuid-pipe.spec.ts`(7/7 pass) · `triggers.controller.spec.ts`(13/13 pass, HTTP round-trip 3케이스 포함) · `backend-labels.test.ts`(frontend, vitest, 20/20 pass) · `src/repo-guards src/modules/triggers src/modules/auth` 전체(41 suites / 881 pass / 1 skip)

## 발견사항

- **[WARNING] [SPEC-DRIFT]** `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표(369~379행)에 이번 diff 가 만든 신규 관측 가능 분기 `400 VALIDATION_ERROR — :id 가 UUID 형식이 아님` 행이 없다.
  - 위치: `spec/5-system/15-chat-channel.md:369-379` (§5.4 표)
  - 상세: `ParseUUIDPipe` 부착으로 `rotateBotToken` 이 새로 낼 수 있는 400 분기가 생겼는데(컨트롤러 `@ApiBadRequestResponse` 문면·CHANGELOG 에는 반영됨), 이 canonical 표에는 없다. 코드가 옳고(500 마스킹 버그 수정이 맞다) spec 표만 낡은 경우다. 자기-반증형 소정정 조건 1(그 문장을 developer 자신이 썼는가)이 깨져(§5.4 표는 developer 가 작성한 문장이 아님) developer 가 직접 고칠 수 없다.
  - 제안: 코드 유지 + spec 반영 — `spec/5-system/15-chat-channel.md` §5.4 표에 `| 400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe) |` 행 추가. 이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(§C, 체크리스트 5라운드 SD1) 에 planner 항목으로 정확히 등재돼 있음을 확인했다 — 새 이슈 아님, 재확인.

- **[WARNING] [SPEC-DRIFT]** `spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트"(493행)가 `@ApiParam({format:'uuid'})` 문서 축만 요구하고 `ParseUUIDPipe` 런타임 축은 언급하지 않는다.
  - 위치: `spec/conventions/swagger.md:482-493` (§5-4)
  - 상세: 저장소 실측(이번 diff 이후 id-형 `@Param` 136/136)은 파이프를 보편 관례로 삼고 이를 신규 가드(`param-uuid-pipe`)로 베이스라인 0 강제하는데, 그 관례의 근거 문서인 §5-4 에는 그 축이 없다. 가드가 규약보다 넓게 문다 — 코드(가드)가 맞고 spec 체크리스트가 낡았다.
  - 제안: 코드 유지 + spec 반영 — §5-4 체크리스트에 `@Param('<id>', ParseUUIDPipe)` 항목 추가. 이미 같은 plan §C 및 5라운드 체크리스트(SD2)에 planner 항목으로 등재돼 있음을 확인했다 — 재확인.

- **[INFO]** `GlobalExceptionFilter` 는 여전히 `QueryFailedError`(SQLSTATE 22P02) 를 분류하지 않는다 — `@Param()` 축 외의 경로(예: `@Query()`, body 필드로 조회하는 다른 서비스 메서드)로 비-UUID 가 유입되면 같은 500 마스킹이 재현될 수 있다.
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`catch` 메서드, `HttpException`/`isPostgresUniqueViolation`/http-error-like 세 분기)
  - 상세: 이 PR 의 스코프(`@Param('id')` 파이프 부착 + 가드)로는 닫히지 않는 더 넓은 클래스다. plan 이 이를 "이번 배치에서 안 하는 이유"(전 엔드포인트 실패 분류를 바꾸는 변경이라 사전 전수 조사가 선행돼야 함)와 함께 정확히 등재해 두었다 — 실측·근거 모두 확인, 새 결함 아님.
  - 제안: 별도 배치에서 22P02 → 400 VALIDATION_ERROR 공용 분기 추가 전, 현재 500 으로 받는 자리 전수 조사 선행. 처분 방향은 이미 plan 에 기록돼 있어 추가 조치 불요.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값 평가

- `rotateBotToken` 의 `:id` 검증 경로는 파이프(런타임) + `@ApiParam`(문서) + `@ApiBadRequestResponse` 문면(계약 서술) 세 층이 모두 갱신되어 일관적이다. 비-UUID 입력은 `ParseUUIDPipe` 가 컨트롤러 진입 전에 400 `VALIDATION_ERROR` 로 끊어 서비스가 호출되지 않는다 — HTTP round-trip 테스트(`triggers.controller.spec.ts` 신규 describe)로 실제 Nest 파이프라인을 태워 확인했고, 세 대조군(비-UUID id / 정상 UUID+본문 누락 / 정상 UUID+정상 본문)이 서로 다른 결과로 갈려 "무엇이 거부했는지"까지 판별 가능하다. vacuous 테스트 우려(과거 세션 메모의 흔한 실패 패턴)를 의식적으로 피한 설계.
- 신규 `param-uuid-pipe` 가드는 판정 대상 스캔 수(`scanned`)와 위반 목록을 **같은 순회**에서 산출해 vacuity floor 조건이 판정 로직과 분리되지 않도록 설계했다 — 뮤테이션 검증(가드 자체 무력화 6종 + 예외 경계 캐너리 2종, plan 기록)까지 거쳤다. `@ApiExcludeEndpoint()` 면제가 런타임 축까지 넓어지지 않는지 보는 반대 방향 캐너리(`excludedPipeless`)도 포함돼 있어 앞서 저장소가 겪은 "면제가 조용히 넓어지는" 실패 클래스를 막는다.
- MDX 가이드 4곳·`backend-labels.ts`/`backend-labels.test.ts` 주석 2곳의 `TRIGGER_NOT_FOUND` 오귀속 수정은 실제 코드(`hooks.service.ts` vs `triggers.service.ts`)와 정확히 일치하도록 고쳐졌다. `MCP_ALLOW_INSECURE_URL` 오탈자 수정도 실재 env var 이름과 일치한다.
- 반환값: `rotateBotToken` 핸들러 모든 경로(비-UUID → 파이프 예외, 본문 누락/비-string → `BadRequestException`, 정상 → 서비스 위임 결과)가 적절한 값/예외를 낸다. 새 가드 함수 `scanUuidParams` 도 빈 스캔·위반 없음·위반 존재 세 경우 모두 일관된 구조체(`{violations, scanned}`)를 반환한다.
- TODO/FIXME/HACK/XXX 마커: diff 전체에 없음.
- 데이터 유효성: `newBotToken` 누락/비-string 검증(기존)과 `:id` UUID 형식 검증(신규)이 계층적으로 분리돼 있고 각각 다른 에러 코드로 판별 가능 — 클라이언트가 "무엇을 고쳐야 하는지" 구분 가능.
- 비즈니스 로직: CCH-SE-04(bot token rotation) 자체의 오케스트레이션 로직은 이번 diff 의 대상이 아니며 무변경 — 회귀 위험 없음.

## 요약

`rotateBotToken` 엔드포인트의 `:id` 파라미터가 비-UUID 입력 시 Postgres SQLSTATE 22P02 → `GlobalExceptionFilter` 미분류 → 500 `INTERNAL_ERROR` 로 마스킹되던 실제 결함을 `ParseUUIDPipe` 부착으로 수정했고, 그 관례를 AST 기반 전수 가드(`param-uuid-pipe`, 베이스라인 0)로 고정했다. 문서 축(`@ApiParam format:'uuid'`)도 함께 채워 `swagger.md §5-4` 가 요구하는 절반만 닫는 실수를 피했다. HTTP round-trip 테스트로 파이프가 실제 Nest 파이프라인에서 작동함을 검증했고(과거 `new Controller(...)` 직접 생성 방식으로는 파이프가 우회돼 vacuous 했던 문제를 인지하고 회피), 기존 6개 형제 엔드포인트·`switchWorkspace`(auth)에 대한 대조 검증도 정확하다. 별도로 유저 가이드 4곳과 프론트엔드 i18n 코드 2곳의 `TRIGGER_NOT_FOUND` 오귀속, `MCP_ALLOW_INSECURE_URL` 오탈자를 실제 코드와 대조해 정확히 수정했다. 모든 사실 주장(500 마스킹 근거 사슬, 형제 엔드포인트 상태, env var 실명, 프론트 에러 소비 방식, spec 문서 내용)을 직접 코드/spec Read 및 grep 으로 대조했고 전부 일치했다. 관련 테스트(신규 가드 spec 7건, 컨트롤러 spec 13건 포함 backend 41 suites/881 tests, frontend i18n vitest 20건)를 직접 실행해 전부 통과함을 확인했다. spec 본문 괴리는 두 건(§5.4 표 신규 400 행 부재, `swagger.md §5-4` 런타임 축 부재) 있으나 둘 다 "코드가 옳고 spec 이 낡은" SPEC-DRIFT 이며, developer 가 자기-반증형 소정정 조건 미충족을 이유로 planner 위임 항목으로 이미 정확히 분리·등재해 두었다(plan 트래커에서 직접 대조 확인) — 새로 지적할 결함이 아니라 기존 처분이 적절함을 재확인하는 수준이다. Critical 은 없다.

## 위험도

LOW
