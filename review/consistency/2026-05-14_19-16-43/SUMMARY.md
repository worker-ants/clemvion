# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 단, 구현 오류로 이어질 수 있는 WARNING 8건 수정 후 spec write 진행 권장.

---

## 전체 위험도
**MEDIUM** — Critical 없음. W1(타입 오류·행 중복), W5(push 순서 역전·용어 불일치·주석 모순), W6(필드 귀속 오류) 등 구현에 직접 영향을 주는 spec 부정확 복수 존재.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Cross-Spec, Convention | `categories.join(', ')` 타입 불일치 — `output.result.categories`는 객체 배열이므로 `.join(', ')`시 `[object Object]` 생성 | §1 (W1) `text_classifier` final assistant 행 | `spec/4-nodes/3-ai/2-text-classifier.md` §5.2 | `output.result.categories.map(c => c.name).join(', ')` 로 수정 |
| 2 | Cross-Spec | `information_extractor`에 `responseFormat=json` 한정어 오기재 — 해당 필드는 `ai_agent` 전용 | §1 (W1) `information_extractor` final assistant 행 | `spec/4-nodes/3-ai/3-information-extractor.md` §1 | `(항상 JSON 직렬화)` 또는 `(Record<string, unknown> → JSON.stringify)` 로 수정 |
| 3 | Plan Coherence, Rationale | 교체 블록에 기존 `message_received` 행 중복 포함 — "마지막 행 교체" 적용 시 동일 행이 두 번 등장 | §1 (W1) 교체 블록 첫 행 | `spec/conventions/conversation-thread.md` §1.4 L52 | 교체 블록에서 `message_received` 행 제거. 교체 대상을 "`ai_assistant final` 단일 행 → `ai_agent` / `text_classifier` / `information_extractor` 3행"으로 명확히 표기 |
| 4 | Convention | W4 markdown anchor 오류 — §4.1·§4.4 를 단일 anchor로 연결, §4.4 도달 불가 | §4 (W4) blockquote 내 링크 | `spec/conventions/node-output.md` §4.4 heading | `[§4.1](./node-output.md#41-상태-전이) / [§4.4](./node-output.md#44-resumed-상태의-output-내용)` 로 분리 |
| 5 | Plan Coherence | "Stage 3 (presentation Principle 1.1 재작성)" cross-link가 dangling — 해당 plan 문서 미존재 | §4 (W4) 추가 주석 블록 | `plan/in-progress/` (대상 문서 없음) | `plan/in-progress/`에 Stage 3 plan 선 생성 후 경로 링크 삽입, 또는 "별도 plan에서 진행 예정 (plan 미정)"으로 표기 |
| 6 | Cross-Spec, Rationale, Convention | `ai_user` push 순서 역전 — step 2.5(LLM 호출 이후)에 배치하면서 설명은 "resolved 직후(LLM 호출 전)"로 기술, 내부 모순 | §5 (W5) step 2.5 | `spec/conventions/conversation-thread.md` §2.2; `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 | `ai_user` push를 step 1.5 직후(LLM 호출 전)로 분리하거나, step을 (a) ai_user push → (b) LLM 호출 → (c) ai_assistant push 순 3단계로 기술 |
| 7 | Cross-Spec, Naming, Plan | 번호 재정리 주석이 블록 내용과 정반대 — "기존 step 2 가 2.5 로 밀리고"라고 썼으나 실제 블록은 step 2(LLM) 유지 + 2.5 신규 삽입 | §5 (W5) 괄호 주석 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 현행 step 목록 | 주석을 `(step 2 유지, 2.5 신규 삽입 — 기존 step 3+ 번호 변경 없음)` 으로 정정하거나 삭제 |
| 8 | Convention | `result.content` 용어가 spec 용어와 불일치 — conversation-thread.md의 공식 필드명은 `output.result.response` | §5 (W5) step 2.5 두 번째 bullet | `spec/conventions/conversation-thread.md` §2.2 | "최종 `output.result.response` (responseFormat=json 시 stringified)" 로 통일 |
| 9 | Cross-Spec, Naming, Rationale, Convention | `output.rendered (template/chart)` — chart 노드는 backend에서 `output.rendered` 미생성, `output.data`만 존재 | §6 (W6) 교체 행 | `spec/conventions/node-output.md` Principle 4.3; `spec/4-nodes/6-presentation/3-chart.md` | `output.rendered (template)` 단독 표기로 수정. chart는 이미 있는 `output.data (chart)` 행으로만 표현 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | W3 반영 시 `ai-agent.md` §7.1 meta 필드 표에 `meta.contextInjection?` 미기재 상태 — 규범과 예시 불일치 잔존 | §3 (W3) | W3 spec write 시 ai-agent.md §7.1 meta 필드 표에 `meta.contextInjection?` 행 동시 추가 |
| 2 | Cross-Spec | W2 각주→inline 이동 시 기존 §5.1 block quote 중복 잔존 가능성 | §2 (W2) | draft 적용 시 기존 §5.1 각주(block quote) 명시적으로 제거 |
| 3 | Convention, Rationale | W3 참조 링크 anchor `#53-cap-v1--char-기반`이 실제 CommonMark 렌더링과 일치하는지 미검증 | §3 (W3) 참조 링크 | 적용 전 실제 anchor 생성 결과 확인 (`—` → `--` 변환 여부) |
| 4 | Plan Coherence | `text_classifier` · `information_extractor` 핸들러에 ConversationThread push hook 구현 여부 미확인 — spec이 "v1 push 적용"으로 선언하면 사실과 다를 수 있음 | §1 (W1) "v1 push 적용" 표기 | spec write 전 `backend/src/nodes/ai/text-classifier/`, `information-extractor/` grep으로 push hook 구현 여부 확인. 미구현 시 표기 수정 필요 |
| 5 | Plan Coherence | node-output-redesign plan 진행 중인 상태에서 W6의 필드명 확정이 해당 plan 산출물 기준이 됨 | §6 (W6) | 적용 전 `spec/4-nodes/6-presentation/` carousel·table·chart spec의 현행 output 필드명이 W6 확정값과 일치하는지 brief 확인 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | W1 타입 오류, W5 push 순서 역전, W6 chart `rendered` 오귀속 |
| Rationale Continuity | LOW | W5 ai_user push 타이밍이 §2.2 컨트랙트와 의미 충돌, W6 Principle 4.3 불일치 |
| Convention Compliance | LOW | W1 타입 불일치, W4 anchor 깨짐, W5 용어 불일치, W6 Principle 4.3 충돌 |
| Plan Coherence | MEDIUM | W1 행 중복, W5 주석 내부 모순, W4 dangling cross-link |
| Naming Collision | LOW | W6 `output.rendered` chart 오기재 (Critical 충돌 없음) |

