# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** `to-record.ts` / `to-record.spec.ts` JSDoc·테스트 추가는 이번 diff 의 핵심 대상(`ai-turn-executor.ts`)과 직접 연결점이 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:143-152`, `to-record.spec.ts:36-47`
  - 상세: `isRecord`/`toRecord` 는 이번 diff 의 `ai-turn-executor.ts` 변경(전부 `ResumeState`/`RetryState` 타입 좁히기)에서 호출되지 않는다. 커밋 메시지 자체가 "to-record.ts 헬퍼 후속(#782 ai-review INFO)"라고 명시하며, 이전 PR(#782)의 ai-review 에서 나온 INFO 항목을 이번 커밋에 끼워 넣은 것으로 확인된다(`git show d089c211b` 커밋 로그로 검증).
  - 제안: 실질적 문제는 아님 — 작더라도 별도 관심사(문서 caveat 고정)이므로 이상적으로는 별도 커밋으로 분리하는 편이 리뷰 가독성에 유리하나, 커밋 메시지에 출처가 투명하게 기록되어 있고 범위도 미미(JSDoc 12줄 + 순수 문서화 테스트 2개)하여 실질적 스코프 이탈로 보기 어렵다.

- **[INFO]** 신규 import(`ResumeState`, `RetryState`)는 사전 커밋(#783, `resume-state.schema.ts`)에서 이미 정의된 타입을 재사용
  - 위치: `ai-turn-executor.ts:22-25`
  - 상세: import 대상 파일이 이번 diff 에는 포함되지 않았지만, 별도로 확인한 결과 직전 커밋(`573f52a64`, #783)에서 이미 존재함. `plan/in-progress/refactor/03-maintainability.md` M-7 항목이 "후속 클러스터: ai-turn-executor.ts(29, resume-state 재사용은 ResumeState 타입 활용)"로 이번 작업을 명시적으로 예고하고 있어 계획된 범위와 정확히 일치.
  - 제안: 없음 (정상 범위).

변경 전반은 `buildRetryState` / `buildMultiTurnFinalOutput` / `endMultiTurnConversation` 3개 메서드의 `as Record<string, unknown>` / `as number` / `as unknown[]` 인라인 단언을 `ResumeState`/`RetryState` 명명 타입으로 교체하는 순수 타입 좁히기이며, `?? 0` / `?? []` fallback 값과 조건 분기 로직은 diff 전후로 동일해 behavior-preserving 하다(커밋 메시지 자체도 이를 명시). 함수 시그니처 변경(`Record<string, unknown>` → `ResumeState`/`RetryState`)은 공개 인터페이스(`endMultiTurnConversation` 의 `state` 파라미터, information_extractor 와 공유)는 그대로 두고 내부에서만 좁히는 방식이라 하위호환도 보존된다. 임포트·포맷팅·주석 변경도 모두 이번 타입화 작업을 설명하는 데 국한되어 있고 무관한 정리는 없다.

## 요약
이번 diff 는 plan(`plan/in-progress/refactor/03-maintainability.md` M-7 "후속 클러스터")에 명시적으로 예고된 작업 범위(`ai-turn-executor.ts` 의 `_resumeState`/`_retryState` 인라인 단언을 `ResumeState`/`RetryState` 명명 타입으로 전환)와 정확히 일치하며, 3개 메서드의 타입 좁히기 외 로직 변경이 없는 behavior-preserving 리팩터다. 유일하게 눈에 띄는 것은 `to-record.ts`/`to-record.spec.ts` 에 붙은 JSDoc caveat + 문서화 테스트인데, 이는 이번 파일의 핵심 변경과 직접 연결되지는 않지만 이전 PR(#782) ai-review 의 INFO 후속 항목이라는 출처가 커밋 메시지에 투명하게 기록되어 있고 규모도 미미해 실질적인 범위 이탈로 보기 어렵다.

## 위험도
NONE
