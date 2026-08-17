# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan-lifecycle 하우스키핑(이전 세션 완료분 이동 + 링크 정정)이 이번 기능 커밋들과 같은 changeset 에 섞여 있다.
  - 위치: `plan/complete/eia-internal-rest-error-masking.md`(신규, `plan/in-progress/eia-internal-rest-error-masking.md` 로부터 이동) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 상대링크 정정 2곳
  - 상세: `git diff --stat origin/main...HEAD -- plan/` 로 확인한 결과 `plan/in-progress/eia-internal-rest-error-masking.md` 는 사라지고 `plan/complete/eia-internal-rest-error-masking.md` 로 동일 내용(6줄 diff, 내용 변형 없음)이 옮겨졌다. 이는 이전 세션(#1179)이 완료했지만 `in-progress/` 에 남겨둔 plan 문서를 이번 세션이 정리한 것으로, 금번 plan(`plan/in-progress/eia-fanout-and-internal-data-masking.md`)의 §A/§B/§D 어디에도 명시된 항목이 아니다. 이미 이전 라운드(`23_08_19` scope)에서 동일하게 지적·평가됐고 위험은 낮다(문서 전용, 내용 무변형).
  - 제안: 코드 위험 없음. 조치 불요 — 커밋 메시지/PR 설명에 이 정리가 별개 사유(이전 세션 lifecycle 누락 정정)임을 한 줄 명시하는 정도면 충분하다.

- **[INFO]** 관련 없는 다른 in-progress plan 문서(`ie-resume-turn-boundary-cancel.md`)에 8줄 짜리 "해소" 캐비엇이 추가됐다.
  - 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md` (WS 채널 마스킹 우려를 서술한 기존 항목 바로 아래)
  - 상세: 그 plan 은 별도 작업(`ie-resume-turn-boundary-cancel`)의 것이지만, 그 문서가 이미 "WS 채널이 값-마스킹 없이 재사용될 수 있다"는 미해결 우려를 기록해 두고 있었다. 이번 PR 의 §A(`WebsocketService.emitExecutionEvent` 값-패턴 마스킹)가 정확히 그 우려를 해소하므로, 다른 작업자가 stale 한 경고를 근거로 불필요한 후속 작업을 벌이지 않도록 해소 사실을 그 자리에 남긴 것이다. 코드 변경은 없고(plan 문서만) 부수적으로 발견한 사실(구독 인가가 workspace 소유만 검사)도 함께 정직하게 기록했다 — 은폐가 아니라 열린 루프를 닫은 것이라 스코프 이탈보다는 정당한 cross-reference 로 판단된다.
  - 제안: 조치 불요.

- **[INFO]** `sanitize-error-message.ts` 내부 구조를 `deepRedactCore`/`deepRedactObject`/`DeepRedactOptions` 로 분리한 리팩터링.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`deepRedactCore`, `deepRedactObject`, `deepRedactSecretsPreserving`)
  - 상세: 겉보기엔 무관한 내부 리팩터링처럼 보이지만, 신규 공개 함수 `deepRedactSecretsPreserving`(§A 의 `llmCalls` wire 예외 요구사항)이 기존 depth-0 캐시(`DEEP_REDACT_CACHE`, 객체 identity 만 키)를 그대로 타면 `preserveKeys` 옵션이 다른 두 호출이 같은 객체에 대해 서로의 캐시 결과를 오염시키는 문제가 생긴다. 그래서 캐시를 `deepRedactSecrets` 진입점 전용으로 남기고, 옵션을 스레딩하는 공유 코어(`deepRedactCore`)로 로직을 통합했다. §A/§마커 요구사항의 직접적 귀결이며, git diff 를 실측하면 순수 추가+최소 재배선(로직 변경 없음)이라 scope 이탈이 아니다.
  - 제안: 없음 (범위 내).

- **[INFO]** `review/code/**`·`review/consistency/**` 산하 130여 개 신규 파일이 이번 diff 에 포함되어 있다.
  - 위치: `review/code/2026/08/17/{00_23_57,00_47_01,10_26_58,10_50_14}/**`, `review/code/2026/08/16/{23_08_19,23_50_03}/**`, `review/consistency/2026/08/{16,17}/**/**`
  - 상세: 이 저장소의 명시 규약(CLAUDE.md `## Skill 체계` — 코드 리뷰어의 `review/code/**` 쓰기 권한, `## 외부 LLM 호출 정책` — "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")에 따라 developer 세션이 구현 완료 후 반복한 `/ai-review` + `resolution-applier` fix 라운드(총 6라운드)의 정본 산출물이다. `plan/complete/` 는 gitignore 대상이 아니며(`feedback_plan_checkbox_actual_state.md`), 실제로 각 라운드의 `RESOLUTION.md` 가 코드 변경(CRITICAL 철회, 마커 처리 등)의 근거로 인용되고 있어 코드 diff 와 인과적으로 연결돼 있다. 따라서 이는 "무관한 부수 작업"이 아니라 이 저장소의 표준 워크플로가 요구하는 감사 추적(audit trail)이다.
  - 제안: 조치 불요. scope 위반으로 판단하지 않는다.

## 요약

이번 changeset(`git diff origin/main...HEAD`, 29개 codebase/spec/plan/CHANGELOG 파일)을 실측했다. 핵심 프로덕션 코드 변경 — `websocket.service.ts`(`maskWireEnvelope`/`toFanoutEnvelope` 신설, 두 emit 경로 공유 초크포인트화), `sanitize-error-message.ts`(`deepRedactSecretsPreserving`/마커 멱등성), `redact-stored-error.ts`(`redactStoredDataForResponse` 신설), `executions.service.ts`/`background-runs.service.ts`(`outputData`+노드 레벨 `inputData` 마스킹 6표면 확장, `Execution.inputData` 카브아웃), 관련 DTO/Swagger JSDoc, 유저 가이드 mdx 2종 — 는 모두 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 가 명시한 §A(WS emit 값-패턴 마스킹)·§B(내부 REST `inputData`/`outputData` 확장)·§D(표면 서술 단일화)로 정확히 추적된다. 신규 테스트(background-runs/executions/websocket/redact-stored-error/sanitize-error-message 각 spec)는 기존 describe 블록 뒤에 순수 추가된 형태이며 포맷팅·임포트 드리프트는 발견되지 않았다. `sanitize-error-message.ts` 의 내부 함수 분리는 신규 옵션(`preserveKeys`) 도입에 따른 캐시 오염 방지가 목적으로, §A 요구사항의 직접 파생이라 불필요한 리팩터링이 아니다. 유일하게 선언된 기능 범위 밖으로 보이는 항목은 (1) 이전 세션이 완료했지만 `in-progress/` 에 남겨둔 plan 문서 이동(내용 무변형)과 (2) 다른 plan 문서에 이번 작업이 그 문서의 미해결 우려를 해소했음을 기록한 8줄 캐비엇으로, 둘 다 위험이 낮고 이미 이전 라운드 스코프 리뷰에서 동일하게 평가·수용됐다. `review/**` 산하 대량 신규 파일은 프로젝트가 상시 승인한 강제 review/fix 워크플로의 산출물이라 스코프 이탈이 아니다. CRITICAL/WARNING 급 범위 이탈은 발견되지 않았다.

## 위험도
LOW
