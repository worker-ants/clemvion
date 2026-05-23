# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/multiturn-error-preserve.md`
**검토 일시**: 2026-05-23
**검토 모드**: spec draft 검토 (--spec)
**이전 검토 참조**: `review/consistency/2026/05/23/16_30_17/cross_spec.md` (HIGH, C1·C2 CRITICAL 2건)

---

## 발견사항

### [INFO] C1' — plan 표기 정정 확인 (이전 C1 해소 방식)

- **target 위치**: Plan `## Open Questions` §OQ1 + `## 영향 spec` 표 전체
- **확인 대상**: 이전 검토의 C1 ("`_resumeState` DB strip 정책과 `_retryState` 보존 정책 충돌") 의 해소 표기 방식
- **상세**: 이전 검토 C1 에서 `(C1 해소)` `(C2 해소)` 형태의 표기를 사용할 것을 권고했으나, 현행 plan draft 의 영향 spec 표에는 해당 구문이 전혀 없다. 대신 모든 행이 `**(본 PR 갱신)**` 형태로 통일되어 있으며, OQ1 설명에 "consistency-check (`review/consistency/2026/05/23/16_30_17/`) 의 C1 Critical 은 ... 동반 갱신으로 해소" 로 기술하고 있다. 즉 plan 이 `(C1 해소)` / `(C2 해소)` 형태를 쓰지 않고 `(본 PR 갱신)` 으로 통일한 것은 plan 내 표기의 일관성을 위한 정정으로 볼 수 있다. 이전 검토의 C1 해소 방안 중 "`execution-engine.md §1.3` + `node-output.md Principle 4.2` + `ai-agent.md §7.4` 동반 갱신" 세 spec 행이 모두 `영향 spec` 표에 `(본 PR 갱신)` 으로 등록되어 있어 해소 의도는 충족된다.
- **현재 상태**: 정합. `(본 PR 갱신)` 표기가 이전 C1 의 `(C1 해소)` 표기 권고를 실질적으로 대체하고 있으며, OQ1 에서 이전 검토 보고서 경로를 명시적으로 인용하여 추적성을 확보하고 있다.
- **잔여 점검**: `spec/5-system/4-execution-engine.md §1.3`, `spec/conventions/node-output.md Principle 4.2`, `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 세 파일이 실제 spec draft 갱신 시 동시에 변경되는지는 구현 phase 에서 확인 필요. plan 의 표기 자체는 일관하다.

---

### [WARNING] C2' — `interaction-type-registry.md §2.1` 행 추가 정합성

- **target 위치**: Plan `## 영향 spec` 표 — `spec/conventions/interaction-type-registry.md §2.1` 행
- **충돌 대상**: `spec/conventions/interaction-type-registry.md §2.1` 현행 표 (§2. ConversationTurnSource → §2.1 처리 분기 매트릭스)
- **상세**: 현행 `interaction-type-registry.md §2.1` 표는 5개 enum 값 (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`) 만 정의하며, `system_error` 행이 존재하지 않는다. plan 의 해당 행은 `**(본 PR 갱신 — AST 가드 충족)**` 으로 표기하고 분기 위치 3개를 명시하고 있다. 이는 이전 검토 C2 (INFO) 의 "interaction-type-registry 에 system_error 등록 여부 확인" 을 자기 인식하고 해소한 것으로 볼 수 있다.

  그러나 현행 `§2.1` 표의 `UI 분기 위치` 컬럼 형식은 "동일 함수 · 아이콘" 수준의 단문인데, plan 이 추가하려는 `system_error` 행의 설명은 분기 위치 3개 위치를 열거하는 방식이다. 형식이 기존 행과 다를 수 있으나 이는 충돌이 아니라 권고 사항이다.

  더 중요한 점은 `interaction-type-registry.md §2` 서두가 "값 5개 (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`)" 라고 명시적 카운트(5개)를 박고 있어, 여기에 `system_error` 를 추가할 때 서두의 값 수도 6개로 갱신해야 한다. plan 의 영향 spec 행 설명이 "분기 위치 3개 명시" 만 언급하고 서두 카운트 갱신을 명시하지 않는다.
