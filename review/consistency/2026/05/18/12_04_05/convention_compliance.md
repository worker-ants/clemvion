# Convention Compliance 점검 결과

대상: `plan/in-progress/spec-draft-conversation-turn-render.md`
점검 모드: spec draft 검토 (--spec)
참조 규약: `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`

---

## 발견사항

- **[INFO]** plan 문서의 §6 섹션 placeholder 형식이 spec 편입 전 draft 형식과 일치하지 않음
  - target 위치: `## 6. 일관성 검토 결과` 섹션 전체
  - 위반 규약: 없음 (규약 직접 위반은 아님)
  - 상세: §6 의 `Critical: __ 건` 등 placeholder 는 draft 문서임을 나타내는 의도적 빈칸이지만, 본 일관성 검토 결과가 바로 이 문서에 채워져야 하는 구조다. 현재 worktree 에서 consistency-check 가 실행 중이므로 구조 자체는 적절하다. 단 세션 경로 패턴 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 가 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 기록되어 있어 실제 경로와 정합한다.
  - 제안: 특별한 수정 불필요. 검토 완료 후 실제 값으로 채우면 된다.

- **[INFO]** draft 문서 §3.1 의 `spec/conventions/conversation-thread.md §1.2` text 필드 보강 제안에서 기존 규약 §1.2 의 `text` 설명 ("system_text injection 과 UI 의 1차 텍스트")과 draft 가 제안하는 새 설명("LLM-facing 1차 텍스트") 사이에 의미 shift 가 존재
  - target 위치: `## 3. spec 변경 항목 / 3.1 ... §1.2 ConversationTurn` 의 text 필드 설명
  - 위반 규약: `spec/conventions/conversation-thread.md §1.2` 현행 정의
  - 상세: 현행 규약의 `text` 설명은 "system_text injection 과 UI 의 1차 텍스트"로, UI 표시 목적도 포함하는 표현이다. Draft 의 개정안은 "LLM-facing 1차 텍스트 — UI 표시는 §11 매핑표를 따라 source + nodeLabel + data 메타로 분기 — text 를 raw 로 직접 노출하지 않는다" 로, UI 역할을 완전히 배제한다. 이 변경 자체는 Draft 의 핵심 결정(D1)이어서 의도적이며, spec 개정으로 반영될 내용이다. 규약 위반이 아니라 규약 개정 요구이므로 INFO 등급.
  - 제안: Draft 채택 시 §1.2 의 text 설명이 기존 "UI 의 1차 텍스트" 역할을 명시적으로 §11 로 위임한다는 문장을 추가하면 backward compatibility 맥락이 명확해진다.

- **[INFO]** §3.4 의 plan 파일 cross-link 경로가 상대경로와 절대경로를 혼용
  - target 위치: `## 3. spec 변경 항목 / 3.4` 의 Spec Conversation Thread §11 링크
  - 위반 규약: 없음 (규약에 경로 형식 강제 없음)
  - 상세: `3.4` 에서 `../../spec/conventions/conversation-thread.md#11-미리보기-ui-렌더-규칙` 으로 plan 파일 내부에서 spec 파일을 절대 경로(`../../spec/`) 로 참조하고 있다. plan 파일은 `plan/in-progress/` 에 위치하므로 `../../spec/` 는 올바른 상대 경로다. 반면 동일 문서의 다른 cross-link 들(§3.1~3.3) 은 spec draft 내부에서의 상대 경로 (`../5-system/`, `../4-nodes/`) 를 사용한다. 혼용 자체가 규약 위반은 아니나 유지보수 시 혼란 가능성이 있다.
  - 제안: plan 파일 내 cross-link 는 plan 파일 기준의 상대경로로 일관되게 작성하는 것이 권장된다. `../../spec/conventions/conversation-thread.md` 형태가 plan 파일 기준으로 정확하므로 현재 경로는 실제로 맞다 — INFO 수준 메모.

