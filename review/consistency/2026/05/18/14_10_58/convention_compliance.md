# Convention Compliance Check — spec/conventions/conversation-thread.md (draft)

## 발견사항

---

### 1. **[WARNING]** §2.5 섹션이 §3 다음에 배치되어 문서 구조가 비선형
- **target 위치**: 라인 165–179 (§2.5 `nextSeq 원자성` 블록이 §3 스코프 규칙 섹션 아래에 위치)
- **위반 규약**: CLAUDE.md 명명 컨벤션 — spec 문서 권장 구조 (섹션 번호 순서 일관성). `spec/conventions/` 문서는 다른 spec 문서에서 인용될 때 `§2.5` 앵커를 기대하므로, 실제 파일에서 §3 뒤에 등장하면 독자와 링크가 혼란을 겪는다.
- **상세**: `## 2. 자동 누적 컨트랙트` 안의 하위 섹션 `### 2.5 nextSeq 원자성` 이 `## 3. 스코프 규칙` (§3.1–3.3) 이후에 배치되어 있다. 이 구조 오류는 기존 저장소 파일(`spec/conventions/conversation-thread.md`)에도 동일하게 존재하므로, 이번 draft 가 새로 도입한 것은 아니지만 신규 개정 시 수정 기회임.
- **제안**: `### 2.5 nextSeq 원자성` 블록을 `### 2.4 opt-out` 직후, `## 3. 스코프 규칙` 이전으로 이동한다.

---

### 2. **[WARNING]** §8 Rationale 위치가 §9 미리보기 UI 렌더 규칙보다 앞에 있어 본문 흐름 단절
- **target 위치**: §8 (라인 266–289) — Rationale 섹션이 §9 UI 규칙 섹션보다 앞에 위치
- **위반 규약**: CLAUDE.md `spec/<영역>/N-name.md` 권장 3섹션 구성 — "본문 끝에 `## Rationale` 섹션을 권장". Rationale 은 본문의 마지막 섹션이어야 한다.
- **상세**: 기존 저장소 파일은 `## 8. Rationale` → `## 9. CHANGELOG` 순서였다. Draft는 `## 8. Rationale` (§8.1 포함) → `## 9. 미리보기 UI 렌더 규칙` → `## 10. CHANGELOG` 순서로 재구성했다. 그 결과 Rationale(§8) 이 본문 내용(§9 UI 렌더 규칙) 보다 앞에 위치해 "본문 끝의 Rationale" 규칙을 위반한다.
- **제안**: 섹션 순서를 `§8 미리보기 UI 렌더 규칙` → `§9 Rationale` (§9.1) → `§10 CHANGELOG` 로 재조정한다. 또는 §8.1 내용 자체가 §9 UI 렌더 규칙의 설계 근거이므로, §9 직후로 통합 이동이 가장 자연스럽다.

---

### 3. **[WARNING]** §4 영속화 표의 `output.messages` 필드명 잔존 (기존 파일과 draft 간 불일치)
- **target 위치**: §4 영속화 표 (draft 라인 187) — `"실행 후"` 행의 비고 컬럼
- **위반 규약**: `spec/conventions/node-output.md` Principle 4.3 — AI Agent의 `output.messages`는 기존 파일에서 이미 사용 중이나, draft CHANGELOG §10 마지막 항목은 `output.messages` → `output.result.messages`(D6 단일 경로)로 정정했다고 명시함.
- **상세**: Draft §4 영속화 표의 해당 비고 칸을 보면 `output.result.messages` (D6 단일 경로, AI Agent §7.4·§7.5 링크) 로 정정되어 있다. 반면 기존 저장소 `spec/conventions/conversation-thread.md` §4 표에는 여전히 `output.messages` (AI 멀티턴 누적) 로 표기되어 있다. 이 자체는 draft가 올바르게 수정하는 방향이나, CHANGELOG와 본문이 정합한지 최종 확인 필요.
- **제안**: Draft 내 §4 영속화 표의 `output.result.messages` 표기가 정확하므로 유지. 추가로 §9.3 표의 "실행 이력 복원 view" 행에서 언급하는 `output.result.messages` 도 동일 경로로 일관성 확인 요망 (draft에서는 일치하는 것으로 보임).

---

