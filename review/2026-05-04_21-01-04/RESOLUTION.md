# Code Review 조치 내용 — 호출 라벨 중복 fix 후속

## 대상 리뷰
- 위치: `review/2026-05-04_21-01-04/SUMMARY.md`
- 범위: `fix(ai-agent): tool loop 한 턴의 어시스턴트 호출 라벨 중복 표시` 커밋 (`6b1f7e0`)

## 전체 위험도
리뷰 결과 LOW (Critical 0 / Warning 0 / Info 13). 필수 조치는 없으나 가치 있는 보완을 진행.

## Info 조치

### #1 멀티라인 주석 → 1줄
**조치 완료.** `fromConversationMessages` 의 3줄 주석을 한 줄 + 보조 한 줄로 압축 (CLAUDE.md "one short line max" 규약 준수). 테스트 주석은 의미 변경 없는 헤더 한 줄로 축약.

### #2 주석 예시 오류
**조치 완료.** 본문 주석의 라벨 예시를 실제 출력 포맷 (`"Turn 1 · 호출 1/2"`) 으로 정렬.

### #3 JSDoc tool loop 동작 미반영
**조치 완료.** `LlmCallTrace.callIndexInTurn` 필드 JSDoc 에 fallback 경로의 정책(chronological, flattenTurnDebug 와 동일)을 명시. `extractLlmCalls` JSDoc 에 "tool loop 시 sequential callIndexInTurn 부여" 한 문장 추가.

### #4 callIndexInTurn 소비자 grep
**조치 완료.** `grep -rn "callIndexInTurn" frontend/src` 결과 외부 소비자는 `labelForCall` (line 151) 한 곳뿐이며 단순히 `+ 1` 라벨링에만 사용. `=== 0` 가정 없음 → 영향 없음.

### #5, #6, #7 보안 (raw payload, 인증, 타입 단언)
**조치하지 않음 (직전 라운드와 동일 디자인 결정).** 디버깅 타임라인은 워크플로 작성자(자기 자신의 system prompt)에게만 노출되며, 권한 분리는 별도 PRD/Spec 영역. Zod 등 런타임 스키마는 경계 검증 정책 결정 사안 (CLAUDE.md "내부 코드/framework guarantees 신뢰" 원칙).

### #8 ≥3 호출 케이스
**조치 완료.** `assigns sequential indices for ≥3 calls in a single turn (deeper tool loop)` 테스트 추가. `[0, 1, 2]` 인덱스 + `호출 3/3` 라벨 검증.

### #9 null-payload 인터리빙
**조치 완료.** `skips assistant items with no payload without breaking the per-turn counter` 테스트 추가. null-payload assistant 가 끼어들어도 카운터가 건너뛰지 않고 다음 valid trace 가 `callIndexInTurn: 1` 을 받는지 검증.

### #10 복수 턴 × 복수 호출
**조치 완료.** `resets callIndexInTurn independently per turn` 테스트 추가. turn 1 = 2 calls, turn 2 = 1 call 픽스처로 turn 별 카운터 독립 초기화 검증.

### #11 durationMs 검증 누락
**조치 완료.** 추가된 tool loop 테스트의 `toMatchObject` 어서션에 `durationMs: 30 / 40` 추가.

### #12 순서 의존성 명시
**조치 완료.** `fromConversationMessages` 주석에 "Caller must pass items in chronological order (same precondition the store guarantees)" 한 줄 추가.

### #13 fallback 경로 deprecation TODO
**조치하지 않음 (오해의 소지).** 백엔드가 trace 를 보내더라도 라이브 waiting 세션에서는 `outputData._turnDebugHistory` 가 아직 도착하지 않은 상태에서도 conversation messages 는 채워질 수 있어 fallback 은 여전히 필요한 본질적 경로. dead 가 아닌 보조 경로이므로 TODO 마킹은 부정확.

## TEST WORKFLOW 재실행 결과
- frontend lint: ✅
- frontend unit test: 1125/1125 ✅ (이전 1122 + 본 라운드 추가 3건)
- frontend build: ✅
- backend 변경 없음

## 후속 사안 없음
모든 보완은 본 라운드에서 처리. 직전 RESOLUTION 의 follow-up 사안(권한 분리, MultiTurnNodeHandler 인터페이스, cancelledRef 일관 적용, 운영 모니터링) 그대로 유지.
