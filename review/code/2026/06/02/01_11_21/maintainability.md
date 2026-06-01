# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `resolveContinuationWorkerConcurrency` — 정규식 선검증 후 `Number()` 파싱 이중 단계
  - 위치: `/codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` L531-538
  - 상세: `/^\d+$/` 통과 시 값은 이미 양의 정수임이 보장되므로, 이후 `Number.isInteger(parsed) && parsed > 0` 재검증은 항상 true다. 의도는 명확하나 중복 조건이 "왜 두 번 검증하는가"라는 의문을 유발해 가독성을 약간 해친다.
  - 제안: `if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_...;` 다음 줄에서 바로 `return Number(raw);` 로 단순화. 또는 내부 주석 한 줄로 "정규식이 이미 양수 정수를 보장함" 명시.

- **[INFO]** `resolveContinuationWorkerConcurrency` — 데코레이터 수준 호출이라는 맥락을 함수 자체 JSDoc 에만 기재
  - 위치: `continuation-execution.queue.ts` JSDoc / `continuation-execution.processor.ts` L371-372
  - 상세: 왜 이 함수가 `@Processor` 데코레이터 인자에서 직접 호출되는지(DI 이전 평가 제약)가 queue 파일의 JSDoc 에 충실히 설명돼 있다. processor 쪽 호출부에는 그 맥락이 없어 처음 보는 개발자는 "DI로 주입하면 안 되나?"라고 의문을 가질 수 있다.
  - 제안: processor의 `@Processor` 호출 바로 위 주석에 한 줄 참조("// DI 주입 불가 — continuation-execution.queue.ts JSDoc 참조")를 추가하거나, queue.ts JSDoc 의 한국어 설명 중 핵심 사유("데코레이터 평가 시점 = DI 이전")를 한 문장으로 processor에도 inline 주석으로 반복.

- **[INFO]** `process()` 내 payload 인라인 타입 단언 다수 잔존
  - 위치: `continuation-execution.processor.ts` L424-450
  - 상세: `button_click`, `ai_message`, `retry_last_turn` 케이스에서 `(payload as { buttonId?: string } | undefined)` 식의 인라인 단언이 반복된다. 파일 상단 JSDoc "각 type 에 대응하는 payload shape 을 명시함으로써 인라인 단언을 제거한다"는 `ContinuationPayload` 의 주석과 실제 코드 사이에 불일치가 있다 — `ContinuationJob.payload` 가 `unknown` 으로 선언돼 있어 타입 유니언이 아직 적용되지 않는 상태다. 이는 이번 PR 변경 범위 밖이지만, 현 코드의 의도 vs 실제 구현 간 괴리가 가독성 부채로 남는다.
  - 제안: 이번 PR에서 해결할 필요는 없으나, `ContinuationJob.payload` 를 `ContinuationPayload | RetryLastTurnContinuationPayload | undefined` 로 좁히는 후속 작업을 plan에 추가 검토.

- **[INFO]** `cancel` case — `void` fire-and-forget 과 TODO 주석
  - 위치: `continuation-execution.processor.ts` L419-421
  - 상세: `void this.engine.applyCancellation(executionId)` 에 "TODO: async 전환 시 `void` 제거 후 `await` 복원 필요" 주석이 붙어 있다. TODO 가 plan 이나 issue 에 연결돼 있지 않으면 사라질 위험이 있다.
  - 제안: plan 항목에 연결하거나, `// TODO(#<issue>)` 형태로 추적 가능 참조를 달아 소멸 방지.

- **[INFO]** `.env.example` 주석 — "Non-positive, non-integer, or non-numeric values fall back to 1" 문구 일치
  - 위치: `.env.example` L40 / `continuation-execution.queue.ts` JSDoc
  - 상세: `.env.example` 주석은 "Non-positive, non-integer, or non-numeric" 세 경우를 나열하나, queue.ts JSDoc 은 "비숫자 / 0 / 음수 / 비정수(소수·공학표기)" 네 케이스를 나열해 표현이 소폭 다르다. 기능적으로 동일하나 유지 시 양쪽을 함께 업데이트해야 한다는 점을 알기 어렵다.
  - 제안: `.env.example` 주석을 단일 정책 설명(예: "정규식 `\d+` 검증 후 양의 정수만 허용, 그 외 fallback 1")으로 통일하거나, 두 곳 중 한 곳에서 다른 곳을 참조.

- **[INFO]** `spec/5-system/4-execution-engine.md` §11 표 행 추가 — 기존 행 형식과 일치
  - 위치: `spec/5-system/4-execution-engine.md` L789
  - 상세: 새 행의 컬럼 구성(`| 변수명 | 기본값 | 설명 |`)과 설명 길이가 기존 `SIGTERM_GRACE_MS` / `RESUME_BULLMQ_ATTEMPTS` 행과 일관돼 있다. 형식 준수는 양호하다. 다만 "비양수·비정수·비숫자 입력은 1 로 fallback" 설명이 §7.4 표의 신규 행("Worker 동시성" 열)에는 없고 §11 표에만 있어, §7.4 단독으로 읽는 독자는 fallback 정책을 놓칠 수 있다.
  - 제안: §7.4 "Worker 동시성" 행에 "(fallback 정책은 §11)" 주석 또는 괄호 병기.

## 요약

변경은 작고 집중적이다. `resolveContinuationWorkerConcurrency` 는 의도가 JSDoc 과 `.env.example` 주석으로 충분히 설명돼 있으며, `@Processor` 데코레이터 인자로의 주입 제약도 명시돼 있다. 정규식 선검증 후 `Number.isInteger` 재검증이 중복되어 있고, processor 호출부에서는 DI 제약 배경이 생략돼 있는 점이 미세한 가독성 부채다. 기존 인라인 단언 잔존과 TODO 추적 부재는 이번 변경의 범위 밖이지만 향후 유지보수 시 혼란 소지가 있다. 전체적으로 유지보수성에 심각한 결함은 없다.

## 위험도

LOW
