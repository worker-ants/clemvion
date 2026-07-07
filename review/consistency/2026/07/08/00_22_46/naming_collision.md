# 신규 식별자 충돌 검토 — spec/2-navigation/13-user-guide.md

## 분석 범위

target 문서(`spec/2-navigation/13-user-guide.md`)는 이미 `status: implemented` 인 기존 spec 이며, 이번 변경분은 `git diff main` 기준 §2 정보 구조(IA) 표의 `03-workflow-editor/` 서브트리 재편 하나뿐이다(`overview`+`walkthrough` 2페이지 → `overview`/`canvas-basics`/`editing-nodes`/`connecting-nodes`/`settings-panel`/`containers-and-tools`/`saving-and-sharing`/`keyboard-shortcuts`/`ai-assistant`/`ai-assistant-walkthrough` 10페이지). 동반 변경으로 `codebase/frontend/src/lib/docs/links.ts` 의 `DOCS.workflowEditor.*` 신규 키 8개, `codebase/frontend/src/content/docs/03-workflow-editor/*.mdx` 신규 파일 16개(ko/en), `spec/3-workflow-editor/_product-overview.md`·`spec/4-nodes/3-ai/_product-overview.md` 의 딥링크 갱신이 포함된다. 이번 diff 는 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키를 신규 도입하지 않으므로, 실질 점검 대상은 **6. 파일 경로/슬러그 충돌** 관점이다.

## 검증 내역

- 신규 슬러그 9종(`canvas-basics`/`editing-nodes`/`connecting-nodes`/`settings-panel`/`containers-and-tools`/`saving-and-sharing`/`keyboard-shortcuts`) 각각을 `spec/`, `codebase/`, `plan/` 전체에서 grep — target 자기참조·`.next` 빌드 산출물 제외 시 기존 다른 의미의 사용처 없음.
- `codebase/frontend/src/content/docs/**/*.mdx` 전체 파일명 중복 검사 — `overview.mdx`/`overview.en.mdx` 2건만 중복이며 이는 `02-nodes/overview.mdx`(노드 개념)와 `03-workflow-editor/overview.mdx`(에디터 개요)로, 두 섹션 모두 변경 전부터 존재하던 기존 패턴(섹션별 독립 스캔이라 라우트 충돌 없음, `registry.ts` 는 `<section>/<slug>` 조합으로 canonical 파일을 식별). 신규 슬러그는 전부 unique.
- `DOCS.workflowEditor` 신규 키 8개(`canvasBasics`/`editingNodes`/`connectingNodes`/`settingsPanel`/`containersAndTools`/`savingAndSharing`/`keyboardShortcuts`/`aiAssistant`/`aiAssistantWalkthrough`) — `links.ts` 내 다른 네임스페이스(`gettingStarted`/`nodes`/`expression`/...)에 동일 키가 없어 namespace 내 충돌 없음.
- front matter `order` 값 — `03-workflow-editor` 10개 페이지가 1~10 을 정확히 1회씩 사용, 중복 없음(`overview`=1, `canvas-basics`=2, `editing-nodes`=3, `connecting-nodes`=4, `settings-panel`=5, `containers-and-tools`=6, `saving-and-sharing`=7, `keyboard-shortcuts`=8, `ai-assistant`=9, `ai-assistant-walkthrough`=10).
- 구 슬러그 `03-workflow-editor/walkthrough` 및 `DOCS.workflowEditor.walkthrough` 잔존 참조 — 전체 저장소(`.next` 빌드 산출물 제외) 검색 결과 0건. rename 이 깔끔히 완료됨.
- `03-workflow-editor/overview` 의 의미 재배정(구: AI 어시스턴트 개요 → 신: 워크플로우 에디터 개요) — 해당 slug 를 참조하는 모든 내부 링크(`settings-panel.mdx`, `canvas-basics.mdx`, `editing-nodes.mdx`, `containers-and-tools.mdx`, `saving-and-sharing.mdx`, `keyboard-shortcuts.mdx`, `connecting-nodes.mdx` 및 각 `.en.mdx`, `links.ts`)를 전수 확인한 결과 전부 새 의미("에디터 개요")로 일관되게 사용 중이며, 옛 의미(AI 어시스턴트)를 기대하는 잔존 링크는 없음. `spec/3-workflow-editor/_product-overview.md` §10, `spec/4-nodes/3-ai/_product-overview.md` §3.6, `codebase/frontend/src/content/docs/99-faq/faq.mdx` 의 딥링크도 `ai-assistant.mdx`/`ai-assistant-walkthrough.mdx` 로 함께 갱신되어 dangling 참조 없음.
- `settings-panel` slug 가 기존 코드 디렉터리 `codebase/frontend/src/components/editor/settings-panel/`(실제 노드 설정 패널 컴포넌트, `spec/3-workflow-editor/1-node-common.md` 가 SoT) 과 이름이 겹치나, 문서 페이지가 바로 그 UI 를 설명하는 용도라 의미가 일치 — 충돌이 아니라 의도된 대응 관계.

## 발견사항

없음. 이번 target diff 범위 내에서 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

### 참고 (충돌 아님, 참고용)

- **[INFO]** `overview.mdx` 슬러그의 섹션 간 재사용
  - target 신규 식별자: 해당 없음(기존 패턴 유지)
  - 기존 사용처: `codebase/frontend/src/content/docs/02-nodes/overview.mdx`
  - 상세: `03-workflow-editor/overview.mdx` 와 파일명이 같지만 `registry.ts` 스캔이 `<section>/<slug>` 조합으로 canonical 경로를 구성하므로 라우트·앵커 충돌은 없다. 다만 두 `overview` 가 문서 트리 곳곳에 반복돼 딥링크 리뷰 시 사람이 헷갈리기 쉬운 이름이라는 점은 참고.
  - 제안: 조치 불필요(기존 컨벤션이며 이번 diff 가 신규 도입한 문제 아님).

## 요약

이번 target 변경은 `/docs/03-workflow-editor/*` 서브트리를 2페이지에서 10페이지로 재편하는 순수 문서 재구성으로, 신규 슬러그·`DOCS.*` 상수·`order` 값·구 슬러그 잔존 참조를 전수 대조한 결과 다른 의미로 이미 쓰이고 있는 식별자와의 충돌은 발견되지 않았다. `overview` 슬러그 재배정(AI 어시스턴트 개요 → 에디터 개요)도 관련된 모든 내부 링크가 새 의미로 일관 갱신되어 있어 실질적인 혼선 소지가 없다. 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 변수 등 다른 관점에서는 이번 diff 가 신규 식별자를 도입하지 않는다.

## 위험도

NONE
