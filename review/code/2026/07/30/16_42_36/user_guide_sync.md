# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[WARNING]** `run_results.mdx` 의 "재시도 성공" 설명이 이번 changeset 이 구현한 "재진입 turn 계속(re-park)" 케이스를 언급하지 않아 사용자 가이드가 신규 동작 대비 불완전하다 (ko/en 동일 결함)
  - 변경 파일: `codebase/backend/src/modules/execution-engine/state/state-machine.ts`(retry-reentry opt-in 대상에 `WAITING_FOR_INPUT` 추가), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`(`reparkAiResumeTurn` 에 `retryReentry` 플래그 전파), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 이번 브랜치(`origin/main` 대비 전체 diff) 전체가 `execution.retry_last_turn`(사용자에게는 실행 결과 화면의 "다시 시도" 버튼) 짝 전이 결함 수정
  - 매트릭스 항목: `run-debug-flow-change`(실행·디버깅 흐름 변경, semantic match, `trigger.globs=[]`) — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"`. 변경 파일이 정확히 이 행이 지목하는 "backend 실행 엔진" 소스(`modules/execution-engine/**`)이고, 같은 changeset 안에서 spec SoT 두 곳(`spec/4-nodes/3-ai/1-ai-agent.md` §12.8, `spec/5-system/6-websocket-protocol.md` §4.3)엔 이 케이스를 설명하는 콜아웃이 신설됐는데 대응하는 프론트엔드 user-guide 는 갱신되지 않음
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` (line 109) + `.../run-results.en.mdx` (line 98)
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md` §12.8 에 이번 changeset 이 새로 추가한 콜아웃 원문: "재진입 turn 이 계속되는 경우: 아래 서술은 재진입 turn 이 **종결**되는 경우다. turn 이 대화를 끝내지 않으면(**multi-turn 에서 가장 흔함**) downstream graph 진행이 아니라 `waiting_for_input` 으로 **re-park** 하고 세그먼트를 종료한다". 즉 이 branch 가 고친 `state-machine.ts`(`FAILED → WAITING_FOR_INPUT` retry-reentry 허용 추가)는 바로 이 "재시도 후 대화가 계속되는" — spec 저자 스스로 "가장 흔한 경우"라 명시한 — 케이스를 persist 가능하게 만드는 수정이다. 그런데 사용자 가이드 `run-results.mdx`/`run-results.en.mdx` 의 "멀티턴 대화 중 오류 발생 시 재시도" 절은 여전히 "재시도가 성공하면 AI 노드 다음에 연결된 노드(예: HTTP Request, 이메일 전송 등)가 일반 실행과 동일하게 이어서 실행돼요" / "If the retry succeeds, any downstream nodes connected to the AI node ... continue executing just as in a normal run." 한 문장만 있고, 대화가 이어지는(가장 흔한) 경우엔 downstream 이 아니라 다시 "입력 대기" 로 돌아간다는 설명이 없다. 사용자가 [다시 시도] 클릭 후 downstream 노드(HTTP Request 등)가 안 도는 것을 보고 "재시도가 실패했다" 로 오인할 소지가 있다 — 이 changeset 자체가 만들어낸/고정시킨 동작에 대한 안내 공백이므로 "동반 갱신 누락"에 해당
  - 제안: 두 파일의 해당 `<Callout type="note">` 블록에 "재시도가 성공했지만 AI 가 대화를 계속 이어가는 경우(멀티턴에서 가장 흔함)엔 downstream 노드가 바로 실행되지 않고, 새 AI 응답이 대화창에 표시되며 실행은 다시 '입력 대기' 상태로 돌아간다" 는 취지의 문장을 ko/en 동시 추가

## 요약

매트릭스 21개 행 중 이번 changeset(전체가 `codebase/backend/src/modules/execution-engine/**` + `spec/**` + `plan/**` 로만 구성 — frontend/i18n/노드/auth/expression-engine/system-status/error-codes.ts/warningRules 파일은 전혀 포함되지 않음) 과 관련 있는 행은 `run-debug-flow-change`(semantic) 1건뿐이며, 대조 결과 대응 user-guide 페이지(`05-run-and-debug/run-results.{mdx,en.mdx}`) 가 이번 PR 이 고친 "재시도 후 대화 계속(re-park)" 케이스를 반영하지 못해 WARNING 1건이 확인됐다. 나머지 후보 행(`new-node`/`node-schema-change`: `codebase/backend/src/nodes/**` 미매치, `new-ui-string`/`new-widget-chrome-string`: frontend·channel-web-chat tsx 없음, `new-warning-code`/`new-error-code`: warningRules·`error-codes.ts` 미터치, `new-cross-cutting-enum`: `WaitingInteractionType` union 값 불변(재export 위치만 유지), `new-handler-output-field`: `NODE_STARTED` payload 필드셋 불변, `auth-session-flow-change`/`auth-config-type-enum-change`: `auth/**` 미터치, `expression-language-change`: `packages/expression-engine/**` 미터치, `backend-api-change`: controller/dto 미터치, `integration-provider-change`/`new-userguide-section-dir`/`new-bullmq-queue`: 해당 없음)는 전부 미매칭으로 확인했다. CRITICAL 급(i18n parity 편측 누락·backend 코드 ko 매핑 누락·신규 섹션 locale 미등록)은 발견되지 않았다.

## 위험도

MEDIUM
