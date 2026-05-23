# Convention Compliance — `ButtonDef.userMessage` 신설 + 합성 규칙

## 결론
**위험도: NONE** — `spec/conventions/**` 위반 없음.

## 점검 매트릭스

| 규약 | 위반 여부 | 근거 |
|---|---|---|
| `spec/conventions/node-output.md` Principle 0 (5필드 invariant `{config, output, meta?, port?, status?}`) | 무관 | `userMessage` 는 `config.buttons[*]` 안 필드 (config echo 대상). 5필드 invariant 침범 없음. |
| `spec/conventions/node-output.md` Principle 1.1 (직교성 — 같은 데이터를 두 위치에 두지 않음) | 무관 | `userMessage` 는 config 안만. `output.interaction` 에는 echo 하지 않음 (render_* 클릭은 `output.interaction` 발화 자체가 없는 경로). |
| `spec/conventions/node-output.md §4.5` `interaction.data` payload 규격 | 무관 | `output.interaction` 는 graph presentation 노드 본체 전용. render_* 클릭은 frontend `onSendMessage` 로 ai_user 발화 — `interaction.data` 가 발생하지 않음. 즉 `interaction.data` 의 1급 필드 (`buttonLabel`, `selectedItem`) 와 본 작업의 `userMessage` 는 다른 layer. |
| `spec/conventions/conversation-thread.md §1.4` `text` 변환 규칙 | 무관 | `text` 변환 (`clicked: <buttonLabel>` 등) 은 `renderInteractionText` (backend, presentation_user source 한정) 의 책임. render_* 의 frontend `onSendMessage` 는 ai_user 메시지로 chat input 에 직접 흘러가 backend 가 chat 발화 흐름 (`ai_user` source) 에서 marker 미적용 (§1.4 비고). |
| `spec/conventions/conversation-thread.md §1.6` LLM-facing 보안 마커 (`[user-input]…[/user-input]`) | 무관 | 마커는 `presentation_user` source 한정 — `ai_user` 는 제외 (§1.6 표). 본 작업의 `userMessage` 는 frontend → chat input → ai_user 경로라 마커 wrap 대상 아님. |
| `spec/conventions/conversation-thread.md §1.6` 라벨/이벤트/메타의 `turn.data` 1급 필드 SoT | 무관 | `userMessage` 는 합성된 user message 본문 (= `turn.text` 후보) 이지 메타데이터 1급 필드가 아님. 다음 LLM turn 의 user message 로 단순 흡수. |
| Principle 7 (config echo) | 정합 | `userMessage` 는 사용자/LLM 입력 raw → `config.buttons[i].userMessage` 그대로 echo. |
| Conventions 의 i18n / locale 정책 | 미명시 (관련 규약 없음) | ` → ` U+2192 는 locale-agnostic literal. plan 의사결정 메모와 일치. |
| Presentation 공통 §10.5 backfill 단계 (validate → overlay → cap → backfill) | 무관 | `userMessage` 는 옵션 필드라 backfill 대상 아님 (= step 3 본문 무수정). |

## 정합 확인

- `userMessage` 옵션 필드 추가는 **schema 위반 retry 1회 게이트** (§10.5 step 4) 와 **무관** — 옵션 필드 미설정은 schema-valid.
- `type: "link"` 에서 `userMessage` 가 설정되어 있어도 무시 — `type: "port"` 와 `type: "link"` 의 시맨틱 분리 (§1 본문 + §2 포트 토폴로지) 와 정합. link 는 외부 URL 이동이 우선 시맨틱이라 user-message 발화 없음.

## STATUS
ISSUES=0
