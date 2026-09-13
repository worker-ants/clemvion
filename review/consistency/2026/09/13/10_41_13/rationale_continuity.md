# Rationale 연속성 검토 — spec/5-system/ (impl-done, guide-error-code-truth / HEAD=a68457936)

## 스코프 메모

- 검토 모드 `--impl-done`, target `spec/5-system/`. `spec/5-system/**` 자체의 diff 는 이번에도 **0 파일** — 정상(이 브랜치는 코드·유저가이드 mdx·plan·review 산출물만 바꿨다).
- 이번 라운드는 이전 두 회차(`review/consistency/2026/09/13/01_15_40`=impl-prep, `10_12_54`=impl-done)가 이미 검토한 작업에 **`a68457936`(리뷰 라운드 1 fix)** 이 추가된 상태를 본다. 프롬프트 본문은 예산에 잘려 있어(`spec/5-system/3-error-handling.md`·`7-llm-client.md` 등 17개 파일, diff 본문 포함) 워킹트리 절대경로(`git diff origin/main...HEAD`, `git show a68457936`)로 직접 대조했다.
- `10_12_54` 회차가 낸 WARNING 1건(`nodeName`→`nodeLabel` 미정정)과, `a68457936` 커밋 메시지가 자백한 자기모순(`LLM_RATE_LIMIT` 2표 중복)이 이번 diff 에서 실제로 해소됐는지를 1차로 검증했다.

## 발견사항

### [INFO] 이전 회차 WARNING(`nodeName`→`nodeLabel`)이 이번 커밋에서 정정됨 — 재지적 아님, 확인만

- target 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:173`, `run-results.en.mdx:163`.
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §2.2 실행 에러 형식 Rationale — *"`nodeLabel` 로 정정 (2026-08-17)": 종전 예시는 `nodeName` 이었다. 엔진 emit 은 전수가 `nodeLabel: node.label ?? node.type` 이고 `nodeName` 을 쓰는 emit 은 코드베이스에 0건임을 실측했다."*
- 상세: 워킹트리를 직접 grep 한 결과 두 파일 모두 `"nodeLabel": "AI Agent"` 로 정정돼 있고 `nodeName` 잔존은 0건이다. `10_12_54` 회차 WARNING 이 지적한 시점의 상태가 `a68457936`("그리고 `nodeName` → `nodeLabel`: spec §2.2 가 2026-08-17 에 이미 정정한 내용인데 바로 옆 `code` 필드를 고치면서 지나쳤다. 실측 재확인 — backend emit `nodeName` 0건, `nodeLabel` 57건.")에서 명시적으로 처분됐다.
- 제안: 없음(양성 확인).

### [INFO] 커밋이 자백한 자기모순(`LLM_RATE_LIMIT` 2표 중복)도 spec §1.4 구조와 정합하게 해소됨

- target 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx`(연결-테스트 문맥에서 `LLM_RATE_LIMIT`/`LLM_TIMEOUT` 언급은 실행-결과 문서로 링크만 남김), `run-results.mdx:188`(`AI · LLM` 행 1곳에만 `LLM_RATE_LIMIT` 유지).
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" 표 — LLM 카테고리는 `LLM_CALL_FAILED · LLM_RATE_LIMIT · LLM_RESPONSE_INVALID · LLM_TIMEOUT · MAX_COLLECTION_RETRIES_EXCEEDED` **단일** 행이며, §1.4 상단 표(엔진 수준)에는 LLM 카테고리 코드가 없다 — 즉 spec 은 애초부터 "LLM 코드는 노드 수준 표 1곳"이라는 단일 등재 구조다.
- 상세: `a68457936` 커밋 메시지는 "노드 종류별/엔진 수준 2단 구조를 도입하면서 노드 표에 넣고 엔진 표에서 지우지 않았다"고 자백했는데, 이는 **가이드(mdx) 자체의 구조**에서 난 결함이지 spec 을 어긴 것은 아니었다(spec 은 애초에 2단 구조를 규정한 적 없음). 수정 후 가이드는 spec 과 동형으로 `LLM_RATE_LIMIT` 를 1곳에만 남겨 오히려 spec §1.4 의 "노드 수준 카테고리 표 단일 등재" 구조에 더 가까워졌다. Rationale 위반이나 기각된 대안 재도입은 없다.
- 제안: 없음(양성 확인). 다만 가이드가 spec §1.4 의 `MAX_COLLECTION_RETRIES_EXCEEDED` 를 (사용자 대상 문서라는 이유로) 계속 생략하는 것은 완결성 이슈일 수 있으나 Rationale 연속성 관점 밖이라 별도 트래커 사안이다.

