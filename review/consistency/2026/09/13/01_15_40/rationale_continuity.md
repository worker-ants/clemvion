# Rationale 연속성 검토 — spec/5-system/ (impl-prep, guide-error-code-truth)

## 스코프 메모

- 검토 모드는 `--impl-prep`, target 은 `spec/5-system/` 전체(번들 25개 파일). 이 중 15개 파일(`4-execution-engine.md`·`7-llm-client.md`·`14-external-interaction-api.md` 등)은 프롬프트 조립 예산 초과로 본문이 생략돼 있어, plan 이 실제로 다루는 표면(`LlmService.testConnection`, `7-llm-client.md`)은 프롬프트 밖이었다 — 리포지토리에서 직접 `Read` 하여 보강했다.
- 실제 대상 plan(`plan/in-progress/guide-error-code-truth.md`)은 **spec 본문 수정이 아니라** 사용자 가이드 mdx(`codebase/frontend/src/content/docs/**`) 정정 + `LlmService.testConnection` 응답 필드 정합화(`error`→`message`, 미발행 `latencyMs` 제거) + 신규 정적 가드(가이드의 에러 코드 오기재 탐지) 3갈래다. 즉 이번 세션에서 `spec/5-system/**` 자체는 아직 변경되지 않았으며(git status 상 untracked 는 plan·review 산출물뿐), 본 검토는 "이 스펙을 SoT 로 삼아 착수했을 때 과거 Rationale 과 충돌하는가" 를 확인하는 사전 점검이다.

## 발견사항

### [INFO] `testConnection` 실패 응답 계약 정정에 대응하는 Rationale 부재

- target 위치: plan 항목 A (`LlmService.testConnection` 을 `{ success, error }` → `{ success, message }` 로, DTO 의 미발행 `latencyMs` 제거) — 착수 시 `spec/5-system/7-llm-client.md` §8.3/§8.4, `spec/2-navigation/6-config.md` §B.3 도 함께 갱신 대상이 될 가능성이 높음.
- 과거 결정 출처: 해당 없음(신규) — 다만 이 저장소는 유사한 "카탈로그/구현 불일치" 를 발견할 때마다 `## Rationale` 에 "카탈로그가 X, 구현은 Y였다" 식 정정 항목을 남기는 관행이 확립돼 있다(예: `3-error-handling.md` "`ACCOUNT_LOCKED` 423 → 401 오기 정정 (2026-08-31)", `error-codes.md §5` 의 rename 이력).
- 상세: 현재 `7-llm-client.md` §8.3 표는 성공 응답(`{ success: true }`/`{ success: true, dimension? }`)만 문서화하고 실패 응답 필드명은 스펙에 등재돼 있지 않다. 즉 plan 이 고치려는 `error`→`message` 정정은 기존 Rationale 을 번복하는 것이 **아니라**(문서화된 적이 없으므로) spec 의 공백을 메우는 작업이다 — 관점 3("결정의 무근거 번복")에 해당하지 않는다. 다만 이 저장소의 관행을 따르면, 코드 수정과 함께 실패 envelope 필드명을 §8.3/§8.4 또는 §B.3 에 한 줄로 명시하고 그 정정 사유를 `## Rationale` 에 남기는 것이 일관적이다.
- 제안: 착수 시 `.claude/tools/run-test-all.sh`/`--impl-done` 이전에 `7-llm-client.md`(또는 `6-config.md` §B.3)에 실패 응답 `{ success:false, message }` 형태를 등재하고, 짧은 Rationale("서비스 반환/DTO/FE 세 층이 `error`/`message` 로 갈라져 있었다")을 추가할 것을 권고한다. Critical/Warning 은 아니다 — spec 이 애초에 이 실패 형태를 규정한 적이 없어 "합의 원칙 위반" 이나 "기각된 대안 재도입" 은 성립하지 않는다.

### [INFO] 가이드의 `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` 는 다른 표면에서는 실재하는 **Planned** 로드맵 이름이다

