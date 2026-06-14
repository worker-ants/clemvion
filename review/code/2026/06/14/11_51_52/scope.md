# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] websocket.gateway.ts — 포맷팅 전용 변경 1건 포함
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L160–165 구간 (diff hunk 1)
- 상세: `allowed ? null : { error: '...' }` 를 3행 삼항 표현으로 재포맷한 변경이 실질 로직 변경(ErrorCode import, buildContinuationErrorAck 재작성)과 같은 파일에 섞여 있다. 의미 변화는 없고 공백·줄바꿈만 달라진 순수 포맷팅 변경이다.
- 제안: 기능 변경과 분리하거나 그대로 두되, 리뷰어에게 "의미 없는 포맷 변경"임을 명시하는 주석을 추가하면 이후 git blame 추적이 편해진다.

### [INFO] workflow-errors.ts — ExecutionTimeLimitError 위 설계 경계 주석 추가
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L415–423 (새 JSDoc 블록)
- 상세: `ExecutionTimeLimitError` 클래스에 "설계 경계 (I-3, ai-review)" 설명 주석이 추가됐다. 이 클래스 자체의 코드는 변경되지 않았으며, 변경 의도와 직접 연관된 코드는 아니다. 그러나 해당 주석의 내용은 새로운 `ExecutionError` 계층에서 `ExecutionTimeLimitError` 를 의도적으로 제외하는 이유를 설명하는 것으로, 이 PR 의 설계 결정을 문서화하는 데 필수적이다.
- 제안: 이슈 없음. 범위 내 정당한 주석.

### [INFO] `@deprecated` 별칭 getter 추가 — 하위 호환 유지
- 위치: `workflow-errors.ts` — `InvalidExecutionStateError.detail` getter, `RetryLastTurnError.detail` getter
- 상세: 기존 `readonly detail` 프로퍼티를 `serverDetail` 로 통합하면서 `detail` 을 `@deprecated` getter 별칭으로 유지하였다. 이는 `detail` 을 참조하는 기존 호출자(execution-engine.service.ts 등)가 즉시 깨지지 않도록 하위 호환성을 유지하는 것이다. 이 PR 의 리팩터 범위에서 필요한 결정이며 over-engineering 이 아니다.
- 제안: 이슈 없음.

### [INFO] 프론트엔드 i18n dict 변경 — 요청된 기능의 자연스러운 확장
- 위치: `codebase/frontend/src/lib/i18n/dict/en/executions.ts`, `ko/executions.ts`, `backend-labels.ts`
- 상세: `interactionError.{invalidState, messageTooLong, internalError}` 키 추가. `INVALID_EXECUTION_STATE` 는 기존에도 `buildContinuationErrorAck` 에서 노출됐으나 i18n 처리가 없었다. 이번 PR 에서 errorCode 기반 localization 계층을 새로 도입하면서 `INVALID_EXECUTION_STATE` 도 함께 맵에 포함한 것은 합리적인 일관성 확보이다. 이 키가 없으면 새 `execution-error-codes.ts` 의 `INVALID_EXECUTION_STATE` 매핑이 실행 시 undefined key 를 참조해 i18n 폴백 동작 불일치가 생긴다.
- 제안: 이슈 없음. 범위 내 필수 변경.

### [INFO] `endConversation` 에 errorCode localization 추가
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (`endConversation` callback)
- 상세: `endConversation` 의 `onFailure` callback 도 `localizeAckError` 로 교체됐다. 이 명령어 자체는 이번 PR 의 주 변경 대상이 아니지만, 4종 continuation 명령(`submitForm`, `clickButton`, `clickContinue`, `sendMessage`, `endConversation`) 전체에 동일 패턴을 일관되게 적용하기 위해 포함된 것이다. plan 체크리스트에도 "4종 continuation" 이 명시돼 있어 범위 내 변경이다.
- 제안: 이슈 없음.

---

## 요약

변경 범위는 plan 의 "execution-engine client-safe typed error 체계" 구현 항목(ErrorCode 확장, ExecutionError 기반 클래스, MessageTooLongError, buildContinuationErrorAck 재작성, 프론트엔드 errorCode localization)과 정확히 일치한다. 모든 파일은 해당 작업의 직접적·필수적 변경으로 구성되어 있으며, 관련 없는 영역에 대한 수정이나 요청하지 않은 기능 확장은 발견되지 않는다. `websocket.gateway.ts` 에 포맷팅 전용 삼항 재포맷이 한 건 섞여 있으나 의미 변화가 없고 3줄 수준이라 영향이 미미하다. consistency-check 에서 이미 확인된 `review/consistency/` 파일과 `plan/in-progress/` 갱신도 프로젝트 워크플로 규약 상 필수 산출물이므로 범위 내에 해당한다.

## 위험도

NONE
