# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `completeRetryExecution` 을 설명하는 JSDoc 이 실제 함수 선언에서 46줄 떨어지고, 바로 아래엔 무관한 다른 메서드의 JSDoc 이 이어 붙어 오독 위험이 생겼다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-731`(orphaned JSDoc, "retry 성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback… `@internal` 이 메서드는 `resumeGraphAfterRetry` 의 defensive fallback 에서만 호출된다") / `:732-742`(바로 이어지는 `markSpawnedRowFailed` 의 새 JSDoc) / `:777`(실제 `completeRetryExecution` 선언)
  - 상세: `git diff origin/main -- .../retry-turn.service.ts` 로 확인한 결과, 원래 이 JSDoc 블록(구 파일 727~739줄)은 `completeRetryExecution` 바로 위에 붙어 있었다. 이번 PR 이 `markSpawnedRowFailed`·`prepareSuccessTermination` 두 신규 private 메서드를 그 JSDoc 과 `completeRetryExecution` 선언 "사이"에 끼워 넣으면서, JSDoc 은 원래 위치(711~731행)에 남고 대상 함수는 46줄 아래(777행)로 밀려났다. 그 결과 소스를 위에서 아래로 읽으면 711~731행의 JSDoc 이 바로 다음 코드(732행부터 시작하는 `markSpawnedRowFailed`)를 설명하는 것처럼 보이지만 실제로는 그렇지 않다 — 두 JSDoc 블록이 연달아 등장하는 것도 시각적으로 "문서가 중복/오배치됐다"는 인상을 준다. 실제 파일(`Read` 로 711~797행 직접 확인)에서도 동일하게 재현됨.
  - 제안: `markSpawnedRowFailed`/`prepareSuccessTermination` 두 헬퍼를 `completeRetryExecution` 앞이 아니라 뒤(또는 클래스의 다른 위치)로 옮겨 JSDoc 이 대상 함수 바로 위에 붙도록 재배치한다. 최소한 JSDoc 상단에 "이 문서는 아래 `completeRetryExecution` (46줄 뒤)에 대한 것" 같은 명시적 포인터를 남긴다.

- **[INFO]** 새로 추가된 두 테스트가 "이전 시도의 `error` 를 완료 시점에 캡처" 하는 동일한 mock-구성 블록을 문자 그대로 반복한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:982-991` 과 `:1054-1063` (둘 다 `const NOT_CALLED = Symbol('completion-not-reached'); let errorAtCompletion: unknown = NOT_CALLED; (mockDriver.updateExecutionStatus as jest.Mock).mockImplementation((exec, status) => { if (status === ExecutionStatus.COMPLETED) { errorAtCompletion = exec.error ?? null; } return Promise.resolve(true); });` 10줄이 동일)
  - 상세: 이 PR 이 신규로 추가한 두 테스트("자연 종결이 이전 시도의 error 를 비운다" / "fallback 종결도 이전 시도의 error 를 비운다")가 같은 캡처 로직을 각각 인라인으로 다시 작성했다. 이 파일은 이미 트랜잭션 mock 헬퍼 3중 중복(W6/W5 계열, `retry-turn-terminal-guard.md` 후속 항목에 등재됨)이 알려진 백로그인데, 이번 diff 가 같은 성격의 새 중복을 하나 더 얹었다. 한쪽만 나중에 수정되고 다른 쪽이 갈리는 drift 위험은 낮지만(둘 다 같은 불변식을 검증하는 대조 테스트라 자연히 같이 바뀔 가능성이 높음), 두 곳 모두 유지보수 대상이 늘어난 것은 사실이다.
  - 제안: `captureErrorAtCompletion(mockDriver): { get value() }` 류의 로컬 헬퍼로 추출하거나, 최소한 이미 계획된 W6 테스트 위생 정리(현재 plan 에서 "13곳을 한 PR 에서 섞으면 이번 PR 의 신규 단언이 diff 에 묻힌다"는 이유로 의도적으로 defer됨)에 이 항목도 포함해 두면 된다. 우선순위는 낮음 — 별도 조치 강제 불필요.

## 긍정적 관찰

- `markSpawnedRowFailed`(`retry-turn.service.ts:743-755`)와 `prepareSuccessTermination`(`:770-775`) 추출은 각각 두 곳에서 문자 그대로 반복되던 "로그·status·error·finishedAt+save 4단계"와 "error 비우기+finishedAt/durationMs 세팅" 로직을 진짜로 통합했다(각 호출부가 동일 인자 순서·의미로 호출됨). DRY 개선이 견고하다.
- `execution-engine.service.ts`(:4308 부근)·`ai-turn-orchestrator.service.ts`(`assertLinkedTransitionApplied`) 두 곳의 변경 모두 기존 중첩 수준을 유지한 채(if/try-catch 1~2단) 반환값 소비·예외 흡수를 추가해 순환 복잡도 증가가 최소화됐다.
- 신규 헬퍼·try/catch 블록의 JSDoc/인라인 주석이 "왜 이렇게 처리하는가"(취소 분류를 바꾸지 않는 이유, 관측과 처방의 구분 등)를 구체적으로 설명해 프로젝트의 기존 문서화 컨벤션과 일관된다.
- 네이밍(`markSpawnedRowFailed`, `prepareSuccessTermination`)은 동사-목적어 형태로 목적을 명확히 드러내며 기존 클래스의 `finalizeGuarded`/`completeRetryExecution`/`failRetryExecution` 명명 패턴과 일관된다.

## 요약

이번 changeset 은 취소/재시도 종결 경로의 결함 수정에 집중된 소규모 diff로, 매직 넘버·과도한 중첩·네이밍 불일치 같은 전형적 유지보수성 문제는 없다. 오히려 두 개의 반복 로직을 헬퍼로 추출해 중복을 줄였다. 다만 그 추출 과정에서 기존 JSDoc 블록이 대상 함수와 물리적으로 분리돼(46줄 간격, 사이에 무관한 JSDoc 삽입) 다음 독자가 문서-코드 매핑을 오독할 실질적 위험이 하나 확인됐다(WARNING). 테스트 파일에 작은 신규 중복 블록이 하나 더 생겼으나(INFO) 이는 이미 계획적으로 defer 된 테스트 위생 백로그와 같은 성격이라 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
