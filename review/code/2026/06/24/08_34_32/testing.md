# 테스트(Testing) 리뷰 결과

**검토 대상**: M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리
**검토 일시**: 2026-06-24
**커밋**: 1c17795c277075ce62b118a01963428c542d73d2

---

## 발견사항

### [INFO] `isPlanPendingApproval` 단위 테스트 부재 — 단순 헬퍼이나 커버리지 갭 존재
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/active-plan-context.ts` +64–72
- 상세: `isPlanPendingApproval` 은 `!!plan && !plan.approvedAt` 의 2줄 헬퍼다. `evaluateFinishGuard` spec 테스트(파일 2, line 208 — "plan 이 승인 전(approvedAt 없음)이면 → null")에서 간접 커버되므로 치명적 갭은 아니다. 그러나 `approvedAt: null`, `approvedAt: undefined`, `approvedAt: ''`(빈 문자열) 세 케이스의 falsy 동작이 명시적으로 검증되지 않는다. 특히 빈 문자열은 `!plan.approvedAt === true` 이므로 실제 데이터 불일치 시 의도치 않게 PAA 상태로 처리될 수 있다.
- 제안: `active-plan-context.spec.ts`(기존 파일)에 `isPlanPendingApproval` 3-case 파라미터화 테스트 추가, 또는 `assistant-finish-guard.service.spec.ts` 에 approvedAt 경계값 케이스 보강.

---

### [INFO] `collectPendingUserConfig` 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts`
- 상세: 이 파일은 신규 추출 모듈로, `edit` 경로와 `evaluateReviewGuard` 두 곳에서 공유된다. 테스트 페이로드에는 이 함수에 대한 전용 테스트 케이스가 없다. 현재 커버되는 경로: `evaluateReviewGuard` 통합 테스트(workflow-assistant-stream.service.spec.ts 381건 무변)에서 간접 실행은 되지만, `nodeId 미존재`, `component 미존재(getComponent → undefined)`, `configSchema 파싱 오류` 같은 방어 분기가 단독으로 검증되지 않는다.
- 제안: `collect-pending-user-config.spec.ts` 신설해 (a) 존재하지 않는 nodeId, (b) registry 에 component 없음, (c) 빈 config 의 3 케이스 최소 커버.

---

