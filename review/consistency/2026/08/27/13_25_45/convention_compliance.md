# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 및 근거

`git diff origin/main...HEAD --stat -- spec/5-system/` 실측 결과, target 영역(`spec/5-system/`)에서 실제 변경된 파일은 `spec/5-system/4-execution-engine.md` 1개뿐이다(+8/-3). 같은 커밋 계열(`masking-expression-egress-split`)이 함께 바꾼 인접 spec 파일 — `spec/conventions/egress-masking.md`, `spec/conventions/node-output.md`, `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md` — 은 target 밖이지만, target 문서(`4-execution-engine.md`)가 그 문서들을 SoT 로 인용하므로 교차 검증 대상으로 함께 확인했다.

코드 측 근거는 워크트리 절대경로에서 직접 확인했다(`codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` 에서 `maskSensitiveFields` import·호출 소거 확인, `explore-tools.service.ts` 는 여전히 `maskSensitiveFields` 를 사용, `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS` export 를 `mask-sensitive-fields.util.spec.ts` 가 실제로 소비함을 확인). target 문서의 "boundary 제거" 서술은 코드와 **일치**한다 — CRITICAL 없음.

## 발견사항

- **[WARNING]** 동일 정정 문장의 축자 반복(intra-document 2회 + 문서군 전체 5회) — 문서군이 스스로 세운 "사본 금지" 원칙과 배치
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4/§1.3 인근 두 곳
    - "shape: `_retryState` 와 동일 부분집합(...)이되 `expiresAt`(TTL) 없음(...) credential / context-binding 필드는 미동봉 (~~`maskSensitiveFields` boundary~~ **allow-list 로 애초에 배제** — 그 boundary 는 2026-08-24 에 제거됐고, **이 배제는 그것과 무관**하다(`buildRetryState`/`buildResumeState` 가 옮길 키를 열거한다))..." (`_resumeCheckpoint` 서술부)
    - "`_retryState` shape: ... credential 제거 정책은 `_resumeState` 와 동일 (~~`maskSensitiveFields` boundary~~ **allow-list 로 애초에 배제** — 그 boundary 는 2026-08-24 에 제거됐고, **이 배제는 그것과 무관**하다(`buildRetryState`/`buildResumeState` 가 옮길 키를 열거한다))..." (`_retryState` 서술부)
    - 동일 문장이 target 문서 밖에서도 `spec/conventions/node-output.md` §4.2.1(1회, SoT 로 명시된 위치) · `spec/4-nodes/3-ai/1-ai-agent.md`(2회)에 **글자 그대로** 재등장 — 총 5개소.
  - 위반 규약: `spec/conventions/node-output.md` 자신의 최근 추가분(Principle 0 addendum, 2026-08-24)이 명시한 원칙 — "이 구분이 산문으로 5개 문서에 흩어져 있던 탓에 ... 네 라운드에 걸쳐 같은 결함이 하나씩 튀어나왔다(각 라운드가 미러 하나씩만 잡았다). **사본을 줄이는 것이 그 재발을 막는 유일한 방법이다**." 및 `spec/conventions/egress-masking.md` Rationale — "같은 방어 문장을 두 곳이 반복하는 것은 주인 없는 사실의 징후다."
  - 상세: `_resumeCheckpoint`/`_retryState`의 credential 배제 정책이 "boundary 제거로 인해 allow-list 로 재해석된다"는 **같은 사실**을, node-output.md §4.2.1 을 SoT 로 명시적으로 인용하면서도(문서 하단 "세 필드의 SoT 는 [CONVENTIONS node-output Principle 4.2.1]") 그 옆에 전체 정정 문장을 다시 손으로 나열했다. 대조적으로 같은 문서(`4-execution-engine.md`) §Rationale "Engine Raw Config Exposure" 항목은 같은 종류의 사실(config storage-time 마스킹 폐지)을 **한 줄 요약 + node-output.md Principle 7 인용**으로 처리해 정확히 SoT 패턴을 따랐다 — 같은 커밋 안에 올바른 예와 반복 예가 공존한다. 이번엔 5곳 모두 동시에 정확히 갱신되어 실질적 drift 는 없었지만("실측: 5곳 전부 동일 문구"), 이 패턴 자체가 문서군이 명시적으로 "재발 원인"으로 지목한 구조다.
  - 제안: `node-output.md §4.2.1` 을 유일한 SoT 로 두고, `4-execution-engine.md`·`1-ai-agent.md` 의 나머지 4곳은 짧은 인용("credential 배제 정책은 allow-list 전환됨 — SoT: node-output.md §4.2.1")으로 축약. 만약 각 문서가 self-contained 서술을 의도적으로 유지하려는 것이라면(예: 실행 엔진 문서 단독 열람 시나리오), 그 의도를 Rationale 에 명시해 규약과의 긴장을 해소할 것.

