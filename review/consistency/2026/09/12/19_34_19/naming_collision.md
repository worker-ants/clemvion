# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep)

## 검토 대상 요약

이번 target 은 spec 문서 변경이 아니라 `plan/in-progress/trigger-uuid-and-guide-error-codes.md`
(구현 착수 전 plan)이며, 실질 작업은 두 축이다.

- **A**: `triggers.controller.ts` `rotateBotToken` 의 기존 `@Param('id') triggerId: string`
  에 `ParseUUIDPipe` 를 부착 + 신규 가드 파일 2개(`param-uuid-pipe-guard.ts`,
  `param-uuid-pipe.spec.ts`) 추가
- **B**: 가이드 문서(`content/docs/**`, `lib/i18n/backend-labels*.ts`)의 오기 식별자를
  이미 존재하는 실재 식별자로 정정 (`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`,
  `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND`)

즉 이 plan 은 **새 엔티티·DTO·엔드포인트·이벤트·ENV var 를 도입하지 않는다** — 전부
"기존에 이미 존재하는 올바른 식별자" 로 코드/문서를 맞추는 정정 작업이다. 아래는 그럼에도
발생 가능한 충돌 후보를 전수 확인한 결과다.

## 발견사항

없음 (CRITICAL/WARNING 없음). 확인 근거는 아래와 같다.

- **파일 경로 — 신규 가드 파일 2개**: `codebase/backend/src/repo-guards/__tests__/` 에
  `param-uuid-pipe-guard.ts` / `param-uuid-pipe.spec.ts` 로 grep 한 결과 기존 코드베이스에
  `param-uuid-pipe` 토큰은 **0건**(사전 미존재)이며, 같은 디렉터리의 기존 12쌍
  (`audit-action-binding-{guard,spec}.ts`, `dto-class-name-collision-*`,
  `endpoint-path-conflict-wrap-*`, `nullable-type-lie-cast-*` 등)과 `<name>-guard.ts` +
  `<name>.spec.ts` 명명 컨벤션이 동일하다. 충돌 없음, 컨벤션 준수(INFO 성격).
- **파라미터명 `triggerId`**: 신규 도입이 아니라 `codebase/backend/src/modules/triggers/triggers.controller.ts:286`
  에 **이미 존재**하는 이름이며(`@Param('id') triggerId: string`), 같은 컨트롤러 내
  `findOne`/`getHistory`/`remove` 등 6곳이 이미 `@Param('id', ParseUUIDPipe) id: string` 패턴을
  쓴다. plan 은 파이프만 추가할 뿐 새 이름을 만들지 않는다.
- **ENV var `MCP_ALLOW_INSECURE_URL`**: `codebase/backend/.env.example:331`,
  `codebase/backend/src/modules/mcp/mcp-client.service.ts:251` 에 실재하는 유일한 이름임을
  grep 으로 확인. 오기 `MCP_INSECURE_URL_ALLOWED` 는 `content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
  2곳에만 존재하고 코드베이스 어디에도 정의되어 있지 않다 — plan 의 정정 방향과 grep 결과가
  일치한다. 충돌 없음.
- **에러코드 `RESOURCE_NOT_FOUND` vs `TRIGGER_NOT_FOUND`**: 두 코드는 이미 서로 다른 실제
  발신처를 갖는 기존 코드다 — `RESOURCE_NOT_FOUND` 는 `spec/5-system/3-error-handling.md:1118`
  (404 기본값) 및 `triggers.controller.ts` 의 `@ApiNotFoundResponse` 6곳이 실제로 내는 코드,
  `TRIGGER_NOT_FOUND` 는 `codebase/backend/src/modules/hooks/hooks.service.ts:120`
  (webhook 인입 경로)의 유일한 발신처이며 `codebase/backend/test/webhook-trigger.e2e-spec.ts`
  가 그 경로에서만 단언한다. plan 의 정정(가이드 문서·`backend-labels.ts` 주석 귀속 수정)은
  **이미 존재하던 오귀속(같은 문자열이 두 다른 API 표면의 코드처럼 문서화된 상태)을 해소**하는
  방향이며, 새 식별자를 만들지 않는다 — 오히려 기존 naming-collision 성격의 문서 오류 하나를
  줄이는 작업이다.
- **가이드 문서(`content/docs/**`)는 spec 명명 컨벤션 영역 밖**: 이 checker 의 관점 6(파일 경로
  충돌)이 다루는 것은 `spec/` 신규 파일 경로이며, plan 이 건드리는 `.mdx`/`backend-labels.ts`
  는 프런트엔드 사용자 가이드·i18n 라벨이라 spec 파일 명명 컨벤션과 무관하다. 새 파일 생성도
  없다(기존 4개 mdx + `backend-labels.ts`/`.test.ts` 편집뿐).

검토 범위상 제약: `spec/5-system/` 18개 파일 중 예산 초과로 `1-auth.md` · `2-api-convention.md` ·
`3-error-handling.md` 3개만 본문이 제공되었고 나머지 15개(`4-execution-engine.md`,
`12-webhook.md`, `14-external-interaction-api.md`, `15-chat-channel.md` 등)는 절단되었다.
다만 plan 의 실측 근거(§A 145건 `@Param` 전수 스캔, §B 97개 UPPER_SNAKE 토큰 전수 스캔)가
이미 코드베이스 전수 grep 기반이고, 이 checker 가 직접 재확인한 grep 결과와도 일치하므로
절단된 15개 파일이 결론을 바꿀 여지는 낮다고 판단한다.

## 요약

target(`trigger-uuid-and-guide-error-codes` plan)은 신규 식별자를 도입하는 작업이 아니라
기존에 이미 정의된 올바른 식별자(`triggerId`, `MCP_ALLOW_INSECURE_URL`, `RESOURCE_NOT_FOUND`)로
코드/문서를 맞추는 정정 배치이며, 유일한 "신규" 산출물인 가드 테스트 파일 2개(`param-uuid-pipe-guard.ts`,
`param-uuid-pipe.spec.ts`)는 grep 으로 사전 미존재(0건)를 확인했고 기존 `repo-guards/__tests__/`
디렉터리의 `<name>-guard.ts`+`<name>.spec.ts` 명명 컨벤션과 정확히 일치한다. 요구사항 ID·
엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 6개 관점 모두에서 충돌 후보를
전수 확인했으나 CRITICAL/WARNING 에 해당하는 충돌을 발견하지 못했다.

## 위험도

NONE
