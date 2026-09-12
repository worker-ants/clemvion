# 문서화(Documentation) 리뷰

## 관측된 워킹트리 이상 상태 (내가 만든 변경 아님 — 보고 의무)

리뷰 시작 시점 status 스냅샷은 clean 이었으나, 검증 도중 확인한 status(short)에 다음 미커밋
변경이 나타났다 — **나는 이 파일에 Write/Edit 를 실행한 적이 없다**:

```
 M codebase/backend/src/modules/triggers/triggers.controller.ts
```

diff:

```diff
-    @Param('id', ParseUUIDPipe) triggerId: string,
+    @Param('id') triggerId: string,
```

이것은 리뷰 대상 diff 가 신규로 추가한 `ParseUUIDPipe` 를 정확히 되돌린 상태이며,
`plan/in-progress/trigger-uuid-and-guide-error-codes.md` 뮤테이션 표의 **M9
("rotateBotToken 의 ParseUUIDPipe 제거")** 뮤턴트와 문자 그대로 일치한다. 이 리뷰 세션의
프롬프트 규약이 경고하는 "병렬 fan-out 중 다른 reviewer 가 같은 워킹트리를 동시에 뮤테이션"
상황으로 보인다 — 다른 reviewer(테스트/가드 담당)가 뮤테이션 검증을 실행 중이며 아직 원복 전일
가능성이 높다.

**하지 않은 것**: 복구 명령(되돌리기)을 실행하지 않았다 — 이 변경을 만든 당사자가 아니고,
저장소 뮤테이션 금지 규약(checkout/restore 금지 포함) 하에서 내가 원복을 시도하는 것 자체가
그 reviewer 의 진행 중인 관측을 오염시킬 수 있기 때문이다. 이 문서화 리뷰의 결론에는
영향이 없다 — 아래 검증은 프롬프트에 실린 diff(=의도된 최종 상태, `ParseUUIDPipe` 포함)를
기준으로 진행했다. **다음 사람이 이 파일을 볼 때**: 만약 이 상태가 그대로 커밋되면
`param-uuid-pipe` 가드 및 신규 HTTP 왕복 테스트가 RED 가 될 것이므로, 최종 커밋 전
`git status`/`git diff` 로 이 자리를 반드시 재확인할 것.

## 검증 방법

프롬프트의 수치·인용 주장을 소스에서 직접 재검증했다 (전부 diff 밖 파일이라 저장소를 뮤테이션하지 않고 `grep`/`Read` 만 사용):

| 주장 | 재검증 | 결과 |
|---|---|---|
| `*.controller.ts` 35개, id-형 `@Param` 136건, 비-id 9건 (`provider`×3·`installToken`×2·`endpointPath`×2·`token`·`type`) | `find`+`grep` 전수 | **정확히 일치** (136/9, 세부 항목까지) |
| `modules/` 의 `@ApiParam(` 144건, 전부 인라인 리터럴(스프레드 0건) | `grep` 전수 | **일치** |
| `GlobalExceptionFilter` 가 `HttpException`·http-error-like·`isPostgresUniqueViolation`(23505) 세 갈래만 분기, `QueryFailedError`(22P02)는 어디에도 안 걸려 500 폴백 | 파일 직접 읽음 | **일치** |
| `chat-channel-card.tsx` 의 `rotateBotToken` `onError` 가 status 를 분기하지 않는다 | 파일 직접 읽음 (`onError: () => toast.error(...)`, err 미참조) | **일치** |
| `TRIGGER_NOT_FOUND` 유일 발신처 `hooks.service.ts:120`, 트리거 REST 404 는 `RESOURCE_NOT_FOUND`(`triggers.service.ts`/`http-exception.filter.ts`) | `grep` 전수 | **일치** |
| `MCP_ALLOW_INSECURE_URL` 이 실재 이름, `MCP_INSECURE_URL_ALLOWED` 는 오기 | `grep` 전수 (`.env.example`·`mcp.config.ts`·spec 등) | **일치** |
| `health.controller.spec.ts` 가 이미 `Test.createTestingModule`+`supertest` 형태 | 파일 확인 | **일치** |
| `common/utils/uuid.ts` 가 같은 22P02→500 마스킹 사슬을 이미 문서화 | 파일 확인 | **일치** |

이례적으로 이 PR 은 자기 주장을 실측 수치까지 병기해 두었고, 위 재검증에서 어긋난 항목이 하나도 없었다. `feedback_measured_claim_proxy_and_timing.md` 류 결함(참인 프록시 문장이 실제로는 아무것도 보증하지 않는 경우)도 발견되지 않았다 — 검증 명령의 대상(예: `@ApiParam` 스프레드 0건, id-형 술어 정확 카운트)이 실제로 주장과 동일한 것을 세고 있었다.

