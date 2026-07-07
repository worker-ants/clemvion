# 요구사항(Requirement) 리뷰 결과

리뷰 대상: `codebase/frontend/src/content/docs/{01-getting-started,02-nodes,03-workflow-editor,99-faq}/**`(mdx 34개 문서 diff, 대부분 신규) + `codebase/frontend/src/lib/docs/links.ts` + `spec/2-navigation/13-user-guide.md` / `spec/3-workflow-editor/_product-overview.md` / `spec/4-nodes/3-ai/_product-overview.md` (링크 경로 갱신).

본 변경은 커밋 `d7d920ef1`(`feat(docs): 워크플로우 에디터 사용자 가이드 8종 신규 + IA 재편`) 단일 커밋으로, `/docs/03-workflow-editor` 섹션에 에디터 기본기 8개 신규 페이지(canvas-basics·editing-nodes·connecting-nodes·settings-panel·containers-and-tools·saving-and-sharing·keyboard-shortcuts·overview 갱신)를 추가하고 기존 AI 어시스턴트 2페이지를 `overview`/`walkthrough` 슬러그에서 `ai-assistant`/`ai-assistant-walkthrough` 슬러그로 이동한 IA 재편이다.

## 검증 방법

문서 내용이 실제 코드 동작과 일치하는지 다음을 코드 대조로 확인했다 (모두 일치 확인됨):

- `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — Settings 탭이 `key={selectedNodeId}` 로 노드 전환 시 리마운트되어 미저장 편집이 사라짐(신규 문서 claim과 일치), `handleSave` 가 명시적 클릭 전까지 `editor-store` 에 반영 안 됨("Save Changes" 필요 claim과 일치), `isTrigger = type === "manual_trigger"` 가드로 Manual Trigger 에서 Error Handling/Disable 필드 숨김(claim과 일치).
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `saveBeforeRun()` 이 `handleRun`/`handleRunWithInput`/`handleRunFromSelected` 공통 진입점(실행 직전 자동 저장 claim과 일치).
- `codebase/frontend/src/components/editor/canvas/zoom-controls.tsx` — `MIN_ZOOM=0.25`/`MAX_ZOOM=2`(25%~200% claim과 일치).
- `codebase/frontend/src/lib/stores/recent-nodes-store.ts` — `RECENT_NODES_MAX=5`, in-memory(비영속) zustand store(세션 한정·5개 상한 claim과 일치).
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts` — `listForWorkflow` 가 `take: 50`(세션 50개 보관 claim과 일치).
- `spec/3-workflow-editor/4-ai-assistant.md` §1~§5 — 3단계 루프(Clarify/Propose Plan/Execute), Plan 카드 UX, 세션/모델 선택, 에러 시나리오 테이블이 `ai-assistant.mdx`/`ai-assistant.en.mdx` 신규 문서 서술과 line-level로 부합.
- 오래된 `walkthrough`/`overview`(AI 어시스턴트용 구 슬러그) 참조가 `codebase/frontend/src/content/docs/**` 전역에 더 이상 남아있지 않음을 grep 으로 확인 — 인바운드 링크 일괄 갱신 완료.

## 발견사항

- **[CRITICAL]** 캔버스 "Tool Area" — 이미 spec 상 제거된 기능을 여전히 활성 기능인 것처럼 서술하는 문서가 이번 PR에서 손대고도(링크만 고치고) 방치됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/ai.mdx:40,326` / `ai.en.mdx:29,315`, `codebase/frontend/src/content/docs/99-faq/faq.mdx:88` / `faq.en.mdx:77`
  - 상세: 이 diff 는 `ai.mdx`/`ai.en.mdx`/`faq.mdx`/`faq.en.mdx` 를 열어 AI 어시스턴트 링크(`.../overview` → `.../ai-assistant`)만 고쳤다. 그런데 같은 파일에 "Registering a tool is as simple as dropping the node into the canvas **Tool Area**"(`ai.en.mdx:315`), FieldTable row `"도구 노드 (Tool Area)"`(`ai.mdx:40`), FAQ Q18 `"캔버스 **Tool Area**에 노드를 끌어다 놓아요"`(`faq.mdx:88`) 가 그대로 남아 있다. 그러나 `spec/4-nodes/3-ai/1-ai-agent.md:72,234,236` 은 "⚠ 재작성 예정 (현재 제거됨) — `toolNodeIds`/`toolOverrides` 필드, Tool Area 연동, 캔버스 Tool Area UX 는 모두 config 스키마·캔버스 UX 에서 제거됐다" 라고 명시하고, `spec/4-nodes/_product-overview.md:201` 도 ND-AG-10 을 `_(제거됨 — 재작성 예정)_` 으로 표시한다. 실제 코드에서도 `grep -ri "tool area\|toolArea" codebase/frontend/src/components/editor` 결과가 0건이라 canvas 상에 "Tool Area" 라는 UI 자체가 존재하지 않는다. 더 결정적으로, **이번 PR이 신규 작성한 `containers-and-tools.mdx`/`containers-and-tools.en.mdx` 자체가 "지금은 캔버스에 AI Agent 전용 도구 영역이 따로 표시되지 않아요... 노드 설정 패널에서 관리해요"(정반대 서술)** 라고 명시해 같은 PR 안에서 두 문서가 정면으로 모순된다. 실제로 이 사실은 커밋 메시지에도 이미 인지되어 있다: "*02-nodes/ai·mcp-servers·faq 의 잔여 Tool Area 서술 정합은 후속 작업으로 분리*". 즉 알려진 채로 방치된 오류 문서가 그대로 배포되는 상태 — 사용자가 `ai.mdx`/FAQ 를 보고 존재하지 않는 "Tool Area" 에 노드를 드래그하려다 실패하게 된다.
  - 제안: 후속 작업으로 미루지 말고 이번 PR 범위에서 `ai.mdx`/`ai.en.mdx`(FieldTable row + Tips 문장) 와 `faq.mdx`/`faq.en.mdx`(Q18) 의 Tool Area 서술을 containers-and-tools 페이지 서술(설정 패널의 Knowledge Base/MCP Server 필드로 도구 등록)에 맞춰 정정. 최소한 커밋 메시지의 "후속 작업" 을 `plan/in-progress/` 에 정식 추적 항목으로 남겨야 한다 (CLAUDE.md "완료된 작업" 원칙상 알려진 미완결 정합성 이슈를 문서화 없이 방치하면 안 됨).

- **[WARNING]** spec IA 인덱스가 자신이 가리키는 새 페이지의 내용과 모순되는 레이블을 씀
  - 위치: `spec/2-navigation/13-user-guide.md` (diff, `containers-and-tools` 행)
  - 상세: 이번 diff 에서 새로 추가된 트리 설명 줄이 `├── containers-and-tools      # 컨테이너와 도구 영역 (그룹 · 중첩 · AI Agent Tool Area)` 로, "AI Agent Tool Area" 라는 표현을 그대로 쓴다. 그런데 정작 이 페이지(`containers-and-tools.mdx`)의 본문은 "지금은 캔버스에 AI Agent 전용 도구 영역이 따로 표시되지 않아요"라며 Tool Area 의 부재를 설명한다. 이 트리 설명은 이번 PR에서 새로 작성된 텍스트이므로 기존 부채가 아니라 이번 커밋 내부의 신규 불일치다.
  - 제안: `13-user-guide.md` 의 해당 설명을 "AI Agent Tool Area" 대신 "AI Agent 도구 연결(설정 패널)" 등 실제 내용에 맞는 문구로 수정.