### [INFO] `evaluateReviewGuard` 의 양성(blocking) 경로 단위 테스트 미작성 — 의도적 결정이나 문서화 필요
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts` +128–131
- 상세: spec 파일 상단 주석이 "blocking/verify checklist 의 양성 경로는 무거운 shadow·registry fixture 가 필요해 통합 테스트에서 커버"라고 의도를 명시한다. 이는 합리적 선택이다. 그러나 `WORKFLOW_REVIEW_REQUIRED` 반환 경로와 `WORKFLOW_VERIFY_REQUIRED` 반환 경로(verifyFiredOnce=false, nonTriggerNodeCount >= 3 이고 checklist 非blocking 인 경우)는 `evaluateReviewGuard` 단위 테스트에서 전혀 다루지 않는다. 통합 테스트 381건이 실제로 이 경로들을 커버하는지 확인이 필요하다.
- 제안: `workflow-assistant-stream.service.spec.ts` 의 통합 테스트가 `WORKFLOW_REVIEW_REQUIRED`/`WORKFLOW_VERIFY_REQUIRED` 분기를 명시적으로 단언하는 케이스 이름을 가지고 있는지 확인. 없다면 통합 테스트에 blocking=true checklist 와 nonTriggerCount >= 3 케이스를 각각 1건씩 추가 권장.

---

### [INFO] `shouldSkipReview` 경계값 — `reviewRoundCount === MAX_REVIEW_ROUNDS` vs 초과 케이스 누락
- 위치: `assistant-finish-guard.service.spec.ts` +329 — `reviewRoundCount: 2` 케이스
- 상세: `reviewRoundCount === 2`(== MAX_REVIEW_ROUNDS) 가 skip 됨을 검증한다. 그러나 `reviewRoundCount === 1` (아직 허용) 케이스와 `reviewRoundCount === 3` (초과, skip 동일하게 true) 케이스가 없다. 현재 구현 `>= MAX_REVIEW_ROUNDS` 에서 정확히 동작하지만 테스트가 `==` 만 체크하면 `>` 로 구현이 바뀔 경우 검출 불가다.
- 제안: `reviewRoundCount: 1` (skip=false), `reviewRoundCount: 3` (skip=true) 케이스 추가.

---

### [INFO] `finishBlockCount > 0 && editsSinceLastFinishBlock === 0` stuck 탈출 케이스 — `finishBlockCount === 0` 경계 미검증
- 위치: `assistant-finish-guard.service.spec.ts` +220–230
- 상세: stuck 탈출 테스트("block 후 진척 0이면 null")는 `finishBlockCount: 1`로 고정되어 있다. `finishBlockCount: 0, editsSinceLastFinishBlock: 0` 조합(첫 번째 finish 호출, 아직 block 경험 없음)이 명시적으로 다루어지지 않는다. 현재 구현에서 `finishBlockCount: 0` 이면 stuck 조건 자체가 false 이므로 guard 가 정상 발동해야 하는데, 이 경로가 다른 케이스들과 섞여서만 커버된다.
- 제안: `freshState({ finishBlockCount: 0, editsSinceLastFinishBlock: 0 })` + plan 에 미완 step 남은 경우에서 PLAN_NOT_COMPLETE 가 반환됨을 명시적으로 단언하는 테스트 추가.

---

### [INFO] `makeService()` 에서 `AssistantFinishGuard` 가 통합 테스트에서 실제 인스턴스로 주입됨 — Mock 대신 실제 객체 사용 적절성
- 위치: `workflow-assistant-stream.service.spec.ts` +1013–1016
- 상세: 통합 테스트에서 `AssistantFinishGuard` 를 mock 없이 실제 인스턴스로 생성해 주입한다. 이는 "가드 발동 단언이 그대로 성립" 이라는 의도적 설계로, 리팩토링 전 동작과의 회귀 동등성을 보장하기 위한 좋은 선택이다. 다만 이로 인해 통합 테스트가 `AssistantFinishGuard` 내부 로직 변경에도 민감하게 결합되어 있어, guard 인터페이스 변경 시 통합 테스트가 광범위하게 영향받을 수 있다. 이는 구조적 trade-off로 현 시점에서는 수용 가능하다.
- 제안: 현재 상태 유지. 단, 향후 `AssistantFinishGuard` 인터페이스가 변경될 경우 `makeService` 의 guard 생성 방식도 함께 갱신해야 함을 주석으로 명시.

---

### [INFO] `truncateReviewOriginalRequest` 함수 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` +549–553
- 상세: `truncateReviewOriginalRequest` 는 빈 문자열, 정확히 200자, 201자, 멀티바이트 유니코드(한국어 포함) 등 경계값을 테스트할 필요가 있다. 프롬프트 인젝션 표면 제어 로직이므로 정확성이 중요하다. 현재 테스트 없음.
- 제안: `assistant-finish-guard.service.spec.ts` 에 `truncateReviewOriginalRequest` 를 직접 export 하거나 별도 순수함수 모듈로 분리 후 경계값 4케이스(빈 문자열, 정확히 상한, 상한+1, 멀티바이트) 테스트 추가.

---

## 요약

이번 리팩토링은 `WorkflowAssistantStreamService` 에 혼재하던 2단계 finish 가드를 `AssistantFinishGuard` 로 분리한 것으로, 테스트 용이성 측면에서 유의미한 개선이다. 신규 단위 테스트(12건)가 `evaluateFinishGuard` 의 전 분기(planClearedThisTurn, PAA, stuck, 성공 edit 없음, 미완 step, 완료, openQuestions)와 `shouldSkipReview` 판정 5케이스를 명확한 한국어 it 설명으로 커버하고, 기존 통합 테스트 381건이 무변 green 이라는 점은 회귀 안전성을 충분히 확보한다. 커버리지 갭은 `isPlanPendingApproval`, `collectPendingUserConfig`, `truncateReviewOriginalRequest` 의 독립 단위 테스트 부재와 `reviewRoundCount` 경계값 누락이 주요 항목이며, 이 중 어느 것도 현재 버그를 유발하지는 않는다. `evaluateReviewGuard` 양성(blocking) 경로가 통합 테스트에서만 커버된다는 의도적 결정은 합리적이지만, 해당 경로의 통합 테스트 케이스 명칭을 확인·보강할 필요가 있다. 전체적으로 리팩토링 목적(테스트 가능한 무상태 collaborator 추출)을 테스트 구조가 잘 지지하고 있다.

## 위험도

LOW
