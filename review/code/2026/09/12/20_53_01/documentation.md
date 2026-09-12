# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `param-uuid-pipe.spec.ts` 헤더 docstring의 "전부 고쳐서 0으로 만들었다" 표현이 세 번째 위반(`executions.controller.ts` `simulateExecutionRunRedeliveryForTest`)의 실제 처리 방식과 살짝 어긋난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:42` (게이트 기준, "실측 시점(2026-09-12) 위반 3건을 **전부 고쳐서** 0으로 만들었다" 문장)
  - 상세: 같은 단락 뒤 문장에서 "셋째는 `@ApiExcludeEndpoint()` 라 OpenAPI 에 실리지 않으므로 **목록이 아니라 구조로** 면제한다"고 스스로 정정하고 있어 읽으면 오해가 풀리지만, 첫 문장만 보면 세 자리 모두 코드를 수정("고쳐서")한 것으로 읽힌다. 실제로 이번 PR의 diff 에는 `executions.controller.ts` 변경이 전혀 없다(리뷰 대상 파일 목록에도 없음) — 세 번째는 판정 함수가 `@ApiExcludeEndpoint()` 데코레이터를 보고 자동으로 면제하는 것이지, 그 파일에 `format:'uuid'`를 추가한 것이 아니다.
  - 제안: "전부 고쳐서" 대신 "전부 처리해(고치거나 구조적으로 면제해) 0으로 만들었다"처럼 표현을 한 번 더 명확히 하면, 다음 사람이 diff 를 보고 "왜 executions.controller.ts 가 없지?"라고 헷갈릴 여지가 줄어든다.

