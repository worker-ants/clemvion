### 발견사항

- **[INFO]** 이번 diff(35개 파일)는 최소 8~9개의 서로 다른 plan-closure 주제를 아우르지만, 전부 커밋 단위로 번호(①~⑨)를 매겨 명시적으로 분리·문서화되어 있어 통상적 의미의 "의도치 않은" 스코프 확장은 아님
  - 위치: `git log origin/main..HEAD` 기준 5개 커밋 — `ceaaf2d69`(①~⑤ plan grooming: ai-agent-tool-payload-budget-guardrail·trigger-param-output-enricher·rag-dynamic-cut → complete, competitive-analysis-n8n-flowise → research/, sqitch-poc 흡수), `1dc27d53d`(rag-search status W1), `f0f46c329`(plan/complete dead 백링크 5곳), `1dafe557f`(⑥ Cafe24 485 실측), `9adb5c241`(⑦ Cafe24 D-2 에러격리 + ⑧ Merge P2→P3 ADR + ⑨ plan-only 잡음)
  - 상세: 각 항목은 커밋 메시지에 근거·범위·consistency-check 세션 ID 까지 명시하고, `spec/**` 변경은 대응하는 `review/consistency/2026/07/17/{00_17_40,00_35_59,00_55_57}/` 3개 세션으로 뒷받침된다. 형식적으로는 "번들"이지만 각 조각이 개별 plan 의 완결 처리와 1:1 대응해 추적 가능하며, `## Rationale` 신설·근거 인용도 매 항목마다 갖춰져 있다 — 전형적인 "관련 없는 리팩토링 섞기"나 "몰래 끼워넣기"와는 성격이 다르다.
  - 제안: 특별 조치 불요. 다만 이렇게 많은 독립 plan-closure 를 한 PR/리뷰 사이클로 묶으면 개별 롤백·부분 반려가 어려워지므로, 향후에는 spec-drift 성격이 다른 항목(예: AI Agent countmax vs Merge ADR)은 별도 PR 로 쪼개는 편이 리뷰·revert 원자성 면에서 유리하다.

- **[WARNING]** 커밋 `9adb5c241` 의 제목은 "⑦ Cafe24 D-2 + ⑧ Merge ADR" 두 항목만 표방하지만, 실제로는 본문에 "⑨ 일부(plan-only)"로 disclose 된 세 번째 무관 묶음(`spec/2-navigation/1-workflow-list.md` pending_plans 재배선, `node-cancellation-inflight-followups.md` 사실관계 정정, `ai-agent-tool-connection-rewrite.md` 경로 정정)이 같은 커밋에 섞여 있음
  - 위치: `spec/2-navigation/1-workflow-list.md` (`pending_plans: spec-sync-workflow-list-gaps.md` → `marketplace-and-plugin-sdk.md`), 커밋 `9adb5c241`
  - 상세: 이 항목은 커밋 제목(⑦+⑧)이 약속하는 두 주제(Cafe24 D-2 에러격리, Merge ADR) 중 어디에도 해당하지 않는다. 커밋 body 에서는 "⑨ 일부 (plan-only)"로 스스로 disclose 하고 있어 완전히 숨겨진 변경은 아니나, 이번 리뷰 payload 에 포함된 3개 consistency-check 세션(`00_17_40` spec/conventions 대상, `00_35_59` spec-draft-cafe24-countmax 대상, `00_55_57` D1/D2=⑦/⑧ 대상) 어디에도 이 workflow-list.md 재배선에 대한 검토 근거가 없다 — 즉 ⑦/⑧ 은 정식 `--spec` draft 검토를 거쳤지만 ⑨ 는 같은 리고 없이 같은 커밋에 얹혔다.
  - 제안: 필수는 아니나(plan frontmatter 재배선은 저위험 문서 편집), 향후에는 이런 "김에 처리" 항목도 최소 별도 커밋으로 분리하거나 커밋 제목에 명시해 리뷰 트레일과 1:1 대응을 유지할 것.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md`(파일29)·`spec/4-nodes/3-ai/0-common.md`(파일27)·`spec/4-nodes/3-ai/1-ai-agent.md`(파일28)·`spec/0-overview.md`(파일22)는 모두 동일 주제(Cafe24/MakeShop 485/161 endpoint 수치 정정 + `AI_AGENT_TOOL_COUNT_MAX` allowlist 경고)를 다루며, `spec-draft-cafe24-countmax.md` draft(D1~D4)와 정확히 1:1 대응 — 정상적인 단일 주제 변경 세트로 확인됨. 무관한 수정이나 추가 기능 확장 없음.

- **[INFO]** `spec/4-nodes/1-logic/11-merge.md`(파일26, Merge P2→P3 ADR)와 `spec/2-navigation/4-integration.md`(파일24 후반부, Cafe24 D-2 에러격리 정책)는 서로 무관한 두 주제이지만 같은 커밋(`9adb5c241`)에서 각각 독립된 `## Rationale` 섹션으로 분리 서술되어 파일/섹션 단위로는 뒤섞이지 않았다. `spec/5-system/11-mcp-client.md`(파일30)는 status 승격(`partial`→`implemented`)+`pending_plans` 제거, capabilities cache won't-do 문서화, countmax 관련 D3 세 개 concern 이 한 파일에 섞여 있으나 이는 커밋 `ceaaf2d69`(①~⑤, spec-sync-mcp-client-gaps 종결)와 `1dafe557f`/`9adb5c241`(countmax) 두 개 서로 다른 커밋에서 순차적으로 편집된 결과로, 각 diff hunk 는 원인 커밋과 정확히 대응한다 — 파일이 같다는 이유만으로 스코프 위반은 아님.

