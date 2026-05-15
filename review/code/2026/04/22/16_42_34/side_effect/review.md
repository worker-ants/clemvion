## 리뷰 결과

### 발견사항

---

**[WARNING] `done` 이벤트 힌트 우선순위가 스펙 주석과 다름**
- 위치: `frontend/src/lib/stores/assistant-store.ts` — `handleSseEvent` 내 `done` 분기 (약 531~547줄)
- 상세: 코드 주석과 테스트 파일 상단 docstring은 우선순위를 `error > stalled > planApprove > completed` 로 명시하지만, 실제 `else if` 체인은 `stalled → completed → planApprove` 순서로 평가한다. `completion.status === 'completed'` 가 `planApprove` 조건보다 먼저 평가되므로, plan이 `approved=false` 인데 `completedActionable > 0` (다른 턴에서 일부 step이 완료된 상태)인 메시지에 `done` 이벤트가 들어오면 `planApproveConfirm` 대신 `turnCompletedHint`가 주입된다. 정상 흐름에서 발생 빈도는 낮으나, spec과 코드가 불일치한다.
- 제안: `completed` 분기와 `planApprove` 분기 순서를 바꿔 `stalled → planApprove → completed` 로 맞추거나, 스펙 주석을 실제 코드 순서로 수정

---

**[INFO] `evaluateFinishGuard` 시그니처 변경 — 내부 전용, 호출 지점 일치 확인 필요**
- 위치: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` `:716` (메서드 선언) / `:287` (호출 지점)
- 상세: `editsSinceLastFinishBlock` 파라미터가 추가됐다. 해당 메서드는 `private`이고 현재 파일 내 유일한 호출 지점도 함께 업데이트되어 있다. 외부 API 파단은 없으나, 클래스 주석(`@Injectable`) 블록 도움말이 여전히 "두 번째 finish 는 정상 탈출로 허용한다" 구 동작을 설명하고 있어 내부 문서 불일치가 남아 있다.
- 제안: `streamMessage` JSDoc의 "finishBlockCount 로 같은 턴 2회 block 을 막아 무한 루프를 방지하고, 두 번째 finish 는 정상 탈출로 허용한다" 설명을 새 progress-aware 동작으로 갱신

---

**[INFO] `handleSseEvent` · `summarizePlanState` 내부 함수 외부 공개**
- 위치: `frontend/src/lib/stores/assistant-store.ts` `:384`, `:566`
- 상세: 두 함수가 `export` 로 변경되어 모듈 공개 API surface가 확대됐다. 의도는 테스트 전용 접근이나, `handleSseEvent`는 순수 함수가 아니라 Zustand `set`/`get` 콜백으로 스토어 상태를 직접 변경한다. 외부에서 직접 호출 시 `sendMessage`가 관리하는 `isStreaming`·`abortController` 같은 스트리밍 생애주기 상태와 어긋날 수 있다.
- 제안: JSDoc의 "production callers go through `sendMessage`" 경고는 적절하나, 추후 실수 방지를 위해 `@internal` TSDoc 태그를 추가하거나, 테스트용 별도 파일(`__test_utils__`)로 분리하는 방안 검토

---

**[INFO] `editsSinceLastFinishBlock` 카운터 — `propose_plan` 성공도 진척으로 카운트**
- 위치: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` `:451~460`
- 상세: `kind === 'plan' && ok === true` 조건이 `editsSinceLastFinishBlock` 를 증가시킨다. `propose_plan`으로 기존 plan을 단순 수정(예: step 재정렬)만 하고 finish를 호출하면, `finishBlockCount > 0` 이고 `editsSinceLastFinishBlock > 0` 이므로 guard가 다시 발동한다. 새 plan의 pending steps를 재평가하므로 결과는 정확하지만, LLM이 step을 실행하지 않고 plan을 반복 제안하는 패턴에서 round가 예상보다 늘어날 수 있다. `toolCallsBudget`이 절대 상한으로 무한 루프를 방어하므로 안전상 문제는 없다.
- 제안: 현재 구현은 허용 가능. 향후 모니터링 시 `propose_plan` 반복 호출 패턴이 관찰되면 `clear_plan + propose_plan` 쌍만 진척으로 인정하는 방향 검토

---

### 요약

이번 변경은 plan-only 턴의 불필요한 prose 제거(프롬프트·클라이언트 힌트 주입), finish 가드의 progress-aware 재발동 두 가지 의도된 동작 변경을 일관성 있게 적용했다. 파일시스템·네트워크·환경 변수에 대한 의도치 않은 부작용은 없으며, 시그니처 변경도 내부 전용으로 호출 지점이 모두 업데이트됐다. 다만 프론트엔드 힌트 우선순위(`completed` vs `planApprove` 순서)가 스펙 주석과 다르게 구현된 점이 가장 주의할 불일치이고, 내부 함수 두 개가 테스트 편의를 위해 공개된 것은 향후 오용 가능성을 만든다.

### 위험도

**LOW**