## 확인했으나 위반 아님 (근거 기록)

- `handler-output.adapter.ts` 의 `config: r.config ?? {}` (spread 아님, `maskSensitiveFields` 미호출)는 `node-output.md` Principle 7 D1의 "명시 키 enumeration 의무화·spread 금지"와 무관한 레이어(엔진 boundary, 핸들러 아님)이므로 위반 아님.
- `DEFAULT_SENSITIVE_KEYS` export 는 코드에서 실측(`grep`)한 결과 런타임 소비처(`explore-tools.service.ts`, `handler-output.adapter.ts` 주석)가 아니라 테스트(`mask-sensitive-fields.util.spec.ts`)만 import — 문서·코드 주석의 "런타임 소비처는 이 export 를 쓰지 않는다" 서술과 일치.
- `spec/5-system/6-websocket-protocol.md`·`2-api-convention.md`·`3-error-handling.md`·`14-external-interaction-api.md`·`7-llm-client.md` 를 `maskSensitiveFields`/`handler-output.adapter` 키워드로 grep — 이번 변경으로 stale 화된 잔여 서술 없음.
- `spec/conventions/node-output.md` frontmatter `pending_plans: plan/in-progress/node-output-redesign/README.md` — 해당 plan 은 실제로 `plan/in-progress/`에 살아있음(실측), stale 참조 아님.
- `spec/5-system/4-execution-engine.md` 의 Overview/본문/Rationale 3섹션 구조는 유지되며, 이번 diff 는 모두 §1(본문)·§Rationale 내부에 정확히 안착 — 문서 구조 규약 위반 없음.
- 새 export·식별자(`DEFAULT_SENSITIVE_KEYS`) 명명·에러코드(`RETRY_STATE_NOT_FOUND`, `RESUME_INCOMPATIBLE_STATE`, 기존 유지)는 `UPPER_SNAKE_CASE` 등 기존 규약과 일치, API/DTO/Swagger 데코레이터 변경은 이번 diff 범위에 없음.

## 요약

target 영역에서 실제로 바뀐 것은 `spec/5-system/4-execution-engine.md` 한 파일이며, 그 서술("config echo 의 credential 배제가 이제 `maskSensitiveFields` boundary 가 아니라 allow-list 기반")은 코드(handler-output.adapter.ts 의 마스킹 제거, explore-tools.service.ts 의 잔존)와 실측 대조 결과 정확하다. CRITICAL 급 규약 위반(명명·출력 포맷·API 문서·금지 패턴)은 발견되지 않았다. 유일한 지적은 문서 구조 층위의 것으로, 동일한 정정 문장이 SoT(`node-output.md §4.2.1`)를 명시적으로 인용하면서도 5곳(그 중 2곳은 target 문서 내부)에 축자 반복돼, 이 문서군이 바로 같은 시점(2026-08-24)에 스스로 지목한 "미러 재발" 패턴과 형태가 같다. 이번엔 5곳이 동시에 일관되게 갱신돼 실질 drift 는 없었으나, 구조적으로는 재발 위험을 남긴다.

## 위험도
LOW
