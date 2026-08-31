# Plan 정합성 검토 — error-codes-layer-split

## 검토 범위
- Target: `spec/conventions/` (impl-done, diff-base `origin/main`). scope 델타 0개 파일 — 코드 전용 PR.
- 실질 diff: `codebase/backend/src/nodes/core/error-codes.ts`(+`EngineErrorCode` 신설) ·
  `error-codes.spec.ts` · `ai-turn-orchestrator.service.ts` · `execution-engine.service.ts` ·
  `shutdown-state.service.ts`(맨 문자열 → 상수 참조 리다이렉트) · 신규 `repo-guards`
  앵커 가드 3파일. 그리고 `plan/in-progress/exec-intake-followups.md` →
  `plan/complete/exec-intake-followups.md` 이동(ARCH#5 항목 체크 완료) + `CHANGELOG.md`.
- `plan/in-progress/**` 전수 중 이 diff 와 교집합 있는 항목을 `grep -rln`(error-codes.ts/.md,
  ErrorCode, WORKER_HEARTBEAT_TIMEOUT, SERVER_INTERRUPTED, WEBCHAT_IDLE_TIMEOUT,
  EXECUTION_QUEUE_WAIT_TIMEOUT, ARCH#5)로 찾아 각각 원문 대조.

## 발견사항

없음. CRITICAL·WARNING 없음.

## 참고 (검토 과정에서 확인한, 조치 불요 사항)

- **자기 소유 plan 항목이 이미 정합화됨**: 이 작업의 근거 항목은
  `plan/in-progress/exec-intake-followups.md` ARCH#5("`error-codes.ts` 엔진 레벨 에러코드
  레이어 분리")였고, 이 diff 자체가 그 파일을 `plan/complete/`로 이동시키며 체크 완료 처리했다.
  이관 시 원래 "파일 분리" 처방을 실측으로 반증하고("혼재는 과장 — 201개 중 대다수는
  API 예외 코드로 애초에 이 enum 소관 아님") "파일은 하나, const 는 둘"로 대안을 택한 근거를
  같은 문서에 남겼다(취소선 보존 방식). `CHANGELOG.md`·`error-codes.ts` JSDoc·plan 세 곳의
  기록이 상호 일치.
- **자매 plan 교차 참조 확인**: `plan/complete/spec-draft-webchat-execution-residuals.md`
  의 I6("`WEBCHAT_IDLE_TIMEOUT` 은 `error-codes.ts` 편집 — ARCH#5 동시 편집 대기열과 겹침")가
  이번 편집으로 함께 닫혔다고 exec-intake-followups.md 가 명시하며, 실제로
  `execution-engine.service.ts` 의 `WEBCHAT_IDLE_TIMEOUT` 리다이렉트가 diff 에 존재해
  주장과 코드가 일치한다. 두 문서 모두 이미 `plan/complete/`에 있어 in-progress 갱신 불요.
- **`ARCH#5` 잔여 참조 없음**: `plan/` 전체에서 `ARCH#5` 를 언급하는 문서 3개
  (`exec-intake-followups.md`·`spec-draft-webchat-execution-residuals.md`·
  `exec-limits-refactor.md`) 전부 `plan/complete/`에 있다. `plan/in-progress/**` 에는
  이 작업을 "대기 중"으로 전제하는 잔여 항목이 없다.
- **미해결 결정과 비-충돌 확인**: `plan/in-progress/spec-update-node-cancellation-shutdown-
  classification.md` 가 `SERVER_INTERRUPTED`(§`error.code`)를 다루는 미해결 (a)/(b) 택일
  결정(SIGTERM 발 abort 를 `failed` 유지 vs `cancelled` 재정의)을 갖고 있으나, 이번 diff 는
  그 값의 **결합 지점만**(`'SERVER_INTERRUPTED'` 리터럴 → `EngineErrorCode.SERVER_INTERRUPTED`
  참조) 바꿀 뿐 `status='failed'` 판정 로직·조건은 손대지 않았다. 신설 JSDoc 도 최종 상태
  분류를 서술하지 않아 그 미해결 결정을 선점하지 않는다.
- **다른 in-progress plan 의 `error-codes.ts` 참조는 무관**: `node-output-redesign/text-
  classifier.md`·`send-email.md` 가 `error-codes.ts` 를 언급하지만 대상은
  `maskEmailForErrorDetails`/`truncateForErrorDetails` 헬퍼(diff 미변경)이고, 이 diff 가 건드린
  `ErrorCode`/신설 `EngineErrorCode` 심벌과는 겹치지 않는다.
- **spec 문서 갱신 불요 판단이 타당**: `spec/conventions/error-codes.md` 의 "적용 범위"는
  `code:` 필드의 `ErrorCode` enum 을 "명명이 중앙화된 대표 surface"로만 규정하고 TS 구현이
  const 를 몇 개로 나누는지는 본 규약의 소유 범위 밖이다 — plan frontmatter 의
  `spec_impact: none` 과 정합.

## 요약
이번 PR 의 근거였던 plan 항목(`exec-intake-followups.md` ARCH#5)이 diff 안에서 스스로
`plan/complete/`로 이관·정합화됐고, 원 처방("파일 분리")을 실측으로 반증한 뒤 대안
("파일 하나·const 둘")을 택한 근거가 코드 JSDoc·CHANGELOG·plan 세 곳에 일관되게 기록돼
있다. 교차 참조된 자매 항목(I6)도 실제 diff 내용과 일치한다. `plan/in-progress/**` 전수를
훑어도 이 diff 와 충돌하는 미해결 결정이나 무효화된 후속 항목을 찾지 못했다 — 유일하게
같은 식별자(`SERVER_INTERRUPTED`)를 다루는 미해결 결정(`spec-update-node-cancellation-
shutdown-classification.md`)은 최종 상태 분류(failed vs cancelled) 문제이고, 이 diff 는
그 판정 로직이 아니라 문자열 리터럴의 앵커링만 바꿔 그 결정을 선점하지 않는다.

## 위험도
NONE
