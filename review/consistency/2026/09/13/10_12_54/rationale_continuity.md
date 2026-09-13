# Rationale 연속성 검토 — spec/5-system/ (impl-done, guide-error-code-truth / 커밋 911d9d7dd)

## 스코프 메모

- 검토 모드 `--impl-done`, target `spec/5-system/`. `spec/5-system/**` 자체의 diff 는 **0 파일**(정상 — 이 브랜치는 코드·유저가이드 mdx·plan 만 바꿨다).
- diff 실체(17파일/936줄)는 프롬프트 예산에 잘려 있어 워킹트리 절대경로(`git show 911d9d7dd`, `git diff origin/main...HEAD`)로 직접 확인했다. 변경 범위: `LlmService.testConnection` 응답 필드(`error`→`message`, 미발행 `latencyMs` 제거), 자매 DTO 2종, 프런트 `model-configs.ts`/테스트, 유저가이드 mdx 4쌍(ko/en) 8파일, 신규 가드 2건(`guide-error-code-{existence,scan}`), plan 문서 2건.
- 이전 회차(`review/consistency/2026/09/13/01_15_40`, `--impl-prep`)의 rationale_continuity 가 이미 이 작업을 사전 점검했고 그 산출물이 이번 커밋에 함께 커밋돼 있다. 아래 발견 중 하나는 그 회차가 지적한 항목이 이번 impl-done 시점에도 spec 에는 그대로 미반영임을 재확인한 것이다(단, 개발자가 이미 planner 백로그로 정식 등재함).

## 발견사항

### [WARNING] 유저가이드가 이미 정정된 필드명(`nodeLabel`)을 여전히 `nodeName`으로 적고 있다 — 이 PR이 바로 옆 줄을 고치면서 지나쳤다

