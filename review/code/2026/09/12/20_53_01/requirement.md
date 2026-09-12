# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes

## 발견사항

- **[INFO] [SPEC-DRIFT] `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 신규 `400 VALIDATION_ERROR`(`:id` 형식 오류) 행이 없다**
  - 위치: `spec/5-system/15-chat-channel.md:369-379` (§5.4 표) / 대응 코드: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 의 `@Param('id', ParseUUIDPipe)` (게이트 291)
  - 상세: 실측 확인 — `ParseUUIDPipe` 가 던지는 `BadRequestException` 은 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)의 `HttpException` 분기를 타고 `getCodeFromStatus(400)` → `'VALIDATION_ERROR'` 로 확정된다(코드 확인 완료). 즉 코드는 옳다. 그런데 §5.4 표는 `400 VALIDATION_ERROR` 행을 이미 갖고 있으나 그 사유는 *"`X-Workspace-Id` 헤더가 UUID 형태가 아님"* 한 가지뿐이고, `:id` 경로 파라미터 자체가 UUID 형식이 아닌 경우의 새 분기는 표에 없다. 컨트롤러의 `@ApiBadRequestResponse` 문면과 `CHANGELOG.md` 에는 반영됐지만 spec 본문(§5.4)은 그대로다. 이는 코드 결함이 아니라 **spec 이 새로 생긴 관측 가능한 분기를 따라잡지 못한** 경우다.
  - 제안: 코드 유지 + spec 반영. `spec/5-system/15-chat-channel.md` §5.4 표에 `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가. 이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A 처분 절과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재되어 있음(자기-반증형 소정정 조건 1 미충족 — developer 가 쓴 문장이 아니라서 직접 고칠 수 없다는 판단도 확인함). 등재 자체는 정확하나, spec 본문은 아직 이 PR 시점 기준 낡아 있다는 사실 자체를 본 리뷰에서도 별도로 확인해 둔다.