- **[INFO]** `plan/in-progress/parallel-p2-followups.md` → `plan/complete/` 이동에 따른 상대링크 경로 정정 3건(`spec/conventions/cross-node-warning-rules.md`, `execution-context.md`, `node-cancellation.md`) 및 `spec/4-nodes/1-logic/10-parallel.md` 의 동일 링크 정정 1건은 순수 기계적 경로 교정으로, 별도 논의 없이 포함되어도 스코프 위반이 아니다(plan 파일 rename 의 직접 귀결).

- 검토한 8개 관점 중 나머지(불필요한 리팩토링, 기능 확장/over-engineering, 포맷팅 변경, 주석 변경, 임포트 변경, 설정 변경)는 해당 사항 없음 — 35개 파일 전부 markdown(spec 문서 + review 산출물)이며 코드/설정/임포트/포맷팅 변경이 아예 존재하지 않는다. `codebase/**` 파일은 이번 diff 에 하나도 없다.

### 요약

이번 변경은 35개 파일 모두 `spec/**` 문서와 `review/consistency/**`·`review/code/**` 산출물로만 구성되며 `codebase/**` 코드 변경이 전혀 없어, 리팩토링·기능확장·포맷팅·임포트·설정 관점의 위반은 발견되지 않았다. 다만 브랜치 전체는 8~9개의 서로 다른 plan-closure 주제(AI Agent tool-count 드리프트, Cafe24 D-2 에러격리, Merge P2→P3 ADR, Parallel waitAll 마이그레이션 결정, MCP client status 승격, RAG search plan 재배선, plan 경로 이동 후속 등)를 5개 커밋에 나눠 담고 있다 — 각 항목은 번호(①~⑨)와 근거·consistency-check 세션으로 명시적으로 disclose 되어 있어 "숨겨진" 스코프 확장은 아니지만, 마지막 커밋(`9adb5c241`)에 한해 제목이 표방하는 두 주제(⑦+⑧) 외에 세 번째 무관 묶음(⑨, workflow-list.md pending_plans 재배선 등)이 정식 `--spec` 검토 트레일 없이 같은 커밋에 섞여 들어간 점은 경미한 스코프 경계 흐림으로 지적할 만하다. 전체적으로는 원자적 리뷰가 다소 어려운 대형 grooming 배치이나, 각 변경이 개별 plan/Rationale 로 추적 가능하고 무관한 코드 수정·포맷팅·주석·임포트 오염은 전혀 없다.

### 위험도
LOW
