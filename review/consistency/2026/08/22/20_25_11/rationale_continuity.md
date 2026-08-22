# Rationale 연속성 검토 — `spec/4-nodes/7-trigger/` (impl-done)

## 스코프 요약

`origin/main...HEAD` diff 는 4개 파일에 걸친 **주석/JSDoc/Swagger 설명 텍스트만의 변경**이다 (로직·분기·시그니처 변경 없음):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL` 각 항목 위에 "사용자가 취할 행동" JSDoc 3건 추가.
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` 함수 JSDoc 을 한국어로 재작성, wrapper(`resolveTriggerParametersRejectingMasked`)로 위임되는 이유·CI 가드 설명 추가.
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ApiPropertyOptional.description` 문자열(Swagger 노출용)에 마스킹 마커 거부 안내 추가.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — catch 블록 위 주석을 영어→한국어로 재작성 (`details` vs `errors` 설명).

이 변경들은 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 및 `spec/5-system/14-external-interaction-api.md` §R17("마커 재제출 거부") Rationale 의 이미 확정된 결정(2026-08-20/21)을 코드 주석에 **요약·인용**하는 것이 전부다.

## 발견사항

없음. 대조한 4개 diff hunk 모두 텍스트 표현 변경이며, 각각 다음 기존 Rationale 과 정합한다:

- `resolve-trigger-parameters.ts` 신규 JSDoc의 "base 에 마스킹 검사를 넣지 않은 것은 의도 — Webhook/Schedule 도 공유하는 함수라 무관한 경로가 거부 규칙을 지게 됨" 서술은 `1-manual-trigger.md` §Rationale ("base 자체에 넣지 않은 것은 의도다…") 및 `14-external-interaction-api.md` §R17 해당 문단과 표현까지 거의 동일하다 — 기각된 대안(공유 함수에 검사 삽입)을 재도입하지 않고 오히려 그 기각 이유를 재확인하는 방향이다.
- `re-run.dto.ts` description 추가("마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부")는 §R17 표(Re-run 모달/서버 가드 2026-08-20 종결 조건)와 일치하며 API 문서 표면에 실 동작을 반영한 것으로, 결정 번복이 아니다.
- `workflows.controller.ts` 주석의 "`errors` 가 아니라 `details` 다" 서술은 `1-manual-trigger.md` §6 인용문("re-run 이 이 목록에 들어온 것은 2026-08-20 이다. 그전까지 `executions.service.ts` 는 내부 reason 을 `errors` 키로 던졌고…")이 다루는 과거 결함(re-run 경로 한정)을 일반화해 workflows.controller.ts(execute 경로)에도 같은 설명을 붙인 것이다. workflows.controller.ts 자신이 `errors` 를 던진 적이 있다고 주장하는 것은 아니고 "왜 `details` 키를 쓰는지"의 배경 설명이라 사실 왜곡은 없다.
- `trigger-parameter.types.ts` 의 3개 JSDoc(누가 무엇을 고쳐야 하는가)은 §6 표의 reason 분류(사용자 입력 정정 vs 트리거 설정 정정)를 그대로 코드 레벨로 옮긴 것으로 새로운 주장을 도입하지 않는다.

기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 관측되지 않았다. 로직 변경이 없으므로 새 Rationale 을 요구할 결정 자체가 없다.

## 요약

이번 diff 는 순수 주석/문서 텍스트 변경(cosmetic followup)으로, 추가된 서술은 `1-manual-trigger.md` §Rationale·§6 및 `14-external-interaction-api.md` §R17 이 이미 확정한 마스킹 마커 거부 설계(base/wrapper 분리, Manual 전용 스코프, CI 가드 강제)를 코드 주석 레벨로 정확히 반영한 것이다. 기각된 대안을 되살리거나 합의 원칙에서 벗어나는 지점은 없으며, 로직 변경이 없어 "결정 번복"에 해당하는 항목도 없다.

## 위험도

NONE