- **제안**: plan `## 영향 spec` 표의 `interaction-type-registry.md §2.1` 행 설명에 "§2 서두 값 카운트 `5 → 6` 갱신" 을 한 줄 추가. 누락 시 서두와 표 사이에 drift 발생.

---

### [INFO] `_retryState` handler return top-level 위치 — plan 명시 상태

- **target 위치**: Plan §C `_retryState 의 handler return 위치 — _resumeState 와 동일하게 top-level` 문단
- **충돌 대상**: `spec/conventions/node-output.md` Principle 0 ("5필드는 불변: `config`/`output`/`meta?`/`port?`/`status?`") + Principle 4.2 (`_resumeState` 비노출 정의)
- **상세**: plan 은 "`_retryState` 는 `NodeHandlerOutput` Principle 0 의 5필드 외 internal top-level 필드로 위치 — `_resumeState` 와 동일 패턴" 이라고 명시하고 있다. 현행 `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 `_resumeState` 주석 (`_resumeState 는 output 외부 top-level 필드다`) 과 정합한다. Principle 0 은 5필드를 "불변" 이라고 하지만 `_resumeState` 가 이미 top-level 6번째 필드로 운용되고 있으므로 Principle 0 의 "5필드" 기술이 실제로는 "5가지 공식 필드" 의 의미이고 internal 필드는 별도 취급임이 §7.4 와 §7.5 의 JSON 예시에서 일관하게 드러난다.

  plan 이 `_retryState` 의 위치를 명시하고 영향 spec (`spec/4-nodes/3-ai/1-ai-agent.md §7.9` JSON 예시에 top-level 추가) 을 지정한 것은 정합하다. 단, `spec/conventions/node-output.md Principle 0` 본문이 "5필드는 불변" 이라고 쓰여있어 독자가 혼란을 겪을 수 있다. `_resumeState` 의 top-level 위치 근거는 §7.4 에만 있고 Principle 0 에는 없다.
- **제안**: plan 의 `node-output.md Principle 4.2` 갱신 행에 "Principle 0 비고에 `_resumeState` / `_retryState` 는 internal top-level 필드로 5필드 외 위치함을 주석 추가" 를 포함하면 spec 독자의 혼란을 방지할 수 있다. plan 이 이를 명시하지 않아도 기술적 충돌은 아니다 (INFO).

---

### [INFO] `external-interaction-api.md` EIA-IN-02 와 §4.6 매핑표 "외부 미노출" 정합 확인

- **target 위치**: Plan `## 영향 spec` 표 — `spec/5-system/14-external-interaction-api.md` EIA-IN-02 행 + `spec/5-system/6-websocket-protocol.md` §4.6 행
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §3.2` EIA-IN-02 현행 정의 ("지원 명령: `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel`") + `spec/5-system/6-websocket-protocol.md §4.6` 현행 `Client → Server 명령 매핑` 표
- **상세**: plan 은 `retry_last_turn` 을 EIA-IN-02 의 외부 허용 command 목록에 포함시키지 않고, §4.6 매핑표에 "외부 미노출" 로 명시하는 이중 경로를 취한다. 현행 EIA-IN-02 와 §4.6 표를 비교하면:

  - 현행 EIA-IN-02: `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel` (5종)
  - 현행 §4.6 표: 동일 5종의 WS 명령에 대응하는 외부 REST 명령, 그 외 `execution.start` / `execution.continue` / `execution.step` / `auth.refresh` / `subscribe` / `unsubscribe` 은 "(외부 미지원)" 으로 기재

  plan 이 §4.6 표에 `execution.retry_last_turn` 행을 추가하되 "외부 미노출" 로 기재하는 것은 기존 §4.6 의 "(외부 미지원)" 패턴과 일치한다. EIA-IN-02 를 갱신해 "본 목록에 `retry_last_turn` 미포함 + 미노출 사유 주석" 을 추가하는 방식도 §4.6 의 마스터 표와 EIA spec 사이에 정합성을 유지한다.

  단, 현행 §4.6 표에 "(외부 미지원)" 항목들은 표의 행 형식이 "내부 WS 명령 → 외부 REST 명령 (없음)" 의 2열 표다. `execution.retry_last_turn` 을 "외부 미노출" 로 추가하면 신규 행이 기존 "(외부 미지원)" 의미와 **다른 이유** (외부 미지원이 아니라 외부 표면 미노출 — 향후 노출 예정) 임을 §4.6 비고에 명시해야 한다. 그렇지 않으면 `execution.start` (원천적으로 외부 webhook 으로 대체됨) 와 `execution.retry_last_turn` (현재 미노출, 향후 노출 예정) 의 의미 차이가 사라진다.
- **제안**: plan 의 `spec/5-system/6-websocket-protocol.md §4.6` 행 설명에 "표의 비고 셀에 `retry_last_turn` 미노출이 '원칙적 배제' 가 아니라 '1차 범위 외 — 별 PR 에서 외부 노출 예정' 임을 명시" 를 추가하면 §4.6 독자의 오해를 방지할 수 있다. plan 의 EIA-IN-02 행 설명에 이미 "별 PR 에서 다룬다" 는 사유가 있어 내용 자체는 정합하나, §4.6 표 비고에 이를 전달하는 명시가 plan 에 기술되지 않은 것이 INFO 수준의 미흡이다.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.1` payload `error` 구조 명시 — 이전 C2 WARNING 잔여 해소 확인

