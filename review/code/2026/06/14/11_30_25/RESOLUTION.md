# RESOLUTION — 11_30_25

**review session**: `review/code/2026/06/14/11_30_25/`
**worktree**: `claude/refactor-04-a1-typed-errors-156e87`
**commit**: `7fd646cb`

---

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W-1 | SPEC-DRIFT → dismiss | 코드 무수정 | spec §7.5.2 는 워크트리(39ed7d31)에 존재. 리뷰어가 main 체크아웃 기준으로 비교한 false positive — PR 머지 시 자동 해소 |
| W-2 | 코드 (i18n/UX) | 7fd646cb | `ERROR_KO` 테이블에 `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` KO 문자열 추가. 주 localization 경로는 `execution-error-codes.ts` 맵이며 ERROR_KO 는 defense-in-depth |
| W-3 | 코드 (문서화) | 7fd646cb | `buildContinuationErrorAck` 에 `@param event`, `@param error`, `@param fallbackMessage` 3개 JSDoc 추가. fallbackMessage 가 비-typed 에러 전용 고정 메시지임과 §7.5.2 누출 차단 계약을 인라인 명시 |

---

## INFO 조치 요약

| INFO # | 분류 | 처리 | 비고 |
|--------|------|------|------|
| I-1 | 보안 (serverDetail non-serialized) | dismiss | `serverDetail` 의 실질 누출 경로 없음. `buildContinuationErrorAck` 가 typed path 에서도 `serverDetail` 을 client 에 전달하지 않음 (로그 전용). 예방적 `toJSON()` 은 후속 리팩토링에서 검토 가능 |
| I-2 | 보안 (fallbackMessage type) | dismiss | 현재 4종 호출부 모두 고정 string literal. W-3 @param 계약이 의도를 문서화하므로 string literal union 강제는 over-engineering |
| I-3 | 아키텍처 (ExecutionTimeLimitError 경계) | 7fd646cb | `ExecutionTimeLimitError` 가 `ExecutionError` 밖에 의도적으로 남겨져 있는 이유를 클래스 직전 JSDoc 블록으로 명문화 (continuation ack 경로 비도달 + 보안 게이트 설명) |
| I-4 | 아키텍처 (ErrorCode 혼재) | defer | 중장기 패키지 분리 후속 항목. 현재 실용적 타협이므로 plan 에 기록 불필요 (spec §4 분리는 별도 리팩토링 범위) |
| I-5 | 요구사항 (EIA REST 에러 처리) | defer | EIA 경로 `MessageTooLongError` → HTTP 422/400 exception filter 는 별도 결정/범위. 현재 rethrow → NestJS generic 500 (누출 없음, 회귀 없음). 아래 보류·후속 항목 참고 |
| I-6 | 부작용 (detail getter non-enumerable) | dismiss | `.detail` 을 외부에서 소비하는 코드 없음 (grep 확인). 테스트·별칭 용도로만 접근. 직렬화 경로에서 `serverDetail` 직접 접근이 이미 코드에서 사용됨 |
| I-7 | 부작용 (channel-web-chat error 필드) | dismiss | channel-web-chat 는 EIA(REST) 경로를 사용하며 WS continuation ack 이벤트(`form_submitted` / `submit_message.ack`)를 소비하지 않음. behavioral change 영향 없음 |
| I-8 | 유지보수 (@deprecated 제거 시점) | 7fd646cb | `detail` getter `@deprecated` 에 "since refactor-04-a1 — use serverDetail; remove after callers migrated" 추가 |
| I-9 | 유지보수 (onAckError 중복) | dismiss | 5개 `useCallback` 의 toast 호출 단행은 현재 구조상 가독성 손해 없음. optional 리팩토링 — 별도 PR 범위 |
| I-10 | 테스트 (RetryLastTurnError factory) | 7fd646cb | `notRetryable()` / `tooEarly()` factory 에 message·code·serverDetail·detail alias 검증 케이스 4개 추가 (`workflow-errors.spec.ts`) |
| I-11 | 테스트 (handleSubmitMessage) | 7fd646cb | `handleSubmitMessage` plain-Error 누출 차단 + `MessageTooLongError` typed path 테스트 2개 추가 (`websocket.gateway.spec.ts`) — `handleSubmitForm` 과 동일 커버 수준 |
| I-12 | 테스트 (clickButton/endConversation localization) | 7fd646cb | `clickButton` errorCode→i18n 매핑 테스트 3개 추가 (INVALID_EXECUTION_STATE, EXECUTION_INTERNAL_ERROR, 미매핑 fallback) (`use-execution-interaction-commands.test.ts`) |
| I-13 | 테스트 (continueAiConversation 중복 호출) | dismiss | `execution-engine.service.spec.ts` 의 이중 assertion 구조는 멱등하며 회귀 위험 없음. 분리는 cosmetic — 별도 PR 범위 |
| I-14 | 아키텍처 (useT stable reference) | dismiss | `useT` 의 `t` 함수가 안정적임을 코드베이스에서 확인 (react-i18next 패턴). `useCallback` 재생성 위험 없음 |

---

## TEST 결과

- lint (backend) : 통과 (0 errors, 43 warnings — pre-existing)
- lint (frontend) : 통과 (0 errors, 10 warnings — pre-existing)
- unit (backend)  : 통과 (6877 passed, 1 skipped pre-existing / 344 suites)
- unit (frontend) : 통과 (26 passed / 1 suite — use-execution-interaction-commands)
- e2e             : 통과 (190/190) — log: `_test_logs/e2e-20260614-114558.log`

**비고**: `sdk` / `web-chat-sdk` 패키지는 본 워크트리에 `package-lock.json` 없음 →
lint/build wrapper 가 해당 패키지에서 환경 오류 발생 (본 변경과 무관 — `project_worktree_test_env_setup` 메모리 참고). backend/frontend 직접 실행으로 검증 완료.

---

## 보류·후속 항목

- **I-5 (EIA REST MessageTooLongError → HTTP 422)**: `execution-engine.service.ts` EIA 진입점에서 `MessageTooLongError` → HTTP 422/400 exception filter 추가. 별도 결정/범위 — plan/in-progress/execution-engine-typed-errors.md 에 후속 항목으로 기록 예정.
- **I-4 (ErrorCode 관심사 혼재)**: `nodes/core/error-codes.ts` 의 WS continuation ack 전용 코드를 `execution-engine/execution-error-codes.ts` 로 분리. 중장기 리팩토링 — 별도 PR 범위.
- **W-1 (SPEC-DRIFT)**: PR 머지 시 자동 해소. 별도 조치 불필요.