---

### 주요 규약 준수 확인 (문제 없음으로 판정된 항목)

1. **명명 규약** — plan 문서 위치(`plan/in-progress/`) 및 파일명(평문) 준수. frontmatter (`worktree`, `started`, `owner`) 모두 존재. `CLAUDE.md` 의 plan frontmatter 규약 완전 준수.

2. **문서 구조** — spec draft 는 `## 0. 배경 / ## 1. 결정 / ## 2. 데이터 모델 변경 / ## 3. spec 변경 항목 / § Rationale` 구조를 포함한다. §3.1 변경 항목 내에 `(개정) §8 Rationale` 섹션이 포함되어 있어 CLAUDE.md 의 권장 3섹션(Overview/본문/Rationale) 구조를 준수한다.

3. **출력 포맷 규약** — Draft 의 `§1.6 금지된 인라인 마커` 는 `spec/conventions/node-output.md §4.5` 의 `interaction.data` 1급 필드(`buttonId`, `buttonLabel`, `selectedItem?`, `url`)를 대안으로 명시하고 있으며, 해당 필드들은 현행 `node-output.md §4.5` payload 규격과 정확히 일치한다. 규약 정합.

4. **`data?` 필드 보강 제안 정합성** — Draft §3.1 의 `data?` 필드 설명 보강에서 `interaction.type` 별 1급 필드로 `fields`, `buttonId`, `buttonLabel`, `selectedItem?`, `url`, `content`, `role` 을 열거하는데, 이는 `node-output.md §4.5` 의 `interaction.data` payload 규격과 완전히 정합한다.

5. **§11 소스별 시각 매핑의 source enum** — `ConversationTurnSource` 5개 값(`ai_user`, `ai_assistant`, `presentation_user`, `ai_tool`, `system`) 이 현행 `spec/conventions/conversation-thread.md §1.1` 의 enum 과 일치한다.

6. **LLM payload prefix 컨벤션 (신규 §1.5)** — Draft §1.5 는 현행 `conversation-thread.md §5.1` 의 messages 모드 매핑표에서 `presentation_user` → `user` 역할, prefix `[from <nodeLabel>] ` 를 참조하며, "builder 책임" 명문화는 현행 규약의 암묵적 전제를 명시적으로 격상하는 것이어서 충돌 없음.

7. **WebSocket emit 예외 표현** — Draft §1.5 의 "emit 시 prefix 포함 형태" 예외는 현행 `conversation-thread.md §5.1` 의 WebSocket emit source 마커 설명 및 `§4.4.6` cross-link 와 정합한다.

8. **금지 항목 검토** — Draft 내부에서 임의 inline marker(`[user-input]…[/user-input]` 등) 를 신규 제안하지 않는다. 오히려 이를 금지 규약으로 격상하는 것이 Draft 의 목적이므로, 규약에서 금지된 패턴을 답습하는 항목은 없다.

9. **API 문서 규약** — 본 draft 는 Swagger/OpenAPI 데코레이터·DTO 와 무관한 내부 데이터 모델·렌더 규칙 spec이므로 `spec/conventions/swagger.md` 규약 적용 대상이 아니다.

---

## 요약

`plan/in-progress/spec-draft-conversation-turn-render.md` 는 정식 규약(`spec/conventions/`) 에 대한 직접 위반이 없다. 명명 규약(plan frontmatter), 문서 구조(Rationale 포함), 데이터 모델 규약(`node-output.md §4.5` interaction.data payload, `conversation-thread.md §1.1` source enum) 모두 현행 규약과 정합한다. 발견된 3건은 모두 INFO 등급으로, 기존 규약의 개정 방향성 메모 및 유지보수 관련 사소한 형식 제안에 해당한다. CRITICAL·WARNING 사항 없음. spec write 를 차단하는 규약 위반은 존재하지 않는다.

## 위험도

NONE
