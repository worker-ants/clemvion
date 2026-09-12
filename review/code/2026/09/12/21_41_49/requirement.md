# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes (5라운드)

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `rotate-bot-token` 의 신규 `400 VALIDATION_ERROR`(`:id` 비-UUID) 분기가 §5.4 실패 응답 표에 없다
  - 위치: `spec/5-system/15-chat-channel.md` §5.4 (실패 응답 표, `344`~`380` 부근 — `| 400 | VALIDATION_ERROR | ... |` 행들 사이)
  - 상세: 컨트롤러(`triggers.controller.ts` `rotateBotToken`)에 `ParseUUIDPipe` 를 붙여 `:id` 가 UUID 형식이 아니면 이제 `400 VALIDATION_ERROR` 를 반환한다(실측 확인 — `triggers.controller.spec.ts` HTTP 왕복 테스트 통과). `@ApiBadRequestResponse` 문면과 `CHANGELOG.md`에는 이 신규 분기가 반영됐지만, canonical 표인 §5.4 실패 응답 표에는 해당 행이 없다. 표에는 이미 "X-Workspace-Id 헤더가 UUID 형태가 아님" 400 VALIDATION_ERROR 행이 있어 `:id` 축과 혼동 소지도 있다. 코드가 옳고 spec 표가 갱신되지 않은 경우다.
  - 제안: 코드 유지 + spec 반영. §5.4 표에 `| 400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe, common/utils/uuid.ts) |` 행 추가. **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§ "planner 항목") 와 `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(체크리스트 4라운드 #1)에 planner 소관 항목으로 등재돼 있음** — 자기-반증형 소정정 조건 1(developer 자신이 쓴 문장) 미충족이라 이번 배치에서 developer 가 직접 고치지 않은 것은 규약상 올바른 판단이다. 신규 결함 아님, 중복 등재 불요.

- **[WARNING]** `[SPEC-DRIFT]` `swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않는다
  - 위치: `spec/conventions/swagger.md:493` (`### 5-4. 새 엔드포인트 체크리스트` — `- [ ] 경로 UUID 파라미터는 @ApiParam({ format: 'uuid' }) 일관 적용`)
  - 상세: §5-4 는 문서 축(`@ApiParam({format:'uuid'})`) 한 줄만 요구하고 `ParseUUIDPipe` 는 그 문서 전체에 0건(실측)이다. 그런데 이번 PR 이 신설한 `repo-guards/__tests__/param-uuid-pipe`(가드 스펙 실행 확인: 7/7 PASS, 저장소 id-형 `@Param` 136/136 이 파이프 보유)가 두 축을 함께 베이스라인 0 으로 강제한다. 가드가 규약 문서보다 넓게 물고 있어, 다음 작성자가 §5-4 만 보고 런타임 축을 빠뜨리면 가드에 걸린다. 코드/가드가 옳고 규약 문서가 낡은 경우다.
  - 제안: 코드 유지 + spec 반영. §5-4 체크리스트에 `@Param('<id>', ParseUUIDPipe)` 항목 추가 + §2-3 예시 코드에도 반영. **이미 두 plan 문서에 planner 소관 항목으로 등재돼 있음**(같은 조건 1 미충족 사유) — 신규 결함 아님.

