# Cross-Spec 일관성 검토 — `presentation-previousoutput-spec-drift` (plan draft)

## 검토 방법

target plan(`plan/in-progress/presentation-previousoutput-spec-drift.md`)이 제안하는 4+2건의 spec 문구 수정을
실제 저장소 상태(`spec/**`, `codebase/backend/**`)와 대조해 사실관계·인용 anchor·범위 완결성을 실측 검증했다.

- `spec/conventions/node-output.md` §4.2 / §4.2.1 원문 확인 — target 의 인용과 정확히 일치.
- `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:287-294` 코드 주석 확인 —
  target 인용("legacy transitional field … Do NOT add new consumers … Removal is tracked as a Phase 3
  precondition")과 정확히 일치.
- `spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md` 의 4개 대상 위치 전수 grep — target 표와 정확히 일치
  (`1-carousel.md`/`2-table.md`/`5-template.md` 에는 `previousOutput` 언급 없음도 확인됨).
- `spec/5-system/4-execution-engine.md` §7.4(:893) / §9.3(:1162) 확인 — Continuation Bus 메시지 타입이 실제로
  **6종**(`continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`)임을 재확인.
  presentation `0-common.md`(§10.9, line 394/426)는 여전히 "5종"으로 남아 있어 target 의 "동반 정정 A" 근거 확인.
- `ai-turn-orchestrator.service.ts` / `retry-turn.service.ts` 확인 — `processAiResumeTurn`(dispatch) vs
  `RetryTurnService`(retry_last_turn 별도 경로) 분리 구조가 target 의 "동반 정정 B" 서술과 일치.
- 나머지 spec 트리에서 "Continuation Bus 5종/6종" 관련 잔존 drift 여부(다른 문서가 같은 문제를 갖는지) 를
  `ai_end_conversation` 키워드로 전수 grep — presentation 영역 밖에는 해당 서술이 없음을 확인 (범위 누락 없음).
- frontend `presentation-renderers.tsx:526-550` 이 `previousOutput` 의 기존(pre-existing) 실 consumer 임을 확인 —
  target 이 "신규 소비 금지"라고만 서술하고 기존 소비자 존재를 부정하지 않으므로 모순은 아님.

## 발견사항

- **[INFO]** "동반 정정 A" 대상 위치 수 표기(`3곳`)가 실측(`2곳`)과 다름
  - target 위치: `## 동반 정정` 표 A행 — "`0-common.md` §10.9 본문·Rationale·'4-layer SSOT 정렬' **3곳**"
  - 충돌 대상: `spec/4-nodes/6-presentation/0-common.md`
  - 상세: `grep -n "5종" 0-common.md` 결과 "Continuation Bus 메시지 타입 5종" 표현은 **line 394(§10.9 본문)와
    line 426("4-layer SSOT 정렬")** 두 곳뿐이다. "4-layer SSOT 정렬"은 §10.9 자체의 하위 소제목이지 별도
    `## Rationale` 섹션이 아니다(문서의 `## Rationale`은 line 432부터 시작하며 그 안에는 "5종/6종" 문구가 없다).
    즉 target 이 "본문·Rationale·4-layer SSOT 정렬"을 3개 별개 지점으로 센 것은 실제로는 2개 지점(§10.9 본문 안의
    두 문장)을 3개로 과다 산정한 것으로 보인다. cross-spec 충돌은 아니지만, 구현 시 "3번째 지점"을 찾다가 존재하지
    않는 위치를 찾아 헤매거나, 반대로 Rationale 섹션에 실제로는 없는 "5종" 문구를 새로 만들어 넣는 과잉 수정으로
    이어질 위험이 있다.
  - 제안: 개정 시 실제 위치는 line 394·426 두 곳(둘 다 §10.9 본문 내부)임을 재확인하고 체크리스트 문구를
    "본문 2곳(§10.9 서술 + 4-layer SSOT 정렬 목록)"으로 정정.

- **[INFO]** node-output.md §4.2 와 제안 문구의 구조적 표현 방식 차이
  - target 위치: `## 개정 방침` "제안 문구" 1·2·4 — `previousOutput` 을 "폐기/금지" 열거 목록에서 **분리**해
    별도 각주로 뺀다.
  - 충돌 대상: `spec/conventions/node-output.md` §4.2 (value-domain SoT)
  - 상세: SoT 인 node-output.md §4.2 는 `previousOutput` 을 "폐기할 필드" 목록 **안에 유지한 채** 같은 불릿
    안에서 "단 Phase 3 완료 전 과도기 예외" 캐비어를 붙이는 구조를 쓴다. target 은 presentation 4곳에서는 반대로
    목록에서 **제거**하고 별도 각주로 분리하는 구조를 제안한다. 사실관계(필드가 존재하고 신규 소비 금지)는 두
    문서가 동일하게 전달하므로 모순은 아니지만, SoT 문서와 하위 문서가 같은 사실을 서로 다른 문서 구조 관용구로
    표현하게 된다 — 향후 또 다른 문서가 이 필드를 언급할 때 어느 패턴을 따라야 할지 판단 기준이 없다.
  - 제안: 사소하므로 필수는 아니나, Rationale 에 "왜 node-output.md 와 다른 구조(목록 제거 vs 목록 유지)를
    택했는지" 한 줄 근거를 남기면 이후 유지보수자의 혼란을 줄인다.

- **[INFO]** `previousOutput` 의 기존 frontend consumer 존재는 target Rationale 에 미언급
  - target 위치: `## 비목표` / `## Rationale`
  - 충돌 대상: `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:526-550`
    (Structured resume shape 분기에서 `raw.previousOutput` 을 실제로 읽어 렌더링에 사용)
  - 상세: target 은 "신규 소비 금지"만 서술하며 기존 소비자 유무는 언급하지 않는다. 실측 결과 frontend Run
    Results Drawer 렌더러가 이미 `previousOutput` 을 소비하는 **기존(pre-existing) consumer**다. target 의
    서술과 직접 모순되지는 않으나(“신규” 소비를 금지하는 것이지 기존 소비자 존재를 부정하지 않음), 이 사실을
    Rationale 에 명시하면 "왜 아직 제거하면 안 되는가"의 근거가 코드(backend 주입)뿐 아니라 프런트 소비 측에서도
    보강되어, 향후 Phase 3 착수 시 backend/frontend 동시 제거가 필요하다는 점을 놓치지 않게 된다.
  - 제안: Rationale 에 "frontend `presentation-renderers.tsx` 도 현재 이 필드를 읽는 기존 consumer — Phase 3
    제거 시 코드·spec·frontend 3자 동시 정리 필요" 를 한 줄 추가 권고(선택적, 정확도 향상 목적).

검증된 사실관계는 모두 target 의 주장과 일치했다 — `_resumeCheckpoint`/`_retryState` 관련 anchor(`node-output.md
#42-폐기할-필드--구조`)는 기존에 `1-ai-agent.md`에서도 동일 형식으로 사용 중인 유효 anchor이며, "동반 정정 B"의
`processAiResumeTurn`/`waitForAiConversation`/`RetryTurnService` 구분도 실제 코드 구조와 일치한다. 데이터 모델,
API 계약, 요구사항 ID, RBAC, 상태 머신 자체의 정의는 target 이 전혀 건드리지 않는다(순수 서술 정정).

## 요약

target 문서는 이미 존재하던 cross-spec drift(코드/`node-output.md` §4.2 대 presentation 4개 문서)를 바로잡는
정정 작업이며, 제안 문구 자체를 코드·SoT 문서·실행 엔진 spec 과 전수 대조한 결과 새로운 모순을 만들지 않는다.
"동반 정정 A"(5종→6종)도 실측 결과 실제 drift이며 수정 범위가 presentation 영역 밖으로 누락된 곳 없이 정확히
경계져 있다. 발견된 사항은 모두 INFO 등급으로, 위치 개수 과다산정 1건과 서술 구조·완결성 관련 사소한 개선 여지
2건뿐이다.

## 위험도
LOW