- **[INFO] [SPEC-DRIFT] `spec/conventions/swagger.md` §5-4 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않는다**
  - 위치: `spec/conventions/swagger.md:482-493` (§5-4 체크리스트) / 대응 코드: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`
  - 상세: `grep -c "ParseUUIDPipe" spec/conventions/swagger.md` = 0 으로 직접 확인. §5-4 는 `@ApiParam({format:'uuid'})` 문서 축 한 줄만 요구한다. 반면 이번 PR 이 새로 들인 가드(`repo-guards/__tests__/param-uuid-pipe*`)는 `ParseUUIDPipe` 런타임 축까지 baseline 0 으로 강제한다 — 즉 **코드(가드)가 spec 보다 더 엄격한 방향**이라 위반은 아니지만, 가드가 요구하는 계약과 spec 체크리스트가 서술하는 계약이 일치하지 않는다.
  - 제안: 코드 유지 + spec 반영. `swagger.md` §5-4 에 `@Param('<id>', ParseUUIDPipe)` 항목 추가 + §2-3 예시 코드에도 반영. 이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에 planner 항목으로 등재됨(조건 1 미충족으로 분리 처리 — developer 가 이번 배치에서는 가드·spec 주석의 "출처" 서술만 정정하고 §5-4 확장 자체는 건드리지 않았음, 확인 완료).

- **[INFO] 리뷰 중 워킹트리에서 관측한 일시적 이상 상태(자체 원복됨) — 보고 의무에 따른 기록**
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (게이트 291, `rotateBotToken` 파라미터)
  - 상세: 리뷰 중간 시점에 `git diff HEAD -- .../triggers.controller.ts` 를 실행한 결과, 워킹트리에 `@Param('id', ParseUUIDPipe)` → `@Param('id')` 로 **파이프가 제거된 미커밋 변경**이 일시적으로 관측됐다(`git diff` 출력에 `-@Param('id', ParseUUIDPipe) triggerId: string,` / `+@Param('id') triggerId: string,` 로 표시됨). 이는 plan 의 뮤테이션 표(`M1 rotateBotToken 의 ParseUUIDPipe 제거`)와 형태가 일치해, **동시에 같은 워킹트리를 사용 중인 다른 리뷰어 세션의 뮤테이션 테스트가 겹쳐 보인 것**으로 추정된다. 본 리뷰어는 이 파일을 직접 수정하지 않았다(뮤테이션 검증은 전부 `/private/tmp/.../scratchpad/*.js` 스크립트로 저장소 밖에서 수행). 이후 재확인한 `git status --short` / `git diff HEAD` 는 해당 파일에 대해 **clean**하며, 현재 파일 내용은 HEAD(`bbc9e7f70`)의 의도된 수정(`ParseUUIDPipe` 부착)과 일치한다.
  - 제안: 조치 불필요 — 원복이 이미 완료된 상태를 확인함. 다음 리뷰어가 같은 잔상을 결함으로 오인하지 않도록 기록만 남긴다.

## 실측 검증 요약 (Critical 없음의 근거)

아래 핵심 주장들을 코드/spec 을 직접 열어 대조했고, 프롬프트·plan·CHANGELOG 의 서술과 **모두 일치**함을 확인했다.

- **500→400 마스킹 해소가 실제로 동작한다**: `GlobalExceptionFilter` 는 `HttpException` / http-error-like / `isPostgresUniqueViolation`(23505) 세 갈래만 분기(코드 확인, `catch()` 본문). `ParseUUIDPipe` 의 `BadRequestException` 은 `HttpException` 분기 → `getCodeFromStatus(400)` = `'VALIDATION_ERROR'`. `Trigger.id` 는 `@PrimaryGeneratedColumn('uuid')`(Postgres `uuid` 컬럼) 이고 `TriggersService.findById` → `findOne({where:{id,...}})` 이라 파싱 불가 값은 22P02 로 떨어져 해당 필터의 세 분기 어디에도 안 걸리고 fallback 500 이 나가는 경로도 확인.
- **가드 실측 수치가 정확하다** — 직접 TS AST 스캔 스크립트로 재현: `*.controller.ts` 35개, `@Param('<literal>', ...)` 145건, id-형 136건(비-id 9건: `provider`×3·`installToken`×2·`endpointPath`×2·`token`·`type`, plan 의 서술과 정확히 일치), id-형 전부 `ParseUUIDPipe` 보유(위반 0), `@ApiParam` 총 144건 중 `format:'uuid'` 135건(비-uuid-format 9건 = 비-id 이름과 정확히 일치). docstring 의 "144", "136", "9", "베이스라인 0" 전부 재현 성공.
- **`TRIGGER_NOT_FOUND` 귀속 정정이 옳다**: 프로덕션 코드에서 `TRIGGER_NOT_FOUND` 의 유일한 발신처는 `hooks.service.ts:120`(웹훅 인입 경로)이고, 트리거 REST API 의 404 는 `triggers.service.ts:347` 의 `RESOURCE_NOT_FOUND` 임을 확인. MDX 4곳 + `backend-labels.ts`/`backend-labels.test.ts` 주석 정정이 실제 코드와 일치.
- **`MCP_ALLOW_INSECURE_URL` 오탈자 수정이 옳다**: 실제 환경변수명은 `.env.example:331`·`mcp.config.ts`·`production-guards.ts` 등 전부 `MCP_ALLOW_INSECURE_URL` (구 표기 `MCP_INSECURE_URL_ALLOWED` 는 코드베이스 어디에도 없음 확인).
- **CHANGELOG 의 "유일한 프런트엔드 소비자는 status 를 분기하지 않는다" 주장 확인**: `chat-channel-card.tsx` 의 rotate mutation `onError: () => toast.error(t("triggers.chatChannel.rotateBotTokenFailed"))` — status 분기 없음. 문구 "Bot Token 회전에 실패했어요"/"Bot Token rotation failed" 도 `lib/i18n/dict/{ko,en}/triggers.ts` 의 실제 문자열과 정확히 일치(MDX 안내가 실제 UI 문구를 그대로 인용).
- **테스트 그린 확인**: `param-uuid-pipe.spec.ts`(신규 가드 spec) 단독 및 `triggers.controller.spec.ts`(신규 HTTP 왕복 3케이스 포함) 를 jest 로 직접 실행해 전부 통과(20/20, 이후 43/43 합산), `auth.controller.spec.ts` 23/23 통과, frontend `src/lib/docs/__tests__` + `src/lib/i18n/__tests__` 30 파일 3351 테스트 통과(`backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 항목 재배치가 배열 내용을 바꾸지 않았음도 확인).
- **엣지 케이스 처리**: `param-uuid-pipe-guard.ts` 의 `isIdShaped`(이름이 `id` 또는 `…Id`) · `@ApiExcludeEndpoint` 구조적 면제(문서 축만 면제, 런타임 축은 계속 강제 — `excludedPipeless` fixture 로 반대 방향까지 캐너리 확보) · `new ParseUUIDPipe(...)` 인스턴스화 형태까지 텍스트 부분일치로 포착 · `scanned` 카운터가 위반 판정과 **같은 순회**에서 산출되어 vacuity floor 가 판정 로직과 분리되지 않음 — 전부 fixture 대조군 테스트로 커버되어 있고 실행 결과도 그린.

## 요약

`rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 를 추가해 500(`INTERNAL_ERROR`) 마스킹을 400(`VALIDATION_ERROR`) 으로 바꾼 핵심 변경은 원인 사슬(Postgres 22P02 → `GlobalExceptionFilter` 미분기 → 500)과 수정 결과(`ParseUUIDPipe` → `HttpException` 400 분기 → `VALIDATION_ERROR`)를 코드 레벨에서 직접 재현해 검증했고 정확하다. 동반된 `@ApiParam({format:'uuid'})` 두 자리 보강, 신규 `param-uuid-pipe` 가드(AST 기반, baseline 0, 대조군 fixture 4종 + vacuity floor), HTTP 왕복 e2e 3케이스는 모두 실행해 그린을 확인했으며, docstring/CHANGELOG/plan 에 적힌 실측 수치(35/145/136/9/144/135)를 독립적으로 재현해 전부 일치함을 확인했다. `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 문서 정정, `MCP_ALLOW_INSECURE_URL` 오탈자 수정도 실제 코드와 대조해 정확함을 확인했다. 남은 두 갭(§5.4 응답표에 신규 400 행 미반영, swagger.md §5-4 가 런타임 축을 요구하지 않음)은 코드가 아니라 spec 이 뒤처진 SPEC-DRIFT 이며, developer 권한 밖이라 이미 planner 위임 항목으로 정확히 분리·등재되어 있음을 확인했다(자기-반증형 소정정 조건 불충족 판단도 타당). 리뷰 도중 다른 동시 세션의 뮤테이션 테스트로 추정되는 일시적 워킹트리 변경(파이프 제거)을 관측했으나 자체 원복되어 최종 상태는 clean 하다. Critical 은 없다.

## 위험도
LOW
