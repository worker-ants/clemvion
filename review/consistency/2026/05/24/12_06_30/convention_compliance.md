# Convention Compliance Report

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 문서: `spec/4-nodes/7-trigger/providers/slack.md`
검토 일시: 2026-05-24

---

## 검토 전제

`spec/4-nodes/7-trigger/providers/slack.md` 파일이 **현재 존재하지 않는다** (prompt_file 의 target 내용 = "(없음)"). 본 검토는 "파일이 신규 생성될 때 지켜야 할 정식 규약 준수 기준"을 선제 정의하는 방식으로 수행한다. 현존하는 동일 계층 파일(`telegram.md`)과 상위 카탈로그(`_overview.md`), 관련 convention(`chat-channel-adapter.md`, `spec-impl-evidence.md`)을 기준 삼아 판정한다.

---

## 발견사항

### **[CRITICAL]** 파일 미존재 — spec-impl-evidence.md §1 대상 파일 부재
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` (파일 없음)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `spec/4-nodes/**.md` 는 frontmatter 의무 대상. `spec/conventions/chat-channel-adapter.md §5` — 신규 provider 추가 시 `spec/4-nodes/7-trigger/providers/<name>.md` 신설 필수.
- **상세**: `spec/conventions/chat-channel-adapter.md §5 Adapter Registry` 는 신규 provider 추가 절차로 "spec/4-nodes/7-trigger/providers/<name>.md 신설"을 step 1 로 강제한다. `spec/4-nodes/7-trigger/providers/_overview.md §2` 는 `slack` 을 Planned provider 로 명시하고 있으나, 대응하는 명세 파일이 없다. 구현 착수 전에 이 파일이 존재해야 `--impl-prep` 체크를 통과할 수 있다.
- **제안**: `spec/4-nodes/7-trigger/providers/slack.md` 를 신설해야 한다. 파일이 생성되면 아래 각 항목의 규약을 만족하도록 작성해야 한다.

---

### **[CRITICAL]** Frontmatter 미존재 — spec-impl-evidence.md 의무 필드 누락 예정
- **target 위치**: 파일 전체 (신규 작성 시 상단 frontmatter 블록)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `id`, `status` 의무 필드. `spec/4-nodes/**.md` 전체 적용 대상.
- **상세**: 파일이 신설될 때 아래 형식의 frontmatter 를 반드시 포함해야 한다. 구현 착수 전이므로 `status: spec-only` 가 적절하며, `code: []` 로 시작 후 구현 완료 시 경로를 채운다.
  ```yaml
  ---
  id: slack
  status: spec-only
  code: []
  ---
  ```
  이 frontmatter 가 없으면 `spec-frontmatter.test.ts` build-time 가드가 fail 한다.
- **제안**: 신규 파일 상단에 위 frontmatter 블록을 포함시킬 것.

---

### **[CRITICAL]** `_overview.md` §1 카탈로그 미갱신 — 신규 provider 등록 절차 미완료
- **target 위치**: `spec/4-nodes/7-trigger/providers/_overview.md §1 Supported providers` 및 `§2 Planned providers`
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §5` step 4 — `spec/4-nodes/7-trigger/providers/_overview.md` 인덱스 갱신 의무. `spec/4-nodes/7-trigger/providers/_overview.md §2` 신규 provider 추가 절차 step 1~2.
- **상세**: `_overview.md §2` 의 절차는 (1) §1 표에 새 행 추가, (2) §2 에서 해당 항목 제거를 명시한다. `slack` 은 현재 §2 Planned 목록에만 있고 §1 에 없다. 구현 착수 시 `slack.md` 신설과 동시에 `_overview.md §1` 에 `slack | ./slack.md | supported (v1)` 행을 추가하고 §2 에서 제거해야 한다.
- **제안**: `slack.md` 파일 신설 commit 에서 `_overview.md §1`·`§2` 를 동시 갱신할 것.

---

### **[WARNING]** 문서 섹션 구조 — Overview / 본문 / Rationale 3섹션 미충족 위험
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` (신규 작성 시 본문 구조)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장. `spec/4-nodes/7-trigger/providers/_overview.md §2` 신규 provider 추가 절차 step 3 — "`telegram.md` 와 동일한 섹션 구조 채택 (Overview / Bot API 매핑 / 명령 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 비기능 / Rationale)".
- **상세**: `_overview.md` 는 `telegram.md` 의 섹션 구조를 명시적으로 요구한다. 이를 따르지 않으면 일관성 위반이다. Slack 에서는 "Bot API 매핑" → "Slack Bolt / Events API 매핑", "명령 매핑" → "Slack command / payload 매핑" 등으로 provider 특화 명칭을 사용하되 동일한 섹션 순서를 유지해야 한다. `## Rationale` 섹션이 없거나 본문 중간에 위치하면 규약 위반.
- **제안**: `telegram.md` 의 섹션 구조(Overview → Bot API 매핑 → 명령 매핑 → 인터랙션 노드 UI 매핑 → 보안 → 비기능 → Rationale)를 기준 템플릿으로 삼아 작성할 것.

---

### **[WARNING]** provider 식별자 컨벤션 확인 필요
- **target 위치**: 신규 파일의 frontmatter `id` 필드 및 `ChatChannelAdapter.provider` 문자열
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §5` — provider 문자열은 lower-case kebab-case. `spec/4-nodes/7-trigger/providers/_overview.md §3` — lower-case, kebab-case, 외부 플랫폼 브랜드명을 직관적으로 표현.
- **상세**: Slack 의 provider 식별자는 `"slack"` (단일 단어, kebab-case 불필요)이 자연스럽다. `_overview.md §2` Planned 목록도 `slack` 으로 기재되어 있다. frontmatter `id: slack` 및 `ChatChannelAdapter.provider = "slack"` 이 일치해야 한다. 혼동이 없는 경우이나 다른 provider (예: `kakao-talk`) 와 달리 붙여쓰기 여부를 명시적으로 확인할 것.
- **제안**: 파일명 `slack.md`, frontmatter `id: slack`, 어댑터 `provider: "slack"` 을 일치시킬 것.

---

### **[INFO]** 관련 문서 링크 블록 — 상단 cross-reference 권장
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` 최상단 (frontmatter 직후)
- **위반 규약**: `spec/4-nodes/7-trigger/providers/telegram.md` 패턴 — frontmatter 직후 `> 관련 문서:` 블록으로 상위 카탈로그·Chat Channel·EIA·Webhook spec 링크 제공.
- **상세**: `telegram.md` 는 `_overview.md`, `15-chat-channel.md`, `chat-channel-adapter.md`, `14-external-interaction-api.md`, `12-webhook.md` 등을 관련 문서로 나열한다. `slack.md` 도 동일한 패턴으로 관련 문서 블록을 포함해야 일관성이 유지된다.
- **제안**: frontmatter 직후에 동일 형식의 관련 문서 블록을 추가할 것.

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 파일이 현재 존재하지 않는 상태이다. 구현 착수 전에 이 파일을 신설해야 하며, 신설 시 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 의무(`id`/`status`/`code`), `spec/conventions/chat-channel-adapter.md §5` 의 어댑터 등록 4단계 절차(명세 파일 신설 + `_overview.md` 갱신 + 어댑터 구현 + registry 등록), `_overview.md` 의 섹션 구조 요건(`telegram.md` 동일 구조)을 모두 충족해야 한다. 파일 부재는 build-time 가드(`spec-frontmatter.test.ts`) 가 `spec/4-nodes/**.md` 전체를 스캔할 때에는 해당 경로가 없으므로 직접 fail 을 일으키지는 않지만, `_overview.md §5 Adapter Registry` 절차 미완수라는 구조적 gap 이 존재한다. 구현 착수 조건(--impl-prep) 으로서 spec 파일 신설이 선행되어야 한다.

---

## 위험도

**HIGH** — spec 파일이 없는 상태에서 구현을 시작하면 SDD(Spec-Driven Development) 원칙 위반이 된다. Chat Channel Adapter convention 의 등록 절차(§5)가 미완수 상태이며, 구현 완료 후 `_overview.md` 카탈로그와 정합성 검증을 소급 적용해야 하는 위험이 있다. Critical 발견사항 3건이 모두 spec 파일 부재에서 파생되므로 파일 신설 전 구현 착수는 권장하지 않는다.
