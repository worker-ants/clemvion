# Maintainability Review — `durationMs` 종결 3종 emit (2026-08-15 10:18)

## 발견사항

- **[INFO]** raw `RETURNING` 행에서 `duration_ms` 를 뽑는 3줄 스니펫이 5곳에 그대로 반복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1046-1049`(`cancelParkedExecution`), `:1181-1184`(`markWebChatIdleTimeout`), `:2861-2864`(`markExecutionCancelled`), `:2910-2913`(`markQueueWaitTimeout`), `:3363-3366`(`finalizeStalledExhausted`)
  - 상세: `toFiniteNumber((result.raw as Array<Record<string, unknown>> | undefined)?.[0]?.duration_ms) ?? null` 형태가 5개 함수에 verbatim 복제돼 있다. 다만 이 항목은 이미 이 PR 의 직전 리뷰 라운드(`review/code/2026/08/15/09_58_24/RESOLUTION.md` W5)에서 "순수 계산부·SQL 상수는 이미 추출했고, 나머지를 얇은 헬퍼로 감싸면 QueryBuilder 체인 호출부가 오히려 읽기 어려워진다. 6번째가 생기면 재검토" 로 명시적으로 보류된 상태이며, 현재도 정확히 5곳으로 그 판단 시점과 개수가 같다.
  - 제안: 재론은 불필요. 다음에 6번째 raw UPDATE 취소 경로가 추가되는 시점에 `extractReturningDurationMs(result)` 같은 1-라인 헬퍼로 승격을 재검토할 것.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한 5줄 설명 주석이 그대로 3중 복제됨
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`, `:415-419`, `:433-437` (프롬프트 diff 게이트 기준으로도 동일 — 392,415,433)
  - 상세: "producer 는 항상 이 키를 싣고 값을 모르면 null" · "그런데 `?` 는 유지한다(consumer 계약)" 설명 블록이 세 필드 선언 앞에 글자 그대로 반복된다. 세 인터페이스가 물리적으로 떨어져 있어 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 있다(이 PR 자신이 CLAUDE.md 메모리에 기록된 "자매 함수 미적용" 패턴을 코드가 아니라 주석 레벨에서 재현할 소지).
  - 제안: 세 곳 중 한 곳(예: `EiaCompletedEvent`)에 canonical 설명을 두고 나머지 둘은 `retry-turn.service.ts:893`(`// 조건 밖 — … (engine 과 동일 처방)`)에서 이미 쓴 것과 같은 "짧은 문장 + 정본 참조" 패턴으로 축약하면 drift 표면이 1곳으로 줄어든다.

- **[INFO]** `TERMINAL_DURATION_MS_SQL` 의 int4 상한이 SQL 문자열 리터럴 안에 매직 넘버로 박혀 있음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:88` (`LEAST(2147483647, …)`)
  - 상세: `2147483647`(Postgres `INTEGER`/int4 최댓값)의 의미는 바로 위 JSDoc(`:74-79`)과 `terminal-duration.spec.ts:126`(`'int4 상한으로 클램프한다'`)에 잘 설명돼 있어 실질 위험은 낮다. 다만 숫자 자체는 SQL 문자열 리터럴 안에만 존재해서, 이 상수만 놓고 보면 의미가 코드에서 즉시 드러나지 않는다.
  - 제안: `const PG_INT4_MAX = 2147483647;` 로 이름을 붙여 템플릿 문자열에 보간하면, 숫자를 보는 시점에 이름이 바로 의미를 전달한다(주석을 따라가지 않아도 됨). 강제 사항은 아님.

- **[INFO]** `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 자기참조 폴백 관용구가 10곳에 반복
  - 위치: `execution-engine.service.ts:639`(`row`), `:2413`·`:3565`·`:4755`·`:4883`·`:4944`(`savedExecution`), `:4295`(`reloaded`) / `retry-turn.service.ts:714`·`:896`·`:949`(`execution`/`savedExecution`)
  - 상세: `resolveTerminalDurationMs` 는 내부에서 이미 `row.durationMs` 유효성을 먼저 검사하므로, 바깥의 `?? x.durationMs` 는 "계산도 실패하고 기존 값도 못 믿을 때 그냥 기존 값(대개 `undefined`/구값)을 유지" 하는 의도된 no-op 폴백이다. 의도는 맞지만 처음 보는 사람에게는 `f(x) ?? x.durationMs` 형태가 "왜 자기 자신을 폴백으로 쓰지" 하는 순간적 혼동을 준다.
  - 제안: 필수는 아니나, 최초 등장 지점(`execution-engine.service.ts:639` 또는 `terminal-duration.ts` 의 함수 docstring)에 "계산 실패 시 필드를 건드리지 않는다" 한 줄을 덧붙이면 나머지 9곳은 문맥으로 읽힌다. 헬퍼로 승격(`stampTerminalDuration(entity)`)하는 대안도 있으나 엔티티 타입이 4종(`row`/`execution`/`savedExecution`/`reloaded`)으로 갈려 있어 뮤테이션 헬퍼가 오히려 타입을 넓혀야 해서 득실이 크지 않다.

- **[INFO]** 테스트 파일의 QueryBuilder mock 팩토리 중복이 이번 PR 로 한 번 더 넓어짐(신규 이슈 아님)
  - 위치: `execution-engine.service.spec.ts` 의 `mkExecQb`(:4738 부근)·`makeIdleQb`·`makeCancelQb`·`makeQb`·`mkQb` 등 7~8개 지점에 `setParameter: jest.fn().mockReturnThis()`/`returning: jest.fn().mockReturnThis()` 2줄이 각각 손으로 추가됨
  - 상세: 이 mock 팩토리 중복 자체는 이 PR 이 만든 게 아니라 기존 구조(각 `describe` 블록이 자체 qb mock 을 재정의)이고, 이미 `review/code/2026/08/15/09_58_24/RESOLUTION.md` W12 에서 "이 PR 이 비용을 실증(22곳 수동 편집) — 다음 리팩터 후보" 로 확인·보류됨. 이번 diff 에서 다시 손으로 2줄씩 반복 추가한 것이 그 비용을 재확인해 준다.
  - 제안: 별도 조치 불필요(이미 트래킹됨). 공유 `makeUpdateQb(overrides)` 팩토리로의 통합은 다음 테스트 인프라 리팩터에서.

## 요약

핵심 로직은 `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 세 프리미티브로 잘 응집돼 있고, 함수 하나가 여러 책임을 떠안거나 조건문이 과도하게 중첩된 곳은 없다. 네이밍(`terminalFinishedAt`, `cancelledDurationMs`, `stalledDurationMs`)과 raw-UPDATE 5경로의 구조(계산→RETURNING→emit)가 전부 동형이라 패턴을 한 번 익히면 나머지를 바로 읽을 수 있다. 새 유틸 `terminal-duration.ts` 는 이미 존재하는 자매 유틸 `terminal-error-payload.ts` 와 문서화 스타일·SoT 인용 방식을 그대로 따라 코드베이스 컨벤션과 일관적이다. 남은 지적은 전부 INFO 급 세부 중복(주석 3중복·raw-returning 추출 5중복·자기참조 폴백 관용구 10회)이며, 그중 다수는 이 PR 의 직전 리뷰 라운드에서 이미 근거와 함께 보류 결정이 난 항목이라 재차단 사유가 아니다.

## 위험도
LOW