- **target 위치**: Plan `## 영향 spec` 표 `spec/5-system/6-websocket-protocol.md §4.1` 행
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.1` 현행 표 — `execution.node.failed` 의 payload 가 `{ executionId, nodeId, nodeExecutionId, nodeName, error }` 로 기재되어 있으며 `error` 의 내부 shape 이 정의되지 않음
- **상세**: 이전 검토 C2 WARNING ("execution.node.failed payload 의 error 가 output.error 풀 구조를 운반한다는 가정이 검증되지 않음") 에 대해 plan 의 `§4.1` 행이 "`execution.node.failed` payload `error` 필드 shape 을 `output.error` 전체 구조 (`{ code, message, details?: { retryable?, retryAfterSec?, ... } }`) 로 명시" 로 갱신 내용을 정확히 기술하고 있다. `execution.node.completed` payload `output` 도 `output.error` 동봉 시 동일 구조로 명시한다.

  이는 이전 WARNING 의 해소 방안과 일치한다. 그러나 `§4.1` 의 현행 표는 `output` 없이 단순 `{ executionId, nodeId, nodeExecutionId, nodeName, error }` 형태이고, plan 갱신 이후에는 `execution.node.completed` payload 에 기존에 없던 `output.error` 필드가 조건부로 추가된다. 이는 `execution.node.completed` payload 의 **하위 호환 확장** (기존 payload 에 선택 필드 추가) 이지만, 기존 WS spec 의 해당 표 행에 명시되지 않은 변경이다.

  spec 구현 phase 에서 기존 `execution.node.completed` 의 `output` 필드가 이미 `NodeHandlerOutput.output` 전체를 전달하는지 (즉 error port 종결 시 `output.error` 가 이미 동봉되는지) 확인이 필요하다. 만약 현재 구현에서 `output.error` 가 이미 동봉된다면 plan 의 §4.1 갱신은 "명시화" 이고, 미동봉이라면 "신규 emit 추가" 이다. 후자일 경우 기존 WS 클라이언트 코드가 `output.error` 를 새로 처리해야 한다.
- **제안**: plan 의 `§4.1` 갱신 행 설명에 "현재 `node.completed` 의 `output` 필드가 error port 종결 시에도 `output.error` 를 동봉하는지 구현 확인 — 미동봉이면 신규 emit 추가, 이미 동봉이면 spec 명시화" 를 구현 착수 전 체크 사항으로 표기 권고.

---

### [WARNING] `interaction-type-registry.md §2.1` 에 `system_error` 추가 시 `exhaustiveness test` AST 가드 범위 — `conversation-inspector.tsx` 렌더 분기 누락 가능성

- **target 위치**: Plan `## 영향 spec` 표 `spec/conventions/interaction-type-registry.md §2.1` 행 — "분기 위치 3개 명시: `threadTurnsToConversationItems` switch, `ConversationTimelineItem` 렌더 분기 (`conversation-inspector.tsx` + `result-timeline.tsx`), `conversation-thread.md §9.1` 매핑표"
- **충돌 대상**: `spec/conventions/interaction-type-registry.md §2.1` 현행 표의 기존 5개 enum 행 — 각 행의 UI 분기 위치 컬럼이 `threadTurnsToConversationItems` 의 source switch 와 `ConversationTimelineItem` 렌더 분기 두 위치만 나열
- **상세**: plan 이 명시하는 분기 위치 3개 중 첫 번째(`threadTurnsToConversationItems` switch)와 두 번째(`conversation-inspector.tsx` + `result-timeline.tsx`) 는 기존 enum 행과 형식이 일치한다. 세 번째로 명시된 `conversation-thread.md §9.1 매핑표` 는 spec 문서 내 매핑이지, 코드 분기 위치가 아니다.

  현행 `§2.1` 의 AST 가드 규칙(§1.2 규칙 3)은 "매트릭스의 모든 enum 값이 각 처리 위치에 명시적으로 등장하는지 grep 검증" 한다. 이 grep 대상은 코드 파일이어야 하는데, `conversation-thread.md §9.1` 은 spec 파일이므로 AST 가드의 grep 범위 밖이다. plan 이 "AST 가드 충족" 이라고 명시하려면 코드 레벨 분기 위치 3개가 모두 코드 파일이어야 한다.

  `conversation-thread.md §9.1` 이 "소스" 역할의 SoT 이고 실제 코드 분기는 `conversation-inspector.tsx` + `result-timeline.tsx` 에 있다면, 매트릭스 행의 3번째 항목은 spec cross-ref 이지 AST 가드 대상이 아니다. 이를 "AST 가드 충족" 이라고 표기하면 오해를 부른다.
