# 변경 범위(Scope) 리뷰

## 대상

`feat(editor): 엣지 위 노드 드롭 → 엣지 분할 + 중간 삽입 (edge §4.1)` — 팔레트 노드를 기존 엣지 위에 드롭하면 엣지를 분할(split)해 중간에 노드를 삽입하는 기능 (spec `2-edge.md` §4 "미구현 · Planned" → §4.1 구현). `git diff origin/main --stat` 기준 47개 파일, 2279(+)/10(-), 3개 커밋(`115ea91d2` 최초 구현 + `0c4cd362d`/`c77db66b1` ai-review 1·2회차 fix).

## 발견사항

- **[INFO]** 47개 파일 중 실질 코드/문서 파일은 10개, 나머지 37개는 프로세스 산출물
  - 위치: `review/code/2026/07/13/{18_32_28,18_59_13}/**`(24개) · `review/consistency/2026/07/13/18_06_53/**`(8개) · `plan/complete/spec-sync-edge-gaps.md`(rename, 1개)
  - 상세: `consistency-check --impl-prep`(착수 전 의무) 산출물 8개, ai-review 1·2회차 산출물(RESOLUTION/SUMMARY/각 관점 md/meta.json/_retry_state.json) 24개가 diff 에 포함돼 있다. 모두 CLAUDE.md 가 규정한 저장 위치(`review/code/**`, `review/consistency/**`)에 정확히 있고, `review/` 는 gitignore 대상이 아니라 커밋 대상이 맞다(project convention). 실질 코드 변경과 무관한 파일 유입이 아니라 이 작업 자체가 거친 필수 프로세스의 증적이다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` → `plan/complete/spec-sync-edge-gaps.md` rename + frontmatter(`status: complete`/`completed`/`spec_impact`) 추가
  - 위치: `plan/complete/spec-sync-edge-gaps.md`
  - 상세: 이번 §4.1 구현으로 해당 plan 의 마지막 잔여 surface(5개 중 마지막)가 완료돼 전부 종결됨을 반영한 정상적 plan lifecycle 이동(`plan-lifecycle.md` 규약과 일치, `spec_impact` 가 리스트 형식). 본문 checkbox 도 이번 작업이 실제로 완료한 §4 항목 하나만 `[ ]`→`[x]` 전환했고 다른 항목은 이미 이전 커밋들에서 체크돼 있었다(diff 로 확인). 스코프 이탈 아님.
  - 제안: 조치 불요.

- **[INFO]** `spec/3-workflow-editor/2-edge.md` 변경이 §4.1 신설 절 + `## Rationale` R-3 + frontmatter `pending_plans` 정리로 국한
  - 위치: `spec/3-workflow-editor/2-edge.md`
  - 상세: 표 1행 갱신("미구현"→"구현됨 §4.1") + §4.1 신설 절 + R-3 Rationale(대안 비교 a/b/c 포함, ai-review 1회차 CRITICAL 후속 보강 기록) + `pending_plans` 에서 완료 plan 참조 제거. 이번 기능과 무관한 다른 절(§1~§3, §5~§11)은 손대지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `workflow-canvas.tsx` `onDrop` 변경은 순수 추가(20여 줄) + `useCallback` 의존성 배열에 실제 신규 참조 3개(`edges`, `removeEdge`, `onConnect`)만 추가
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`
  - 상세: 기존 `buildAndAddNode(nodeType, position)` 한 줄을 대체하되, 원 호출을 지우지 않고 `newId` 를 받아 그 결과를 이후 분기에서 재사용하는 형태로 확장했다. 관련 없는 다른 로직(§1.2/§1.3/§3.2/§4·§5 hover preview)은 건드리지 않았다.
  - 제안: 조치 불요.

발견된 CRITICAL/WARNING 없음. 점검 관점별 확인 결과:

- **의도 이상의 변경**: `edge-utils.ts` 는 신규 순수 함수 4개(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) **추가**만 있고 기존 함수(`firstInputHandleId`/`buildAutoConnectConnection`/`resolvePortType` 등) 로직 변경 없음(`git diff` 상 그 함수들에 대한 hunk 자체가 없음). `editor-store.ts` 는 `removeEdge` 시그니처에 `opts?: { skipUndo? }` 추가(§1.2 `onConnect` 의 기존 `skipUndo` 패턴과 대칭) 뿐, 다른 액션 무변경.
- **불필요한 리팩토링**: 없음. 기존 함수 재작성·이름 변경·이동·시그니처 파괴적 변경 없음(`removeEdge` 는 옵션 파라미터 추가라 기존 호출부 하위 호환).
- **기능 확장(over-engineering)**: 오히려 스코프를 의도적으로 좁혔다 — 컨테이너 경계 엣지(`body`/`emit`)·컨테이너 자체인 새 노드·무입출력 노드(트리거·sink)는 분할 생략(`buildEdgeSplitPlan`→null)으로 명시 제한, `## Rationale` R-3 에 대안(a/b/c) 비교와 함께 근거 기록. impl-prep(WARNING 5건)·ai-review 1회차(CRITICAL 1건: 컨테이너 새 노드 body 재편입)를 반영해 범위를 확장이 아니라 축소하는 방향으로 처리했다.
- **무관한 파일/영역 수정**: 10개 실질 파일(CHANGELOG, 코드 3, 테스트 2, 문서 mdx 4) + spec 1 + plan 1 + 프로세스 산출물 37개 전부 이 작업 또는 그 필수 프로세스에 직접 귀속된다. plan 비고에 명시된 잔여 tech-debt(`findLatestResultByNodeId` selector 를 `node-settings-panel.tsx` 등 기존 소비처로 확대)는 실제로 건드리지 않고 별도 follow-up(`task_edb57ca2`)으로 명시 분리해 두었으며, ai-review architecture/maintainability 가 지적한 store 비원자성·`isContainerBoundaryEdge` 정밀도·`onDrop` 훅 추출 건도 코드로 손대지 않고 RESOLUTION 에 "이월" 로 기록만 했다 — 스코프 크리프 없음.
- **포맷팅 변경**: 코드 파일(`edge-utils.ts`, `editor-store.ts`, `workflow-canvas.tsx`) diff 전부가 순수 추가(addition) 라인이며 기존 라인 재포맷팅·공백/줄바꿈 변경 없음. mdx 문서 4개도 기존 문장에 한 문장 추가(en/ko 각 1줄)뿐 서식 변경 없음.
- **주석 변경**: 신규 함수(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`)에 대한 신규 JSDoc + `onDrop` 신규 로직에 대한 신규 인라인 주석뿐, 기존 주석 수정/삭제 없음. `removeEdge` JSDoc 은 기존 내용 유지 + `opts.skipUndo` 설명 1줄 추가.
- **임포트 변경**: `workflow-canvas.tsx` import 목록에 `buildEdgeSplitPlan`/`findEdgeIdAtPoint` 2개만 추가되고 `onDrop` 본문에서 실제 사용됨. 테스트 파일 import 도 신규 테스트 대상 함수만 추가. 미사용 임포트·불필요한 정리 없음.
- **설정 변경**: `tsconfig`/`eslint`/`package.json`/CI 워크플로 등 설정 파일 변경 없음(diff 대상에 포함되지 않음).

## 요약

47개 변경 파일 전부가 "팔레트 노드를 엣지 위에 드롭 → 분할·중간 삽입"이라는 단일 기능(spec §4.1)과 그 구현이 프로젝트 규약상 필수로 동반하는 프로세스 산출물(impl-prep consistency-check 8파일, ai-review 1·2회차 24파일, plan lifecycle 완료 이동, CHANGELOG·유저가이드 갱신)로 정확히 귀속된다. 실질 코드 변경(`edge-utils.ts` 신규 순수 헬퍼 4개, `editor-store.ts` `removeEdge` 의 `skipUndo` 옵션 추가, `workflow-canvas.tsx` `onDrop` 배선 확장)은 모두 추가적·최소한이며 기존 로직·포맷·주석·임포트에 대한 무관한 손질이 전혀 없다. 오히려 컨테이너 경계·컨테이너 자체인 새 노드·무입출력 노드는 명시적으로 스코프에서 제외해 over-engineering 을 피했고, ai-review 가 발견한 인접 개선 여지(store 원자 액션화, selector 통합, 훅 추출)는 코드에 반영하지 않고 별도 task/이월로 명확히 분리해 두었다. 변경 범위 관점에서 위반 사항 없음.

## 위험도

NONE
