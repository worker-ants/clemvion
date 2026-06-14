# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] `detail` deprecated getter — 마이그레이션 기한 명시 없음
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `InvalidExecutionStateError.detail` getter 및 `RetryLastTurnError.detail` getter
- 상세: `@deprecated since refactor-04-a1 — use serverDetail; remove after callers migrated` 주석이 있으나 "언제까지" 또는 "어느 PR/버전까지" 와 같은 구체적인 마이그레이션 기한이 없다. deprecated alias 는 시간이 지날수록 유지보수 부담이 증가하며, 기한 없는 deprecated 는 영구 잔존 위험이 있다.
- 제안: `@deprecated` 주석에 제거 대상 추적 이슈 또는 milestone 식별자를 추가한다. 예: `remove in refactor-04-a2 cleanup or after all callers migrated to serverDetail`.

---

### [INFO] `ExecutionTimeLimitError` 앞에 JSDoc 블록이 두 개 연속 배치
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L415–424 (변경 후)
- 상세: `ExecutionTimeLimitError` 클래스 선언 직전에 기존 JSDoc `/** 대상 워크플로우 ... */` 과 신규 설계 경계 주석 `/** 설계 경계 (I-3, ai-review) ... */` 이 연속으로 두 블록 존재한다. TypeScript/IDE 툴링은 클래스 선언 직전 마지막 JSDoc 블록만 hover 시 노출하므로, 앞쪽 기존 문서는 IDE 에서 사실상 숨겨진다.
- 제안: 두 JSDoc 을 하나의 블록으로 병합하거나, 설계 경계 설명을 기존 JSDoc 의 추가 단락으로 통합한다.

---

### [INFO] `buildContinuationErrorAck` — 로그 메시지 안에 삼항 표현식 인라인 삽입
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 변경 후 `buildContinuationErrorAck` 비-typed 분기 `logger.warn(...)` 호출
- 상세: `` `[${event}] continuation failed (internal): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}` `` 처럼 템플릿 리터럴 안에 복합 삼항 표현식이 인라인으로 포함되어 있다. 로그 메시지 구성 로직이 `logger.warn()` 호출 안에 묻혀 가독성이 떨어진다.
- 제안: 지역 변수로 추출한다. 예: `const detail = error instanceof Error ? (error.stack ?? error.message) : String(error); this.logger.warn(\`[${event}] continuation failed (internal): ${detail}\`)`.

---

### [INFO] `websocket.gateway.spec.ts` — 동일 describe 블록 내 소켓 초기화 패턴 혼용
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 신규 `handleSubmitMessage (§7.5.2 leak-block, I-11)` describe 블록
- 상세: 이 블록 안에만 `authedMessageSocket()` 헬퍼 함수가 정의되어 있고, 같은 파일의 다른 테스트들은 `createMockSocket` + 인라인 속성 설정 패턴을 직접 사용한다. 패턴이 혼용되어 파일 전체를 읽을 때 일관성이 낮다.
- 제안: 현재 규모에서는 허용 가능하나, 파일 상위 수준에 공통 `createAuthedSocket()` 헬퍼를 두어 전체 describe 에서 재사용하는 방향을 고려한다. INFO 수준.

---

### [INFO] `execution-engine.service.spec.ts` — 동일 서비스 호출 두 번 반복
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `continueAiConversation 은 10000자 초과 시 typed MessageTooLongError throw` it 블록
- 상세: 단일 `it` 블록에서 `service.continueAiConversation('exec-5', tooLong)` 이 두 번(`toBeInstanceOf` 검사, `toThrow` 검사) 개별 `await expect(...)` 로 호출된다. 호출마다 실제 서비스 로직이 실행되어 의도치 않은 부작용이 있다면 두 번째 결과가 달라질 수 있고, 불필요한 실행 비용이 발생한다.
- 제안: `const err = await service.continueAiConversation(...).catch(e => e)` 로 한 번만 호출 후 `expect(err).toBeInstanceOf(...)` + `expect(err.message).toBe(...)` 를 연속 검사하거나, 두 it 블록으로 분리한다.

---

### [INFO] `localizeAckError` 함수의 배치 — hook 파일 vs 유틸 모듈
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` — 파일 스코프 `localizeAckError` 함수
- 상세: `localizeAckError` 는 `TFunction` 과 `getExecutionInteractionErrorI18nKey` 를 조합하는 얇은 변환 함수이다. 현재 hook 파일에 배치되어 있으나, 변환 로직 자체는 `execution-error-codes.ts` 에 더 가까운 응집도를 갖는다. 현재 구조가 동작상 문제는 없으나 테스트 재사용성이 낮다.
- 제안: 향후 동일 변환이 다른 hook 에서도 필요해지면 `execution-error-codes.ts` 로 이동을 고려한다. 현재 규모에서는 INFO 수준.

---

## 요약

이번 변경은 `ExecutionError` 추상 기반 클래스 신설 및 `MessageTooLongError` 추가, `buildContinuationErrorAck` 의 typed/non-typed 분기 재작성, frontend errorCode 로컬라이제이션 레이어(새 파일 `execution-error-codes.ts` + 훅 수정 + i18n dict 추가) 로 구성된다. 전반적으로 의도가 명확하고 네이밍이 목적을 잘 표현하며, JSDoc 주석이 설계 결정과 보안 경계를 충실히 기술하고 있다. 함수 길이와 중첩 깊이는 적절하며 매직 넘버도 상수(`MAX_MESSAGE_LENGTH`)로 처리되어 있다. 발견된 사항은 전부 INFO 등급(deprecated 기한 미명시, JSDoc 이중 블록, 로그 인라인 삼항, 테스트 내 중복 호출, 소켓 초기화 패턴 혼용)으로 기능적 유지보수 위험은 없다.

## 위험도

LOW