- **제안**: plan 의 `interaction-type-registry.md §2.1` 행 설명에서 세 번째 분기 위치를 "spec §9.1 매핑표 (cross-ref, AST 가드 비대상)" 으로 명시하고 AST 가드 대상 코드 파일은 2개(`conversation-utils.ts` switch + `conversation-inspector.tsx` / `result-timeline.tsx` 렌더 분기) 임을 명확히 할 것. plan 이 "AST 가드 충족" 이라고 단언하려면 대상 분기 위치가 코드 파일이어야 한다.

---

### [WARNING] `_retryState` 를 `output` 형제로 명시 — Principle 0 의 "5필드 불변" 과 잠재 오해

- **target 위치**: Plan §C `_retryState 의 handler return 위치` 문단 — "`output.error` 와 같은 레벨이 아니라 `output` 형제"
- **충돌 대상**: `spec/conventions/node-output.md Principle 0` — "모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다" + "이 5필드의 의미는 어떤 노드에서든 동일해야 합니다"
- **상세**: plan 은 `_retryState` 가 `_resumeState` 와 동일한 top-level internal 필드라고 명시하면서도, `Principle 0` 은 "5필드는 불변" 이라고 쓰고 있다. 현재 `_resumeState` 가 이미 Principle 0 의 5필드 외 6번째 top-level 필드로 운용되고 있어 이 모순은 `_resumeState` 도입 이전부터 있었던 기술 부채다.

  `Principle 4.2` 갱신 대상에 `_retryState strip 예외` 가 포함되어 있으나 `Principle 0` 자체를 갱신하는 내용은 plan 의 영향 spec 표에 없다. spec 독자가 Principle 0 을 읽고 `_retryState` 나 `_resumeState` 가 handler return 의 허용 필드임을 알 수 없어 implementation 시 혼란 가능성이 있다.
- **제안**: plan 영향 spec 표에 `spec/conventions/node-output.md Principle 0` 비고 갱신 행을 추가해 "internal top-level 필드 (`_resumeState`, `_retryState`) 는 5필드 외 허용 예외 — Principle 4.2 참조" 주석을 붙이도록 명시. 없어도 기술적 작동은 가능하나 spec reader 혼란 유발 가능성이 있어 WARNING.

---

### [INFO] `execution.retry_last_turn` ack 패턴 — 이전 C2 CRITICAL 완전 해소

