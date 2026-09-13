# Plan 정합성 검토 — `spec/5-system/` (--impl-done, target plan: `guide-error-code-truth.md`)

## 발견사항

- **[WARNING]** `3-error-handling.md §1` 카탈로그 완결성 항목이 최소 3개 plan 파일에 중복·비참조 등재됨
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    `"3-error-handling.md §1 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다"`
    (`guide-error-code-truth.md` §E #1·#2 를 반영해 이번 배치가 새로 등재, `CAFE24_*`·
    `MAKESHOP_*`·`OAUTH_*`·`LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED` 를 예시로 듦)
  - 관련 plan:
    1. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
       "추가 위임" 절 — 같은 파일 같은 절(`3-error-handling.md §1.2`)에 `OAUTH_STATE_MISMATCH`
       를 등재하는 매우 상세한 구조 결정을 이미 진행 중이다: §1.2 메인 표는 400 을 안 받으므로
       새 서브섹션이 필요하고, 발행처가 둘(로그인 OAuth `auth-oauth.service.ts` / 연동 OAuth
       `integration-oauth.service.ts`)이며 의미 폭이 다르고(`MISMATCH`/`MISSING`/`EXPIRED`/
       `INVALID` vs `MISMATCH`/`EXPIRED`), `2-navigation/4-integration.md §9.4` 와 상호링크가
       필요하다는 것까지 실측·정리돼 있다.
    2. `plan/in-progress/keyset-cursor-uuid-validation.md` §D #1 — 같은 파일 같은 절
       (`3-error-handling.md §1`)에 Background Runs REST 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·
       `EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`) 미등재를 **동일한 논거**
       ("§1.5~§1.12 가 예외 없이 지켜 온 관행에서 이 도메인만 빠졌다")로 이미 planner 등재해
       두었다.
  - 상세: 세 plan 파일 모두 `3-error-handling.md §1` 을 대상으로 "도메인별 최소 등재 관행
    (§1.5~§1.12)에서 이 도메인만 빠졌다" 는 동일한 진단 틀을 독립적으로 재발명했는데, 서로를
    인용하지 않는다. 특히 `OAUTH_*` 는 두 항목(신규 항목과 #1)이 **글자 그대로 같은 코드
    계열**을 가리킨다 — `spec-update-node-cancellation-shutdown-classification.md` 쪽은 이미
    "새 서브섹션 필요·두 발행처 의미 폭 차이·`§9.4` 상호링크" 까지 판단을 끝냈는데, 신규 항목은
    이를 모르는 채 `OAUTH_*` 를 "한 줄도 없다" 는 평면적 서술로만 등재했다. planner 가 신규
    항목만 보고 착수하면 (a) 이미 끝난 구조 분석을 중복 수행하거나, (b) 그 구조 분석을 모른 채
    단순 나열 등재를 해 버려 두 발행처 의미 폭 차이·서브섹션 분리 요구를 놓칠 위험이 있다.
    `impl-prep`(`review/consistency/2026/09/13/01_15_40` cross_spec WARNING#1)도 "§1.4 에
    'Integration 노드' 행 또는 §1.13 신설, OAuth 는 별도 §1.x" 라고 **독자적으로 다시** 위치를
    제안했는데, 이 제안 역시 `spec-update-node-cancellation-shutdown-classification.md` 의
    기존 결정(§1.2 신규 서브섹션, §1.2.1 은 오답)과 절 번호가 어긋난다 — 세 군데가 서로 다른
    삽입 위치를 제안 중인 상태로 남는다.
  - 제안: `spec-draft-nullable-notation-followups.md` 신규 항목에
    `spec-update-node-cancellation-shutdown-classification.md`(OAuth 부분) ·
    `keyset-cursor-uuid-validation.md`(Background Runs 부분) 로의 상호 포인터를 추가할 것.
    planner 가 `3-error-handling.md §1` 을 열 때는 이 세 항목을 한 턴에 묶어 처리하는 편이
    절 번호·서브섹션 위치 충돌을 막는다 (target 문서 자체의 결함이 아니라 plan 쪽 상호참조
    누락이므로 target 재작업은 불필요, plan 문서만 갱신하면 됨).

## 확인했으나 문제 없음 (참고)

- §A 처분 반전(`LLM_CONNECTION_ERROR` 수렴 → 8갈래 문장 표로 폐기)은 impl-prep
  (`01_15_40` plan_coherence WARNING)이 미리 경고한 "체크박스만 바뀌고 근거 문장이 낡은 채
  남는다" 패턴을 실제로 피했다 — `spec-draft-nullable-notation-followups.md` 의 옛 처분
  문장이 취소선 처리되고 실측(§333/§345 `7-llm-client.md` 인용, 실재 코드 3종 카운트)이 함께
  실렸다. 미해결 결정 우회가 아니라 반증 기반 정정으로, 정정 요건(등재 시점 선행조건이
  스스로를 반증)을 충족한다.
- `7-llm-client.md §8.3` failure-shape 미문서화 gap(`01_15_40` cross_spec WARNING#2)은
  spec 을 직접 고치지 않고 planner 항목으로만 등재됐다(`spec-draft-nullable-notation-
  followups.md` "testConnection 실패 응답 shape 이 어느 spec 표에도 없다") — developer 가
  spec-linked 파일(`llm.service.ts`)을 고치면서도 `spec/**` 쓰기 경계를 지켰고, 이 gap 이
  `--impl-done` 게이트에서 다시 걸릴 수 있음을 스스로 명시했다. 선행 plan 미해소가 아니라
  의도적·인지된 이연이다.
- `user-guide-evidence.md §2` "가드 3건" 카운트가 신규 가드로 4건이 되는 불일치도 동일한
  경로로 planner 항목 등재됐다(naming_collision WARNING#4·#5 반영). `spec/conventions/
  error-codes.md` 에는 안 적기로 한 근거(그 문서가 소유 범위를 명명원칙/rename/historical-
  artifact 로 못박음)도 실측 인용이 정확하다.
- `ERROR_KO` 매핑 미배선(§F)은 `spec-draft-nullable-notation-followups.md` 기존 항목(2026-09-12
  등재분, `#1328`)을 정확히 재인용했고 새 결정을 내리지 않았다 — 중복 등재 없음.
- 코드 diff(`llm.service.ts`, `model-config-response.dto.ts`, `integration-response.dto.ts`)는
  `spec/5-system/7-llm-client.md §450`(`LLMClient.testConnection(): Promise<boolean>` 인터페이스
  불변)과 다른 계층(`LlmService` 서비스 레이어)이라 충돌하지 않는다. `latencyMs`·
  `TestConnectionResultDto` 를 참조하는 다른 in-progress plan 은 없다(grep 0건).

## 요약

target 코드 변경(LLM Test Connection 계약 정정, 유저 가이드 5종 에러 코드 정정, 신규 build-time
가드)은 `spec/5-system/` 기존 서술과 직접 충돌하지 않고, 이번 배치가 스스로 발견한 spec 갭은
모두 developer 권한 경계를 지켜 planner 항목으로 등재됐다 — 미해결 결정을 일방적으로 우회한
사례는 없다. 다만 그 planner 등재 자체가 `3-error-handling.md §1` 카탈로그 완결성을 놓고 이미
진행 중인 다른 두 plan(OAuth 서브섹션 설계·Background Runs 코드 등재)과 절 위치·범위가 겹치는데
상호 참조가 없어, 다음 planner 턴이 중복 분석을 하거나 이미 끝난 구조 결정(OAuth 두 발행처
분리)을 놓칠 위험이 있다. target 문서 자체를 다시 여는 CRITICAL 사안은 아니고, plan 파일 간
포인터 보강으로 해소 가능한 WARNING 이다.

## 위험도

LOW