---

## 권장 조치사항

1. **[W1 타입 오류 수정]** `categories.join(', ')` → `categories.map(c => c.name).join(', ')` 로 교정. `information_extractor` `responseFormat` 한정어 제거.
2. **[W1 행 중복 제거]** 교체 블록에서 `message_received` 행 삭제. 교체 범위를 "ai_assistant final 1행 → 3행"으로 명기.
3. **[W5 push 순서 재구성]** `ai_user` push를 step 1.5 직후(LLM 호출 전)에 배치하고, `ai_assistant` push를 LLM 응답 수신 후 step으로 명확히 분리. `result.content` → `output.result.response` 용어 통일.
4. **[W5 주석 수정]** 번호 재정리 주석을 "step 2 유지, 2.5 신규 삽입 — step 3+ 번호 불변"으로 교정하거나 삭제.
5. **[W6 필드 귀속 수정]** `output.rendered (template/chart)` → `output.rendered (template)` 단독 표기. chart는 `output.data` 행으로만 표현.
6. **[W4 anchor 분리]** §4.1 / §4.4 링크를 별도 anchor로 분리. "Stage 3" cross-link에 plan 미정 명기 또는 plan 문서 선 생성.
7. **[INFO 사전 확인]** spec write 직전 `text_classifier` · `information_extractor` 핸들러의 push hook 구현 여부 grep 확인. 미구현 시 "v1 미적용" 표기로 조정.