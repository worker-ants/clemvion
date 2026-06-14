# 변경 범위(Scope) 리뷰

## 작업 의도

본 PR(refactor-04 A-1)의 목적은 **client-safe typed error 체계** 도입이다:
- `ExecutionError` 추상 기반 클래스 신설 + 기존 `InvalidExecutionStateError`·`RetryLastTurnError` 흡수
- `MessageTooLongError` typed error 신설 (plain Error 대체)
- `buildContinuationErrorAck` 재작성 — typed→safe msg / plain→generic fallback + 누출 차단
- `ErrorCode` enum 확장 (`EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG`)
- Frontend: errorCode→i18n key 매핑 + 4종 continuation 핸들러 localize
- 연관 테스트·plan·consistency-check 산출물 추가

---

## 발견사항

### [INFO] `websocket.gateway.spec.ts` — 기존 테스트 설명 및 검증 내용 변경 (의도 내)
- 위치: 파일 5, diff L446, L469
- 상세: 두 기존 테스트의 설명과 기대값이 함께 변경됐다. `result.data.error` 기대값이 `'No pending continuation'` → `'Form submission failed'`로, errorCode 기대가 `undefined` → `'EXECUTION_INTERNAL_ERROR'`로 바뀌었다. 이는 `buildContinuationErrorAck`의 plain Error 내부 message 미전달 정책 변경의 직접 반영이며 범위 내다.
- 제안: 없음.

### [INFO] `execution-engine.service.spec.ts` — 동일 인자 함수 2회 호출
- 위치: 파일 1, diff L48-53
- 상세: `service.continueAiConversation('exec-5', tooLong)`을 두 개의 독립 `expect` 블록에서 각각 한 번씩 총 두 번 호출한다. 이 경로는 상태 변경 없이 즉시 reject하므로 멱등하여 범위 관점 문제는 없다. 다만 변수로 추출하면 코드를 단순화할 수 있다.
- 제안: 필요 시 `const rejected = service.continueAiConversation(...)` 로 추출해 재사용 — 범위 이탈은 아님.

### [INFO] `workflow-errors.ts` — `detail` 필드를 getter 별칭으로 전환
- 위치: 파일 4, diff L313-326, L343-349
- 상세: `InvalidExecutionStateError`·`RetryLastTurnError`의 `readonly detail?: string` 필드를 `get detail()` getter(`serverDetail`의 `@deprecated` 별칭)로 교체했다. 기반 클래스 흡수에 따른 필수적 변경이며 하위 호환을 유지한다. 범위 내.
- 제안: 없음.

### [INFO] `review/consistency/2026/06/14/10_58_32/` 산출물 파일 포함
- 위치: 파일 15-20
- 상세: consistency-check --spec 산출물 전체(SUMMARY.md, 각 checker 결과, meta.json, _retry_state.json)가 커밋에 포함됐다. 프로젝트 규약("일관성 검토 산출물 → `review/consistency/**`")에 따른 정상 커밋 대상이다. 범위 이탈 없음.
- 제안: 없음.

---

## 요약

변경된 16개 파일(BE 소스 4 + FE 소스 3 + plan 1 + consistency-check 산출물 6 + 신규 테스트 2) 모두 "client-safe typed error 체계 도입"의 직접 구현·테스트·문서화 범위 안에 있다. 요청 외 리팩토링, 무관 파일 수정, 의도 없는 임포트 정리, 포맷팅 전용 변경은 발견되지 않았다. `detail` 필드의 getter 전환은 기반 클래스 흡수에 따른 필수 변경이며 하위 호환을 유지한다. 게이트웨이 테스트의 기대값 변경은 ack 빌더 동작 변경의 직접 반영이다.

## 위험도

NONE
