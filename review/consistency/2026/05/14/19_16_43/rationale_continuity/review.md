대상 spec 파일을 읽었습니다. 이제 관련 Rationale 섹션을 비교 분석합니다.

---

### 발견사항

- **[INFO]** W1: `message_received (ai_user)` 행 중복 포함 가능성
  - target 위치: `plan/in-progress/spec-draft-thread-followups.md` §1 (W1 교체 블록)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §1.4 현행 표
  - 상세: W1의 교체 블록이 "기존 표 마지막 행을 교체"라고 명시하지만, 제안 내용 첫 행에 `message_received (ai_user) | 메시지 본문 그대로`를 포함한다. 현재 §1.4 표에 동일 행이 이미 존재하므로(L52), 단순 apply 시 행이 중복될 수 있다. 의도가 "마지막 **두** 행 교체"였다면 범위를 명확히 기술해야 한다.
  - 제안: 교체 대상을 "기존 표 마지막 행(`ai_assistant final` 행)"으로 좁히거나, `message_received` 행의 포함 여부를 명시하여 적용 범위를 확정할 것.

---

- **[WARNING]** W5: `ai_user` push 타이밍이 conversation-thread.md §2.2 정의와 충돌
  - target 위치: `plan/in-progress/spec-draft-thread-followups.md` §5 (W5 삽입 블록)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §2.2 단일-turn 자동 누적 컨트랙트
  - 상세:
    - conversation-thread.md §2.2 표는 `single-turn userPrompt (resolved)` 시점에 `ai_user` push가 발생한다고 정의한다 — 즉 LLM 호출 **이전**이다.
    - multi-turn §6.2 step 2.c도 "사용자 메시지를 대화 이력에 추가 + ConversationThread 에 `ai_user` turn 자동 push"를 LLM 호출(step 2.e) **이전** 단계로 배치한다.
    - 반면 W5의 삽입 블록은 step 2.5 ("ConversationThread push")를 step 2 ("systemPrompt + userPrompt로 LLM 호출") **이후**에 위치시키면서, 동시에 해당 step 내부 설명에 "`userPrompt` 가 resolved 된 직후 `ai_user` turn push (1회)"라고 기술한다. 순서(step 번호: 2 → 2.5)와 내부 텍스트("resolved 된 직후", 즉 LLM 호출 전 시점)가 모순된다.
    - 또한 "(번호 재정리 — 기존 step 2 가 2.5 로 밀리고)" 주석이 실제 제안 내용(step 2 = LLM 호출, step 2.5 = push)과 반대 순서를 암시해 이중 혼선이 생긴다.
  - 제안: `ai_user` push는 step 2 이전(1.5 직후 또는 2 내부 첫 단계)으로 이동시키고, `ai_assistant` push는 LLM 호출 완료 후 step에 배치하도록 두 sub-step으로 분리할 것. 대안으로 하나의 step으로 묶되 순서를 "(a) LLM 호출 직전: ai_user push → (b) LLM 호출 → (c) 응답 수신 후: ai_assistant push" 순으로 기술.

---

- **[WARNING]** W6: `output.rendered (template/chart)` 가 Principle 4.3의 chart output 정의와 불일치
  - target 위치: `plan/in-progress/spec-draft-thread-followups.md` §6 (W6 교체 행)
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 4.3 (Waiting 상태 output 표)
  - 상세: W6 교체 행은 `output.rendered (template/chart)`라고 표기해 chart 노드에도 `rendered` 필드가 있음을 시사한다. 그러나 Principle 4.3 표는 chart의 waiting output을 `{ data }`로, template을 `{ rendered }`로 **명확히 분리** 정의한다. Principle 4.2 각주도 "현재 presentation 노드의 `output.rendered` (HTML snapshot) → 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토"라고 기술해 chart의 `rendered`가 spec 확정값이 아님을 암시한다.
  - 제안: `output.rendered` 를 `(template)` 단독으로 표기하고, chart는 `output.data`로 분리할 것. 만약 chart에 `rendered`가 실제로 존재하면 Principle 4.3 chart 행을 먼저 `{ data, rendered? }`로 갱신한 후 W6를 작성해야 한다.

---

- **[INFO]** W3: 참조 링크 앵커 경로 점검 권장
  - target 위치: `plan/in-progress/spec-draft-thread-followups.md` §3 (W3 교체 행)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §5.3 (이미 `meta.contextInjection` 정의)
  - 상세: conversation-thread.md §5.3(L167)에서 `meta.contextInjection`이 이미 "Principle 2 (meta = 런타임 측정값) 정합"으로 명시되어 있어 원칙 충돌은 없다. 다만 W3의 참조 링크 `[Spec Conversation Thread §5.3](./conversation-thread.md#53-cap-v1--char-기반)`에서 `#53-cap-v1--char-기반`이 현행 heading `## 5.3 Cap (v1 — char 기반)` 의 실제 markdown anchor와 일치하는지 확인 필요.
  - 제안: 적용 전 anchor 생성 규칙(`-`로 특수문자 치환) 으로 실제 링크 동작을 검증할 것.

---

### 요약

target 문서(W1–W6)는 Phase 8 impl-prep 검토에서 발견된 미문서화 간극을 spec에 보강하는 작업으로, 과거 Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 위반하는 CRITICAL 사안은 발견되지 않았다. 다만 W5는 `ai_user` push의 발생 시점(LLM 호출 전)을 step 번호(LLM 호출 후인 2.5)와 반대로 배치해 conversation-thread.md §2.2 컨트랙트와 의미상 충돌하며, W6는 `output.rendered`를 chart 노드에도 적용하는 표기가 Principle 4.3의 chart output 정의(`{ data }`)와 불일치한다. 두 항목은 spec에 내부 모순이 생기기 전에 수정하는 것이 안전하다.

### 위험도

**LOW** — CRITICAL 없음. WARNING 2건은 실제 구현 오류를 유발할 수 있는 spec 모순이지만 범위가 국소적이며 수정 방안이 명확하다.