# 변경 범위(Scope) 리뷰

## 대상

`feat(editor): 엣지 위 노드 드롭 → 엣지 분할 + 중간 삽입 (edge §4.1)` — 팔레트 노드를 기존 엣지 위에 드롭하면 엣지를 분할(split)해 중간에 노드를 삽입하는 기능 (spec `2-edge.md` §4 "미구현 · Planned" → §4.1 구현). 16개 파일, `git diff origin/main --stat` 기준 622(+)/8(-), 단일 커밋(115ea91d2).

## 발견사항

- **[INFO]** CHANGELOG.md 항목이 매우 길다 (구현 세부·테스트 목록·SoT 링크까지 1개 bullet 에 압축)
  - 위치: `CHANGELOG.md` 신규 "Unreleased" 섹션
  - 상세: 요청 범위를 벗어난 내용은 아니며(전부 §4.1 구현 설명), 바로 아래 §4/§5 항목도 동일하게 장문 — 이 repo 의 기존 CHANGELOG 관례(구현 근거·SoT 를 항목에 압축)를 그대로 따른 것으로 판단된다. 범위 이탈이 아니라 스타일 일관성 문제이므로 정보 제공 수준.
  - 제안: 조치 불요 (기존 관례 일치).

- **[INFO]** `plan/complete/spec-sync-edge-gaps.md` 신규 파일 + (rename 으로) `plan/in-progress/spec-sync-edge-gaps.md` 소멸, `spec/3-workflow-editor/2-edge.md` frontmatter `pending_plans` 에서 해당 항목 제거
  - 위치: `plan/complete/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md` frontmatter
  - 상세: 이번 §4.1 구현으로 해당 plan 의 마지막 잔여 surface(§4 mid-insert)가 완료되어 5개 surface 전부 종결됨을 반영한 plan lifecycle 이동. `CLAUDE.md`/`plan-lifecycle.md` 규약(완료 plan 은 `plan/complete/`, frontmatter `spec_impact` 리스트 필수)과 정확히 일치하며, 본 작업이 유발한 상태 전이이므로 스코프 내.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/07/13/18_06_53/**` 8개 파일이 diff 에 포함
  - 위치: `review/consistency/2026/07/13/18_06_53/{SUMMARY,meta,convention_compliance,cross_spec,naming_collision,plan_coherence,rationale_continuity}.md`, `_retry_state.json`
  - 상세: 착수 전 의무 수행한 `consistency-check --impl-prep`(scope=`spec/3-workflow-editor/`, BLOCK:NO) 산출물이며, 내용도 정확히 이번 §4.1 mid-insert 를 대상으로 한 WARNING 5건(포트 규칙·컨테이너 경계·undo 원자성·hit-test seam·detach/split 용어 충돌)으로, 커밋 메시지·spec `## Rationale R-3`·plan 완료 문구가 인용하는 바로 그 리포트다. `review/` 는 gitignore 대상이 아니며 프로젝트 규약상 리뷰 산출물은 커밋 대상 — 무관한 파일 유입이 아니라 필수 프로세스 증적.
  - 제안: 조치 불요.

- **[INFO]** `workflow-canvas.tsx` `onDrop` useCallback 의존성 배열에 `edges, removeEdge, onConnect` 추가
  - 위치: `workflow-canvas.tsx` onDrop 콜백 하단 `[buildAndAddNode, edges, removeEdge, onConnect]`
  - 상세: 새로 참조하는 3개 값을 정확히 추가한 것으로 로직 변경에 종속된 필수 수정. 불필요한 의존성 나열이나 무관한 콜백 재작성 없음.
  - 제안: 조치 불요.

발견된 CRITICAL/WARNING 없음. 다음 항목들을 확인했고 이상 없음:
- **의도 이상의 변경**: `edge-utils.ts` 는 신규 함수 4개(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) 추가만 있고 기존 함수 로직 변경 없음. `editor-store.ts` 는 `removeEdge` 시그니처에 `opts?: { skipUndo? }` 옵션 추가(§1.2 `onConnect` 의 기존 `skipUndo` 패턴과 대칭) 뿐, 다른 액션은 무변경.
- **불필요한 리팩토링**: 없음. 기존 함수 재작성·이름 변경·이동 없음.
- **기능 확장(over-engineering)**: 스코프를 오히려 의도적으로 좁혔다 — 컨테이너 경계 엣지(`body`/`done`/`emit`)와 무입출력 노드(트리거·sink)는 분할을 생략(`buildEdgeSplitPlan`→null)하도록 명시 제한, spec `## Rationale R-3` 에 근거 기록. impl-prep 리뷰 WARNING 을 반영해 범위를 확장이 아니라 축소하는 방향으로 처리함.
- **무관한 파일/영역 수정**: `git diff origin/main --stat` 16개 파일 전부 CHANGELOG/구현 3파일(코드)+테스트 2파일+spec 1파일+plan 1파일+consistency 리포트 8파일로, 전부 이 작업 또는 그 필수 프로세스 산출물에 직접 귀속. 무관 컴포넌트(예: plan 비고에 언급된 `node-settings-panel.tsx` selector 이관)는 실제로 건드리지 않고 별도 follow-up(`task_edb57ca2`)으로 명시 분리해 두었다.
- **포맷팅 변경**: diff 전부가 추가(addition) 라인이며 기존 라인 재포맷팅·공백 변경 없음.
- **주석 변경**: 신규 함수에 대한 신규 JSDoc 주석만 있고 기존 주석 수정/삭제 없음.
- **임포트 변경**: `workflow-canvas.tsx` import 목록에 `buildEdgeSplitPlan`/`findEdgeIdAtPoint` 2개만 추가, 실제로 onDrop 본문에서 사용됨. 미사용 임포트 없음.
- **설정 변경**: 설정 파일(tsconfig/eslint/package.json 등) 변경 없음.

## 요약

16개 파일 변경 전부가 "팔레트 노드를 엣지 위에 드롭 → 분할·중간 삽입"이라는 단일 기능(spec §4.1)과 그 구현에 필수적으로 동반되는 프로세스 산출물(impl-prep consistency-check 리포트, plan lifecycle 완료 이동, CHANGELOG 등재)로 정확히 귀속된다. 코드 변경(`edge-utils.ts` 신규 순수 헬퍼 4개, `editor-store.ts` `removeEdge` 의 `skipUndo` 옵션 추가, `workflow-canvas.tsx` onDrop 배선)은 모두 추가적이고 최소한이며 기존 로직·포맷·주석·임포트에 대한 무관한 손질이 없다. 오히려 컨테이너 경계·무입출력 노드는 명시적으로 스코프에서 제외해 over-engineering 을 피했고, 발견된 selector 중복 이관 같은 인접 개선은 별도 작업으로 분리해 두었다. 변경 범위 관점에서 위반 사항 없음.

## 위험도
NONE