- **[INFO]** 두 건의 spec 문서 drift(§`15-chat-channel.md §5.4` 실패 응답 표 · §`swagger.md §5-4` 런타임 축 미기재)가 이번 PR 로 실제로 벌어졌는데 아직 spec 본문에는 반영되지 않았다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 3168, 3177 부근 — "planner 항목" 두 건)
  - 상세: `rotateBotToken`에 `ParseUUIDPipe`를 붙이면서 새 관측 가능한 400 분기가 생겼고(`triggers.controller.ts`의 `@ApiBadRequestResponse`·CHANGELOG 에는 반영됨), 이는 `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표와 `swagger.md §5-4` 체크리스트가 다루는 영역이다. developer 자신이 쓴 문장이 아니라서(자기-반증형 소정정 조건 1 미충족) 이번 PR 범위에서 직접 고치지 못하고 planner 백로그 항목으로만 등재해 둔 상태다.
  - 제안: 이미 트래커에 정확히 등재·근거까지 남아 있어 절차상 문제는 없다. 다만 이 두 항목이 planner 턴에서 처리되기 전까지는 `swagger.md §5-4`/`15-chat-channel.md §5.4`가 실제 계약보다 좁게 서술된 상태로 남는다는 점을 다음 세션이 놓치지 않도록, SUMMARY/후속 세션에서 이 두 항목의 우선 처리를 다시 짚어주는 것이 좋다(신규 발견은 아니고 기존 등재의 재확인).

## 검증한 사항 (문제 없음 확인)

- `CHANGELOG.md`의 신규 "Unreleased" 항목은 500→400 동작 변경을 표(종전/지금)와 배포 영향(⚠️)까지 갖춰 명확히 기술한다. "저장소 안의 유일한 소비자(프런트엔드 토스트)는 status 를 분기하지 않아 영향 없음"이라는 주장은 `chat-channel-card.tsx`의 `onError` 핸들러가 실제로 status 를 보지 않고 고정 토스트만 띄우는 것으로 직접 확인했다(정확).
- `triggers.controller.ts`의 `@Param('id', ParseUUIDPipe)` 추가와 `@ApiBadRequestResponse`/`@ApiParam` 문서 갱신은 실제 코드 변경과 1:1로 일치하며, 인라인 주석이 500 마스킹 사슬(22P02 → `GlobalExceptionFilter` 미분기)을 정확히 설명한다.
- `auth.controller.ts`의 `switchWorkspace`에 붙은 `format: 'uuid'` 추가 이유 주석(산문 "(UUID)"와 OpenAPI `format` 키의 차이)도 정확하고, 실제로 `param-uuid-pipe-guard.ts`가 그 두 축을 구분해서 판정하는 로직과 일치한다.
- `param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts`의 JSDoc은 이례적으로 충실하다 — 실측 수치(id-형 136건, 비-id 9건, `@ApiParam` 144건)를 시점과 함께 병기하고, 이전 라운드에서 정규식 스캔이 낸 오차(127→144, 텍스트가 첫 `}`에서 끊기는 문제)까지 self-correction 형태로 남겨 두었다. `enclosingScopeName`·`CHAT_CHANNEL_CODES` 등 문서 안에서 참조하는 심볼도 실재를 확인했다(`source-scan.ts:110`, `backend-labels.test.ts:486`).
- 스캔 루트 관련 주석("`*.controller.ts` 35개가 전부 `modules/` 아래")은 `find`로 재확인해도 사실이다(35/35).
- `backend-labels.ts`/`backend-labels.test.ts`의 `TRIGGER_NOT_FOUND` 주석 재배치는 실제 발신처(`hooks.service.ts`의 인입 webhook 경로)에 맞게 정정되었고, 같은 파일 하단에 이미 올바르게 적혀 있던 `CHAT_CHANNEL_CODES` 주석과의 자기모순도 해소했다.
- `triggers.mdx`/`triggers.en.mdx`, `telegram.mdx`/`telegram.en.mdx`, `mcp-servers.mdx`/`mcp-servers.en.mdx`의 한국어/영어 쌍은 문구·에러 코드 목록·환경변수명(`MCP_ALLOW_INSECURE_URL`)이 서로 정확히 미러링되어 있다. "8종" 같은 개수 언급이 남아 다음 코드 목록과 어긋나는 stale 카운트도 없다.
- `plan/in-progress/trigger-uuid-and-guide-error-codes.md`는 예측/실측을 나란히 적은 뮤테이션 검증 표, `--impl-prep`/`/ai-review` 각 라운드 지적과 처분을 표로 남겨 추적성이 매우 좋다. CHANGELOG 는 이번 배치가 만든 것만 다루고, 순수 문서 오탈자 수정(가이드 오류 코드, 환경변수명)은 CHANGELOG 에 올리지 않은 것도 이 저장소의 기존 관례(동작 변경만 등재)와 일치한다.

## 요약

문서화 수준이 이례적으로 높다. CHANGELOG 항목이 배포 영향까지 포함해 명확하고, 코드 변경(`ParseUUIDPipe`/`@ApiParam`)에 맞춰 OpenAPI 문서 문구·인라인 주석이 정확히 동기화되었으며, 신규 가드(`param-uuid-pipe-guard.ts`)의 JSDoc은 실측 수치·출처·과거 오류의 자기 정정까지 담아 후속 유지보수자를 위한 근거를 남겼다. 유저 가이드 4곳의 존재하지 않는 에러 코드(`TRIGGER_NOT_FOUND`) 정정과 환경변수 오탈자(`MCP_ALLOW_INSECURE_URL`) 수정도 한/영 쌍이 정확히 미러링되어 있다. 발견된 두 건은 모두 INFO 수준으로, 하나는 docstring 표현의 사소한 정밀도 문제(구조적 면제를 "고쳤다"고 뭉뚱그림)이고 다른 하나는 이미 트래커에 정확히 등재된 spec-drift 백로그(§`15-chat-channel.md §5.4`, §`swagger.md §5-4`)의 재확인일 뿐, 이번 PR 자체의 문서 결함은 아니다.

## 위험도

NONE
