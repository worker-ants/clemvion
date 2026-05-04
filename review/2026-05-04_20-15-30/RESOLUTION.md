# Code Review 조치 내용

## 대상 리뷰
- 위치: `review/2026-05-04_20-15-30/SUMMARY.md`
- 범위: `origin/main..HEAD` — `execution.ai_message` waiting_for_input 분기 정렬 + spec 갱신

## 전체 위험도
리뷰 결과 MEDIUM (Critical 0 / Warning 12 / Info 10) → 조치 후 재실행 가능 상태로 정리.

## Warning 조치

### #1 Security — 시스템 프롬프트 무필터 전송 / #2 Security — responsePayload 원시 노출
**조치하지 않음 (의도된 디자인).**

이 두 사안은 디버깅 타임라인의 본질적 동작이며, terminal emit 분기에서 이미 동일하게 작동 중이다. 워크플로 작성자는 자신이 작성한 system prompt와 LLM provider 응답 raw 데이터를 디버깅을 위해 볼 수 있어야 하며, 본 PR이 발생시킨 새 노출이 아니다. 만약 추후 워크스페이스 멤버 권한 분리(viewer 등)가 도입되면 그 시점에서 디버그 페이로드 노출 정책을 별도 사안으로 다뤄야 한다 (spec/PRD 단계 결정).

### #3 API Contract — frontend breaking change 확인
**조치 완료.** `frontend/src/lib/websocket/use-execution-events.ts` 에서 `payload.requestPayload` / `payload.responsePayload` 직접 참조를 grep 으로 검사한 결과, 신규 messages-기반 흐름에는 사용처가 없고 legacy 단일-메시지 fallback (line 367-368) 만 `payload.requestPayload ?? lastLlmCall?.requestPayload` 형태의 nullable fallback 으로 사용 중이다. 백엔드가 더 이상 `payload.requestPayload` 를 보내지 않더라도 항상 `lastLlmCall?.requestPayload` 로 evaluate 되므로 동작상 회귀 없음. frontend 변경 불필요.

### #4 API Contract — terminal emit 분기 동기화 미검증
**조치 완료.** terminal 분기(execution-engine.service.ts:1783-) 도 `buildAiMessageDebugFromResumeState` helper 로 일원화. 기존 inline 추출 코드(`turnDebugArray`/`lastTurnDebug` 로컬)를 제거하고 `{ turnDebugHistory: metaSource.turnDebug }` 어댑터 객체로 helper 를 호출. 두 분기가 코드 레벨에서 동일 shape 을 보장한다.

### #5 Testing — 통합 테스트 부재
**부분 조치.** `buildAiMessageDebugFromResumeState` 단위 테스트에 회귀 검증 케이스 4건 추가 (`llmCalls: []`, `llmCalls: null`, `turnDebugHistory: null`, shallow-copy mutation). emit 호출부 통합 테스트는 multi-turn AI Agent 전체 mock 셋업이 필요해 별도 테스트 파일에서 다루는 것이 적합하므로 본 PR 범위에서는 보류. 단, helper 가 emit 으로 spread 되는 결과 객체이므로 helper 단위 테스트가 사실상 emit shape 을 결정한다.

### #6 Requirement — `llmCalls: null` 런타임 버그
**조치 완료.** `if (llmCalls !== undefined)` → `if (Array.isArray(llmCalls))` 로 가드 강화. `null` / `undefined` / non-array 모두 거른다. 회귀 테스트 추가 (`drops llmCalls when the field is non-array (defensive against legacy null)`).

### #7 Architecture — unsafe cast / Record erasure
**조치 완료.** helper 파일 내 `LlmCallRecord` / `TurnDebugEntry` 인터페이스 정의 후 `as unknown[]` cast 를 `Array.isArray()` 가드 + 명시 타입으로 교체. 반환 타입도 `LlmCallRecord[]` 로 강화.

### #8 Performance — O(n²) payload 성장 / #9 Performance — llmCalls 무제한
**조치하지 않음 (디자인 트레이드오프).**

