# 테스트(Testing) 리뷰 결과

## 발견사항

### **[WARNING]** `structuredOutputCache` freeze 경로에 대한 테스트 커버리지 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` M-5 describe 블록
- 상세: `freezeSharedCacheValues` 는 `parallel-executor.ts:231-235` 에서 `nodeOutputCache` 와 `structuredOutputCache` 양쪽 모두에 적용된다. 그러나 M-5 테스트 블록의 "값 내부 mutate → TypeError" 케이스는 `nodeOutputCache.nodeA` 경로만 검증하며, `structuredOutputCache` 에 대한 동일 경로 검증이 없다. `freezeSharedCacheValues` 가 두 필드 모두에 호출됨에도 실질 커버리지는 한 필드에 집중된다. 이미 다른 리뷰어(22_20_51 I6·I7)에서도 "선택 후속"으로 분류했으나, 두 캐시 경로가 동일 freeze 함수를 공유하기 때문에 실질 위험은 낮다.
- 제안: `structuredOutputCache` 값 내부 mutate → TypeError 검증 케이스를 M-5 describe 블록에 추가. 또는 기존 케이스에 `structuredOutputCache` 필드도 포함하는 fixture 로 확장해 단일 케이스에서 양쪽을 커버.

### **[WARNING]** "top-level 키 추가 격리" 테스트의 의미 모호성 — FREEZE_BRANCH_CACHE ON/OFF 무관하게 통과
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` 라인 118-136
- 상세: 두 번째 M-5 it 블록("top-level 키 추가는 branch 간 격리되어 정상 동작한다")은 `FREEZE_BRANCH_CACHE` 의 ON/OFF와 무관하게 shallow copy 격리만 검증한다. 이 테스트는 freeze 가 비활성인 환경(production)에서도 동일하게 통과하며, M-5 freeze invariant를 직접 검증하지 않는다. 이로 인해 M-5 describe 블록 내에 위치하면서도 M-5 가드와 무관한 테스트가 혼재한다는 혼란이 생긴다. 테스트 실패 메시지에서 "freeze 가드 실패" 인지 "shallow copy 격리 실패" 인지 구분하기 어렵다.
- 제안: 테스트 이름에 "이 테스트는 freeze ON/OFF 무관하게 shallow copy 격리를 검증함" 주석을 추가하거나, 해당 케이스를 M-5 describe 블록 외부의 shallow copy 격리 describe 블록으로 이동.

### **[INFO]** `applyContinuation` / `applyCancellation` 경로 단위 테스트 충분성 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: `registerContinuationHandlers()` 의 직접 호출 2건이 테스트 setup에서 제거됐다. 이 메서드가 실제로 no-op이었기 때문에 제거 자체는 올바르나, 제거 후 `applyContinuation` / `applyCancellation` 재개 시나리오(form/AI continuation)에 대한 단위 테스트가 spec 파일에 충분히 존재하는지 별도 확인이 필요하다. BullMQ Worker 경유 continuation 흐름은 e2e 179건으로 커버됨이 확인됐으나, 단위 레벨의 `applyContinuation` 계약 검증이 분리되어 있는지가 불명확하다.
- 제안: `execution-engine.service.spec.ts` 에서 `applyContinuation` / `applyCancellation` 을 직접 호출하는 테스트 케이스가 존재하는지 확인. 없다면 BullMQ Worker 없이도 continuation 재개 로직을 검증하는 단위 테스트 추가 권장.

### **[INFO]** `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 제거 후 잔여 테스트 참조 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: deprecated 상수 2건이 제거됐다. PR diff 내 파일에서는 직접 참조가 없으나, 전체 test 파일 범위에서 이 상수를 import 하는 경우 컴파일 오류가 발생한다. 다른 리뷰어가 "grep 0건 확인 완료"를 언급하고 있지만, 이는 런타임 코드에 대한 확인으로 테스트 파일 전체 범위가 포함됐는지 불명확하다.
- 제안: `grep -r "FAILED_DEGRADED_THRESHOLD\|DELAYED_DEGRADED_THRESHOLD" codebase/backend/src` 로 spec 파일 포함 전체 범위에서 잔여 참조 없음을 재확인.

### **[INFO]** `toChatChannelEvent` 전체 분기 커버리지 맵 갱신 미완
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- 상세: `toEiaEvent` → `toChatChannelEvent` rename이 spec 파일 전체에 반영됐고 회귀 차단력은 유지된다. 그러나 `chat-channel.dispatcher.ts` 내 `toChatChannelEvent` 의 모든 이벤트 타입 분기에 대한 커버리지 맵이 이번 rename 이후 갱신됐는지 확인되지 않는다. 신규 분기가 추가된 것은 아니므로 이번 PR이 갭을 새로 도입하지는 않으나, 기존 갭이 rename 이후에도 그대로 잔존한다.
- 제안: 추후 `toChatChannelEvent` switch/if 분기 전체를 나열한 커버리지 맵을 작성해 테스트 미포함 이벤트 타입 목록 관리 권장. 이번 PR의 필수 조치는 아님.

### **[INFO]** M-5 테스트 — `mutator` 클로저 캡처 패턴의 명시적 문서화 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` 라인 92-110
- 상세: 이전 리뷰(22_00_04 W3)에서 지적된 `try/catch` → `expect(mutator).toThrow(TypeError)` 전환이 완료됐으며, 패턴 의도가 인라인 주석("non-strict 환경에서 silent-pass 가능성 제거")으로 명확하게 설명된다. `mutator` 변수가 클로저를 통해 외부로 유출되는 구조는 비직관적일 수 있으나 주석이 충분히 보완한다. 현재 상태 양호.
- 제안: 없음.

### **[INFO]** `FREEZE_BRANCH_CACHE` 전제 단언 — jest 환경 가드 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` 라인 82-84
- 상세: 이전 리뷰(22_00_04 W2)에서 지적된 "Jest 가 NODE_ENV=production 으로 돌 경우 false positive" 문제가 `expect(FREEZE_BRANCH_CACHE).toBe(true)` 전제 단언 추가로 해소됐다. `FREEZE_BRANCH_CACHE` export 및 `@internal` JSDoc도 완료됐다. 현재 상태 양호.
- 제안: 없음.

---

## 요약

이번 변경의 테스트 관점 핵심은 세 가지다. (1) `toEiaEvent` → `toChatChannelEvent` rename이 spec 파일 전체에 일관되게 반영돼 회귀 차단력이 유지됐다. (2) M-5 freeze invariant 가드 테스트가 `try/catch` → `expect(mutator).toThrow(TypeError)` 전환 및 `FREEZE_BRANCH_CACHE` 전제 단언 추가로 이전 리뷰 WARNING을 모두 해소했다. (3) `registerContinuationHandlers`/`on()` 제거에 따른 테스트 setup 정리도 적절하다. 주요 미완 항목은 `structuredOutputCache` freeze 경로에 대한 커버리지 갭이다 — `freezeSharedCacheValues` 는 두 캐시 필드 모두에 적용되나 테스트는 `nodeOutputCache` 경로만 검증한다. 또한 두 번째 M-5 테스트("top-level 키 추가 격리")는 freeze ON/OFF 무관하게 동작해 M-5 describe 블록 내에서의 위치가 다소 혼란스럽다. 이 두 항목 외에 전체적으로 테스트 변경이 프로덕션 코드 변경과 정확히 동반됐으며 테스트 신뢰도가 이전 라운드 대비 실질적으로 향상됐다.

---

## 위험도

LOW

STATUS=success ISSUES=2
