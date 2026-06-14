# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] `detail` deprecated getter — JSDoc 표기가 충분하나 제거 시점 계획 부재
- 위치: `workflow-errors.ts` — `InvalidExecutionStateError.detail`, `RetryLastTurnError.detail` getter
- 상세: `@deprecated` 로 마킹되고 `serverDetail` 별칭임이 명시돼 있어 의도는 명확하다. 다만 deprecation 제거 시점이나 마이그레이션 가이드(언제 `detail` 호출자를 `serverDetail` 로 전환할지)가 코드 또는 계획에 없다. 시간이 지나면 "언제까지 유지할 deprecated getter 인지" 알 수 없게 된다.
- 제안: JSDoc 에 `@deprecated since refactor-04-a1 — use {@link serverDetail}; remove after callers migrated` 와 같이 제거 기준을 한 줄 추가한다.

### [INFO] `MessageTooLongError` — `actualLength` 파라미터 생략 시 동작이 생성자 시그니처만으로 불명확
- 위치: `workflow-errors.ts` — `constructor(maxLength: number, actualLength?: number)`
- 상세: `actualLength` 가 없을 때 `serverDetail` 이 `max=10000` 만 담기는 동작이 생성자 시그니처만 보면 즉시 이해되지 않는다. 서비스 코드에서는 항상 두 인자를 전달하므로 실제 문제는 아니지만, 테스트 파일에서 단독 `maxLength` 호출 패턴이 "단항 생성자" 처럼 오해될 수 있다.
- 제안: JSDoc 에 `@param actualLength - 서버 로그 전용. 미지정 시 serverDetail 에 max 만 포함.` 정도 추가하면 충분하다.

### [INFO] `localizeAckError` 함수 — `use-execution-interaction-commands.ts` 내 파일-로컬 배치
- 위치: `use-execution-interaction-commands.ts` — `localizeAckError` 함수
- 상세: `localizeAckError` 는 `getExecutionInteractionErrorI18nKey` + `t` 를 조합하는 순수 변환 함수다. 현재는 훅 파일 내부에만 있어 다른 훅/컴포넌트에서 동일 패턴이 필요할 때 복사·붙여넣기 압력이 생긴다. `execution-error-codes.ts` 에 이미 매핑 로직이 있으므로, 두 파일에 걸쳐 단계가 나뉜다.
- 제안: `execution-error-codes.ts` 로 옮기거나 export 하는 것을 고려할 수 있다. 현재 사용처가 한 곳뿐이라면 즉각 리팩토링은 불필요하다.

### [INFO] `emitWithAck` 콜백 시그니처 변경 후 동일 단행 토스트 패턴이 5개 `useCallback` 에 반복
- 위치: `use-execution-interaction-commands.ts` — `clickButton`, `clickContinue`, `endConversation`, `submitForm`, `sendMessage`
- 상세: `clickButton` 과 `clickContinue`, `endConversation` 은 부가 동작 없이 `(error, errorCode) => toast.error(localizeAckError(t, error, errorCode))` 단행이다. 동일 콜백 리터럴이 반복된다.
- 제안: `const onAckError = (err: string, code?: string) => toast.error(localizeAckError(t, err, code))` 공통 변수를 추출하면 토스트만 하는 세 콜백에서 중복을 제거할 수 있다. 현재는 INFO 수준이지만 향후 이 패턴이 늘어나면 관리 비용이 증가한다.

### [INFO] 테스트 — `service.continueAiConversation('exec-5', tooLong)` 동일 호출이 연속 두 번 발생
- 위치: `execution-engine.service.spec.ts` — "continueAiConversation 은 10000자 초과 시 typed MessageTooLongError throw 하고 publish 하지 않는다" 블록
- 상세: `rejects.toBeInstanceOf` 와 `rejects.toThrow` 를 분리 검증하기 위해 같은 서비스 호출을 두 번 한다. 목(mock) 설정이 상태를 가질 경우 테스트 격리 문제가 생길 수 있다.
- 제안: 에러를 변수에 캡처(`const err = await ...catch(e => e)`)한 뒤 `instanceof` + `message` 를 직접 assert 하는 방식으로 리팩토링을 고려한다.

### [INFO] `buildContinuationErrorAck` — `fallbackMessage` 가 파라미터로 남아 있어 핸들러마다 다른 문자열 전달 가능
- 위치: `websocket.gateway.ts` — `buildContinuationErrorAck(event, error, fallbackMessage)` 메서드
- 상세: 현재 diff 에서 각 핸들러가 어떤 fallback 문자열을 넘기는지 확인되지 않는다. `fallbackMessage` 가 파라미터이면 미래에 핸들러마다 임의 문자열을 넣어 동작이 분산될 위험이 있다.
- 제안: 클래스 레벨 `private static readonly CONTINUATION_FALLBACK_MESSAGE = 'Form submission failed'` 상수를 두고, `buildContinuationErrorAck` 의 `fallbackMessage` 기본값 또는 내부 상수로 활용해 호출 지점에서 문자열 리터럴을 반복하지 않게 한다.

### [INFO] `EXECUTION_INTERACTION_ERROR_CODE_TO_I18N` 맵 — 키 타입이 `string` 이라 오타 방어 없음
- 위치: `execution-error-codes.ts` — `Record<string, TranslationKey>`
- 상세: 프로젝트 관례(`integration-error-codes.ts` 선례) 로 의도된 열린 설계다. 현재로서는 타당하다.
- 제안: 미래에 backend `ErrorCode` 타입이 공유 패키지로 export 된다면 키 타입 narrowing 을 검토할 수 있다. 현재는 변경 불필요.

---

## 요약

이번 변경은 `ExecutionError` 추상 기반 도입, `MessageTooLongError` 신설, WebSocket ack 빌더의 typed/plain 에러 분기 재작성, frontend i18n 매핑이라는 일관된 계층 구조를 갖추고 있으며 가독성과 의도 명확성이 전반적으로 높다. JSDoc 및 인라인 주석이 spec §7.5.2 계약을 충실히 참조하고 있어 맥락 파악이 용이하다. 경미한 개선 여지는 deprecated getter 제거 시점 미명시, 단행 토스트 콜백 반복, 테스트 내 동일 호출 이중 실행 정도이며, 모두 INFO 수준으로 기능 정확성이나 보안에 영향을 주지 않는다. 코드베이스 스타일과의 일관성도 잘 유지됐다.

## 위험도

NONE
