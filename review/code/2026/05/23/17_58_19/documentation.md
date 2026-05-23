# Documentation Review

**대상 변경**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정

**리뷰 파일**: 15개 (backend service + tests, frontend hook + tests, spec 3종, plan, consistency review artifacts)

---

## 발견사항

### [INFO] 인라인 주석 품질 — execution-engine.service.ts
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L535~L168, L1742~L1193
- 상세: `registerContinuationHandlers` 의 `'continue'` listener 에 추가된 주석(`spec/4-nodes/6-presentation/0-common.md §10.9`) 과 `waitForAiConversation` 의 `submitted` unwrap 로직 주석이 모두 변경의 목적·spec cross-ref·back-compat 이유를 명시하고 있다. `else` 분기의 warn log 도 실행 ID와 action.type 을 포함해 운영 진단에 충분한 컨텍스트를 제공한다. 개선할 여지가 없는 수준.
- 제안: 해당 없음.

### [INFO] 인라인 주석 품질 — use-execution-interaction-commands.ts
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` L679~L687
- 상세: `submitForm` 내 신규 optimistic UI 로직에 달린 블록 주석(사용자 보고 날짜, root cause, spec cross-ref, dedup 자연 발생 설명)이 충분히 명확하다. ack 실패 콜백 내 인라인 주석도 `sendMessage` 와의 평행 패턴을 언급해 유지보수자가 패턴을 파악하기 좋다.
- 제안: 해당 없음.

### [INFO] JSDoc/독스트링 — ExecutionInteractionCommands 인터페이스
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` L783~L794
- 상세: `submitForm` 의 JSDoc 한 줄 (`/** Submit a form waiting node's filled values and resume the execution. */`) 이 기존 그대로 유지된다. 신규로 추가된 optimistic UI 사이드이펙트(conversation store 에 `presentation_user` turn 추가, `isWaitingAiResponse` 설정, ack 실패 시 rollback) 가 JSDoc 에 반영되어 있지 않다. 외부 소비자가 store 변경 사이드이펙트를 JSDoc 만으로는 알 수 없다.
- 제안: `submitForm` JSDoc 을 다음과 같이 보강:
  ```
  /**
   * Submit form data and resume the execution. Also appends an optimistic
   * `presentation_user` turn to the conversation store and activates the
   * AI-response spinner — mirroring `sendMessage` behaviour. On WS ack
   * failure the spinner is cleared; the optimistic turn is retained so the
   * user can see what was submitted.
   */
  ```

### [INFO] 독스트링 누락 — useExecutionInteractionCommands 함수 본문 JSDoc
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` L797~L800
- 상세: 함수 레벨 JSDoc (`/** Wraps WebSocket commands... */`) 은 "Also updates the conversation store for AI chat so the user's own message appears immediately" 라고 명시하지만, `submitForm` 이 추가됨에 따라 이 문장이 AI chat 에만 국한된 것처럼 읽힌다. form 제출도 동일 패턴임을 언급하면 더 정확하다.
- 제안: "Also updates the conversation store for AI chat and form submission so the user's action appears immediately..." 로 수정.

### [INFO] 테스트 파일 인라인 주석 — 중복 블록 주석
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` L259~L262, L413~L416
- 상세: diff 에서 추가된 4개 테스트 케이스 블록 앞의 주석(`spec/4-nodes/6-presentation/0-common.md §Rationale (form submission wire format wrap)...`)이 첫 번째 케이스 앞에만 있는 것이 아니라 전체 파일에서 보면 동일 주석이 두 곳에 있는 것처럼 읽힌다. diff 에서 새로 추가된 블록에도, 전체 파일 컨텍스트에도 같은 주석이 있다. 중복 주석이 아닌 것은 확인되지만(diff 블록과 기존 파일 경계), 가독성을 위해 테스트 `describe` 상단 또는 `it` 블록 직전 한 곳에만 두는 것이 더 깔끔하다.
- 제안: 주석을 `describe` 블록 상단의 공통 단락으로 이동하거나, 첫 번째 `it` 앞에만 두고 나머지 `it` 에서는 제거.

### [WARNING] spec 문서 내 anchor ID 불일치 가능성
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 신설 본문의 cross-ref 링크 `#109-form-submission-wire-format-internal-bus-sentinel`
- 상세: `spec/5-system/6-websocket-protocol.md` 의 변경(L2103)과 `spec/4-nodes/3-ai/1-ai-agent.md` 의 변경(c.fallback 줄)에서 모두 `[Presentation 공통 §10.9](../6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel)` 형태의 anchor 를 사용한다. Markdown renderer 가 `### 10.9 Form submission wire format (internal bus sentinel)` 헤딩에서 생성하는 anchor 는 `#109-form-submission-wire-format-internal-bus-sentinel` 이다 (숫자 `10.9` → `109`, 소문자, 공백→`-`). GitHub 기준으로는 `.` 가 제거되어 `109` 가 맞다. 그러나 일부 Markdown 렌더러(예: Docusaurus, VitePress)는 `#10-9-form-submission-wire-format-internal-bus-sentinel` 으로 다르게 처리한다. 프로젝트가 사용하는 렌더러에서 실제로 anchor 가 유효한지 확인이 필요하다.
- 제안: 프로젝트 내 다른 spec 의 기존 anchor 패턴(예: `#107-conversationthread-운반`)과 일치하는지 확인. 기존 패턴이 동일 방식이면 정합.