- **[INFO]** 나머지 전 항목 직접 검증 완료, 결함 없음
  - `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` 7/7 PASS(vacuity floor `scanned > 100` 포함), `triggers.controller.spec.ts` 13/13 PASS(신규 HTTP 왕복 3케이스: 비-UUID→400 VALIDATION_ERROR/서비스 미호출, 정상 UUID+본문누락→400 INVALID_BOT_TOKEN, 정상 UUID+정상본문→200/서비스에 id 그대로 전달 — 세 대조군이 실제로 갈림을 실행으로 확인), `auth.controller.spec.ts` 23/23 PASS, `frontend backend-labels.test.ts` 20/20 PASS, `swagger-probe.spec.ts` + `swagger-dto-contract.spec.ts` 43/43 PASS.
  - `git diff --stat origin/main...HEAD -- codebase/ CHANGELOG.md` 결과가 프롬프트에 나열된 파일 15개(+CHANGELOG)와 정확히 일치 — 스코프 밖 변경 없음.
  - `GlobalExceptionFilter.getCodeFromStatus(400) === 'VALIDATION_ERROR'` 직접 확인 — `ParseUUIDPipe` 가 던지는 `BadRequestException`(exceptionResponse 에 `code` 없음, `error` 필드가 문자열이라 `nested` 도 null)이 정확히 이 기본 분기로 떨어져 테스트 기대값(`VALIDATION_ERROR`)과 일치한다.
  - `auth.controller.ts` `switchWorkspace`: `ParseUUIDPipe` 는 이미 적용돼 있었고(런타임 축 기존), 이번 diff 는 `@ApiParam` 에 `format:'uuid'` 만 추가(문서 축) — 주석의 서술과 실제 변경 범위가 일치.
  - `backend-labels.ts`/`backend-labels.test.ts`: `TRIGGER_NOT_FOUND` 의 유일한 발신처가 `hooks.service.ts:120`(인입 webhook)임을 grep 으로 확인, 메시지 문면("해당 웹훅 엔드포인트를 찾을 수 없어요")도 그 귀속과 일치. 트리거 REST API 404 는 `triggers.service.ts` `findById` → 컨트롤러 `@ApiNotFoundResponse`(`RESOURCE_NOT_FOUND`)로 별도 확인.
  - `mcp-servers{,.en}.mdx`: 실제 환경변수명이 `MCP_ALLOW_INSECURE_URL` (코드 10곳 이상 + `.env.example:331`)임을 확인, 종전 `MCP_INSECURE_URL_ALLOWED` 는 코드베이스 어디에도 없음 — 정정이 옳다.
  - CHANGELOG 의 "형제 6개 엔드포인트는 처음부터 파이프를 갖고 있었다" 주장: `triggers.controller.ts` 의 `@Param('id', ParseUUIDPipe)` 총 7건 중 6건이 기존(findOne/update/getHistory/remove/rotateNotificationSecret/revokePerTriggerToken), 1건이 신규(rotateBotToken) — 실측 일치.
  - CHANGELOG 의 "유일한 소비자(프런트엔드 토스트)는 status 를 분기하지 않는다" 주장: `chat-channel-card.tsx` 의 `rotateBotToken` 호출 catch 블록이 에러 객체를 버리고 고정 문자열 토스트만 띄움을 확인 — 상태코드 분기 없음, 500→400 전환의 영향 없음 주장이 실측과 일치.
  - TODO/FIXME/HACK/XXX 신규 주석 0건(diff 전수 grep).
  - 워킹트리 뮤테이션 없음 — `git status --short` 는 미커밋 review 산출물 디렉터리만 표시, `codebase/**` 변경 0.

## 요약

`rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe`/`@ApiParam({format:'uuid'})` 를 추가해 비-UUID 입력이 500(masking)이 아니라 400 VALIDATION_ERROR 로 명확히 분류되도록 한 변경과, 유저 가이드·코드 주석이 실재하지 않거나 잘못 귀속된 에러 코드/환경변수명을 가리키던 4~6곳을 바로잡은 변경이다. 핵심 동작 변경(500→400), 신규 AST 가드(param-uuid-pipe, 베이스라인 0, vacuity floor + 대조군 4종), 신규 HTTP 왕복 테스트(3 대조군) 모두 직접 실행해 통과를 확인했고, 코드·문서 상호 참조(에러 코드 발신처, 환경변수 실재, 프런트엔드 소비 방식)도 grep/실행으로 교차검증해 전부 일치했다. spec 본문과의 유일한 괴리 두 건(`15-chat-channel.md §5.4` 실패표, `swagger.md §5-4` 체크리스트)은 코드가 옳고 spec 이 낡은 SPEC-DRIFT 이며, 이미 자기-반증형 소정정 조건 미충족을 이유로 정확히 planner 소관 백로그(`plan/in-progress/*.md`)에 등재돼 있어 이번 라운드에서 새로 발견된 결함이 아니다. TODO/FIXME 등 미완성 표식, 반환값 누락, 엣지케이스 미처리, 워킹트리 오염은 발견되지 않았다.

## 위험도

LOW
