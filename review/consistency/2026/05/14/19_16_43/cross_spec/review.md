모든 관련 파일을 읽었습니다. 이제 cross-spec 분석 결과를 보고합니다.

---

## 발견사항

### **[WARNING] W1 — `text_classifier` multi-label: `output.result.categories.join(', ')` 타입 불일치**
- **target 위치**: spec draft §1 (W1), `text_classifier final assistant` 행
- **충돌 대상**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.2
- **상세**: draft 는 multi-label text 변환으로 `output.result.categories.join(', ')` 를 기술하나, 실제 `output.result.categories` 는 `Array<{name, confidence?, evidence?}>` — 문자열 배열이 아니다. `.join(', ')` 를 그대로 호출하면 `[object Object], [object Object]` 가 생성된다.
- **제안**: `output.result.categories.map(c => c.name).join(', ')` 로 수정하거나, 간략히 "매칭된 카테고리 `name` 목록, `, ` 로 join" 으로 기술.

---

### **[WARNING] W1 — `information_extractor`: `responseFormat=json` 한정어 잘못된 참조**
- **target 위치**: spec draft §1 (W1), `information_extractor final assistant` 행
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md` §1 (config 표)
- **상세**: draft 에 `(responseFormat=json 의 경우 JSON 직렬화)` 라는 한정이 있으나, `responseFormat` 은 `ai_agent` 전용 config 필드다. `information_extractor` 에는 해당 필드가 존재하지 않으며 `output.result.extracted` 는 `outputSchema` 에 의해 **항상** JSON 객체다. 한정어가 다른 노드 컨텍스트에서 copy-paste 된 것으로 보인다.
- **제안**: 한정어를 `(항상 JSON 직렬화)` 또는 `(Record<string, unknown> → JSON.stringify)` 로 수정.

---

### **[WARNING] W5 — single-turn `ai_user` push 순서 역전**
- **target 위치**: spec draft §5 (W5), step 2.5
- **충돌 대상**: `spec/conventions/conversation-thread.md` §2.2; `spec/4-nodes/3-ai/1-ai-agent.md` §6.1
- **상세**: draft 는 step 2.5 를 `2. LLM 호출` **이후** 로 배치하면서, 동시에 `ai_user` push 를 "`userPrompt` 가 resolved 된 직후" 로 기술한다. `userPrompt` 는 LLM 호출 **이전** step 1.5 직후에 resolved 되므로, `ai_user` push 는 step 2 이전에 일어나야 한다. step 2.5 한 곳에 두 push 를 묶으면 `ai_user` 의 시간적 위치가 spec 의 §2.2 시계열(단계별 push 시점)과 어긋난다.
- **제안**: `ai_user` turn push 를 step 1.5 와 step 2 사이 (`1.7` 또는 `2` 앞 단계)로 분리하거나, step 2.5 의 설명을 `userPrompt resolved → ai_user push (step 2 진입 전)` 과 `LLM 최종 응답 → ai_assistant push (step 4 직후)` 로 위치를 명확히 분리하여 기술.

---

### **[WARNING] W5 — 번호 재정리 설명이 기존 spec 과 불일치**
- **target 위치**: spec draft §5 (W5), step 삽입 주석 `(번호 재정리 — 기존 step 2 가 2.5 로 밀리고, 후속 step 도 따라 갱신)`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 현행 step 목록 (1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7)
- **상세**: step 2.5 를 삽입해도 기존 step 2("LLM 호출") 는 2 로 유지되고 3~7 도 변하지 않는다. 주석의 "기존 step 2 가 2.5 로 밀리고 후속 step 도 따라 갱신"은 사실과 다르며, 이를 그대로 적용하면 spec 의 §7.1~§7.3 등 각 케이스의 단계 참조가 잘못될 수 있다.
- **제안**: 주석을 삭제하거나 "step 2 와 step 3 사이에 step 2.5 를 삽입; 기존 step 3~7 번호 불변" 으로 교정.

---

### **[WARNING] W6 — `output.rendered` 를 chart 에 잘못 귀속**
- **target 위치**: spec draft §6 (W6), "프레젠테이션 뷰 (런타임 필드)" 행 교체안
- **충돌 대상**: `spec/conventions/node-output.md` Principle 4.3 Waiting 상태 output 표
- **상세**: draft 는 `output.rendered` 를 "template/chart" 로 표기하나, Principle 4.3 은 chart 의 런타임 출력 필드를 `output.data` 로, `output.rendered` 는 template 전용으로 정의한다. chart 를 `output.rendered` 에 포함하면 Principle 4.3 과 직접 모순된다.
- **제안**: 교체 행을 `output.rendered` (template) 와 `output.data` (chart) 로 명확히 분리.

---

### **[INFO] W3 — ai-agent.md §7.1 JSON 예시에 `meta.contextInjection` 미반영**
- **target 위치**: spec draft §3 (W3)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta` JSON 예시
- **상세**: W3 에서 Principle 2 에 `meta.contextInjection?` 를 추가하면 ai-agent.md §7.1 의 JSON 예시와 필드 표에는 해당 필드가 없어 규범(Principle 2)과 예시 문서 간 불일치가 남는다. CRITICAL 은 아니지만 동기화 권장.
- **제안**: W3 반영 시 ai-agent.md §7.1 meta 필드 표에 `meta.contextInjection?` 행을 추가하는 작업을 함께 계획.

---

### **[INFO] W2 — 각주 → inline 이동 정합**
- **target 위치**: spec draft §2 (W2), `system` row
- **충돌 대상**: `spec/conventions/conversation-thread.md` §5.1 기존 block quote
- **상세**: 현재 §5.1 에 동일 내용의 각주(block quote)가 존재. draft 가 이를 row 내 inline 으로 이동하고 각주를 제거하면 중복이 해소된다. 내용 자체의 cross-spec 충돌 없음.
- **제안**: draft 적용 시 기존 각주 제거를 명시.

---

## 요약

총 5개 WARNING 과 2개 INFO 가 발견되었다. CRITICAL(기존 spec 과의 직접 작동 불가 모순) 은 없으나, **W1 의 두 가지 타입/한정자 오류, W5 의 push 순서 역전, W6 의 `output.rendered` chart 포함 오류** 는 그대로 spec 에 반영될 경우 구현체가 잘못된 경로나 순서를 참조할 수 있어 수정 후 write 진행을 권장한다. W5 의 번호 재정리 주석은 삭제 또는 수정 필요.

## 위험도

**MEDIUM** — CRITICAL 없음. 다만 W1(타입 오류), W5(push 순서), W6(필드 귀속 오류) 3개는 구현 오류로 이어질 수 있는 spec 부정확으로, spec write 전 수정이 강하게 권장된다.