### [INFO] CHANGELOG 업데이트 — spec/4-nodes/6-presentation/0-common.md
- 위치: `spec/4-nodes/6-presentation/0-common.md` §9 CHANGELOG
- 상세: 2026-05-23 항목이 추가되었고, 변경 내용(root cause, sentinel wrap, dispatch 4 케이스, Rationale cross-ref)을 모두 담고 있다. 형식도 기존 행과 일관된다. 문제 없음.
- 제안: 해당 없음.

### [INFO] plan 문서 TDD 체크리스트 미완 상태
- 위치: `plan/in-progress/render-form-submit-fix.md` §TDD 체크리스트
- 상세: 체크리스트 항목이 모두 `- [ ]` 미완 상태로 커밋되어 있다. 이는 코드 변경(backend service, frontend hook, tests 모두 포함)과 불일치한다. 코드가 구현·테스트까지 완료된 시점에 plan 체크리스트는 반영되어야 한다.
- 제안: 구현·테스트 완료된 항목은 `- [x]` 로 갱신. 특히 `(C) backend dispatch test 선작성`, `(C) backend 구현`, `(C) backend test PASS`, `(A) frontend test 선작성`, `(A) frontend submitForm optimistic UI 구현`, `(A) frontend test PASS` 항목은 이미 완료 상태로 보인다.

### [INFO] spec 문서 §10.9 본문 내 4-SSOT 정렬 목록 중복
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 본문 말미 "4-layer SSOT 정렬" 단락, §Rationale `form submission wire format wrap (2026-05-23)` 말미 "4-layer SSOT 정렬" 단락
- 상세: 동일한 SSOT 정렬 목록이 §10.9 본문과 §Rationale 에 중복으로 존재한다. 단일 진실 원칙상 하나에만 두고 다른 곳에서 cross-ref 하는 것이 바람직하다. 중복이 있어도 내용은 일치하므로 기능적 문제는 없으나, 나중에 한쪽만 수정해 불일치가 생길 위험이 있다.
- 제안: §Rationale 의 SSOT 정렬 목록을 제거하고 "4-layer SSOT 정렬은 §10.9 참조" 로 대체.

### [INFO] 환경변수·설정 변경 없음
- 상세: 이번 변경은 내부 dispatch 로직 변경이며 새 환경변수나 설정 옵션이 추가되지 않았다. 설정 문서 업데이트 불필요.

### [INFO] API 문서 — WS 프로토콜 표 업데이트
- 위치: `spec/5-system/6-websocket-protocol.md` §4.2 `execution.submit_form` 행
- 상세: 기존 셀 뒤에 `**외부 wire 호환**: ...` 문장이 추가되었다. 표 셀 안에 bold 마크다운이 포함되어 있어 렌더링이 지저분해질 수 있다. 표 바깥에 footnote 또는 비고 단락으로 빼는 것이 더 가독성이 좋다. 그러나 내용 자체는 명확하고 필요한 cross-ref 를 담고 있다.
- 제안: 비고를 표 아래 단락으로 이동(`> **외부 wire 호환**: ...`)하거나, 현재 형식 유지(기존 다른 행도 같은 방식으로 긴 설명을 셀에 담고 있음).

---

## 요약

이번 변경의 문서화 수준은 전반적으로 높다. backend service 파일의 인라인 주석이 변경 목적·spec cross-ref·회귀 방지 근거를 명확히 기술하고 있으며, spec 문서(`0-common.md §10.9`, `1-ai-agent.md §6.2 c.fallback`, `6-websocket-protocol.md §4.2`)가 모두 동기화되어 있다. §Rationale 에도 결정 근거가 충분히 담겨 있다. 주요 개선 기회는 두 가지다: `submitForm` JSDoc 이 신규 사이드이펙트(optimistic UI, store mutation)를 반영하지 않아 외부 소비자 안내가 부족한 점, 그리고 `plan/in-progress/render-form-submit-fix.md` 의 TDD 체크리스트가 이미 완료된 구현을 미완으로 표시하고 있는 점이다. 이 두 항목 외에는 CHANGELOG 업데이트, spec cross-ref, 인라인 주석 품질 모두 기준을 충족한다.

---

## 위험도

LOW
