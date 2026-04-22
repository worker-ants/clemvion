---
name: 2026-04-23 plan-only turn 핑퐁 루프 차단 리뷰 조치
date: 2026-04-23
---

# 조치 내역

SUMMARY.md (위험도 LOW) 의 Warning / Info 이슈 중 아래 항목을 처리.

## 조치 완료

### WARNING #1 — `planForTurn && !planForTurn.approvedAt` 3곳 중복
`isPlanPendingApproval(plan: AssistantPlanRecord | null): boolean` 모듈 스코프
helper 추출. 3개 사용처 모두 helper 로 교체:
- edit 핸들러 (stream.service.ts)
- `evaluateFinishGuard`
- 메인 루프의 plan-only 종료 가드

단일 출처(SoT) 확보 → 향후 approve 판별 변경 시 누락 위험 제거.

### WARNING #2 — 이중 가드 의도 불명확
`planPending` 블록에 "(A) finishReason='stop' 은 done payload 정정, (B) !planPending
단락은 round-trip 재진입 차단. 둘 다 필요함" 주석 3줄로 명시. 미래 기여자가
한쪽을 중복으로 오판·제거하지 않도록 설계 의도 고정.

### WARNING #3 — 테스트가 PAA 오류를 실제로 검증하지 않음
신규 테스트에 3개 `add_node` SSE 이벤트 수집 → 각각 `result.error === 'PLAN_AWAITING_APPROVAL'`
단언 추가. "가드가 1 라운드로 종료했다" 뿐 아니라 "올바른 이유로 종료했다" 까지 고정.

### INFO #2 — `hadSuccessfulEditThisRound` 를 lazy 평가
선언 순서 교체: `planPending` 먼저 계산, 이후 `hadSuccessfulEditThisRound = !planPending && pendingResultsForLlm.some(...)` 로 단락. plan-only 종료 경로에서 불필요한 O(n×m) 배열 탐색 제거.

### INFO #4 — 8줄 한국어 주석 블록 축약
서비스 파일 내 주석을 3줄 (의도·이유·A/B 참조) 로 축약. 상세 설명은 `memory/workflow-assistant-provider-quirks-and-review-always.md` 6번 섹션에 위임. CLAUDE.md "WHY 자명하지 않을 때 한 줄" 규약 준수.

### INFO #5 — `appendMessage` finishReason 영속 미검증
신규 테스트에 `expect(assistantPersist?.[1]).toMatchObject({ role: 'assistant', finishReason: 'stop' })` 추가. 다음 턴 rehydration 시 "승인 대기" 상태로 복원되는 경로가 회귀 테스트로 고정됨.

### INFO #9 — 테스트 제목 / 모델 ID 불일치
테스트 제목을 "(gemini-3-flash-preview pattern)" 으로 통일 (mock model 과 동일).

## 조치 유보 (이번 변경 범위 밖)

### WARNING #4 — Round 2에서 `propose_plan` 중간 발행 시나리오 회귀 테스트 부재
현재 동작은 "중간 라운드에서 propose_plan 이 발행되면 해당 라운드 tool result
피드백 없이 턴 종료" 인데, 이것이 의도적인지 명시 테스트가 없음. 다만 이는
현실 LLM 에게는 드문 패턴이고 (LLM 은 보통 턴 시작에 plan 을, 또는 아예 안 냄)
기존 `planPending` 가드의 자연스러운 부산물이므로 본 변경 범위 밖으로 분리.
`memory/` 메모 6번 섹션에 "호환성" 항목으로 3가지 경로를 문서화해 후속 RFC
에서 참고할 수 있게 함.

### WARNING #5 — `streamMessage` 단일 메서드 책임 8종 초과
기존 SRP 이슈. 이번 변경으로 가드 1개가 추가되어 책임 집중이 소폭 심화.
리팩토링은 plan-only / finish / review / loop 제어 전반을 재설계해야 하므로
별도 이슈로 분리.

### INFO #1 — `truncateReviewOriginalRequest` sanitizer 부재
이번 변경과 무관한 기존 prompt injection 표면 이슈. 별도 이슈로 분리.

### INFO #7 — PAA `tool_call` SSE 이벤트가 여전히 클라이언트에 전달
UX 개선 — 1 라운드 내 종료로 PAA 빨간 배지 개수는 드라마틱하게 줄었지만 (수십 개 → 최대 수 개) 여전히 노출 가능. 프론트엔드에서 `error === 'PLAN_AWAITING_APPROVAL'`
이벤트를 배지에서 제외하거나 별도 스타일로 렌더링하는 것이 "UX 관점에서 가장 깔끔".
본 백엔드 PR 범위 밖으로 분리.

### INFO #8 — `evaluateFinishGuard` JSDoc staleness
기존 staleness. 별도 이슈로 분리.

### INFO #10 — 동일 sessionId 동시 요청 경쟁 조건
기존 아키텍처 이슈. 별도 이슈로 분리.

## 검증

- `backend` 전체 test: 1725/1725 pass
- `backend` lint: clean
- `backend` build: success

## 관련 문서

- 메모: `memory/workflow-assistant-provider-quirks-and-review-always.md` §6 "Plan-only 턴의 핑퐁 루프 차단"
- 회귀 테스트: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` "does NOT round-trip when a plan was proposed and is pending approval..."