### 4. **[INFO]** §1.1 에서 §1.2 `text` 필드 상호 참조가 장문화로 인해 가독성 저하
- **target 위치**: §1.2 ConversationTurn 표의 `text` 행 (draft 라인 53)
- **위반 규약**: 직접 위반 규약 없음 — 형식 제안.
- **상세**: `text` 필드 설명이 §1.5, §1.6, §9, §9.5 교차 참조를 포함한 3줄 이상의 복합 기술로 확장되었다. 본문 표 셀에 인라인으로 여러 섹션 참조가 집중되어 테이블 markdown 렌더링 시 셀 너비가 불균형해질 수 있다. 또한 `text` 필드에 대한 실질 명세는 §1.4·§1.5·§1.6 에 분산되어 있는데 표 셀에서 다시 요약하면 drift 위험이 재발한다.
- **제안**: `text` 행 설명을 "LLM-facing 1차 텍스트 — 상세는 §1.4·§1.5·§1.6 참조. 사용자 출처 텍스트는 `[user-input]…[/user-input]` 마커로 wrap (§1.6). UI 표시 시 §9.5 strip 적용. 빈 문자열 가능" 수준으로 압축하고 세부 내용은 해당 하위 섹션에 위임.

---

### 5. **[INFO]** §9.1 UI 시각 매핑 표에 이모지 사용
- **target 위치**: §9.1 source 별 시각 매핑 표 (draft 라인 298–304)
- **위반 규약**: 직접 규약 위반 없음. CLAUDE.md는 "Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked." 를 agent 작성 지침으로 적용. 단, 이 spec 파일은 agent 가 직접 쓰는 것이 아니라 사람이 편집하는 SoT 문서이므로 이모지 금지 조항이 직접 적용되지는 않는다.
- **상세**: `👤`, `🤖`, `🧩`, `🔧`, `ℹ️` 이모지가 표 셀 안에 사용됨. 렌더링 환경에 따라 이모지 너비가 다르게 계산되어 markdown 표 정렬이 깨질 수 있다. 또한 이 규약 문서가 다른 도구(IDE, CLI)에서 참조될 때 이모지가 노이즈가 될 수 있다.
- **제안**: 이모지 대신 `(user)`, `(assistant)`, `(presentation)`, `(tool)`, `(system)` 등 텍스트 레이블로 대체하거나, 이모지를 실제 UI 구현 문서에만 사용하고 본 conventions 파일에서는 텍스트 식별자만 사용.

---

### 6. **[INFO]** §10 CHANGELOG 번호가 기존 §9에서 §10으로 이동하며 외부 링크 앵커 영향 가능
- **target 위치**: §10 CHANGELOG (draft 라인 340)
- **위반 규약**: 직접 규약 위반 없음 — 운영 주의사항.
- **상세**: 기존 저장소 파일에서 CHANGELOG는 `## 9. CHANGELOG`였으나 draft에서 `## 10. CHANGELOG`로 번호가 바뀌었다. 다른 spec 문서나 plan 문서에서 `#9-changelog` 앵커로 링크가 있으면 404가 된다.
- **제안**: Git history에서 `#9-changelog` 앵커를 참조하는 문서가 있는지 확인 후 필요 시 갱신. 현재 신규 섹션(§9 UI 렌더 규칙)이 중요한 정보이므로 번호 이동 자체는 적절하다.

---

## 요약

Target 문서(`spec/conventions/conversation-thread.md` draft)는 기존 conventions 파일 대비 §1.5 (LLM payload prefix 책임 경계), §1.6 (금지 인라인 마커 정책), §9 (미리보기 UI 렌더 규칙) 등 중요한 신규 규약을 추가하고 §4 영속화 표의 필드명 오류를 정정하는 개선을 담고 있다. 정식 규약 직접 위반(CRITICAL)은 없으며, 주요 이슈는 두 가지 WARNING — §2.5 섹션이 §3 이후에 잘못 배치된 것(기존 오류 승계)과 Rationale(§8) 이 신규 본문 섹션(§9 UI 렌더 규칙)보다 앞에 위치해 CLAUDE.md 권장 "본문 끝의 Rationale" 구조를 위반하는 것이다. 두 WARNING 모두 섹션 재배열로 해결되며 채택을 블로킹하지는 않는다.

## 위험도

LOW