- **[INFO]** 문서 상호 참조·슬러그 재편 정합성은 전수 확인상 이상 없음
  - 위치: `codebase/frontend/src/lib/docs/links.ts`, `spec/3-workflow-editor/_product-overview.md`, `spec/4-nodes/3-ai/_product-overview.md`, 각 mdx 파일의 `[...](/docs/03-workflow-editor/...)` 링크 전반
  - 상세: `DOCS.workflowEditor.walkthrough` 제거 후 9개 새 키(`canvasBasics`~`aiAssistantWalkthrough`)로 대체, spec 문서 2곳의 "사용자 가이드" 링크가 `overview.mdx`/`walkthrough.mdx` → `ai-assistant.mdx`/`ai-assistant-walkthrough.mdx` 로 정확히 갱신, 코드베이스 전체에서 구 슬러그(`03-workflow-editor/overview`가 AI 어시스턴트를 가리키던 용법, `03-workflow-editor/walkthrough`)에 대한 잔여 참조 0건 확인. `spec/3-workflow-editor/4-ai-assistant.md` 본문(3단계 루프·Plan 카드·세션·에러 테이블)과 신규 `ai-assistant.mdx`/`ai-assistant.en.mdx` 서술이 line-level 로 부합.
  - 제안: 없음 (참고용).

## 요약

이번 PR은 `/docs/03-workflow-editor` 섹션에 에디터 조작 가이드 8종을 신규 작성하고 AI 어시스턴트 문서를 하위 슬러그로 분리하는 대규모 문서 IA 재편이다. 검증한 핵심 동작 claim(저장 버튼 필요, 노드 전환 시 미저장 편집 소실, 실행 직전 자동 저장, 줌 범위, Recent 노드 5개 세션 한정, 세션 50개 보관, AI 어시스턴트 3단계 루프)은 모두 실제 코드/spec 과 일치해 품질이 높다. 다만 이번 PR이 직접 건드린 `ai.mdx`/`ai.en.mdx`/`faq.mdx`/`faq.en.mdx` 에는 spec 상 이미 제거된 "캔버스 Tool Area" 기능을 여전히 활성 기능처럼 서술하는 대목이 남아 있고, 이는 같은 PR이 새로 작성한 `containers-and-tools.mdx` 의 서술과 정면 모순된다 — 커밋 메시지가 "후속 작업"으로 인지·유예했음에도 추적 문서 없이 방치된 상태로 배포되므로 CRITICAL 로 판단한다. 추가로 이번 PR이 새로 작성한 `spec/2-navigation/13-user-guide.md` 의 트리 설명 문구도 같은 모순(“AI Agent Tool Area”)을 새로 도입해 WARNING 이다. 두 항목 모두 텍스트 몇 줄 수정으로 해결 가능한 낮은 리스크지만, 사용자에게 존재하지 않는 UI 조작을 안내한다는 점에서 문서 PR의 핵심 목적(정확한 사용자 안내)을 훼손한다.

## 위험도

MEDIUM — 신규 페이지 자체의 정확도는 높으나(코드/spec 대조 전수 통과), 이번 PR이 직접 편집한 기존 파일에 스스로 모순되는 "제거된 기능" 서술을 방치한 CRITICAL 1건이 있어 순수 LOW 로 보기 어렵다. 다만 영향 범위가 문서 콘텐츠에 국한되고 실제 애플리케이션 동작에는 영향이 없어 CRITICAL/HIGH 전체로는 격상하지 않음.
