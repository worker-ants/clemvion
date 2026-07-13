# 문서화(Documentation) 리뷰 결과

대상: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), `codebase/frontend/src/content/docs/03-workflow-editor/{canvas-basics,connecting-nodes}.{mdx,en.mdx}`, `review/code/2026/07/13/{11_04_21,11_28_30}/*`(직전 두 라운드 ai-review 산출물 커밋)

본 changeset 은 §1.2(출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결) 최초 구현 + 이에 대한 ai-review 2라운드(11_04_21 HIGH→해소, 11_28_30 MEDIUM→해소) 반영 커밋 3개를 포함한다. 직전 두 라운드가 지적한 documentation/user_guide_sync 항목(spec stale, CHANGELOG 미갱신, 유저 가이드 2페이지 stale, skipUndo 테스트 부재)이 실제로 코드베이스에 반영됐는지 직접 실측 대조했다.

## 발견사항

- **[WARNING]** `onConnectEnd` 위 블록 주석이 이미 폐기된 필드명(`popup.source`)을 참조 — 2회차 개명(`source`→`dragSource`) 이후 갱신 누락된 stale 주석
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:336` (`// 연결한다(popup.source 에 연결원 기록 → handleAddNodeFromSearch 가 소비). React Flow v12`)
  - 상세: 1회차 ai-review(11_04_21) INFO #13 을 반영해 `NodeSearchPopupState.source` → `dragSource` 로 개명했고(`workflow-canvas.tsx:110-111`), 그 근거 주석("Connection.source 문자열과 구분하려고 dragSource 로 명명")과 `openNodeSearchPopupAt` 위 주석(:301, "dragSource 가 주어지면...")은 정확히 갱신됐다. 그러나 같은 개명 대상이었던 `onConnectEnd` 함수 바로 위 블록 주석(:334-338)은 개명 전 필드명 `popup.source` 를 그대로 남겨두었다 — 실제 코드에는 `popup`이라는 지역 변수/필드 자체가 존재하지 않고(`nodeSearchPopup.dragSource` 가 맞는 참조, `handleAddNodeFromSearch`:603 참조), `connectionDragSource()` 반환값도 지역 변수 `dragSource`(:342)에 담긴다. 이는 리네임이 코드 전체에 걸쳐 완전히 전파되지 못하고 주석 한 곳에만 잔존한 전형적인 stale-comment 사례로, 신규 독자가 `onConnectEnd` 를 읽을 때 실재하지 않는 `popup.source` 라는 이름을 찾다가 혼동할 수 있다.
  - 제안: `// 연결한다(popup.source 에 연결원 기록 ...)` → `// 연결한다(NodeSearchPopupState.dragSource 에 연결원 기록 ...)` 또는 단순히 `dragSource` 로 표현을 정정.