- target 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:173`, `run-results.en.mdx:163` — "실행 에러 응답 예시" JSON 블록. 이번 커밋이 바로 이 블록의 `"code"` 필드(`NODE_EXECUTION_FAILED` → `LLM_TIMEOUT`)를 고쳤다.
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §2.2 실행 에러 형식의 Rationale — *"`nodeLabel` 로 정정 (2026-08-17)**: 종전 예시는 `nodeName` 이었다. 엔진 emit 은 전수가 `nodeLabel: node.label ?? node.type` 이고 `nodeName` 을 쓰는 emit 은 코드베이스에 **0건**임을 실측했다 — [WS §4.1] 의 같은 drift 를 정정하며 이 예시도 함께 맞췄다."*
- 상세: 실측(`grep -rln "nodeName" codebase/backend/src`)으로 재확인해도 backend 소스에 `nodeName` 필드를 emit 하는 코드는 0건이고, `nodeLabel` 은 `node-handler.interface.ts`·`conversation-thread.types.ts`·`statistics.service.ts` 등 다수에서 표준 필드로 쓰인다. 즉 스펙은 이미 "실행 에러 봉투 예시에 `nodeName` 을 쓰면 안 된다"를 명시적 Rationale 로 확정했는데, 유저가이드의 동일 목적 JSON 예시는 여전히 `nodeName` 을 싣고 있다. 이번 커밋의 취지 자체가 *"가이드가 실제로 존재하지 않는 것을 사실처럼 적는 문제"* 를 고치는 것이었고, 바로 그 원칙을 어기는 필드가 같은 파일·같은 JSON 블록·바로 인접한 줄에 있었는데 이번 배치의 스캔 축(에러 코드 토큰)이 필드명은 보지 않아 지나쳤다.
- 제안: `nodeName` → `nodeLabel` 로 정정 (`run-results.mdx`/`.en.mdx` 각 1줄). 이미 §2.2 Rationale 이 명시한 정정이므로 새 Rationale 작성은 불필요하고 단순 오탈자 정정에 해당한다. 이번 리뷰에서 새로 발견된 것이므로 이번 배치에서 바로 고치거나, 안 되면 `plan/in-progress/spec-draft-nullable-notation-followups.md` 류 트래커에 한 줄 등재할 것을 권한다.

### [INFO] `testConnection` 실패 응답 shape 의 spec 미문서화는 이미 planner 백로그로 정식 이관됨 — 재지적 아님, 추적 확인만

- target 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 반환 타입 `error`→`message`), `spec/5-system/7-llm-client.md` §8.3 (성공 케이스만 문서화, 실패 필드명 여전히 미등재).
- 과거 결정 출처: 없음(신규 공백) — 다만 이전 회차 `review/consistency/2026/09/13/01_15_40/rationale_continuity.md` 가 동일 지점을 INFO 로 이미 지적했고, `2-navigation/4-integration.md §9.1`/Rationale(`:id/test` 결과 shape `{success, code, message}`)이라는 자매 사례가 이 저장소의 관행(계약 정정 시 spec 에 한 줄 + Rationale)을 보여준다.
- 상세: `plan/in-progress/guide-error-code-truth.md` §E 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신분을 확인한 결과, 개발자는 이 갭을 스스로 고치지 않고(=developer 는 `spec/` 쓰기 권한 밖) *"planner 등재. `7-llm-client.md` 는 spec-linked 라 `--impl-done` 에서 재조우할 것이다"* 라고 명시적으로 트래커(`spec-draft-nullable-notation-followups.md`, "`testConnection` 실패 응답 shape 이 어느 spec 표에도 없다" 항목, `01_15_40` 인용 포함)에 등재했다. 즉 이번 impl-done 시점에 spec 이 여전히 갭 상태인 것은 "무근거 번복"이 아니라 **거버넌스 경계(§자기-반증형 소정정 예외 밖)를 지킨 정상적 이관**이다.
- 제안: 없음(참고용). planner 턴에서 이 트래커 항목을 처리할 때 `7-llm-client.md` §8.3 표에 실패 행(`{ success:false, message }`, SoT=`sanitize-error.util.ts`)을 추가하고 짧은 Rationale 을 남기면 완결된다.

### [INFO] 가이드의 에러코드 정정 내용은 기존 Rationale/카탈로그와 정합적으로 검증됨

- target 위치: `run-results.mdx`/`error-handling.mdx`(ko/en)의 은퇴 코드 2종(`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`) 제거 + 카테고리별 코드표 도입, `integrations.mdx`(ko/en)의 `MAKESHOP_API_ERROR`→`MAKESHOP_404` 치환.
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.4/§3.1 — "구 에러 코드 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다" + 카테고리별 실재 코드표(HTTP/DB/Email/LLM/Code/Sub-workflow).
- 상세: 직접 대조한 결과 가이드의 신규 표(HTTP_TRANSPORT_FAILED·DB_QUERY_FAILED·EMAIL_SEND_FAILED·LLM_CALL_FAILED 등)는 §1.4/§3.1 카탈로그와 1:1 로 일치한다. `models.mdx` 의 8갈래 문장 표도 `sanitize-error.util.ts` 실제 8분기와 정확히 일치한다. 기각된 대안(예: 트래커가 초안으로 썼던 "`LLM_CONNECTION_ERROR` 로 수렴 표기") 을 다시 채택하지 않았고, 오히려 그 초안을 취소선 처리하며 반증 근거를 남긴 것도 이 저장소의 "무근거 번복 금지" 관행에 부합한다.
- 제안: 없음(양성 확인).

## 요약

이번 impl-done 대상(`guide-error-code-truth`, 커밋 `911d9d7dd`)은 `spec/5-system/` 본문을 건드리지 않았고, 실제로 대조해 본 결과 §1.4/§3.1 의 에러 코드 카탈로그·§2.1 API 계약 관행과는 정합적이다 — 기각된 대안의 재도입이나 무근거 번복은 발견되지 않았다. 다만 두 가지를 남긴다: (1) `testConnection` 실패 응답 shape 미문서화는 이미 개발자가 스스로 인지해 planner 백로그로 올바르게 이관했으므로 재지적이 아니라 추적 확인 성격의 INFO 다. (2) 이번 PR이 정확히 같은 종류의 결함("가이드가 존재하지 않는 것을 사실처럼 서술")을 고치는 과정에서, `run-results.mdx`(ko/en)의 바로 그 JSON 예시 안에 이미 스펙이 정정을 확정한 `nodeName`(코드베이스 0건, 정답은 `nodeLabel`)이 그대로 남아 있는 것을 발견했다 — 새로 도입된 것은 아니지만 스펙에 박힌 결정을 어기는 채로 방치돼 있고, 이번 배치의 스캔 축(에러 코드 토큰)이 구조적으로 볼 수 없는 사각지대였다는 점에서 WARNING 으로 기록한다.

## 위험도

LOW