- target 위치: plan §A "가이드(`models{,.en}.mdx`)는 … 5행 표를 싣는다(`LLM_AUTH_ERROR` 401 · … · `LLM_MODEL_NOT_FOUND` 404 · … · `LLM_TIMEOUT`) … 실측하니 주어부터 틀렸다."
- 과거 결정 출처: `spec/5-system/7-llm-client.md` §6 "에러 처리" — "**미구현(Planned)** — 세분화 에러 코드: `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400) 는 향후 클라이언트 계층에서 분기 예정이나 현재는 `LLM_CONNECTION_ERROR` 로 수렴한다."
- 상세: plan 의 결론("이 엔드포인트는 코드를 내지 않는다")은 `testConnection` 엔드포인트에 한정하면 정확하다 — §6 은 `testConnection` 이 아니라 `*.client.ts` 의 chat/embed 호출 일반(노드 실행 경로)에 대한 서술이라 표면이 다르다. 다만 plan 문서 자체가 "5행 표"를 "존재하지 않는 에러 코드" 로 뭉뚱그려 표현하고 있어, 이름 자체(`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`)는 §6 에 **Planned 로드맵 항목으로 이미 실재**한다는 사실이 plan 본문에서 드러나지 않는다. Rationale 연속성 관점에서 문제되는 것은 spec 위반이 아니라, 이번 배치가 만들 **신규 정적 가드(§D)** 가 "가이드가 에러 코드 문맥에 이름을 적으면 실재 카탈로그(§1)에 있어야 통과" 라는 판정 기준을 쓸 경우, 향후 누군가 §6 의 Planned 코드를 정당하게 가이드에 caveat 과 함께 언급하려 할 때 (아직 §1 카탈로그엔 없으므로) 가양성으로 막힐 수 있다는 점이다.
- 제안: guard 설계(§D) 또는 plan 본문에 "Planned 로 문서화된 로드맵 코드명(§6)은 이 가드의 판정 대상에서 어떻게 다루는가" 를 한 줄 명시할 것. 지금은 A/B/C 항목의 실측 스코프 밖이라 Critical 은 아니지만, 가드가 커버리지 기준을 "§1 카탈로그 등재 여부" 로만 잡으면 Planned 서술까지 오탐할 수 있다는 점을 체크리스트 D 항목에 남겨두면 향후 재작업을 줄인다.

### [INFO] `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 은퇴는 이미 §1.4 에 정착돼 있어 추가 조치 불필요

- target 위치: plan §B.
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.4 "구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다."
- 상세: plan §B 가 가이드에서 이 두 코드를 제거하는 것은 이 기존 Rationale/카탈로그 결정을 **그대로 따르는 것**이며 번복이 아니다. `error-codes.md §5`(Rename 이력) 표에는 이 3코드가 등재돼 있지 않지만, §5 의 진입 기준은 "구 코드 → 대체 코드 1:1(또는 조건별 분기) rename" 이고 이 3코드는 카테고리별 다대다 대체(HTTP_*/DB_*/LLM_* 등)라 애초에 §5 표 형식과 맞지 않는다 — §1.4 자체가 이미 SoT 로 기능하고 있어 등재 누락으로 보기 어렵다. 문제 삼을 근거가 약해 Warning 으로 올리지 않았다.
- 제안: 없음(참고용 확인 항목).

## 요약

이번 plan(`guide-error-code-truth`)은 spec 본문을 직접 변경하지 않고 사용자 가이드 mdx·`LlmService.testConnection` 응답 계약·신규 정적 가드를 다루며, 검토 대상 `spec/5-system/` 번들에서 이 작업과 충돌하는 "기각된 대안의 재도입", "합의 원칙 위반", "무근거 번복", "invariant 우회" 는 발견되지 않았다. `MODEL_CONFIG_NOT_FOUND`/`DEFAULT_MISSING` 분리, `AUTH_CONFIG_NOT_FOUND` 400 예외, `select:false` 기각 등 이 문서군에 이미 존재하는 굵직한 Rationale 들은 모두 자기 정합적이며 최근 3라운드 연속 지적됐던 "1행 기각 대안 재도입" 오판 사례에 대한 선제적 해명까지 본문에 포함돼 있다. 다만 (1) `testConnection` 실패 envelope 필드 정정에 대응하는 spec 갱신·Rationale 기록이 체크리스트에 없고, (2) 신규 가드가 `7-llm-client.md §6` 의 **Planned** 로드맵 코드명(`LLM_AUTH_ERROR` 등)을 어떻게 판정할지 불명확하다는 두 가지 INFO 성격의 보완 여지가 있다. 둘 다 착수를 막을 사유는 아니다.

## 위험도

LOW
