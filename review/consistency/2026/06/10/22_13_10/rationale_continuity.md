# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`, `spec/data-flow/14-chat-channel.md`, `spec/5-system/16-system-status-api.md`, `spec/4-nodes/1-logic/10-parallel.md` (dead code 제거 03 M-6·m-2 + parallel branch dev/test deep freeze 06 M-5)

diff-base: `origin/main`

---

## 발견사항

### INFO-1: `toEiaEvent` alias 제거 — spec 문서 참조 갱신 불완전
- **등급**: INFO
- **target 위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (diff 제거부), `codebase/backend/src/modules/websocket/websocket.service.ts` (주석 갱신)
- **과거 결정 출처**: `spec/data-flow/14-chat-channel.md` §2.1 — dispatcher 파일 참조, `spec/5-system/15-chat-channel.md` 관련 항목
- **상세**: diff 는 `@deprecated toEiaEvent` alias 를 제거하고 모든 호출부를 `toChatChannelEvent` 로 교체했다. `spec/data-flow/14-chat-channel.md` Rationale 에는 `toChatChannelEvent` 이름이 이미 다이어그램(line 116)에 반영돼 있어 alias 제거 자체는 Rationale 정합이다. 단, `websocket.service.ts` JSDoc 의 참조 갱신이 `toChatChannelEvent` 로 맞춰졌으나, spec 문서 본문 내 `toEiaEvent` 표기가 남아있을 경우 보완이 필요할 수 있다 — diff 범위 기준으로는 코드 쪽은 이미 정합 완료.
- **제안**: 별도 spec 검색으로 `toEiaEvent` 잔존 참조가 있으면 제거하거나 `spec/data-flow/14-chat-channel.md` Rationale 에 함수명 전환 결정(alias-to-direct)을 1줄 기록하는 것을 권장.

---

### INFO-2: `ContinuationBusService.on()` + `registerContinuationHandlers()` 완전 제거 — full B3 Rationale 명시적 근거 있음
- **등급**: INFO
- **target 위치**: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (on() 메서드 제거), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (registerContinuationHandlers() 빈 stub 제거)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)" — "full B3: in-memory 머신(`pendingContinuations`·`firstSegmentBarriers` 일가·`firePayload` scheduler·`runAiConversationLoop`·detached) **완전 제거(full B3)**" 명시
- **상세**: Spec Rationale 은 full B3 완료 후 이 컴포넌트들이 제거됐음을 명시적으로 선언한다. diff 의 `on()` 제거 + `registerContinuationHandlers()` empty stub 제거는 Rationale 에 명시된 full B3 의 dead-code 정리 단계로, Rationale 과 완전 정합이다. 기각된 대안(in-memory pub/sub 유지)의 재도입 없음.
- **제안**: 이상 없음. Rationale 정합 확인 완료.

---

### INFO-3: `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수 제거 — spec §3 getter 전환 Rationale 부재
- **등급**: INFO
- **target 위치**: `codebase/backend/src/modules/system-status/system-status.constants.ts` (모듈-로드 시 평가되는 두 상수 제거)
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md` §3 — `FAILED_DEGRADED_THRESHOLD`·`DELAYED_DEGRADED_THRESHOLD` 를 코드상수 이름으로 참조; Rationale R-5
- **상세**: diff 는 `@deprecated` 태그가 붙은 두 개의 모듈-로드 시 평가 상수(`FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD`)를 제거하고 getter 함수(`getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()`) 사용으로 이행 완료한다. spec §3 의 "코드상수 ↔ env 매핑" 표는 여전히 `FAILED_DEGRADED_THRESHOLD`·`DELAYED_DEGRADED_THRESHOLD` 이름을 언급하지만, getter 함수도 같은 이름의 함수형 래퍼이므로 spec 의 의도(env 기반 설정 가능 threshold)는 유지된다. Rationale R-5 와 충돌 없음.
- **제안**: spec §3 의 "코드상수 이름" 표기를 "getter 함수명 참조" 로 가볍게 갱신하거나, Rationale 에 "모듈-로드 시 평가 상수를 getter 로 전환" 1줄을 추가하면 미래 독자의 혼란을 방지할 수 있다.

---

### INFO-4: `FREEZE_BRANCH_CACHE` 환경 판별 — spec invariant 와 정합, Rationale 기록 없음
- **등급**: INFO
- **target 위치**: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (M-5 FREEZE_BRANCH_CACHE 추가)
- **과거 결정 출처**: `spec/4-nodes/1-logic/10-parallel.md` §Rationale "중첩 Parallel 허용" 결정 G + "결정 D" — "branch 별 nodeOutputCache 는 shallow copy, 값 객체는 공유 (deep clone 비용 회피)", "값 내부를 mutate 하지 않는다는 invariant 는 JSDoc 에 명시"
- **상세**: spec 은 deep clone 비용 회피를 위해 값 객체 공유를 명시적으로 채택했고, "mutate 금지" invariant 는 JSDoc 합의로만 두었다. 이번 변경은 production 동작을 변경하지 않고 dev/test 환경에서만 freeze 로 invariant 위반을 즉시 검출하는 가드를 추가한다 — spec invariant 를 약화하거나 번복하지 않고 오히려 기계적으로 강화하는 방향이다. 환경 판별이 allowlist(`development`/`test`)로 구현돼 spec 주석(ai-review W2)의 우려도 반영했다.
- **제안**: 이상 없음. spec Rationale 의 invariant 를 코드 레벨에서 보강하는 것으로 Rationale 정합이다.

---

## 요약

이번 diff 가 다루는 네 영역(chat-channel dispatcher 함수명 전환, continuation-bus/execution-engine dead code 제거, system-status 상수 제거, parallel cache freeze 가드)은 모두 각 spec 의 `## Rationale` 에 명시적으로 기각되거나 폐기된 결정을 재도입하지 않는다. 특히 `ContinuationBusService.on()` 와 `registerContinuationHandlers()` 제거는 `spec/5-system/4-execution-engine.md` §Rationale "full B3" 결정에 의해 명시적으로 예고·근거화된 dead-code 정리이며, parallel cache freeze 가드는 spec 이 선언한 "mutate 금지 invariant" 를 production 무변경으로 dev/test 에서만 기계 강화한 조치다. 미세한 INFO 항목으로, spec 본문의 코드상수 이름 참조(`FAILED_DEGRADED_THRESHOLD`)가 getter 전환 후에도 그대로 남아 있고 `toEiaEvent` 관련 함수명 전환 결정이 spec Rationale 에 1줄도 기록되지 않은 점이 있으나, 두 사안 모두 합의된 원칙·invariant 를 위반하거나 과거에 기각된 대안을 부활시키는 수준이 아니다.

## 위험도

NONE
