# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** #501 회귀 설명 주석이 호출부 3곳에 거의 동일 문구로 중복
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:149-150` (`handleAiResumeTurn`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:2629-2630` (`applyRetryLastTurn`), 그리고 `execution-engine.service.ts` 의 `buildRetryReentryState` 본문(§4847 부근)
  - 상세: "`#501 회귀 — ... 재구성 state 에 재주입한다 (checkpoint 미영속)`" 계열 주석이 call-site 마다 표현만 살짝 바꿔 반복된다. `resume-state.schema.ts` 의 `nodeExecutionId` 필드 doc-comment 도 유사 문구를 담고 있어 총 4곳에 사실상 같은 설명이 흩어져 있다.
  - 제안: 코드 동작상 문제는 아니며 각 call-site 맥락(orchestrator resume vs retry 재진입)이 달라 완전한 중복은 아니다. 다만 SoT 를 `buildRetryReentryState` JSDoc 한 곳에 두고 호출부는 "§X 참조, opts.nodeExecutionId 전달 사유는 그쪽 JSDoc" 정도로 축약하면 향후 정책 변경 시 갱신 지점이 하나로 줄어든다. 우선순위 낮음(문서 성격 diff).

- **[INFO]** `execution-engine.service.spec.ts` 의 무관 결함 수정이 같은 커밋에 포함
  - 위치: `execution-engine.service.spec.ts` diff (`service` → `svcMetrics` in `reentryWorkflowInput` describe)
  - 상세: PR #868 이 남긴 out-of-scope 참조 버그(`ReferenceError`)를 이번 diff 가 함께 고쳤다. plan 문서(`fix-resume-turn-usage-log-attribution.md`)의 "부수 발견(TEST WORKFLOW 중 조치)" 섹션에 명시적으로 기록돼 있어 추적 가능성 자체는 확보되어 있다.
  - 제안: 현 상태로 충분(정책상 발견 즉시 조치 + plan 기록). 별도 조치 불필요.

## 요약

이번 변경은 `buildRetryReentryState` 재구성기가 `workflowId`/`nodeExecutionId` 를 재유도하지 못해 resume 턴 usage-log 가 누락되던 회귀(#501)를 좁게 수정한다. 변경 폭이 작고(옵션 파라미터 1개 확장 + 필드 재주입 2줄 + 스키마 필드 1개 추가), 각 파일에 회귀 번호·근거·spec 참조를 명시한 주석이 충실히 달려 있어 가독성이 높다. 기존 코드베이스 패턴(`opts` 객체 파라미터, allow-list 스키마 partial+catchall, ISP 기반 driver 인터페이스)을 그대로 따르며 새로운 매직 넘버·중첩·복잡도 증가는 없다. 유일한 미미한 지적은 동일한 회귀 설명 주석이 호출부 여러 곳에 거의 그대로 반복되어 있다는 점(문서 성격 중복, 로직 중복 아님)과 테스트 파일의 사전 결함 수정이 같은 diff 에 묶여 있다는 점인데, 후자는 plan 문서에 명시적으로 기록되어 추적 가능하다. 전반적으로 유지보수성 관점에서 문제 될 소지가 거의 없는 소규모 정합화 커밋이다.

## 위험도
NONE
