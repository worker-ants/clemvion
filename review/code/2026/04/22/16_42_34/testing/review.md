코드 변경 사항을 테스트 관점에서 분석합니다.

---

## 발견사항

### [WARNING] `handleSseEvent` hint 우선순위 주석과 코드 순서 불일치
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `done` 분기, 변경된 주석 및 if-else 체인
- **상세**: 주석은 `error > stalled > planApprove > completed` 순위를 선언하지만, 코드의 실제 실행 순서는 `stalled → completed → planApprove`입니다. 대부분의 경우 상호 배타적(unapproved plan이면서 completedActionable > 0이어야 `completed`와 `planApprove` 동시 충족 가능)이라 실제 버그는 드물지만, 이전 턴에서 모든 step이 완료되었음에도 plan.approved가 false인 엣지 케이스(예: 자연어 승인 → 히스토리 hydration 시 approved 플래그 누락)에서 `completed` 힌트가 `planApprove` 힌트보다 우선 발동합니다.
- **제안**: if-else 순서를 주석과 일치시키거나(`planApprove` 조건을 `completed` 앞으로 이동), 주석을 실제 코드 순서(`stalled > completed > planApprove`)로 수정. 추가로 `plan.approved=false`이고 steps가 모두 done인 케이스를 테스트에 포함.

---

### [WARNING] 실패한 edit 호출이 진척 카운터에 산입되지 않는다는 테스트 부재
- **위치**: `workflow-assistant-stream.service.spec.ts` — 새 3-round 진척 테스트
- **상세**: 구현에서 `editsSinceLastFinishBlock`은 `ok === true`일 때만 증가합니다. 즉 `ok:false` edit가 연속으로 발생해도 stuck 탈출이 되어야 하는데, 이 경로를 검증하는 테스트가 없습니다. 만약 미래 리팩터링에서 실패 케이스도 카운트하도록 변경되면 stuck LLM이 무한 루프에 빠질 수 있습니다.
- **제안**: Round 1에서 `add_node`가 `ok:false`를 반환하고 finish → 즉시 탈출(`editsSinceLastFinishBlock === 0`이므로 escape)하는 시나리오 테스트 추가.

---

### [WARNING] `propose_plan` 성공 시 `editsSinceLastFinishBlock` 증가 경로 미검증
- **위치**: `workflow-assistant-stream.service.ts:451-458` — 진척 카운터 증가 로직
- **상세**: 구현은 `kind === 'plan' && ok === true`도 `editsSinceLastFinishBlock++` 대상으로 포함합니다(`propose_plan` 이후 guard가 다시 발동할 수 있도록). 하지만 현재 모든 테스트는 `add_node` (kind='edit')만 진척으로 사용하고, `propose_plan`이 block 후 카운터를 리셋해 guard를 재발동시키는 시나리오는 테스트되지 않았습니다.
- **제안**: `finish` block 이후 `propose_plan`(plan 교체) + finish 시 guard가 다시 발동하는 테스트 추가.

---

### [WARNING] `summarizePlanState` — `openQuestions` 잔존 시 'completed' 방지 미검증
- **위치**: `frontend/src/lib/stores/__tests__/assistant-store.test.ts` — `summarizePlanState` describe 블록
- **상세**: 현재 테스트는 openQuestions가 빈 케이스만 다룹니다. 모든 actionable step이 done이지만 `openQuestions: ['환불 여부?']`가 남아있으면 `status`는 'completed'가 아닌 'pending'이어야 하는데, 이 경계값이 테스트되지 않았습니다.
- **제안**: openQuestions가 있을 때 'completed'가 아닌 'pending'을 반환하는 케이스 추가.

---

### [INFO] system-prompt 테스트의 정규식 (b) 복잡도 및 취약성
- **위치**: `system-prompt.spec.ts:279-282` — `(b)` assertion
- **상세**: 패턴 `/plan[- ]only turn[s]?[^\n]*(?:do not|must not)\s+emit|(?:do not|must not)\s+emit[^\n]*plan[- ]only/`는 두 방향의 alternation을 가진 복잡한 정규식으로, 프롬프트 문구가 약간만 바뀌어도 실패합니다. 기존의 다른 테스트들은 (`/validate\(\)/`, `/\?\./` 등) 훨씬 단순한 패턴을 사용합니다.
- **제안**: 두 단계로 분리 — `plan-only turn` 문구 존재 확인 + `do NOT emit` 문구 존재 확인으로 나눠 가독성과 유지보수성 개선.

---

### [INFO] `handleSseEvent` — openQuestions가 있는 미승인 plan에서 planApprove 힌트 발동 여부 미검증
- **위치**: `assistant-store.test.ts` — done event 시나리오
- **상세**: `planApprove` 분기는 plan 존재 + 미승인 + no-edit + no-prose일 때 발동합니다. 하지만 openQuestions가 있는 plan에서도 이 hint가 뜨는지(뜨면 "계획대로 진행해 주세요"와 함께 질문 목록이 card에 있음) 의도된 동작인지 명확하지 않고 테스트도 없습니다.
- **제안**: `openQuestions: ['환불 여부?']`가 있는 미승인 plan에서 hint 발동/미발동 여부 명시 테스트 추가.

---

### [INFO] 3-round 테스트의 `chatStream` mock 순서 의존성
- **위치**: `workflow-assistant-stream.service.spec.ts:959-1120` — `mockImplementationOnce` 체이닝
- **상세**: `mockImplementationOnce`를 3번 순서대로 체이닝하는 방식은 round 경계에서 어떤 mock이 소비되는지 추적하기 어렵습니다. 현재 테스트는 round별로 올바른 mock이 호출됨을 `toHaveBeenCalledTimes(3)`으로만 검증하며, 각 round의 입력 messages를 round1/round2/round3별로 어느 정도 확인하지만 `add_s2` node 실제 반영 여부(shadow 적용)까지는 검증하지 않습니다. 이는 기존 테스트 패턴과 일관성은 있으나 유지보수 시 주의 필요.

---

## 요약

테스트 전반적으로 주요 기능(plan-only turn의 prose 생략 + client hint 자동 주입, progress-aware finish guard)에 대한 커버리지는 잘 갖추어져 있습니다. 특히 3-round 통합 테스트와 `handleSseEvent` 단위 테스트는 핵심 시나리오를 명확하게 검증합니다. 다만 실패 edit의 진척 미산입 경로, `propose_plan`의 진척 카운터 역할, openQuestions가 있는 plan에서의 hint 우선순위, 그리고 주석과 코드 실행 순서의 불일치가 미검증·미문서화 상태로 남아 있어, 향후 리팩터링 시 회귀 위험이 존재합니다.

## 위험도

**LOW** — 현재 구현은 동작하며 핵심 시나리오는 커버됩니다. 다만 priority 주석-코드 불일치와 일부 엣지 케이스 미검증으로 인해 추후 수정 시 잠재적 회귀 위험이 있습니다.