이는 본 PR 이전부터 존재한 디자인 사안이며 terminal 분기도 동일하게 누적 messages 를 보낸다. 페이로드 크기 제한·delta 전송은 별도 PRD/Spec 결정이 필요한 구조 변경이므로 본 작업 범위 밖. (spec/5-system/6-websocket-protocol.md §4 의 권한 있는 명세 변경 사안.)

### #10 Concurrency — llmCalls 얕은 참조 mutation 위험
**조치 완료.** `result.llmCalls = [...lastTurnDebug.llmCalls]` 으로 shallow copy 적용. 회귀 테스트 추가 (`shallow-copies llmCalls so later mutation of resumeState cannot retroactively change a buffered emit`).

### #11 Maintainability — spread 주입 가독성
**조치하지 않음.** helper 이름 `buildAiMessageDebugFromResumeState` 가 충분히 selfdocumenting 하고, 주변 emit 객체에 이미 다른 spread 들(예: `metaSource.config` spread)이 자연스러운 패턴으로 사용 중. 호출부 인라인 주석으로 어떤 필드가 들어가는지 명시(#12 와 함께 처리).

### #12 Documentation — 제거 배경 미주석
**조치 완료.** waiting 분기 emit 직전에 인라인 주석 추가:
> `// The earlier flat fields (lastTurnRequest / lastTurnResponse / lastTurnDurationMs on resumeState) are intentionally not emitted — turnDebugHistory's last entry already carries the same data and additionally preserves the per-call sequence in tool loops.`

## Info 조치

| # | 조치 | 비고 |
|---|------|------|
| 1 | ✅ | `llmCalls: []` 빈 배열 케이스 단위 테스트 추가 (의도된 동작: 보존) |
| 2 | ✅ | `totalDurationMs: 0` / `turnDebugHistory: null` 경계값 테스트 추가 |
| 3 | ✅ | spec 의 §4.4 에 `llmCalls` 항목 스키마 표 추가 |
| 4 | ✅ | spec 의 페이로드 표에 `llmCalls[].durationMs` (단일 LLM) vs 최상위 `durationMs` (턴 전체) 의미 차이 명시 |
| 5 | ✅ | spec 에 `metadata.inputTokens` 가 "대화 전체 누적"임을 표 설명에 명시 |
| 6 | ✅ | helper JSDoc 에 `totalDurationMs` → `durationMs` 매핑을 명시 |
| 7 | ✅ | `LlmCallRecord` 인터페이스 정의 (#7 과 함께 처리) |
| 8 | 보류 | 단기 현행 유지 권장. 별도 사안. |
| 9 | ✅ | describe 블록 주석을 "spec §4.4 참조" 한 줄로 축약 |
| 10 | ✅ | spec §4 표 entry 의 본문 중복 설명 제거 → "상세 필드 정의는 §4.4 참조" 로 단순화 |

## TEST WORKFLOW 재실행 결과
- backend lint: ✅
- backend unit test: 2564/2564 ✅ (이전 2560 + 본 PR 추가 4건 + 본 RESOLUTION 추가 4건 = 차이 +4 → +8 누적이 아닌 helper 추가분만 4 → 이번 라운드 추가 4건 포함하여 통과)
- backend build: ✅
- frontend 변경 없음 — 이전 라운드 lint/test/build 통과 유지

## 후속 사안 (Follow-up)
1. (별도 PR) 프론트엔드 `use-execution-events.ts:355-378` legacy fallback 분기는 백엔드가 항상 `messages` 배열을 보내므로 dead code. 정리하면 분기 단순화 가능.
2. (별도 PRD/Spec) 워크스페이스 멤버 권한 분리 도입 시 `llmCalls` 의 `requestPayload`/`responsePayload` 노출 정책을 권한별로 분기 (Security #1, #2).
3. (별도 PRD/Spec) WebSocket 페이로드 크기 제한 / delta 전송 / debug 옵트인 채널 분리 (Performance #8, #9).
4. (별도 PR) emit shape 회귀 검증 통합 테스트 — multi-turn AI Agent 전체 mock 셋업 (Testing #5 보강).
