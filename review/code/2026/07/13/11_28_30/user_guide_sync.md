# User Guide Sync Review

## 발견사항

- **[WARNING]** 유저 가이드 `connecting-nodes.mdx`(+`.en.mdx`)의 "빈 영역 드롭 = 아무 일도 안 일어남" 서술이 신규 §1.2 동작으로 사실과 어긋남(stale)
  - 변경 파일: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onConnectEnd` 신설) + `codebase/frontend/src/lib/utils/edge-utils.ts`(`connectionDragSource`/`buildAutoConnectConnection` 등) — `spec/3-workflow-editor/2-edge.md` §1.2 구현체
  - 매트릭스 항목: JSON 에는 "spec 신규/대규모 변경"(`spec-major-change`, glob `spec/3-*/**`) 행이 매칭되나 그 targets 는 spec frontmatter(`code:`/`status:`/`pending_plans:`) 정합만 요구 — 이는 이미 충족(spec `code:` 에 `workflow-canvas.tsx`/`edge-utils.ts` 실존, `status: partial` + `pending_plans` 유지). 이번 발견은 JSON 행이 아니라 PROJECT.md 의 nuance 원칙("사용자 가시면 이 코드 변경의 의미를 정확히 반영하는가? 단순 동기화가 아닌 *의미 갱신*", §170-181 DOCUMENTATION 체크리스트) + 해당 MDX 자체의 `code:` frontmatter 가 `workflow-canvas.tsx` 를 명시적으로 가리키는 registry 연결에 근거
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` §"연결선 긋기" 3번 항목("...빈 캔버스... 놓으면 임시 연결선이 사라지고 **아무 일도 일어나지 않아요**") + `connecting-nodes.en.mdx` 동일 문장("...the temporary edge disappears and **nothing happens**")
  - 상세: 이번 PR(2 commits, origin/main 대비 미머지)로 출력 포트 드래그 후 빈 캔버스에 드롭하면 이제 노드 추가 검색 팝업이 열리고 노드 선택 시 자동으로 엣지가 연결된다(`spec/3-workflow-editor/2-edge.md` §1.2 갱신 완료로 코드-spec 은 정합). 그런데 사용자 가이드 `connecting-nodes.mdx`(+en)는 여전히 "빈 캔버스에 드롭하면 아무 일도 일어나지 않는다"고 명시적으로 서술 — 이 페이지 frontmatter `code:` 필드가 바로 이번에 변경된 `workflow-canvas.tsx`/`editor-store.ts` 를 가리키고 있어(`registry.test.ts` 는 경로 실존만 검증, 내용 stale 은 못 잡음), 사용자가 가이드를 그대로 신뢰하면 새로 생긴 핵심 제스처(빈 캔버스 드롭 → 팝업+자동연결)를 인지하지 못하거나 가이드와 실제 동작이 다르다고 오인할 수 있다
  - 제안: `connecting-nodes.mdx`/`connecting-nodes.en.mdx` §"연결선 긋기" 3번 항목을 "출력 포트에서 드래그 후 빈 영역에 드롭하면 노드 추가 검색 팝업이 열리고, 노드를 선택하면 자동으로 연결된다(대상에 입력 포트가 없으면 노드만 생성)"로 갱신. 다른 무효 target(출력 포트끼리·같은 노드)에 대한 "아무 일도 일어나지 않음" 서술은 유지

- **[WARNING]** 유저 가이드 `canvas-basics.mdx`(+`.en.mdx`)의 "노드를 추가하는 세 가지 방법" 목록이 §1.2 신규 네 번째 방법(출력 포트 드래그→빈 영역 드롭)을 누락
  - 변경 파일: 위와 동일(`workflow-canvas.tsx` `onConnectEnd`/`openNodeSearchPopupAt`)
  - 매트릭스 항목: 위와 동일 근거(PROJECT.md nuance, `canvas-basics.mdx` frontmatter `code:` 도 `workflow-canvas.tsx` 를 명시)
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx` "## 노드를 추가하는 세 가지 방법" `<Steps>` 목록(팔레트 드래그·팔레트 클릭·더블클릭 3가지만 서술) + `.en.mdx` "## Three ways to add a node"
  - 상세: 이 섹션은 노드 추가 방법을 사용자에게 총망라해 안내하는 곳인데, §1.2 가 도입한 "출력 포트에서 드래그해 빈 영역에 드롭 → 노드 검색 팝업 → 선택 시 자동 연결"이라는 네 번째 방법(또한 유일하게 자동으로 엣지까지 연결해주는 방법)이 빠져 있어 가이드가 불완전
  - 제안: `<Steps>` 목록에 네 번째 항목 추가(또는 "빈 영역을 우클릭해도..." 문단처럼 목록 아래 보충 문단으로), 출력 포트 드래그 시 자동 연결·트리거 등 입력 포트 없는 노드는 연결 생략됨을 명시

- **[INFO]** 이번 diff 자체(`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`)는 신규 UI 문자열(TSX 리터럴)이나 신규 노드/통합/에러코드를 도입하지 않아 i18n dict parity·backend-labels·locale 섹션 등록 트리거는 매칭되지 않음(diff 는 JSDoc 주석과 순수 헬퍼/undo 옵션 배선만 추가)
  - 변경 파일: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 확인 차 grep 한 결과 신규 toast/label 문자열 없음(추가된 한국어 텍스트는 전부 코드 주석). `dict/{ko,en}` · `backend-labels.ts` 갱신 불요로 판단

## 요약

매트릭스 20개 trigger 후보 중 이번 changeset(HEAD 커밋, edge §1.2 ai-review 반영분)에 실제 매칭된 것은 `spec-major-change`(spec/3-workflow-editor/2-edge.md frontmatter 정합 — 이미 충족, 갭 없음) 1건이며, JSON 행에는 없지만 PROJECT.md nuance("의미 갱신" 원칙 + MDX frontmatter `code:` 역참조)로 `03-workflow-editor/connecting-nodes.mdx`·`canvas-basics.mdx`(각 ko/en) 2개 유저 가이드 페이지가 §1.2 신규 동작(빈 캔버스 드롭→자동 노드추가+연결)을 반영하지 못해 WARNING 2건(문서 stale) 확인됨. i18n dict parity·backend-labels·locale 섹션 등록 등 CRITICAL 버킷 매칭은 없음. 이 changeset 은 origin/main 대비 아직 미머지된 2-commit 기능 브랜치라 머지 전 반영 여지가 있음.

## 위험도

MEDIUM
