# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 로드 및 변경 set 요약

`.claude/config/doc-sync-matrix.json` (`rows[]` 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재했다. 변경 file 목록(`git diff origin/main...HEAD --name-only`):

- `CHANGELOG.md`
- `codebase/backend/src/modules/auth/auth.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (신규)
- `codebase/frontend/src/content/docs/02-nodes/triggers{,.en}.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `plan/in-progress/trigger-uuid-and-guide-error-codes.md`

## 매칭된 trigger

이 PR 은 `triggers.controller.ts`(`rotateBotToken` 에 `ParseUUIDPipe` 부착, 비-UUID `:id` 가 500→400 이 됨) + `auth.controller.ts`(`switchWorkspace` 의 `@ApiParam` 에 `format:'uuid'` 보강)를 핵심으로 한다. 매트릭스에서는 **`backend-api-change`** 행(`trigger.globs: ["*.controller.ts", ".../dto/**"]`, semantic) 이 매칭된다 — targets: (a) controller·DTO 의 swagger jsdoc, (b) API 노출 변경이 사용자 안내에 영향 시 관련 user-guide 페이지.

`auth-session-flow-change` 행(`codebase/backend/src/modules/auth/**`)도 glob 상 매칭되지만, diff 전문을 직접 확인한 결과 `auth.controller.ts` 변경은 `@ApiParam({ format: 'uuid' })` 한 줄 OpenAPI 메타데이터 보강뿐이고 인증·세션 로직/응답 계약에 실질 변화가 없다 — **의미상 "흐름 변경"이 아니므로 `07-workspace-and-team/` 동반 갱신 대상이 아니라고 판단**한다.

## 동반 갱신 검증 (staged 된 same-set 파일 대조)

같은 변경 set 안에서 아래가 확인됐다 — 모두 diff 를 직접 열어 claim 과 실제 파일 내용을 대조했다:

1. **swagger jsdoc** — `triggers.controller.ts`: `@ApiParam({ name:'id', description:'트리거 UUID', format:'uuid' })` 추가 + `@ApiBadRequestResponse` 문면에 `VALIDATION_ERROR (:id 가 UUID 형식이 아님 — ParseUUIDPipe)` 선두 추가. `auth.controller.ts`: `format:'uuid'` 추가. → 요구 (a) 충족.
2. **CHANGELOG.md** — `rotate-bot-token` 의 500→400 behavior change 항목 신설(관측 가능한 변경이므로 필수) — 확인됨.
3. **`triggers.mdx`/`.en.mdx`** (02-nodes) Chat Channel API 에러 코드 Callout — 종전에 있던 **`TRIGGER_NOT_FOUND` 오기재**(실제로는 `hooks.service.ts` 인입 webhook 전용 코드, REST API 404 는 `RESOURCE_NOT_FOUND`)를 제거하고 정정. 동시에 "한국어 화면엔 모두 한국어로 표시돼요" 라는 **반증된 과장 문장**도 "API 직접 호출 시 보이는 값" 으로 좁혀 정정. ko/en 양쪽 동시 반영 확인.
4. **`telegram.mdx`/`.en.mdx`** — rotate-bot-token 에러 목록의 `404 TRIGGER_NOT_FOUND` → `404 RESOURCE_NOT_FOUND`(설명 병기) 정정, ko/en 양쪽 확인.
5. **`backend-labels.ts` / `backend-labels.test.ts`** — `ERROR_KO`/`LOCALIZED_ERROR_CODES` 의 `TRIGGER_NOT_FOUND` 주석 귀속을 "chat-channel API 코드" 블록에서 "hooks webhook 인입 코드" 로 재배치(항목 자체는 유지, 근거는 도달성 미검증이라 삭제하지 않음 — plan 에 명시). 코드 값 삭제 없음, 순수 주석 정정.
6. **`mcp-servers.mdx`/`.en.mdx`** — 존재하지 않는 환경변수명 `MCP_INSECURE_URL_ALLOWED` → 실재 `MCP_ALLOW_INSECURE_URL` 로 정정. `.env.example:331` · `mcp.config.spec.ts` · `production-guards.ts` 등 실제 코드베이스와 grep 대조해 실재 확인.
7. **`param-uuid-pipe` 가드 3파일** — `rotateBotToken`/`switchWorkspace` 를 포함한 "id-형 `@Param`" 136곳 전수의 `ParseUUIDPipe` + `@ApiParam format:'uuid'` 두 축을 베이스라인 0 으로 고정하는 harness 가드. user-guide 대상은 아니나 재발 방지 장치로 이 PR 이 채택.
8. **`plan/in-progress/*.md` 2건** — 트래커 체크박스가 실제 완료 상태와 일치(`[x]`), 해소 근거를 인용문으로 남김. 이번 배치에서 **하지 않기로 한 것**(에러코드 5종 오기·`ERROR_KO` 미배선·`swagger.md §5-4` 갱신)은 별도 미해결 항목으로 등재돼 있어 조용히 누락되지 않았다.

## 그레이존 판단 (INFO — 조치 불요로 결론)

- `rotateBotToken` 이 이제 낼 수 있는 `400 VALIDATION_ERROR`(비-UUID `:id`)가 `telegram.mdx`/`triggers.mdx` 의 에러 코드 목록에 명시적으로 추가되지 않았다. 다만 `telegram.mdx` 의 해당 줄은 원래부터 "등"(비353망라)으로 끝나고, 같은 문서 다른 섹션들(§6 PATCH 차단, placeholder 오류 등)이 이미 `400 VALIDATION_ERROR` 를 일반 패턴으로 여러 차례 문서화하고 있어 사용자가 새로 배워야 할 개념이 아니다. 이 케이스는 URL 경로에 수동으로 잘못된 UUID 를 넣는 극단적 오용 시나리오이며(정상 UI·API 클라이언트 흐름에서 도달 불가) 6개 형제 엔드포인트가 이미 135/136 로 이 계약을 갖고 있었던 점을 감안하면 "새로 노출된 사용자 가시 개념"이 아니라 나머지 API 전체와 동일선상에 놓인 것이다. → 갱신 누락으로 분류하지 않는다.

## 종결되지 않은 항목 (이 PR 범위 밖, 트래커에 정상 등재됨 — 참고용)

- `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`/`INTEGRATION_ERROR`/`NODE_EXECUTION_FAILED`/`MAKESHOP_API_ERROR` — 가이드가 존재하지 않는(또는 은퇴한) 에러 코드명을 적고 있는 별도 결함군. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미해결(`[ ]`)로 등재돼 있고 이번 PR 의 diff 에는 손대지 않았다 — 스코프 이탈이 아니라 의도된 분리이므로 본 리뷰의 발견사항으로 세지 않는다.
- `ERROR_KO` 매핑을 읽는 프로덕션 호출부가 0건이라는 배선 갭 — 문서 문면은 이번 PR 이 진실로 좁혔고(§triggers.mdx), 배선 자체는 별도 결정 사안으로 등재돼 있다.

## 요약

매트릭스 21행 중 이번 diff 는 `backend-api-change`(semantic) 1행이 실질 매칭되며, `auth-session-flow-change` 는 glob 상 스친다고 코드 내용을 직접 대조한 결과 실질 흐름 변경이 아니라 배제했다. 매칭된 행의 동반 갱신 target(swagger jsdoc + 사용자 안내 페이지)이 모두 같은 커밋 set 안에서 이행됐고, 부수적으로 이번 전수 스윕이 발견한 **선재 결함 2건**(guide 의 `TRIGGER_NOT_FOUND` 오기재 6곳, `mcp-servers` 환경변수 오기 2곳)까지 같은 turn 에 정정했다. i18n parity(ko/en) 는 4개 MDX 파일 전부 동시 갱신으로 유지됐고, `backend-labels.ts`/`.test.ts` 는 코드 값 변경 없이 주석 귀속만 정정해 회귀 위험이 없다. 누락된 동반 갱신을 찾지 못했다.

## 위험도

NONE
