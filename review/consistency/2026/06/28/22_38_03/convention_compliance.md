# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/7-trigger/providers/` (4개 파일: `_overview.md`, `discord.md`, `slack.md`, `telegram.md`)
**검토 모드**: impl-done (diff-base: origin/main)

---

## 발견사항

### [WARNING] slack.md / discord.md — MDX 가이드 파일이 `code:` 에 등재 (본래 위치는 `user_guide:`)
- **target 위치**: `slack.md` frontmatter `code:` 항목 중 `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`, `slack.en.mdx`; `discord.md` 의 `discord.mdx`, `discord.en.mdx`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1 필드 정의` 및 `§5.3 완성 머지 시` 예시
- **상세**: `code:` 의 정의는 "본 spec 이 약속한 surface 의 구현 경로"이며, `.mdx` 가이드 페이지는 "가이드 크로스링크"용 `user_guide:` 에 두도록 convention 예시가 명시한다 (`§5.3` 예시에서 `telegram.mdx` 가 `user_guide:` 아래 등장). 두 파일이 `.mdx` 를 `code:` 에 혼입시켜 spec-code-paths 가드가 `.mdx` 실존으로 통과하는 것은 기술적으로 오류가 아니지만 의미론적으로 `code:` = 구현 surface, `user_guide:` = 가이드 cross-link 라는 도메인 구분을 깨뜨린다. `telegram.md` 는 `.mdx` 를 `code:` 에 포함하지 않으며 (별도의 `user_guide:` 필드도 없음), 세 파일 간 일관성이 없다.
- **제안**: `slack.md`·`discord.md` 의 `.mdx` 항목을 `code:` 에서 제거하고 `user_guide:` 키 아래로 이동. 또는 세 파일을 `user_guide:` 키 없이 `.mdx` 를 `code:` 에 유지하도록 통일 후 convention 예시(§5.3)를 갱신. 전자(convention 예시 준수)가 의미상 더 명확하다.

---

### [INFO] telegram.md — `## 5` 하위 절 번호가 5.1→5.4→5.6 (5.5 결번)
- **target 위치**: `telegram.md §5 인터랙션 노드 UI 매핑` — `5.4 Carousel / Chart / Table` 다음이 `5.6 Execution Failed` (5.5 없음)
- **위반 규약**: `spec/4-nodes/7-trigger/providers/_overview.md §1 신규 provider 추가 절차` — "`telegram.md` 와 동일한 8섹션 + Rationale 구조 채택"이라 명시. Slack/Discord 의 §5.5 Typing 절이 정규 구조로 확립됐으나 Telegram 문서만 5.5 가 없음
- **상세**: Slack(`§5.5 Typing`), Discord(`§5.5 Typing`)는 동일 번호에 typing indicator 절을 두고, Telegram 은 §5.4 내에서 typing 을 설명한 뒤 §5.6 Execution Failed 로 건너뜀. `telegram.md §5.6` 자체에 "Slack/Discord 의 §5.6 과 정렬 (provider 간 동일 의무 가시성 우선)" 이라는 주석이 있어 의도적인 정렬이지만, §5.5 결번 상태로 두면 새 provider 작성 시 기준 파일(`telegram.md`) 의 구조를 따를 때 혼란이 발생할 수 있다.
- **제안**: 정보 제공 수준의 문제이므로 즉시 수정 불필요. 향후 `telegram.md` 에 `### 5.5 Typing (CCH-MP-04 - typing 등가)` 절을 추가해 "Slack/Discord 와 달리 `sendChatAction(typing)` 는 §5.1 에서 인라인 기술" 이라 한 줄 참조 처리하면 3개 파일의 5섹션 구조가 동일해진다.

---

### [INFO] `_overview.md` — 카탈로그 §1 표가 `supported (v1)` 상태를 선언하나 discord/slack/telegram 의 frontmatter 는 `status: partial`
- **target 위치**: `_overview.md §1 Supported providers (v1)` 표 — 세 provider 모두 `supported (v1)`으로 표기
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` — `partial` 과 `implemented` 의 의미 구분
- **상세**: `_overview.md` 의 `supported` 는 provider 카탈로그 도메인 용어(adapter + registry + e2e 완료)이고, 개별 spec 파일 frontmatter 의 `status: partial` 은 spec-impl-evidence 도메인 용어(spec 에 약속한 surface 가 모두 구현됐는가). 두 용어 공간은 다르므로 서로 모순이 아님. 그러나 외부 독자가 카탈로그 `supported`를 보고 frontmatter `partial`을 보면 혼동할 수 있어 가시성 차원에서 언급.
- **제안**: 현행 구조는 설계 의도이므로 변경 불필요. 다만 `_overview.md §1` 에 "각 provider 의 spec 구현 완성도(`partial`/`implemented`)는 각 파일 frontmatter 참조" 라는 주석 한 줄을 추가하면 오해 여지가 줄어든다.

---

## 요약

`spec/4-nodes/7-trigger/providers/` 의 4개 파일은 정식 규약(`spec/conventions/spec-impl-evidence.md`, `chat-channel-adapter.md`) 에 대한 **구조적 중대 위반은 없다**. `_overview.md` 는 `_*.md` 면제 규칙에 따라 frontmatter 없이 적법하며, 세 provider spec 은 `id`/`status`/`code:`/`pending_plans:` 를 모두 보유하고 8섹션 + Rationale 구조를 준수한다. provider 식별자 규약(lower-case kebab-case) 도 `telegram`/`slack`/`discord` 로 정합한다. 주요 발견은 `slack.md`·`discord.md` 가 `.mdx` 가이드 파일을 `code:` 아래에 두어 convention 예시의 `user_guide:` 위치 권고를 따르지 않는 WARNING 1건과, `telegram.md` 의 §5.5 결번이라는 형식 일관성 INFO 1건이다. 전자는 세 파일 간 비일관성과 "가이드 크로스링크 vs 구현 surface" 도메인 혼입을 유발하므로 정정 권장이다.

---

## 위험도

**LOW**
