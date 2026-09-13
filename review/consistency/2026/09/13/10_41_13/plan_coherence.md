# Plan 정합성 검토 — `spec/5-system/` (--impl-done, target plan: `guide-error-code-truth.md`, 라운드 1 수정 반영 후)

## 발견사항

없음 (Critical 0 · Warning 0).

이전 라운드(`review/consistency/2026/09/13/10_12_54` plan_coherence)가 낸 유일한 WARNING —
"`3-error-handling.md §1` 카탈로그 완결성을 겨냥하는 plan 3건(`spec-draft-nullable-notation-
followups.md` 신규 항목· `spec-update-node-cancellation-shutdown-classification.md`·
`keyset-cursor-uuid-validation.md`)이 상호 참조 없이 독립적으로 등재돼 있다" — 는 이번 라운드의
`plan/in-progress/spec-draft-nullable-notation-followups.md:3204-3223` 편집으로 해소됐다.
실측 확인:

- `spec-update-node-cancellation-shutdown-classification.md:632` 인용(`OAUTH_STATE_MISMATCH`
  §1.2 등재) — 해당 파일 632행에 문자 그대로 존재.
- `keyset-cursor-uuid-validation.md:128` 인용(Background Runs 4종 §1 등재) — 해당 파일의
  `## D` 절 표 1행과 일치.
- 세 plan 이 "따로 처리하면 카탈로그 구조가 세 번 갈린다 — planner 턴에서 §1 하위 구조를
  한 번에 정해야 한다" 는 명시적 통합 지시로 마무리됨.

## 확인했으나 문제 없음 (참고)

- **미해결 결정과의 충돌 없음**: `LlmService.testConnection` 반환 필드를 `error`→`message`
  로 바꾸고 `ModelTestConnectionResultDto`/`TestConnectionResultDto` 에서 `latencyMs` 를
  제거·`code?: string` 를 추가한 코드 변경은, `spec/5-system/7-llm-client.md:450`
  (`LLMClient.testConnection(): Promise<boolean>` 인터페이스 불변 서술)이나
  `spec/2-navigation/4-integration.md §9.1`(`200 + { success:false, code:'INTEGRATION_INCOMPLETE' }`
  이미 문서화)과 다른 계층·다른 방향이라 충돌하지 않는다. 오히려 integration DTO 의 `code`
  필드 추가는 spec 이 이미 문서화한 형태로 **코드를 spec 에 맞춘 것**이다.
- **선행 plan 미해소 없음**: 이 배치가 스스로 찾은 spec 갭 3건(§1 카탈로그의 `CAFE24_*`/
  `MAKESHOP_*`/`OAUTH_*`/LLM 도메인 누락, `testConnection` 실패 shape 미문서화,
  `user-guide-evidence.md §2.1` 관계표 누락 행)은 전부 developer 권한 경계를 지켜 planner
  항목으로만 등재됐고(`spec-draft-nullable-notation-followups.md:3204,3225,3234`), target
  (`spec/5-system/`)을 직접 편집하지 않았다. `TestConnectionResultDto`/
  `ModelTestConnectionResultDto`/`IntegrationTestResult`/`guide-error-code-*`/
  `sanitizeLlmErrorMessage`/`LlmService`/`testConnection` 을 전수 grep 한 결과 이 두 파일
  (`guide-error-code-truth.md` 자신과 `spec-draft-nullable-notation-followups.md`) 외에
  이 식별자들을 참조하는 다른 in-progress plan 은 없다 — 라운드 1 수정 이후에도 이 사실은
  변하지 않았다.
- **후속 항목 누락 없음**: 신규 가드 3종(`guide-error-code-existence.test.ts`·
  `guide-error-code-scan.ts`·`guide-sanitized-message-parity.test.ts`)의 위치·설계 결정
  (`repo-guards/` 대신 기존 가드 가족에 합류, Planned 로드맵 이름 허용목록 미채택)은
  `--impl-prep`(`01_15_40`) 결과를 반영한 것이고, 그 결정이 만드는 후속 문서 갱신 의무
  (`user-guide-evidence.md §2` "가드 3건"→4건 카운트 정정)도 이미 planner 항목으로 등재돼
  있다. `spec/5-system/7-llm-client.md §6` 의 "미구현(Planned)" 로드맵 이름
  (`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`)을 향후 실제로 구현하려는 다른 in-progress plan 은
  현재 없음(grep 0건) — 새 가드가 그 시점에 걸릴 잠재적 충돌은 지금 시점엔 해당 없음.
- 라운드 1 자체 수정분(§ `code?: string` 선언, `nodeLabel` 정정, `LLM_RATE_LIMIT` 중복 제거,
  UI 실패 경로 테스트 추가 등)도 다른 plan 의 진행 중 항목과 겹치는 자리가 없다 — 관련
  plan(§`spec-draft-nullable-notation-followups.md`)의 해당 항목들이 이번 diff 와 1:1로
  대응하며 별도 미해결 결정을 우회하지 않는다.

## 요약

`spec/5-system/` 자체 델타는 0 이며, 코드 diff(LLM Test Connection 계약 정정·유저 가이드
정정·신규 build-time 가드)는 기존 spec 서술과 직접 충돌하지 않는다. 라운드 1(`10_12_54`)이
낸 유일한 plan 정합성 WARNING — 같은 절(`3-error-handling.md §1`)을 겨냥하는 plan 3건의
상호 참조 부재 — 은 이번 수정에서 파일·줄 단위 실측 인용으로 정확히 해소됐다. 이번 라운드에서
새로 발견된 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락은 없다. `plan_coherence` 관점에서는
`codebase/**` 를 더 건드릴 필요 없이 이 라운드로 수렴한다.

## 위험도

NONE
