## 발견사항

---

- **[WARNING]** 0-common.md 와 conversation-thread.md §2.3 의 v1 스코프 불일치
  - **target 위치**: spec-draft §2 "수정: 0-common.md" 의 §11 본문 "모든 AI 노드의 turn 누적 (자동 push) 은 v1 부터 적용된다" ↔ 신규 conversation-thread.md §2.3 "v1 은 `ai_agent` 만 자동 누적"
  - **과거 결정 출처**: 해당 내용은 과거 Rationale 위반이 아니라 draft 내부 모순이나, 기존 spec 에서 AI 노드 카테고리(text_classifier, information_extractor) 가 독립 구현을 가짐이 명시되어 있어 v1 경계가 모호해지면 구현자 혼선 가능
  - **상세**: 0-common.md 수정안은 "주입 동작(contextScope 활성화) = v1 ai_agent only, 하지만 turn 누적(push) = v1 전체 AI 노드"로 읽힌다. 그러나 conversation-thread.md §2.3 은 "v1 은 `ai_agent` 만 자동 누적"이라고 선언한다. 두 문서를 동시에 읽으면 text_classifier / information_extractor 가 v1 에서 turn 을 push 하는지 안 하는지가 결정되지 않는다.
  - **제안**: 두 위치 중 하나를 명확한 SoT 로 확정. 예: conversation-thread.md §2.3 의 "v1 은 `ai_agent` 만 자동 누적" 을 "v1 은 `ai_agent` 만 turn push 및 주입 동작 모두 구현. text_classifier / information_extractor 는 v2 에서 동일 인터페이스로 추가"로 확장하고, 0-common.md §11 의 "모든 AI 노드의 turn 누적은 v1부터" 문구를 "ai_agent 의 turn 누적은 v1부터" 로 좁힌다.

---

- **[INFO]** system_text 주입 모드에서 사용자 입력 텍스트의 prompt injection 위험에 대한 Rationale 부재
  - **target 위치**: conversation-thread.md §5.2 system_text 모드, §1.4 text 변환 규칙
  - **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale — "`sanitizeLlmProvidedString` ... 제어 문자·개행 제거, 백틱·꺾쇠 중화 ... LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다"
  - **상세**: 기존 Rationale 는 *LLM 이 생성한 문자열*이 system prompt 에 재주입될 때 sanitize 해야 한다는 invariant 를 확립했다. conversation-thread.md §1.4 에서 form_submitted 의 text 는 `name=John, age=30` 형태로 변환되어 system_text 모드 시 system prompt 끝에 첨부된다. end-user 가 form 필드에 "Ignore previous instructions..." 형태의 텍스트를 입력하면 동일한 injection 경로가 존재한다. 기존 `{{ $node.output }}` 표현식은 workflow 디자이너가 명시 참조하는 반면, thread 자동 주입은 모든 form 출력을 일괄 주입한다. `MAX_TURN_TEXT_CHARS: 4000` 으로 크기 제한이 있고 `excludeFromConversationThread` opt-out 이 있으나, text 변환 시 sanitization 정책이 Rationale 에 명시되지 않았다.
  - **제안**: conversation-thread.md §1.4 또는 §5.2 에 "system_text 모드에서 turn.text 를 system prompt 에 첨부할 때, `thread-renderer` 는 개행·백틱·XML 헤더 등 prompt 구조를 오염시킬 수 있는 문자를 이스케이프 처리한다 (기존 `sanitizeLlmProvidedString` 규약 준용)" 한 줄을 Rationale 에 박는다.

---

- **[INFO]** `conversationHistory` DEPRECATED 처리 — 기존 Rationale 와 완전 일치
  - **target 위치**: spec-draft §3.1 §1 설정 표 + §3.5 Rationale §12.2
  - **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale §12.2 동일 문단
  - **상세**: draft 의 §12.2 이 기존 Rationale 의 "handler 코드가 한 번도 읽지 않는 deadweight" 판단을 그대로 인용하고 `contextScope`/`contextScopeN` 대체를 선언한다. 기각된 대안의 재도입 없음. 1 cycle 호환성 유지 후 schema 제거 계획도 적절.

---

- **[INFO]** Background 격리 — ND-BG-05 불변량 준수 확인
  - **target 위치**: conversation-thread.md §3.2, spec-draft §4.3
  - **과거 결정 출처**: `spec/5-system/4-execution-engine.md` (Rationale 미발췌) + draft 내 "PRD 3 §4.11 ND-BG-05 격리 원칙" cross-link
  - **상세**: Background 실행 시 enqueue 시점 shallow snapshot 으로 thread 를 격리하는 설계가 ND-BG-05 "백그라운드 실패가 메인 흐름 상태에 영향 없음" 원칙과 일관된다. 새 invariant ("background thread 가 메인 turn 을 못 보고, 역방향도 마찬가지") 를 신규 Rationale 로 문서화한 것은 적절.

---

## 요약

기존 spec Rationale 에서 명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. `conversationHistory` 폐기 근거가 기존 Rationale 와 일치하고, Background 격리·Sub-workflow 상속 정책도 확립된 원칙을 따른다. 다만 draft 내부에서 0-common.md 와 conversation-thread.md §2.3 이 text_classifier / information_extractor 의 v1 push 여부에 대해 상충하는 서술을 담고 있어 구현자 혼선이 예상되며, system_text 주입 모드에서의 end-user 입력 sanitization 정책이 기존 Rationale(sanitizeLlmProvidedString 규약)에 비추어 명시되지 않은 점이 보완 필요하다.

## 위험도

**LOW** — Critical 이슈 없음. 내부 문구 불일치(WARNING 1건) 수정과 Rationale 보완(INFO 1건)으로 spec write 진행 가능.