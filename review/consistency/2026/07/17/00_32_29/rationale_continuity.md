# Rationale 연속성 검토 결과

- target: `plan/in-progress/ai-node-failed-conversation-preview.md`
- 검토 모드: spec draft 검토 (`--spec`)
- 대조 대상: `spec/conventions/conversation-thread.md` (§8 Rationale, §9), `spec/3-workflow-editor/3-execution.md` (§10.6.1), `spec/3-workflow-editor/_product-overview.md` (ED-EX-13), `spec/2-navigation/14-execution-history.md`

## 발견사항

- **[CRITICAL]** "기본 탭 정책" 이 기존에 명시적으로 좁게 scope 된 "retryable 전용" 예외를 무근거로 전체 대화형 노드 실패로 확장
  - target 위치: `plan/in-progress/ai-node-failed-conversation-preview.md` Phase 1 항목 3 — "**기본 탭 정책** — 대화형 노드는 `result.error` 가 있어도 미리보기를 기본 선택 (오류 탭은 명시적 선택). 현재 result-detail.tsx:999 는 무조건 오류 탭."
  - 과거 결정 출처:
    - `spec/3-workflow-editor/3-execution.md:510-515` — "디폴트 탭 선택 우선순위: 1. Error — 에러가 있으면 최우선 / 2. Preview / 3. Output" + 바로 아래 blockquote: "**AI multi-turn retryable error 종결 시 예외**: AI Agent multi-turn 이 `port: 'error'` + `details.retryable === true` 로 종결된 경우에는 **Preview 우선**" (Error 탭은 여전히 `output.error` JSON 으로 접근 가능, 디버깅 용도)
    - `spec/3-workflow-editor/_product-overview.md:121` — `ED-EX-13`(필수): "서브 탭 기본 선택 우선순위: Error(에러 발생 시) > Preview (Presentation·AI 대화형·Form/버튼 대기 시) > Output"
    - `spec/2-navigation/14-execution-history.md:213` — "기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output (§10.6.1 의 **retryable-error Preview 예외**·auto-fallback 포함)" — 이력 화면도 같은 SoT(§10.6.1)를 재확인
  - 상세: 기존 spec 은 "Error 탭 최우선" 을 `필수` 로 못박은 뒤, 오직 **`port: 'error'` + `details.retryable === true`** 로 종결된 AI multi-turn 1개 케이스에만 Preview 우선 예외를 명시적으로 부여했다 (재시도 버튼이 Preview 안에 있기 때문이라는 근거까지 명시). target 의 Phase 1 항목 3 은 이 예외를 "대화형 노드는 `result.error` 가 있어도 미리보기를 기본 선택" 으로 조건 없이 일반화한다 — `retryable` 여부도, `port:'error'`(status completed) 대 `node.failed`(status failed) 구분도 언급하지 않는다. 이대로 구현되면 (a) `retryable === false`(예: 인증 실패, `_retryState` 미동봉·재시도 버튼 미노출 케이스, CT-S10) 인 대화형 노드까지 Preview 가 기본 탭이 되어 "재시도 가능성이 있을 때만 Preview 우선" 이라는 기존 근거가 무의미해지고, (b) `ED-EX-13`(필수) 문구 자체와 충돌한다. target 의 "결정 기록" 절에는 이 탭 정책 확장에 대한 Rationale 이 전혀 없다 (기록된 결정은 "store 를 1차 소스로", "systemError.nodeId 로 귀속 판정" 2건뿐).
  - 제안: Phase 1 항목 3 을 "retryable === true (재시도 가능) 대화형 노드 실패 한정" 으로 명시적으로 좁히거나, 조건 없이 넓히길 의도한다면 그 자체를 새 결정으로 `conversation-thread.md` §8 또는 `3-execution.md` 에 Rationale 로 남기고 `ED-EX-13` 문구·§10.6.1 blockquote 예외 조항을 함께 개정해야 한다. 후자를 선택할 경우 CT-S10(non-retryable, 재시도 버튼 미노출)에 대응하는 탭 기본값 시나리오도 CT-S15/S16 후보에 함께 정의해 회귀 차단 표(§9.10)에 반영할 것.

- **[INFO]** §9.3 "데이터 소스 선택" 신규 행이 §8.1/D4 의 "1차 소스 = conversationThread snapshot" 원칙과 별개 소스처럼 보일 위험
  - target 위치: Phase 1 항목 1 — "§9.3 데이터 소스 선택 표에 행 추가 — `node.failed` 종결 대화형 노드의 1차 소스 = store `conversationMessages`"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8.1 "emit messages 를 conversation Preview 에서 격리한 이유" — "conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 둔다" (D4) + §9.3 기존 표의 "conversation Preview 탭" 행 (1차 소스 = `conversationThread.turns` snapshot)
  - 상세: `conversationMessages`(store) 는 §9.7 의 WS 이벤트 매핑(`threadTurnsToConversationItems` 등)을 거쳐 `conversationThread.turns` snapshot 으로부터 파생되는 사본이지 별도 소스가 아니다. 신규 행을 "store 가 1차 소스" 로만 서술하면, 독자가 §8.1/D4 의 "conversationThread snapshot 단일 1차 소스" 원칙과 모순되는 두 번째 소스가 신설된 것으로 오독할 수 있다 — 내용상 충돌은 아니나 표현이 이전 결정과 나란히 놓였을 때 정합성이 흐려진다.
  - 제안: 신규 행 비고에 "store `conversationMessages` 는 §9.7 을 통해 `conversationThread.turns` 를 반영한 사본이며 D4 원칙의 연장" 임을 한 문장으로 명시해 §8.1 결정과의 계보를 드러낼 것.

## 요약

target plan 은 근본 원인 진단(§9.7.1 store reset 정책·Inv-6·§9.3 1차 소스 규정)과 스코프 결정(이력 뷰 복원은 EH-DETAIL-12 v2 로 명시적으로 이월, `systemError.nodeId` 귀속 판정은 §1.2.1 payload 정의와 일치)에서 기존 Rationale 과 대체로 정합적이며, "결정 기록" 절도 과거 결정(§9.3 D4, §1.2.1)을 명시적으로 인용해 계보를 잘 유지한다. 다만 Phase 1 "기본 탭 정책" 항목 하나가 `spec/3-workflow-editor/3-execution.md §10.6.1` 이 이미 `port:'error'` + `retryable===true` 로 좁게 scope 해 둔 "Preview 우선 예외" 를 조건 없이 "대화형 노드 실패 전체" 로 확장하면서 새 Rationale 을 남기지 않아, `ED-EX-13`(필수: Error > Preview) 과 직접 충돌할 소지가 있다. 이 한 항목만 명시적 조건화(또는 의도적 확장이라면 대응 Rationale 개정)로 정리하면 나머지는 특별한 연속성 위험이 없다.

## 위험도

HIGH