## 발견사항

- **[INFO]** `models.mdx` / `models.en.mdx` 가 미구현(Planned) 에러 코드를 이미 나온 것처럼 서술 — 이 PR 범위 밖, 이미 트래커에 등재됨
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx:88,90` / `models.en.mdx:71,73` (`LLM_AUTH_ERROR`(401)·`LLM_MODEL_NOT_FOUND`(404) 행)
  - 상세: `spec/5-system/7-llm-client.md:345` 는 이 두 코드를 "미구현(Planned)" 으로 명시하고 현재는 `LLM_CONNECTION_ERROR` 로 수렴한다고 적는다. 실측(`grep`)으로 재확인했다 — 두 mdx 파일 모두 `FieldTable` 에 이 두 코드를 401/404 로 이미 동작하는 필드처럼 나열한다. 이 PR 의 diff 는 이 두 파일을 건드리지 않으며, `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 가 이 갭을 정확히 진단하고(*"미구현을 기구현처럼 서술한 것 — 이름 치환이 아니라 실측 후 대응"*) 별건 백로그로 명시적으로 미룬 상태다.
  - 제안: 신규 조치 불요 — 이미 올바르게 등재·추적됨. 다음 세션이 이 항목을 집는다면 plan 파일의 §C 서술을 그대로 착수 근거로 쓰면 된다.

- **[INFO]** 신규 400 분기가 `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표와 `spec/conventions/swagger.md §5-4` 체크리스트에 반영되지 않음 — developer 권한 밖, 이미 planner 항목으로 분리 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (두 개의 `[ ]` planner 항목, `15-chat-channel.md §5.4` 신규 400 행 / `swagger.md §5-4` 런타임 축 미기재)
  - 상세: 컨트롤러의 `@ApiBadRequestResponse` 설명과 CHANGELOG 에는 새 `VALIDATION_ERROR` 분기가 반영됐지만, canonical spec 문서 2곳은 그대로다. `CLAUDE.md` 의 자기-반증형 소정정 조건 1(그 문장을 developer 자신이 썼는가)이 두 문서 모두에서 깨져 있어(다른 시점에 다른 저자가 작성) developer 턴에서 직접 고치지 않은 판단은 규약과 일치한다.
  - 제안: 신규 조치 불요 — 프로세스대로 올바르게 분리됐다. Planner 턴에서 두 항목을 마저 닫을 때 참고.

- **[INFO]** 같은 엔드포인트(`rotate-bot-token`)에 대한 두 개의 독립된 `## Unreleased` CHANGELOG 항목이 인접해 있다
  - 위치: `CHANGELOG.md:3` (400 UUID 검증 변경) 와 `CHANGELOG.md:26` (502 breaking change)
  - 상세: 두 항목 모두 자기 완결적이고 내용은 정확하지만, 같은 엔드포인트의 서로 다른 실패 축(`:id` 형식 검증 vs 실패 원인 분류)을 다루는 두 블록이 연속으로 있어 훑어보는 독자가 하나의 변경으로 오인할 여지가 약간 있다.
  - 제안: 선택 사항 — 급하지 않음. 굳이 고친다면 첫 문단에 "이 항목은 아래 502 항목과 별개로 `:id` 파싱 축만 다룬다" 한 줄을 추가하는 정도로 충분하다.

## 요약

diff 에 포함된 JSDoc·인라인 주석·CHANGELOG·MDX 유저 가이드 전부가 실제 코드 동작과 일치함을 다수의 독립 재검증(grep/파일 읽기)으로 확인했다 — 특히 수치 주장(136/9, 144, 22P02 마스킹 사슬, 프런트엔드 소비자 미분기)이 전부 정확했다는 점이 눈에 띈다. 신규 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`)와 fixture 는 각 판정 갈래·설계 근거·왜 이런 형태인지를 상세히 문서화했고, `triggers.controller.spec.ts` 의 신규 HTTP 왕복 테스트도 "왜 기존 describe 로는 안 되는가", "대조군이 왜 세 개인가"를 명시적으로 설명한다. 유일하게 남는 것은 이 PR 의 스코프 밖에 있는 사전 존재 spec/문서 드리프트(§5-4 체크리스트, §5.4 실패 표, `models.mdx` 의 미구현 코드 서술)인데, 전부 `plan/in-progress/` 트래커에 정확한 근거와 함께 분리 등재되어 있어 새로운 문서화 리스크로 보지 않는다. 별도로, 리뷰 도중 워킹트리에서 `triggers.controller.ts` 의 `ParseUUIDPipe` 가 제거된 미커밋 상태를 관측했다(위 섹션 참조) — 내가 만든 변경이 아니며 병렬 리뷰 세션의 뮤테이션 테스트로 추정된다.

## 위험도

LOW
