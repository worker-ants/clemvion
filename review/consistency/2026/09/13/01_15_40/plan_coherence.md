# Plan 정합성 검토 — `spec/5-system/` (--impl-prep, target plan: `guide-error-code-truth.md`)

## 발견사항

- **[WARNING]** 트래커의 기존 "처분 제안" 문구가 이번 실측으로 이미 반증됐는데, plan 체크리스트가 그 정정을 명시하지 않는다
  - target 위치: `plan/in-progress/guide-error-code-truth.md` §A (L18-55), 체크리스트 E "트래커 등재/종결" (L111)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L3141-3166 (`- [ ] 유저 가이드가 존재하지 않는 에러 코드 5종을 이름으로 적는다`)
  - 상세: 트래커 항목은 자신의 진단으로 *"LLM 쪽 둘(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`)은 오기가 아니라 미구현"* 이라며 `7-llm-client.md:345`(클라이언트 계층 `LLM_CONNECTION_ERROR` 수렴)을 근거로 들고, **"처분은 '이름 치환'이 아니라 수렴 코드(`LLM_CONNECTION_ERROR`)를 적고 세분화는 Planned 로 표시"** 라고 구체적 처분까지 못박아 두었다(L3162-3163). `guide-error-code-truth.md` §A 는 이보다 더 깊이 파서 **주어 자체가 틀렸다**는 걸 실측했다 — `LlmService.testConnection` 은 `client.testConnection()`(§6 코드-매핑이 적용되는 `chat()`/`stream()` 과는 다른 별개 메서드)을 호출하고 `catch` 에서 `err.code` 가 아니라 `err.message` 만 취해 `sanitizeLlmErrorMessage` 8갈래 고정 문장으로 정규화한다 — **어떤 LLM_\* 코드도, `LLM_CONNECTION_ERROR` 조차, 이 경로엔 존재하지 않는다**(직접 소스 확인: `codebase/backend/src/modules/llm/llm.service.ts:312-345`, `codebase/backend/src/modules/llm/clients/openai.client.ts:230-232`). 즉 트래커가 적어 둔 "처분 제안" 자체가 이제 틀린 서술이다. `guide-error-code-truth.md` 는 이 사실을 자기 plan 안에는 정확히 적었지만(§A "실측하니 주어부터 틀렸다"), 트래커 쪽 체크리스트 항목(§3141-3166)을 어떻게 갱신할지는 "E: 트래커 등재/종결" 한 줄로만 남겨 두어 — 체크박스만 `[x]` 로 바뀌고 L3162-3163 의 구체적 처분 문장이 취소선 없이 그대로 남을 위험이 있다. 이 저장소가 반복 학습한 클래스(`plan 서술은 철회로 거짓이 될 수 있다` — 체크박스만 바뀌고 근거 문장이 안 바뀌는 패턴)와 정확히 같은 모양이다.
  - 제안: `guide-error-code-truth.md` 구현 완료 시 `spec-draft-nullable-notation-followups.md` L3162-3163 의 "처분 제안" 문장을 체크박스 전환과 **함께** 취소선 + 정정으로 갱신할 것(단순히 체크만 하지 말 것). 이 plan_coherence 리포트를 그 정정의 근거로 인용 가능.

- **[INFO]** `spec/5-system/7-llm-client.md` 는 `testConnection` 실패 경로의 응답 shape 을 아직 문서화하지 않는다 — §A 코드 수정이 이 문서의 spec-linked 대상을 건드리므로 `--impl-done` 게이트에서 다시 마주칠 gap
  - target 위치: `spec/5-system/7-llm-client.md` `#### LlmService.testConnection — kind별 probe 전략`(L441-452) — 성공 경로(`{ success: true }`, `{ success: true, dimension? }`)만 표로 문서화하고 실패 경로는 언급이 없음
  - 관련 plan: `plan/in-progress/guide-error-code-truth.md` 체크리스트 A (L103-106) — `LlmService`·`ModelTestConnectionResultDto`·가이드 표 갱신만 나열, `7-llm-client.md` 갱신 항목 없음
  - 상세: `llm.service.ts` 는 `7-llm-client.md` frontmatter `code:` 글로브에 이미 포함돼 있어(spec-linked 파일) 이 서비스를 고치면 `--impl-done spec/5-system/`(또는 `7-llm-client.md` 단독) 게이트가 실패 경로 미문서화를 다시 지적할 가능성이 있다. `guide-error-code-truth.md` 는 `owner: developer` 라 spec 쓰기는 원칙적으로 planner 턴 대상(CLAUDE.md) — 이 gap 을 착수 전에 인지하지 못하면 구현 중간에 계획에 없던 planner 에스컬레이션이 필요해질 수 있다.
  - 제안: 체크리스트 A 에 "`7-llm-client.md` §testConnection 표에 실패 경로(`{ success:false, message }`) 행 추가 필요 여부 확인" 항목을 미리 얹거나, 착수 전 `--impl-done` 대상 파일에 `7-llm-client.md` 가 걸릴 수 있음을 미리 적어 둘 것.

## 요약

`guide-error-code-truth.md` 의 §A~§D 처분은 `spec/5-system/3-error-handling.md` 의 현재 카탈로그(§1.4 "구 에러 코드" 목록·§1 전체 코드 표)와 직접 대조했을 때 모두 정합했다 — 가이드가 지어낸 5개 코드(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`/`LLM_CONNECTION_ERROR`/`INTEGRATION_ERROR`/`NODE_EXECUTION_FAILED`/`MAKESHOP_API_ERROR`) 중 어느 것도 현재 카탈로그에 등재돼 있지 않아 target 문서와 충돌하는 결정은 없다. 다만 이 배치가 닫으려는 상위 트래커(`spec-draft-nullable-notation-followups.md`)의 항목 하나는 이미 확정된 "처분 제안" 문장을 갖고 있는데, 이번 실측이 그 문장을 사실상 반증했다 — plan 이 이를 자기 문서에는 정확히 반영했지만 트래커 쪽 정정까지 체크리스트에 명시하지 않아 "체크박스만 바뀌고 근거 문장은 낡은 채 남는" 이 저장소의 상습적 결함 패턴을 재현할 위험이 있다(WARNING). 그 외에는 다른 in-progress plan(예: `spec-conventions-engine-error-code-surface.md`, `keyset-cursor-uuid-validation.md`, `auth-guard-reflection-hardening.md` 등)과 파일·결정 축이 겹치지 않아 미해결 결정 우회나 선행 조건 미해소는 발견되지 않았다.

## 위험도

LOW