- **[INFO]** SoT spec `spec/3-workflow-editor/2-edge.md` §1.2 stale 라벨/각주 — 실측 결과 정확히 해소 확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2 (L32-37)
  - 상세: 헤더 "(미구현 · Planned)" 제거, "현재 구현" 각주가 실제 구현(`onConnectEnd`, React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle`, `NodeSearchPopupState.dragSource`, `buildAndAddNode` id 반환, `onConnect` `skipUndo`, 순수 헬퍼 4종)과 정확히 일치하도록 갱신됨을 직접 대조로 확인. "대상 노드에 입력 포트가 없으면 연결 생략" 불릿도 `buildAutoConnectConnection` 의 `null` 반환 경로와 일치. `status: partial`/`pending_plans` 는 §1.3 등 잔여 항목 때문에 유지되어 타당.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** CHANGELOG 미갱신 — 실측 결과 해소 확인, 저장소 관례에 부합
  - 위치: `CHANGELOG.md` L3-4 (최상단 신규 `## Unreleased — 워크플로 편집기 출력 포트 드래그→빈 영역 드롭 노드 추가 팝업 + 자동 엣지 연결` 섹션)
  - 상세: 자매 항목(§2.2/§2.3, 웹채팅 carousel 등)과 동일한 톤·상세도(핵심 동작 굵게 + 종전 상태 + 구현 파일/함수명 + undo 단일화 근거 + SoT 경로)로 작성되고 실제 diff 와 내용이 모두 일치.
  - 제안: 없음.

- **[INFO]** 유저 가이드 2페이지(ko/en) stale — 실측 결과 해소 확인
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.{mdx,en.mdx}`("세 가지"→"네 가지" 방법, §1.2 항목 추가), `connecting-nodes.{mdx,en.mdx}`("빈 캔버스 드롭 = 아무 일 없음" → §1.2 신규 동작 서술로 분리)
  - 상세: 11_28_30 라운드 user_guide_sync WARNING 2건(빈 캔버스 드롭 서술 stale, 노드 추가 방법 목록 누락)이 정확히 반영됨. 다른 무효 target("출력 포트끼리·같은 노드")의 "아무 일도 일어나지 않음" 서술은 그대로 유지해 §1.2 케이스만 분리한 점도 적절. connecting-nodes.mdx 신규 4번 항목이 canvas-basics.mdx 신규 네 번째 방법과 상호 교차링크(`[노드 연결하기](/docs/03-workflow-editor/connecting-nodes)`)되어 있어 두 문서 간 정합도 확인됨.
  - 제안: 없음.

- **[INFO]** `onConnect` `skipUndo` 옵션 회귀 테스트 부재 — 실측 결과 해소 확인
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` 신규 `describe("onConnect — skipUndo (§1.2)")`(2케이스: opts 미지정 시 undoStack +1, `{skipUndo:true}` 시 undoStack 불변)
  - 상세: 11_28_30 라운드 documentation/testing 리뷰가 지적한 "주석상의 계약(`opts?.skipUndo` 기본값 false)이 테스트로 뒷받침되지 않음" 이슈가 이 diff 에서 정확히 해소됨. `editor-store.ts` L89-91 의 JSDoc 스타일 주석("opts.skipUndo — 호출자가 직전에 이미 pushUndo 한 경우... 기본 false")과 테스트 단언이 정확히 대응.
  - 제안: 없음.

- **[INFO]** 신규 순수 헬퍼 5종(`edge-utils.ts`) JSDoc 및 `workflow-canvas.tsx`/`editor-store.ts` 인라인 주석 전반 — 개명 지점(위 WARNING 제외) 정확·충실
  - 위치: `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`
  - 상세: 모든 함수에 목적·판정 근거·null 반환 조건(§1.2/§1.3 경계 포함)을 설명하는 JSDoc 이 있고 실제 구현과 일치한다(`connectionDragSource` 의 "§1.3 소관이라 배제" 서술은 `fromHandle?.type !== "source"` 가드와 정확히 대응).
  - 제안: 없음.

- **[INFO]** spec `## Rationale` 섹션에 §1.2 엣지 케이스(입력 포트 없으면 연결 생략) 설계 근거 미등재 — 2라운드 전부터 "선택 사항"으로 분류, 여전히 미반영
  - 위치: `spec/3-workflow-editor/2-edge.md` `## Rationale`(R-1, R-2 만 존재)
  - 상세: 직전 두 라운드에서 동일하게 지적되고 매번 "필수 아님/선택"으로 분류된 항목으로, 이번 라운드에도 변화 없음. 기능적 영향 없음.
  - 제안: 선택 사항 — 필수 아님. 변경 없이 두어도 무방.

- **[INFO]** `connecting-nodes.mdx`/`.en.mdx` frontmatter `code:` 목록에 `edge-utils.ts` 미포함 (pre-existing, 이번 diff 로 신규 도입된 갭 아님)
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` frontmatter `code:` (custom-edge.tsx, use-edge-highlighting.ts, workflow-canvas.tsx, editor-store.ts 만 등재)
  - 상세: 이번 §1.2 구현의 판정·조립 로직 대부분(`connectionDragSource`/`buildAutoConnectConnection`/`firstInputHandleId`/`pointerClientPosition`/`isConnectionDroppedOnPane`)이 `edge-utils.ts` 에 있고, 이 문서가 바로 "연결 유효성 규칙"을 설명하는 페이지임에도 `code:` 레지스트리에 `edge-utils.ts` 가 없다. `git show origin/main:...connecting-nodes.mdx` 대조 결과 이 갭은 이번 PR 이전부터 있던 pre-existing 상태(§2.2/§2.3 의 `isSelfConnection`/`isDuplicateConnection` 도 같은 파일 소속인데 이미 누락)라 이번 diff 의 회귀는 아니다.
  - 제안: 차단 사유 아님. 다음에 이 문서를 만질 기회에 `code:` 목록에 `edge-utils.ts` 추가를 고려.

## 요약

이번 changeset 은 직전 두 ai-review 라운드(11_04_21 HIGH, 11_28_30 MEDIUM)가 낸 documentation/user_guide_sync 관련 지적 전건(SoT spec stale, CHANGELOG 미갱신, 유저 가이드 2페이지 stale, skipUndo 테스트 부재)을 실측 대조 결과 정확히 해소했다. 다만 이번 실측 과정에서 두 라운드 모두가 놓친 잔여 결함 하나를 새로 발견했다 — `onConnectEnd` 블록 주석(`workflow-canvas.tsx:336`)이 2회차에 개명된 `NodeSearchPopupState.dragSource` 대신 폐기된 필드명 `popup.source` 를 그대로 참조하는 stale 주석이다. 차단 수준은 아니나(실제 동작에는 영향 없음, 주석 정정만 필요) 정확성 관점에서 WARNING 으로 기록한다. 그 외 spec Rationale 미보강, `connecting-nodes.mdx` frontmatter 의 pre-existing `edge-utils.ts` 미등재는 이전부터 선택 사항/무관련 갭으로 분류되어 있어 조치 불요.

## 위험도
LOW
