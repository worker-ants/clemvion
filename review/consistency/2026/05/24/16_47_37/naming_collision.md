# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)  
대상 영역: `spec/4-nodes/3-ai`  
분석 기준 커밋: `22652414` (docs(spec): render_form tool_result 가드 필드 보강)

---

## 발견사항

### 1. **[WARNING]** `spec/4-nodes/6-presentation/4-form.md` 에 남은 구 shape 참조 — stale cross-reference

- **target 신규 식별자**: `render_form` tool_result content 의 새 shape — `{ ok: true, type: 'form_submitted', data: { …formData }, message: '<재호출 금지 안내문>' }`  
  (`spec/4-nodes/3-ai/1-ai-agent.md §4.1 표, §6.1.d.ii, §6.2 step 2.c, §12.6`)
- **기존 사용처 (stale)**: `spec/4-nodes/6-presentation/4-form.md` line 128  
  ```
  AI Agent `render_form` 의 tool_result content (`{type: 'form_submitted', data: { … }}`) 에도 동일하게 metadata 배열이 직렬화되어 LLM 에 회신된다.
  ```
  여기에 가드 필드 `ok` / `message` 가 누락된 구 shape 이 그대로 남아 있다.
- **상세**: 동일 커밋 내에서 `1-ai-agent.md` 와 `spec/4-nodes/6-presentation/0-common.md §10.9 (4) layer` 는 새 shape 으로 정합하게 갱신됐으나, `4-form.md` 는 갱신되지 않아 두 spec 파일이 같은 tool_result shape 을 다르게 서술한다. 개발자가 `4-form.md` 를 참고해 구현하면 가드 필드 `ok: true` / `message:…` 가 누락된 채로 LLM 재호출 차단 로직이 빠질 수 있다.
- **제안**: `spec/4-nodes/6-presentation/4-form.md` line 128 의 tool_result 인라인 예시를 다음과 같이 갱신한다.  
  변경 전: `{type: 'form_submitted', data: { … }}`  
  변경 후: `{ok: true, type: 'form_submitted', data: { … }, message: '<재호출 금지 안내문>'}` (상세는 [AI Agent §12.6] 링크 추가)

---

### 2. **[INFO]** `spec/4-nodes/6-presentation/0-common.md §10.9` dispatch 케이스 서술에도 구 shape 잔존

- **target 신규 식별자**: 동일 — `ok`, `message` 가드 필드 포함 새 shape
- **기존 사용처 (stale)**: `spec/4-nodes/6-presentation/0-common.md` line 399 (dispatch 표 `'form_submitted'` 케이스 설명)  
  ```
  tool_result content `{type:'form_submitted', data:{…}}` JSON 채워 LLM 재호출
  ```
  그리고 line 629 (Rationale 섹션)  
  ```
  LLM tool_result content (`{type:'form_submitted', data:{…}}`, ai-agent §6.2 step 2.c) 는 LLM-facing layer. 변경 불요 — 이미 동형 shape 으로 명시되어 있다.
  ```
  이 두 곳은 새 커밋으로 §10.9 (4) layer 행 자체는 갱신됐으나, dispatch 표의 설명 컬럼(line 399)과 Rationale 단락(line 629)에서 구 `{type, data}` shape 만 언급하고 있다.
- **상세**: (4) layer 행의 shape 은 정확히 수정됐으나 그 아래의 구현 단계 서술과 Rationale 설명이 이전 shape 을 그대로 참조하고 있어 명세 내부에서 불일치가 생긴다. 실질적 영향은 낮으나 개발자가 Rationale 만 읽는 경우 혼동 가능.
- **제안**: line 399 의 tool_result content 설명 컬럼을 `{ok:true, type:'form_submitted', data:{…}, message:'<...>'}` 로 갱신하고, line 629 의 Rationale 단락 마지막 문장 "변경 불요 — 이미 동형 shape 으로 명시되어 있다" 를 "가드 필드 `ok`, `message` 추가 — §12.6 및 §10.9 (4) layer 행 참조" 로 갱신한다.

---

### 3. **[INFO]** 새 Rationale 절 번호 `§12.6` — 충돌 없음, 확인 사항

- **target 신규 식별자**: `§12.6 render_form submit 후 LLM 의 동일 form 재호출 회귀 차단` (`spec/4-nodes/3-ai/1-ai-agent.md`)
- **기존 사용처**: 기존 마지막 절은 `§12.5` (`2026-05-23 신설`). `§12.6` 은 이 커밋이 처음 도입.
- **상세**: 충돌 없음. 번호 체계 연속성(12.5 → 12.6)도 정합. `§12.6` 을 참조하는 링크가 `0-common.md` Changelog 및 본문에 올바르게 `#126-render_form-...` anchor 형식으로 추가됨.
- **제안**: 없음.

---

### 4. **[INFO]** `ok` 필드 — display-only `render_*` tool_result 와의 의미 정합 확인

- **target 신규 식별자**: `render_form` submit tool_result 에 새로 추가된 `ok: true` 필드
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 표에서 `render_table/chart/carousel/template` 의 tool_result 는 이미 `{ok: true}` 스텁을 사용.
- **상세**: `ok: true` 라는 키는 display-only 경로에서도 사용되며, `render_form` submit 의 새 shape 에서도 동일 키를 공유한다. 두 경우 모두 "LLM 에 "성공" 을 알리는 신호" 라는 의미로 일관되어 충돌 없음. §12.6 Rationale 도 이를 명시 ("PR #278 (`e4b7aa12 render_* 무한 retry 차단 — rich tool_result`) 의 동형 라인").
- **제안**: 없음. 의도된 패턴 일관성.

---

### 5. **[INFO]** `message` 필드 — output.error.message / output.result.message 와 이름 중복 여부

- **target 신규 식별자**: `render_form` submit tool_result 의 `message` 필드 (LLM 재호출 금지 안내문)
- **기존 사용처**: `output.error.message` (에러 메시지, §7.3), `output.result.message` (waiting turn 의 마지막 assistant 응답, §7.4 표) 에서도 `message` 키가 사용된다.
- **상세**: 충돌 없음. 새 `message` 필드는 LLM-facing tool_result content 안의 키로, `output.*` 구조와는 다른 레이어에 위치한다. LLM 이 tool_result 안의 `message` 를 노드 output 구조의 `message` 와 혼동할 여지는 없다.
- **제안**: 없음.

---

## 요약

이번 커밋(`22652414`)이 도입하는 신규 식별자는 `render_form` tool_result 의 가드 필드 `ok: true` + `message: '<재호출 금지 안내문>'` 두 개이며, 섹션 번호로는 `§12.6` 이 신설된다. 이 식별자들은 기존 spec 과 의미 충돌 없이 추가된다. 단, `spec/4-nodes/6-presentation/4-form.md` line 128 이 구 shape `{type: 'form_submitted', data: { … }}` 를 그대로 참조해 새 shape 과 불일치하는 stale cross-reference 가 남아 있다. 이 문서를 기준으로 구현하는 개발자는 가드 필드가 빠진 tool_result 를 작성할 가능성이 있으므로 갱신이 권장된다. `0-common.md` 의 dispatch 표(line 399)와 Rationale(line 629) 에도 동일하게 구 shape 설명이 잔존한다.

---

## 위험도

LOW
