# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 정확성에 이상 없음. 주요 위험은 유지보수성(이중 가드 의도 불명확, 조건 중복)과 테스트 커버리지 누락에 집중됨.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | `planForTurn && !planForTurn.approvedAt` 동일 조건이 3곳에 분산 (`edit 핸들러`, `evaluateFinishGuard`, 신규 `planProposedPendingApproval` 블록). 향후 승인 판별 로직 변경 시 누락 수정 위험 | `stream.service.ts` — edit 핸들러, `evaluateFinishGuard`, 신규 guard 블록 | `isPlanPendingApproval(plan)` private 헬퍼로 추출해 단일 출처(SoT) 확보 |
| 2 | Architecture / Maintainability | 이중 억제 메커니즘의 의도 불명확. `finishReason = 'stop'` 덮어쓰기(done 이벤트 payload 보정)와 `!planProposedPendingApproval` 단락(round-trip 재진입 차단)이 각각 필요한 이유가 코드에서 드러나지 않아 미래 기여자가 한쪽을 중복으로 오판·제거 가능 | `stream.service.ts` — `planProposedPendingApproval` 블록 + `shouldContinueLoop` 선언부 | 주석 한 줄로 "Both guards needed: (A) fixes done payload, (B) prevents re-entry via hadSuccessfulEditThisRound" 명시 |
| 3 | Testing | 새 테스트에서 3개 `add_node` 호출이 실제로 `PLAN_AWAITING_APPROVAL` 오류를 받았는지 미검증. 가드가 올바른 이유로 동작하는지 구별 불가 | `spec.ts` — 신규 `it('does NOT round-trip...')` 어서션 블록 | `events.filter(e => e.event === 'tool_call' && e.data.name === 'add_node')` 3개 확인 후 각각 `result.error === 'PLAN_AWAITING_APPROVAL'` 단언 추가 |
| 4 | Testing / Side Effect | Round 1에서 edit 후 Round 2에서 `propose_plan` 발행되는 중간 라운드 시나리오 미검증. 이 경우 Round 2의 tool result가 LLM에 피드백되지 않고 turn 종료되는 동작이 의도적인지 테스트로 고정되어 있지 않음 | `service.ts` — `planProposedPendingApproval` 판정 로직 | "Round 2에서 propose_plan" 시나리오 회귀 테스트 추가 또는 memory 문서에 의도된 동작 명시 |
| 5 | Architecture | `streamMessage` 단일 메서드가 세션 로딩·메시지 조립·tool 디스패치 4종·finish guard·review guard·loop 제어·plan guard·퍼시스턴스 등 8개 이상 책임 담당. 가드 추가마다 유지보수 비용 선형 증가 | `stream.service.ts` — `streamMessage` 전체 | `resolveLoopContinuation(...)` 전용 메서드 분리 고려 (단기적으로는 현행 유지 가능) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `truncateReviewOriginalRequest`에서 사용자 원문을 200자 truncation만으로 LLM tool result에 재삽입하는 프롬프트 인젝션 표면 존재 (이번 변경과 무관한 기존 이슈) | `stream.service.ts` — `evaluateReviewGuard` 내 `originalRequest` 삽입 | `<`, `>`, backtick 등 LLM 제어 토큰 strip sanitizer 추가, 또는 `planTitle` 같은 서버 내부값으로 대체 |
| 2 | Performance | `hadSuccessfulEditThisRound` (O(n×m) 배열 탐색)가 `planProposedPendingApproval` 선언보다 앞에 배치되어 plan-only 종료 경로에서 불필요하게 연산 수행 | `stream.service.ts` — `shouldContinueLoop` 계산 직전 | 선언 순서 교체: `planProposedPendingApproval` 먼저 선언 후, `hadSuccessfulEditThisRound = !planProposedPendingApproval && pendingResultsForLlm.some(...)` 으로 lazy 평가 |
| 3 | Documentation | `planProposedPendingApproval` 관련 설명 주석이 `finishReason` 설정 지점과 `shouldContinueLoop` 설정 지점 두 곳에 거의 동일하게 반복. 한쪽만 갱신 시 설명 불일치 위험 | `stream.service.ts` — 신규 guard 블록 두 곳 | 한 지점에 풀 설명, 나머지는 "위 planProposedPendingApproval 참조" 수준으로 축약 |
| 4 | Documentation / Maintainability | 서비스 파일 내 8줄 한국어 주석 블록이 CLAUDE.md 규약("WHY가 자명하지 않을 때 단 한 줄")을 초과하며 `memory/` 파일과 내용 중복 | `stream.service.ts` — `planProposedPendingApproval` 직전 주석 | 핵심 WHY 1-2줄로 축약, 나머지는 memory 파일에 위임 |
| 5 | Testing / Requirement | 신규 테스트에서 `appendMessage` 두 번째 호출의 `finishReason: 'stop'` 영속 저장 여부 미검증. 다음 턴 rehydration 시 상태 복원 정확성에 영향 | `spec.ts` — 신규 테스트 어서션 블록 | `expect(mocks.sessionService.appendMessage.mock.calls[1][1]).toMatchObject({ finishReason: 'stop' })` 추가 |
| 6 | API Contract | `done` 이벤트 `finishReason`이 프로바이더 원문이 아닌 서버 정규화값임을 클라이언트 타입에 명시되지 않음 | `AssistantStreamEvent` 타입 | `finishReason: 'stop' \| 'tool_calls' \| 'error'` 및 "provider raw 값 아님" 주석 문서화 |
| 7 | API Contract | `PLAN_AWAITING_APPROVAL` 오류인 `tool_call` SSE 이벤트가 여전히 클라이언트에 전달되어 소수의 빨간 배지 노출 가능성 잔존 | SSE `tool_call` yield — `kind === 'edit'` 분기 | 프론트엔드에서 `error === 'PLAN_AWAITING_APPROVAL'` 이벤트를 배지 카운트 제외 또는 별도 스타일 처리 계약 추가 고려 |
| 8 | Documentation | `evaluateFinishGuard` JSDoc `@param state` 설명이 `FinishGuardState`의 `reviewCompleted`, `reviewRoundCount` 필드를 누락 (기존 staleness) | `stream.service.ts` — `evaluateFinishGuard` JSDoc | `@param state` 설명에 누락 필드 추가 또는 설명을 인터페이스 JSDoc으로 이동 |
| 9 | Testing | 테스트 제목 `"Gemini-3-flash pattern"` vs mock `model: 'gemini-3-flash-preview'` 불일치 | `spec.ts` — 신규 `it()` 첫 인자 | 제목을 `"(Gemini-3-flash-preview pattern)"` 으로 통일 |
| 10 | Concurrency | 동일 `sessionId`에 대한 동시 요청 시 `appendMessage` 경쟁 조건 (이번 변경과 무관한 기존 아키텍처 이슈) | `persistAssistantTurn` → `sessionService.appendMessage` | Redis 기반 세션 락 또는 클라이언트 측 단일 요청 보장 메커니즘 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | 기존 prompt injection 표면(truncateReviewOriginalRequest) 지적; 신규 코드는 보안 개선 효과 |
| Performance | LOW | `hadSuccessfulEditThisRound` 계산 순서 비효율; 핵심 효과는 LLM round-trip 50→1 감소로 대폭 개선 |
| Architecture | LOW | 이중 억제 의도 모호, 조건 중복 분산, `streamMessage` SRP 위반 심화 |
| Maintainability | LOW | 이중 가드 묵시적 결합(WARNING), 주석 과다, 조건 중복 |
| Testing | LOW | `add_node` PAA 검증 누락, 중간 라운드 propose_plan 시나리오 미검증 |
| Side Effect | LOW | Round 2+ propose_plan 시나리오 테스트 부재; PAA 실패 항목 히스토리 누적(기존 패턴) |
| Requirement | LOW | appendMessage finishReason 영속 미검증, PAA 이벤트 단언 누락 |
| API Contract | LOW | finishReason 정규화 타입 미문서화, PAA tool_call SSE 노출 잔존 |
| Documentation | LOW | 주석 중복, JSDoc staleness |
| Concurrency | LOW | 기존 세션 동시 요청 경쟁 조건 (신규 코드는 무관) |
| Scope | NONE | 변경 범위 적절, 불필요한 리팩토링 없음 |
| Database | NONE | DB 관련 변경 없음 |
| Dependency | NONE | 신규 외부 의존성 없음 |

