# RESOLUTION - 11_51_52

> ai-review pass-2 (convergence) -- A-1 typed-error implementation
> RISK LOW, Critical 0, Warning 6, INFO 14. All 6 Warnings resolved (4 fixed, 2 dismissed with rationale).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 (security) | 코드 dismiss | -- | grep 확인: serverDetail 는 websocket.gateway.ts logger.warn 에만 사용. HTTP 응답 및 WS ack body 직렬화 경로 없음. @deprecated detail getter 는 backward-compat 유지. |
| W-2 (security) | 코드 fix | 585b8502 | buildContinuationErrorAck JSDoc 에 아키텍처 불변식 추가 -- 4종 continuation 핸들러가 모두 이 메서드를 거친다고 명시. localizeAckError 기존 JSDoc 에도 이미 client-safe 근거 기록됨. |
| W-3 (architecture) | 코드 dismiss | -- | error-codes.ts 에 이미 "Continuation ack client-safe boundary codes" 섹션 블록 존재 (pass-1 7fd646cb). 모듈 이동은 out-of-scope 장기 리팩터. |
| W-4 (documentation) | 코드 fix | 585b8502 | buildContinuationErrorAck JSDoc 첫 줄을 "A-1 typed-error (spec 7.5.2) -- continuation 핸들러 4종 catch 공통화 + 누출 차단." 으로 교체. 원래 W-8 태그는 trailing note 로 유지. |
| W-5 (api_contract) | 코드 dismiss | -- | channel-web-chat/src + packages/web-chat-sdk/src grep 결과 empty. 두 패키지는 EIA REST/SSE 경로 사용, WS continuation ack 미소비. WS ack 소비자는 frontend 뿐이며 이번 PR 에서 이미 갱신됨. |
| W-6 (user_guide_sync) | 코드 fix | 585b8502 | error-handling.{mdx,en.mdx} 에 상호작용 에러 섹션 추가. 3개 errorCode 및 사용자 노출 의미 기술. KO/EN parity 유지. |

## INFO 항목 처리 (고가치 선별 적용)

| INFO # | 조치 |
|--------|------|
| I-5 (arch -- EIA dual i18n) | DEFERRED -- pass-1 이미 plan 에 기록. 장기 통합 과제. |
| I-6 (deprecated deadline) | FIXED in pass-1 (7fd646cb) -- @deprecated JSDoc 에 since/remove hint 추가. |
| I-7 (JSDoc double block) | DISMISSED -- ExecutionTimeLimitError 이중 JSDoc 는 설계 경계 주석과 클래스 JSDoc 분리 의도. 병합 시 설계 맥락 손실 위험. 유지 결정. |
| I-8 (logger inline ternary) | FIXED in pass-1 (7fd646cb) -- @param fallbackMessage JSDoc 으로 plain-error 경로 명시. error.stack ?? error.message 는 이미 단순해 별도 추출 생략. |
| I-9 (test double service call) | DISMISSED -- 기존 테스트 구조 영향 낮음. 별도 clean-up 이슈로 추적. |
| I-10 (test -- handleEndConversation leak-block) | FIXED -- 585b8502. plain Error → EXECUTION_INTERNAL_ERROR fallback + 내부 message 미노출 검증 케이스 추가. |
| I-11/I-13 (test -- endConversation localization) | FIXED -- 585b8502. EXECUTION_INTERNAL_ERROR / INVALID_EXECUTION_STATE / unmapped fallback 3케이스 추가. |
| I-12 (test -- i18n dict 교차 검증) | DISMISSED -- TypeScript 컴파일 타임 타입 강제로 실질 위험 낮음. 선택적 보완 과제로 분류. |

## TEST 결과

- lint  : 통과 (backend 43 warnings, 0 errors; frontend 10 warnings, 0 errors -- all pre-existing)
- unit  : 통과 (backend 57 passed; frontend 4383 passed, 1 skipped)
- e2e   : 통과 (190/190)

## 보류·후속 항목

- I-5 (EIA REST dual i18n 경로): plan 이관 완료 -- 장기 통합 과제
- I-9 (중복 서비스 호출 테스트): low-priority cleanup, 별도 이슈 추적
- I-12 (i18n dict 교차 검증 테스트): 선택적 보완, 실질 위험 낮음
