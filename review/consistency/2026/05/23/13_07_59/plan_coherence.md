# Plan 정합성 검토 결과

**대상 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
**worktree**: `telegram-chat-channel-spec-polish-49c49b`
**검토 일시**: 2026-05-23

---

## 발견사항

### 1. **[WARNING]** `chat-channel-visual-ssr-png.md` 의 미해결 결정을 target plan 이 일방적으로 확정

- **target 위치**: 결정 3 — `uiMapping.visualNode` enum 및 v1 fallback (plan §결정 3)
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — "결정 항목 #2 — fallback 정책 (사용자 escalate)" 절
- **상세**: `chat-channel-visual-ssr-png.md` 는 `uiMapping.visualNode` 의 `'text'` 값 신설을 "권장 검토 옵션" 으로만 제시하고, 실제 enum 결정은 사용자 escalate 미해결 상태(`결정 항목 #2` 체크박스 미완료)로 남겨두었다. target plan(결정 3)은 이를 `"text" | "photo" | "auto"` 3-enum 으로 확정하고 `text_only → text` rename + `auto` 신설을 spec 에 직접 기재한다. backlog plan 의 미해결 결정 항목을 사전 합의 없이 target plan 이 선점하는 구조다.
  - 다만 target plan 의 배경 절은 이 관계를 명시적으로 언급하며("chat-channel-visual-ssr-png.md (backlog) — v2 SSR PNG 격상. 본 plan 의 결정 3 (uiMapping.visualNode enum) 은 v2 trigger 신호의 SoT 가 된다"), 후속 plan 에 "본 plan 머지 직후 plan 문서만 1 commit 으로 갱신" 의무를 명시하고 있어 인지된 상태임은 확인된다.
  - 그러나 `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 절 자체가 갱신되지 않은 채 backlog 에 남아 있으면, 이후 진입자가 해당 결정이 이미 확정됐음을 모르고 별도 결정을 시도할 위험이 있다.
- **제안**: target plan 머지 후 `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 절을 "target plan 결정 3 에서 확정 (spec-telegram-chat-channel-ui-polish)" 으로 갱신하는 후속 커밋을 target plan 의 §후속 plan 항목 3 에 이미 명시되어 있다. 충분하나, 해당 후속 항목이 실제로 실행될 수 있도록 `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 에 `<!-- DECISION PENDING: spec-telegram-chat-channel-ui-polish 머지 후 갱신 의무 -->` 혹은 동등한 인라인 메모를 선제적으로 추가하는 것이 안전하다.

---

### 2. **[WARNING]** `spec-fix-isactive-drawer-toggle.md` 와 `spec/2-navigation/2-trigger-list.md §2.3.1` 동시 편집 — 머지 순서 일부만 명시

- **target 위치**: 결정 1 — §2.3.1 필드 권한 매트릭스에 9개 row 추가 (plan §결정 1)
- **관련 plan**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` (worktree: `trigger-drawer-cleanup-f6a707`) — `spec/2-navigation/2-trigger-list.md §2.3.1` 의 `isActive` row 수정
- **상세**: target plan 이 §2.3.1 에 9 row 를 추가하고, `spec-fix-isactive-drawer-toggle.md` 가 같은 §2.3.1 의 `isActive` row 를 수정한다. target plan 의 §머지 순서 합의 절이 이 관계를 명시하고 양방향 합의 내용을 기록하고 있다는 점은 긍정적이다.
  - 그러나 `spec-fix-isactive-drawer-toggle.md` 자체(worktree: `trigger-drawer-cleanup-f6a707`)에는 target plan 과의 머지 순서 합의가 역방향으로 기재되어 있지 않다. target plan 에만 일방적으로 기술된 상태다.
  - 두 worktree(`telegram-chat-channel-spec-polish-49c49b`, `trigger-drawer-cleanup-f6a707`)가 동일 파일의 인접 row 를 동시에 편집하므로, 어느 한쪽이 먼저 PR 을 오픈해 base 가 변경되면 다른 쪽이 rebase 시 수동 확인이 필요하다.
- **제안**: `spec-fix-isactive-drawer-toggle.md` 에도 "본 plan 의 §2.3.1 isActive row 수정은 spec-telegram-chat-channel-ui-polish 의 9 row 추가와 동일 표 경합. 머지 순서는 해당 plan §머지 순서 합의 참조" 를 추가해 양방향 교차 참조를 완성한다.

---

### 3. **[INFO]** `chat-channel-visual-ssr-png.md` 의 후속 plan 갱신 의무가 target plan 라이프사이클에만 명시 — backlog plan 자체에는 미반영

