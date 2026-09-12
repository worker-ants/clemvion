# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes

## 발견사항

- **[WARNING] [SPEC-DRIFT] `spec/conventions/swagger.md §5-4` 는 문서 축(`@ApiParam format:'uuid'`) 만 요구한다 — 코드·테스트 주석이 "한 조항이 두 축(ParseUUIDPipe 포함)을 요구한다"고 서술하는데 spec 본문엔 런타임 축이 없다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:90` (JSDoc `두 축을 함께 본다 (spec/conventions/swagger.md §5-4 의 한 조항)`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:28` (`spec/conventions/swagger.md §5-4 의 한 조항이 두 가지를 요구한다`)
  - 상세: `spec/conventions/swagger.md` §5-4(482~493행)의 체크리스트를 직접 열어 대조하면, 해당 절이 명시하는 항목은 `- [ ] 경로 UUID 파라미터는 @ApiParam({ format: 'uuid' }) 일관 적용` 한 줄뿐이다(493행). `ParseUUIDPipe` 라는 단어 자체가 `swagger.md` 전체에 등장하지 않는다(grep 0건). 즉 "런타임 400 차단"과 "문서 format 광고"를 **같은 조항이 함께 요구한다**는 서술은 그 spec 문서의 실제 내용과 line-level 로 어긋난다. `ParseUUIDPipe` 관례 자체는 실재하고(`spec/5-system/1-auth.md:502`, `spec/data-flow/12-workspace.md:382` 가 워크스페이스 컨트롤러 사례로 문서화) 이 PR 의 가드가 그 관례를 저장소 전역으로 baseline 0 에 고정한 것은 타당한 개선이다 — 다만 그 개선의 근거를 실제로 요구하지 않는 spec 절(§5-4)에 잘못 귀속시켰다. 이대로 두면 다음 사람이 §5-4 만 읽고 "ParseUUIDPipe 요구는 없다"고 오판하거나, 반대로 §5-4 를 근거로 이 가드의 런타임 축을 인용해 다른 곳에 적용하려다 spec 본문을 못 찾는다.
  - 제안: 코드를 되돌릴 필요는 없음(가드·구현 모두 옳음) — `project-planner` 경유로 `spec/conventions/swagger.md §5-4` 체크리스트에 런타임 축 항목을 별도로 추가(예: `- [ ] 경로 UUID 파라미터는 @Param('id', ParseUUIDPipe) 로 400 차단`)하거나, 최소한 코드 주석의 "한 조항이 두 가지를 요구한다"는 표현을 "문서 축은 §5-4, 런타임 축은 저장소 관례(§5-4 미기재)"로 정정.

- **[INFO] `param-uuid-pipe` 가드·spec·fixture 는 실측대로 동작 — 뮤테이션·실행 검증 통과**
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: `npx jest src/repo-guards/__tests__/param-uuid-pipe.spec.ts` 실행 결과 6/6 통과(현재 `modules/` 전수 스캔에서 위반 0건, vacuity floor 통과, 대조군 fixture 4형태 정확히 분기). `tsc --noEmit` 에도 이 파일들에서 에러 없음. plan 이 주장하는 뮤테이션 6종(M1~M6) 자체를 재실행하지는 않았으나(리뷰 스코프상 저장소 뮤테이션 회피), 판정 로직을 직접 읽어 각 갈래(파이프 누락·문서 축 누락·ApiExcludeEndpoint 면제·id-형 접미사·`new ParseUUIDPipe(...)` 인스턴스화)가 실제로 분기 가능한 코드임을 확인했다. 결함 아님 — 근거로 기록.

- **[INFO] `rotateBotToken` 400 VALIDATION_ERROR 경로·`switchWorkspace`/`simulateExecutionRunRedeliveryForTest` 처분이 실제 코드와 일치**
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId`), `codebase/backend/src/common/filters/http-exception.filter.ts:132`(`getCodeFromStatus(400) → 'VALIDATION_ERROR'`), `codebase/backend/src/modules/auth/auth.controller.ts:447`(`switchWorkspace` 이미 `ParseUUIDPipe` 보유), `codebase/backend/src/modules/executions/executions.controller.ts:238`(`@ApiExcludeEndpoint()` 확인)
  - 상세: `ParseUUIDPipe` 가 던지는 `BadRequestException` 은 `resp.code` 가 없어 `GlobalExceptionFilter.getCodeFromStatus(400)` 로 폴백해 `VALIDATION_ERROR` 가 되는 것을 직접 확인 — 컨트롤러 JSDoc·`@ApiBadRequestResponse` 갱신 문면과 일치. `findById` 미스 시 `RESOURCE_NOT_FOUND`(`triggers.service.ts:348`)도 확인. 결함 아님.

- **[INFO] 유저 가이드 MDX 4곳·`backend-labels.ts`/`.test.ts` 주석 정정이 실제 코드·spec 과 일치**
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers{,.en}.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`, `codebase/frontend/src/lib/i18n/backend-labels.ts:605-612`, `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:339-344`
  - 상세: `TRIGGER_NOT_FOUND` 의 유일한 발신처가 `hooks.service.ts:120`(인입 webhook, `spec/data-flow/10-triggers.md:74` 시퀀스와 일치)이고 트리거 REST 404 는 `RESOURCE_NOT_FOUND`(`triggers.service.ts:348`, `@ApiNotFoundResponse` 문면)임을 확인 — MDX 4곳·코드 주석 2곳의 오귀속 정정이 정확하다. `backend-labels.test.ts`/`vitest run` 20/20 통과. `chat-channel-card.tsx:394` 의 `rotateBotTokenFailed` 문구(ko/en 모두)와 새 MDX 문장의 인용이 정확히 일치. `MCP_ALLOW_INSECURE_URL` 로의 정정도 `.env.example:331`·`mcp.config.ts`·`spec/5-system/11-mcp-client.md` 다수 언급과 일치. 결함 아님.

## 요약

리뷰 대상은 `rotateBotToken`(및 `switchWorkspace`) 의 `:id` 경로 파라미터에 UUID 계약 두 축(`ParseUUIDPipe` 런타임 차단 + `@ApiParam format:'uuid'` 문서화)을 채우고 이를 AST 기반 전수 가드로 고정한 변경, 그리고 유저 가이드/코드 주석이 `TRIGGER_NOT_FOUND`를 chat-channel API 코드로 잘못 적어온 6곳을 `RESOURCE_NOT_FOUND`/hooks-inbound 귀속으로 정정한 변경이다. 두 축 모두 실제 코드(`GlobalExceptionFilter`, `TriggersService.findById`, `hooks.service.ts`)와 실측 결과가 일치했고, 신규 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture)는 직접 실행해 6/6 통과, vacuity floor·대조군 4형태 분기까지 확인했다. 유저 가이드 정정 4곳과 코드 주석 정정 2곳도 실제 발신처·i18n 문자열과 line-level로 대조해 정확함을 확인했다. 유일한 발견은 spec 귀속 문제로, 코드/테스트 주석이 `spec/conventions/swagger.md §5-4`가 "런타임 축까지 요구하는 한 조항"이라고 서술하지만 그 절의 실제 본문은 문서 축(`@ApiParam format:'uuid'`) 하나만 명시하고 있어 SPEC-DRIFT(spec 미반영)로 분류했다 — 구현 자체는 타당하고 되돌릴 필요가 없으며, spec §5-4에 런타임 축 항목을 추가하는 것으로 해소된다.

## 위험도

LOW