### [INFO] `TestConnectionResultDto.code` 신설·`latencyMs`/`meta` 제거는 인접 spec(§9.1)·기존 마스킹 원칙과 정합

- target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`(`latencyMs`→`code` 치환, `meta` 제거), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`(`latencyMs` 제거), `codebase/backend/src/modules/llm/llm.service.ts`(`error`→`message`).
- 과거 결정 출처(간접, scope 밖이지만 diff 가 직접 인용): `spec/2-navigation/4-integration.md §9.1` — *"POST /api/integrations/:id/test … `status='pending_install'` row 는 … `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 로 즉시 거부"*, 그리고 `spec/5-system/3-error-handling.md` Rationale "4xx http-error `message` 고정 문구 — CWE-209 방지"(내부 원문 대신 고정/정제된 문구만 노출).
- 상세: 실측(`IntegrationTestResult` 인터페이스, `integrations.service.ts:75-83`)으로 `code`/`message`/`capabilities`/`serverInfo`/`preview` 생산자가 실재함을 확인했고, spec §9.1 이 `code` 필드를 이미 문서화하고 있어 DTO 쪽이 낡아 있던 상태였다(생산자 있음·선언 없음 방향). `latencyMs`/`meta` 제거는 그 반대 방향(선언 있음·생산자 0건)이며, 이번 diff 가 실측(`grep`)으로 두 방향을 모두 닫았다고 주장하고 이는 워킹트리 검증과 일치한다. `LlmService.testConnection` 의 `message` 필드가 `sanitizeLlmErrorMessage` 의 고정 8갈래 문장만 반환하는 것은 §3-error-handling.md Rationale 의 "provider/내부 원문을 그대로 echo 하지 않고 고정 문구로 마스킹한다"는 기존 원칙과 같은 방향이며 이를 어기지 않는다.
- 제안: 없음(양성 확인). MCP 전용 3필드(`capabilities`/`serverInfo`/`preview`) 미선언은 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-13 등재)에 후속으로 정식 이관했으므로 "무근거 번복"이 아니라 정상적인 단계적 처리다.

### [INFO] `testConnection` 실패 응답 shape 의 spec 미문서화는 이번 라운드에도 여전히 갭이나, 3회 연속 동일하게 planner 백로그로 정식 추적됨 — 신규 지적 아님

- target 위치: `spec/5-system/7-llm-client.md` §8.3(성공 케이스만 문서화, 표 행 `{ success: true }`/`{ success: true, dimension? }`뿐 — 실패 필드명 `message` 는 여전히 어느 표에도 없음).
- 과거 결정 출처: 없음(신규 공백, "결정의 번복"이 아니라 "결정이 없었던 자리"). 다만 `01_15_40`(impl-prep) INFO#1 → `10_12_54`(impl-done) INFO#2 가 동일 지점을 연속 지적했다.
- 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md:3225-3232` 항목("`testConnection` 실패 응답 shape 이 어느 spec 표에도 없다", "5개 checker 전원이 짚었다")이 이번 커밋(`a68457936`)에서도 갱신·유지돼 있고, `LlmService.testConnection` 의 JSDoc(`@returns 실패 시 { success:false, message }`)에도 이 갭을 명시했다. developer 는 `spec/` 쓰기 권한 밖이라 이 자리를 스스로 못 메우고 planner 이관을 유지한 것으로, 거버넌스 경계를 지킨 정상 상태다 — Rationale "무근거 번복"에 해당하지 않는다.
- 제안: 없음(참고용, 3회 연속 동일 결론). planner 턴에서 `7-llm-client.md` §8.3 표에 실패 행을 추가하고 짧은 Rationale 을 남기면 이 항목은 완결된다.

## 요약

이번 라운드(`a68457936`, `/ai-review`+`--impl-done` 지적 10건 처분 커밋)는 앞선 두 회차의 rationale-continuity 지적(§2.2 `nodeLabel` 미정정 WARNING)과 커밋 스스로 자백한 자기모순(§1.4 `LLM_RATE_LIMIT` 표 중복)을 모두 실측 확인 가능한 형태로 해소했으며, 새로 도입된 DTO 필드 변경(`code` 추가, `latencyMs`/`meta` 제거, `error`→`message`)은 spec `§9.1`·`3-error-handling.md` 의 기존 마스킹 원칙과 정합적이라 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 유일하게 남는 것은 `testConnection` 실패 응답 shape 의 spec 미문서화인데, 이는 3회 연속 checker 가 지적했고 developer 가 매번 같은 방식(권한 밖 → planner 백로그 이관)으로 정상 처리하고 있어 "무근거 번복"이 아니라 거버넌스 경계를 지킨 대기 상태다.

## 위험도

LOW