---

## 발견 없는 에이전트

- **Database** — DB 쿼리·스키마·트랜잭션 관련 변경 없음
- **Dependency** — 신규 외부 패키지 추가 없음
- **Scope** — 의도된 범위를 벗어난 변경 없음

---

## 권장 조치사항

1. **(즉시 권장)** `isPlanPendingApproval(plan: AssistantPlanRecord | null): boolean` 헬퍼 추출 — 3곳에 분산된 동일 조건을 단일 출처로 통합하여 향후 승인 로직 변경 시 누락 방지
2. **(즉시 권장)** 이중 가드 주석 보완 — `finishReason = 'stop'`(done 이벤트 payload용)과 `!planProposedPendingApproval`(round-trip 재진입 차단)이 모두 필요한 이유를 한 줄로 명시하여 미래 오판 제거 방지
3. **(테스트 보강)** 신규 테스트에 `add_node` × 3의 `PLAN_AWAITING_APPROVAL` 오류 단언 추가 + `appendMessage` `finishReason: 'stop'` 영속 검증 추가
4. **(테스트 보강)** "Round 2에서 propose_plan 발행" 시나리오 회귀 테스트 추가 — 중간 라운드 plan 제안 시 의도된 동작 고정
5. **(낮은 우선순위)** `hadSuccessfulEditThisRound` 계산을 `planProposedPendingApproval` 선언 뒤로 이동하여 plan-only 경로에서 불필요한 배열 탐색 회피
6. **(낮은 우선순위)** 서비스 파일 내 8줄 주석 블록을 1-2줄로 축약 (CLAUDE.md 규약 준수)
7. **(장기 검토)** `evaluateReviewGuard`의 사용자 원문 LLM 재삽입 경로에 LLM 제어 토큰 sanitizer 추가 또는 서버 내부값으로 대체