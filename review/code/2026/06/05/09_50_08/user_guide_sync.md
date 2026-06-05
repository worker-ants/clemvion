# 유저 가이드 동반 갱신 리뷰

리뷰 기준: `.claude/config/doc-sync-matrix.json` rows[] + `spec/conventions/user-guide-evidence.md`  
변경 diff: `git diff 9f30216f..HEAD`  
매트릭스 trigger 총 17건, 매칭된 trigger 3건, 누락 2건.

---

## WARNING

**`agent-memory.en.mdx` frontmatter 누락 — ko.mdx 와 구조적 불일치**

- 변경 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/agent-memory.en.mdx`
- 매트릭스 항목: `userguide-gui-flow-section` (trigger: `06-integrations-and-config/**.mdx`) + `integration-provider-change` — 통합 신규/제공자 변경 시 `06-integrations-and-config/<provider>.{mdx,en.mdx}` 구조 준수
- 누락된 동반 갱신: `agent-memory.en.mdx` 의 YAML frontmatter 블록
- 상세: `agent-memory.mdx`(ko)는 표준 frontmatter(`title`, `title_en`, `section`, `order`, `summary`, `summary_en`, `spec`, `code`)를 모두 갖추고 있으나, `agent-memory.en.mdx`는 frontmatter 없이 본문만 시작한다. `registry.test.ts`(frontmatter `spec:` / `code:` 경로 실존 가드)가 `.en.mdx`를 대상으로 포함한다면 빌드 실패 또는 사이드바에서 영문 타이틀이 ko 파일의 `title_en` 폴백으로 제공되어 locale 분기 로직(`localizedTitle`)이 정상 동작하지 않는다. 기존 모든 `.en.mdx`(telegram, slack, discord, web-chat)는 동일한 frontmatter 구조를 갖는다.
- 제안: `agent-memory.en.mdx` 상단에 아래 frontmatter를 추가한다.

  ```yaml
  ---
  title: "Agent Memory"
  title_en: "Agent Memory"
  section: "06-integrations-and-config"
  order: 11
  summary: "Browse and clean up the persistent memory an AI Agent accumulates under the persistent memory strategy, organized by scope."
  summary_en: "Browse and clean up the persistent memory an AI Agent accumulates under the persistent memory strategy, organized by scope."
  spec: ["spec/2-navigation/16-agent-memory.md", "spec/5-system/17-agent-memory.md", "spec/4-nodes/3-ai/1-ai-agent.md"]
  code: ["codebase/frontend/src/app/(main)/agent-memory/page.tsx", "codebase/frontend/src/lib/api/agent-memories.ts"]
  ---
  ```

---

## WARNING

**`agent-memory.mdx` / `agent-memory.en.mdx` 에 `<ImplAnchor kind="ui-entry">` 부재 — `integrations-coverage.test.ts` 잠재 회피**

- 변경 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/agent-memory.mdx`, `agent-memory.en.mdx`
- 매트릭스 항목: `userguide-gui-flow-section` — "`<ImplAnchor kind="ui-entry"> 동반 작성 — file/symbol 실존 의무`". convention_ref: `spec/conventions/user-guide-evidence.md`
- 누락된 동반 갱신: 두 파일 본문 어디에도 `<ImplAnchor>` 없음
- 상세: `integrations-coverage.test.ts`의 `findGuiFlowSections()`는 heading 또는 body에 bareword `GUI`가 있는 절만 GUI flow section으로 분류한다. `agent-memory.mdx`의 "화면 열기"절, `agent-memory.en.mdx`의 "Open the screen"절 모두 `GUI` 키워드가 없으므로 현재 테스트는 이 파일을 **"no GUI section — skip"** 경로로 통과시킨다. 테스트가 통과하더라도 `spec/conventions/user-guide-evidence.md §3.1`에 따르면 `06-integrations-and-config/` 내 UI 진입점을 설명하는 절은 `<ImplAnchor kind="ui-entry">`를 동반해야 한다. 현재 가이드는 `codebase/frontend/src/app/(main)/agent-memory/page.tsx`라는 실제 UI 진입점이 존재하므로 anchor 등록이 필요하다. 또한 향후 `findGuiFlowSections()`의 검출 신호가 확장될 경우(한국어 heading 지원 등) 해당 절이 GUI section으로 분류되면 테스트가 즉시 실패 전환된다.
- 제안:
  1. `agent-memory.mdx` "화면 열기"절에 아래 anchor 삽입:
     ```mdx
     <ImplAnchor
       kind="ui-entry"
       file="codebase/frontend/src/app/(main)/agent-memory/page.tsx"
       symbol="AgentMemoryPage"
       describes="사이드바 에이전트 메모리 메뉴 → 에이전트 메모리 관리 페이지"
     />
     ```
  2. `agent-memory.en.mdx` "Open the screen"절에 동일 파일/symbol로 anchor 삽입.
  3. 또는 "화면 열기" heading을 "화면 열기 (GUI)" 로 변경하여 테스트 검출도 함께 활성화.

---

## 요약

유저 가이드 동반 갱신 관점 평가: 매트릭스 17개 trigger 중 3개(integration-provider-change, userguide-gui-flow-section, new-ui-string) 에 매칭. `new-ui-string`은 ko/en dict 양쪽(`agentMemory.ts`) + sidebar(`ko/sidebar.ts`, `en/sidebar.ts`) 모두 동반 등록되어 i18n parity 충족. `new-userguide-section-dir`은 신규 섹션 디렉토리 추가가 없으므로 해당 없음. 누락 2건: (1) `agent-memory.en.mdx` frontmatter 완전 부재 — locale 분기·registry 가드 영향, (2) 두 언어 MDX 모두 `<ImplAnchor kind="ui-entry">` 없음 — convention 미준수 및 잠재적 테스트 취약성.

## 위험도

MEDIUM

---

BLOCK: NO