- **target 위치**: §후속 plan 항목 3 "(필수 follow-up) `chat-channel-visual-ssr-png.md`"
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md`
- **상세**: target plan 이 머지된 후 `chat-channel-visual-ssr-png.md` 를 갱신해야 한다는 의무가 target plan 의 §후속 plan 에 명시되어 있으나, backlog plan 인 `chat-channel-visual-ssr-png.md` 자체에는 이 의무가 역방향으로 기재되어 있지 않다. 결과적으로 `chat-channel-visual-ssr-png.md` 를 독립적으로 열람하면 enum 결정이 이미 완료됐음을 인지하기 어렵다.
- **제안**: target plan 머지 후 후속 항목 3 실행 시 `chat-channel-visual-ssr-png.md` 에 "결정 항목 #2 는 spec-telegram-chat-channel-ui-polish 에서 확정 (`text|photo|auto`, default `auto`)" 일 줄 추가로 충분.

---

### 4. **[INFO]** `chat-channel-secret-store-infra.md` 와의 관계 — target plan 이 `SecretResolver + secret://` 패턴을 기정사실로 인용

- **target 위치**: §배경 — "이미 spec 에 채택된 `SecretResolver` + `secret://` ref 패턴을 그대로 활용 (충돌 없음)"
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` — "결정 항목 (사용자 escalate)" 미결, status: backlog
- **상세**: `chat-channel-secret-store-infra.md` 는 secret store 인프라 선정(AWS Secrets Manager / HashiCorp Vault / DB 암호화 컬럼)을 사용자 escalate 미결로 남겨두었다. target plan 은 spec 레벨에서 이미 채택된 `secret://` ref 패턴을 cross-link 형태로만 인용하며 직접 구현을 다루지 않으므로 실질적 충돌은 없다. 단, 이 참조가 추후 구현 단계(developer plan)에서 infra 결정이 아직 미완임을 인지하지 못하고 진입할 경우 차단될 수 있음.
- **제안**: target plan 범위(spec 정의)에서는 문제없다. 후속 developer plan(항목 1, `developer-trigger-list-chat-channel-card-ui`) 이 botToken 입력 UI 를 구현할 때 `chat-channel-secret-store-infra.md` 의 infra 결정 미완 여부를 사전 확인하도록 해당 developer plan 에 명시할 것을 권장.

---

### 5. **[INFO]** worktree 충돌 없음 확인

- target plan worktree `telegram-chat-channel-spec-polish-49c49b` 와 동일 spec 파일(`2-trigger-list.md`, `15-chat-channel.md`, `12-webhook.md`, `chat-channel-adapter.md`, `telegram.md`)을 동시에 편집 중인 다른 worktree는 확인되지 않는다.
- `spec-fix-isactive-drawer-toggle.md` 의 worktree `trigger-drawer-cleanup-f6a707` 은 `2-trigger-list.md §2.3.1` 에 접근하지만 동일 row 가 아니므로 hard 충돌은 아니다(상기 WARNING 2 참조).
- `ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) 는 `spec/4-nodes/3-ai/1-ai-agent.md` 계열을 주로 편집하며 target plan 의 대상 파일과 겹치지 않는다.

---

## 요약

target plan `spec-telegram-chat-channel-ui-polish.md` 은 관련 backlog plan 3건(`chat-channel-visual-ssr-png.md`, `chat-channel-secret-store-infra.md`, `chat-channel-dispatcher-split.md`)과의 경계를 배경 절에서 명시적으로 인지하고 있어 전반적으로 잘 설계된 정합성을 보인다. 주요 위험은 두 가지다. 첫째, `chat-channel-visual-ssr-png.md` 의 미해결 "결정 항목 #2(사용자 escalate)" 를 target plan 이 선점 확정하는 구조인데, 해당 backlog plan 이 역방향으로 이를 반영하지 않아 독립 열람 시 혼동 가능성이 있다(후속 항목 3 에 이미 갱신 의무가 명시되어 있으나 실행 전 상태). 둘째, `spec-fix-isactive-drawer-toggle.md` 와 `spec/2-navigation/2-trigger-list.md §2.3.1` 의 동시 편집 경합이 target plan 에만 단방향으로 기록되어 있어, 역방향 교차 참조가 누락된 상태다. 두 항목 모두 작업 차단 수준은 아니나 머지 전후 후속 조치가 누락될 위험이 있으므로 WARNING 등급으로 분류한다. CRITICAL 수준의 미해결 결정 우회 또는 worktree hard 충돌은 없다.

---

## 위험도

**LOW**

(CRITICAL 없음. WARNING 2건은 머지 후 후속 갱신 조치로 해소 가능. INFO 3건은 추적 메모 수준.)
