# 변경 범위(Scope) 리뷰

## 대상

`edge §4.1` — 팔레트 노드를 기존 엣지 위에 드롭하면 엣지를 분할(split)하고 중간에 노드를 삽입하는 기능 (spec `2-edge.md` §4 "미구현 · Planned" → §4.1 구현, R-3 신설). 33개 파일 diff: 구현 3(`workflow-canvas.tsx`/`edge-utils.ts`/`editor-store.ts`) + 테스트 2 + spec 1 + 유저가이드 4(ko/en × 2문서) + CHANGELOG 1 + plan lifecycle 1 + 1회차 ai-review 산출물 13(`review/code/2026/07/13/18_32_28/**`) + impl-prep consistency-check 산출물 8(`review/consistency/2026/07/13/18_06_53/**`). 1회차 ai-review CRITICAL(컨테이너 새 노드 body 재편입) 반영 완료 상태의 최종 diff.

## 발견사항

- **[INFO]** 리뷰/컨시스턴시 프로세스 산출물 21개 파일(`review/code/2026/07/13/18_32_28/**`, `review/consistency/2026/07/13/18_06_53/**`)이 diff 대부분(33개 중 21개)을 차지
  - 위치: `review/code/2026/07/13/18_32_28/{RESOLUTION,SUMMARY,architecture,documentation,maintainability,meta,requirement,scope,security,side_effect,testing,user_guide_sync}.md`, `_retry_state.json`; `review/consistency/2026/07/13/18_06_53/{SUMMARY,convention_compliance,cross_spec,meta,naming_collision,plan_coherence,rationale_continuity}.md`, `_retry_state.json`
  - 상세: 모두 본 §4.1 작업에 대한 착수 전 `consistency-check --impl-prep`(BLOCK:NO, WARNING 5건) 및 구현 후 `/ai-review` 1회차(CRITICAL 1 + WARNING 6, `RESOLUTION.md` 로 반영 완료) 산출물이다. `CLAUDE.md`("코드 리뷰 산출물"/"일관성 검토 산출물" 저장 위치)와 사용자 메모("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋")에 정확히 부합하는 필수 프로세스 증적이며, 내용도 이번 §4.1 변경만을 대상으로 한다. 무관한 파일 유입이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `plan/complete/spec-sync-edge-gaps.md` 신규 생성 + `spec/3-workflow-editor/2-edge.md` frontmatter `pending_plans`에서 해당 항목 제거 (plan lifecycle 이동)
  - 위치: `plan/complete/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md` frontmatter
  - 상세: 본 §4.1 구현으로 해당 plan의 마지막 잔여 surface가 완료되어 5개 surface(§1.2/§1.3/§2.2·2.3/§3.2/§4) 전부 종결됨을 반영한 정상 lifecycle 이동(`plan-lifecycle.md` 규약 부합, `spec_impact` 리스트 포함). 파일 내용 중 §1.2~§3.2 이력 서술은 이전 PR(#940~#943)에서 이미 작성된 기존 내용이며 본 PR이 새로 작성한 것은 완료 도장(✅ 헤더)과 §4 항목 서술뿐 — 스코프 내 상태 전이.
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md` 신규 항목이 구현 세부·테스트 목록·SoT 링크까지 단일 bullet에 압축돼 매우 길다
  - 위치: `CHANGELOG.md` 신규 "Unreleased — 워크플로 편집기 엣지 분할(중간 노드 삽입)" 섹션
  - 상세: 요청 범위(§4.1 구현)를 벗어난 서술은 없으며, 바로 아래 §4/§5 항목도 동일한 장문 포맷 — 이 repo의 기존 CHANGELOG 관례를 그대로 따른 것. 범위 이탈이 아니라 스타일 이슈.
  - 제안: 조치 불요(기존 관례 일치).

- **[INFO]** `workflow-canvas.tsx` `onDrop` useCallback 의존성 배열에 `edges`/`removeEdge`/`onConnect` 추가
  - 위치: `workflow-canvas.tsx` onDrop 콜백 하단 `[buildAndAddNode, edges, removeEdge, onConnect]`
  - 상세: 새로 참조하는 값만 정확히 추가된 필수 종속 수정. 무관한 콜백 재작성 없음.
  - 제안: 조치 불요.

CRITICAL/WARNING 없음. 점검 관점별 확인 결과:

- **의도 이상의 변경**: `edge-utils.ts`는 신규 함수 4개(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) 추가만 있고 기존 함수 로직 변경 없음. `editor-store.ts`는 `removeEdge` 시그니처에 `opts?: { skipUndo? }` 옵션 추가(§1.2 `onConnect`의 기존 `skipUndo` 패턴과 대칭)뿐, 다른 액션은 무변경.
- **불필요한 리팩토링**: 없음. 기존 함수 재작성·이름 변경·이동 없음.
- **기능 확장(over-engineering)**: 오히려 스코프를 의도적으로 좁혔다 — 컨테이너 경계 엣지(`body`/`emit`)와 무입출력 노드(트리거·sink)는 분할 생략(`buildEdgeSplitPlan`→null), 1회차 ai-review CRITICAL 반영으로 "새 노드 자체가 컨테이너"인 경우까지 추가 제외(`definition.isContainer` 가드) — spec `## Rationale R-3`에 근거 기록. 확장이 아니라 축소 방향.
- **무관한 파일/영역 수정**: 33개 파일 전부 CHANGELOG/구현 3파일(코드)+테스트 2파일+spec 1파일+유저가이드 4파일+plan 1파일+리뷰/컨시스턴시 프로세스 산출물 21파일로, 전부 이 작업 또는 그 필수 프로세스 산출물에 직접 귀속.
- **포맷팅 변경**: 코드 diff(2·8·10번 파일)는 전부 추가(addition) 라인이며 기존 라인 재포맷팅·공백 변경 없음.
- **주석 변경**: 신규 함수에 대한 신규 JSDoc/인라인 주석만 있고 기존 주석 수정/삭제 없음.
- **임포트 변경**: `workflow-canvas.tsx` import 목록에 `buildEdgeSplitPlan`/`findEdgeIdAtPoint` 2개만 추가, 실제 onDrop 본문에서 사용됨. 미사용 임포트 없음.
- **설정 변경**: tsconfig/eslint/package.json 등 설정 파일 변경 없음. `review/code/.../meta.json`·`_retry_state.json`은 앱 설정이 아니라 리뷰 프로세스 자체의 메타데이터.

## 요약

33개 파일 변경 전부가 "팔레트 노드를 엣지 위에 드롭 → 분할·중간 삽입"이라는 단일 기능(spec §4.1)과 그 구현에 필수적으로 동반되는 프로세스 산출물(impl-prep consistency-check 리포트, ai-review 1회차 리포트+RESOLUTION, plan lifecycle 완료 이동, CHANGELOG 등재, 유저가이드 ko/en 동반 갱신)로 정확히 귀속된다. 실제 애플리케이션 코드 변경(`edge-utils.ts` 신규 순수 헬퍼 4개, `editor-store.ts` `removeEdge`의 `skipUndo` 옵션, `workflow-canvas.tsx` onDrop 배선)은 모두 추가적이고 최소하며, 1회차 리뷰에서 발견된 CRITICAL(컨테이너 새 노드 body 재편입)도 스코프를 넓히지 않고 좁히는 가드 추가로 해소했다. 기존 로직·포맷·주석·임포트·설정에 대한 무관한 손질은 없다. 변경 범위 관점에서 위반 사항 없음.

## 위험도
NONE