- **target 위치**: Plan §C "새 WS 명령 `execution.retry_last_turn`" + ack 타입/payload 상세 기술
- **확인 대상**: 이전 검토의 C2 CRITICAL ("ack type 형태 미명시") 해소 여부
- **상세**: 이전 검토 C2 CRITICAL 은 "ack type 형태 (`execution.retry_last_turn.ack`) 를 명시하라" 는 지적이었다. 현행 plan draft 는 ack type (`execution.retry_last_turn.ack`), ack payload 성공 (`{ executionId, nodeExecutionId, resumed: true }`), ack payload 실패 (`{ executionId, nodeExecutionId, resumed: false, error: { code, message } }`), 에러 코드 3종 (`INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`) 을 모두 명시하고 있다. `execution.click_button.ack` 의 `resumed` 패턴과 `execution.submit_form` reject 의 `error` 패턴을 결합한 형태로, 기존 §4.2 ack 패턴과 일치한다.

  이는 C2 CRITICAL 을 완전히 해소한다. 추가로 `nodeId` 대신 `nodeExecutionId` 를 사용하는 사유를 §4.2 비고에 명시하겠다는 계획도 있어 spec reader 의 혼란 예방까지 커버된다.
- **현재 상태**: 완전 해소. 잔여 충돌 없음.

---

### [INFO] `resumeToken` 필드 제거 — 이전 검토 WARNING 완전 해소

- **target 위치**: Plan §C R1 결정 설명 — "`resumeToken` 필드는 plan 초안에서 제거. WS payload 가 `nodeExecutionId` 만으로 충분히 식별 가능. token 의 추가 의미가 없어 spec 면적·보안 표면 모두 축소"
- **충돌 대상**: 이전 검토의 WARNING ("output.error.details.resumeToken 의 FE 사용 여부 불명확")
- **상세**: 이전 검토의 WARNING 에서 `resumeToken` 필드가 `output.error.details` 에 있으나 FE 가 실제로 사용하지 않아 존재 이유가 불명확하다고 지적했다. 현행 plan draft 는 이 필드를 명시적으로 제거하고 사유("token 의 추가 의미가 없어 spec 면적·보안 표면 모두 축소")를 기술했다. `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 갱신 행도 "`resumeToken` 은 R1 결정으로 미사용 — 제거" 로 명시되어 있다.
- **현재 상태**: 완전 해소.

---

## 요약

이번 검토는 이전 검토(`16_30_17/`) 의 CRITICAL 2건·WARNING 4건·INFO 3건을 기반으로 plan draft 가 어떻게 갱신되었는지를 집중 검토했다. 4가지 중점 확인 사항에 대한 판정: (1) C1' — plan 표기 `(본 PR 갱신)` 으로 통일된 것이 `(C1 해소)` 표기 권고의 실질적 대체이며 OQ1 에 추적성이 확보되어 정합함. (2) C2' — `interaction-type-registry.md §2.1` 행이 영향 spec 표에 등록되어 있으나, §2 서두의 enum 값 카운트(`5개` → `6개`) 갱신이 plan 행 설명에 누락되어 WARNING. (3) `_retryState` handler return top-level 위치 — plan 에 명시되어 있고 `_resumeState` 패턴과 일관성 확보, Principle 0 비고 갱신이 영향 spec 표에 포함되지 않아 spec 독자 혼란 가능성이 INFO 수준으로 남음. (4) EIA-IN-02 와 §4.6 매핑표 외부 미노출 정합 — 미노출 결정 자체는 양 spec 행에 일관하게 기술되어 있으나, §4.6 표의 비고에 "`retry_last_turn` 미노출이 원칙적 배제가 아니라 향후 노출 예정" 임을 명시하도록 plan 에 기술되지 않아 INFO 수준의 미흡이 남음. 전반적으로 이전 검토 대비 CRITICAL 2건 모두 해소되었고 주요 WARNING 도 대부분 구체화되었다. 신규 발견 사항 중 가장 주의가 필요한 것은 `§4.1` 의 `node.completed` output.error 동봉 여부 구현 확인 누락(WARNING) 과 `interaction-type-registry §2.1` AST 가드 범위 오기(WARNING) 두 건이다.

---

## 위험도

**LOW**

STATUS: SUCCESS
