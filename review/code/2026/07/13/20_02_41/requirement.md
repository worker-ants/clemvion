### 발견사항

- **[WARNING]** 이번 라운드(`20_02_41`) 에도 이전 라운드(`19_42_07/requirement.md`)가 지적한 harness diff-list 누락 문제가 재발함 — 이번엔 더 심함
  - 위치: `review/code/2026/07/13/20_02_41/_prompts/*.md` (전 reviewer 공통 파일목록, 19개)
  - 상세: 이번 세션 payload 의 19개 파일은 review 산출물(`review/code/2026/07/13/19_18_01/user_guide_sync.md` 1개, `review/code/2026/07/13/19_42_07/*` 9개, `review/consistency/2026/07/13/18_06_53/*` 8개) + `spec/3-workflow-editor/2-edge.md` 뿐이다. 실제로 리뷰 대상이어야 할 마지막 커밋 `d00d39c18`(`fix(editor): edge §4.1 ai-review 4회차 반영 — 컨테이너 경계 핸들 SoT 상수화`)는 `git show d00d39c18 --stat` 로 확인한 결과 `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts`, `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` 를 포함하는데 이 셋 모두 이번 payload 에서 빠졌다. 게다가 파일목록이 "마지막 커밋 diff"도 "브랜치 전체 diff"도 아닌, 여러 라운드(`18_06_53`→`115ea91d2`, `19_18_01`의 파일 1개만→`ad5fa3388` 일부, `19_42_07` 전체→`d00d39c18`)에서 review 산출물만 선별적으로 뽑아 붙인 형태라 diff-base 계산 로직 자체가 일관성이 없다. 직전 라운드(`19_42_07/requirement.md`)가 이미 이 결함 계열을 WARNING 으로 보고하고 "orchestrator diff-base 계산 로직 점검"을 권고했으나 이번 라운드에도 반영되지 않고 재발했다.
  - 제안: 본 리뷰는 diff 목록을 신뢰하지 않고 `git log --oneline -6`, `git show d00d39c18 --stat`, `git diff origin/main..HEAD --stat` 로 실제 변경분을 직접 확인하고 `codebase/frontend/src/lib/utils/edge-utils.ts`/`codebase/frontend/src/lib/stores/editor-store.ts`/테스트 파일을 직접 Read 해 spec 정합성을 재검증했다(아래 정합성 확인 참조, 결함 없음). orchestrator 스크립트의 diff-base 산출 로직을 이번엔 실제로 고칠 것을 재차 권고 — 2회 연속 재발은 "review-infra 이슈로 코드 무관" 이라는 이전 판단만으로 넘기기엔 신뢰성 리스크가 누적되고 있다(다음 라운드에서 실제 코드 결함이 있어도 조용히 놓칠 위험).

- **[WARNING]** `RESOLUTION.md`(19_42_07) 가 주장하는 "노드 복제 phantom-undo → 별도 backlog task(`task_89a0d3a2`)로 전환" 이 실제로는 durable 하게 추적되지 않음
  - 위치: `review/code/2026/07/13/19_42_07/RESOLUTION.md` "INFO(반영/이월)" #1 항목 (`task_89a0d3a2`) — 비교 대상: `plan/complete/spec-sync-edge-gaps.md` "비고" 섹션
  - 상세: 직접 코드 대조 결과 이 결함(`workflow-canvas.tsx` `handleNodeMenuAction` `case "duplicate"` 451행 `pushUndo()` 명시 호출 + 472행 `addNode(newNode)` 호출, `addNode` 자체가 840행에서 `get().pushUndo()` 를 무조건 재호출 → 삽입 1회에 undo 스냅샷 2개)는 실제로 현재 코드에 그대로 존재해 §4.1 이 스코프 밖으로 남긴다는 판단 자체는 정확하다. 다만 같은 plan 파일(`plan/complete/spec-sync-edge-gaps.md`)의 "비고" 섹션은 이미 확립된 관례대로 `task_78c80fec`(UX 프리뷰 이월)·`task_edb57ca2`(selector DRY 이월) 두 backlog ID 를 기록해 두었는데, `task_89a0d3a2` 는 이 plan 이 `115ea91d2` 커밋에서 이미 `plan/complete/` 로 이동된 **이후**(`d00d39c18`, 19:42) 생성된 backlog 항목이라 그 "비고" 섹션에 소급 반영되지 않았다. `grep -rl "task_89a0d3a2"` 전체 저장소 검색 결과 `review/code/2026/07/13/19_42_07/RESOLUTION.md` 한 곳에만 존재한다 — `plan/**` 어디에도, 신규 in-progress plan 파일에도 없다. "정보 저장 위치" 원칙(`spec/plan` 이 단일 진실, `review/` 는 산출물)에 비춰보면 이 backlog 항목은 "전환 완료"라고 서술된 것과 달리 canonical 위치에 등록되지 않은 상태다.
  - 제안: `plan/complete/spec-sync-edge-gaps.md` "비고" 섹션에 `task_89a0d3a2`(노드 복제 phantom-undo + `pushUndo()` 전수 감사 + `withUndoCheckpoint` 상위 헬퍼 검토)를 `task_78c80fec`/`task_edb57ca2` 와 같은 형식으로 추가하거나, 별도 `plan/in-progress/*.md` 를 신설해 이 결함을 등록할 것. 지금 상태로는 `review/` 디렉터리를 훑지 않는 한 이 잔존 버그가 재발견되기 어렵다.

- **정합성 확인(결함 없음, 참고용)**: 이번 라운드의 실질 변경분(`d00d39c18`)이 주장하는 "컨테이너 경계 핸들 SoT 상수화" 는 코드와 spec 양쪽에 line-level 로 정확히 반영되어 있다.
  - `codebase/frontend/src/lib/utils/edge-utils.ts:137-138` 에 `export const CONTAINER_BODY_HANDLE = "body"` / `CONTAINER_EMIT_HANDLE = "emit"` 가 실제로 export 되고, `RESERVED_INPUT_HANDLE_IDS`(145행)·`CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES`(247-248행, `isContainerBoundaryEdge` 가 참조)가 모두 이 상수를 사용하도록 정정됨.
  - `codebase/frontend/src/lib/stores/editor-store.ts:24-25` 가 위 두 상수를 `edge-utils.ts` 에서 import 하고, `detectContainerConflict`(269, 283행)·`propagateContainerOnConnect`(334, 342행) 양쪽에서 리터럴 `"body"`/`"emit"` 대신 상수를 사용 — spec R-3 "커플링 주의" 문단이 서술하는 "두 핸들 값은 `edge-utils.ts` 의 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 공유 상수로 묶여 있어… `buildEdgeSplitPlan`(분할 제외)과 store `detectContainerConflict`/`propagateContainerOnConnect`(거부·전파)가 함께 import" 라는 서술과 정확히 일치.
  - `buildEdgeSplitPlan(edge, id, null|undefined)` 방어 테스트(RESOLUTION #7)가 `edge-utils.test.ts` 에 실제로 추가됨 확인.
  - R-3 오탈자 정정(RESOLUTION #5, "노드)덕에"→"노드) 덕에") 및 §4.1 "연결·불변식(원자성)" 단락에 "`onConnect` **2회**… 리스너를 추가하는 소비처는 '드롭 제스처당 2회' 를 전제해야 한다"(RESOLUTION #3) 문구가 모두 실제 spec 본문에 반영되어 있음을 직접 확인.
  - 테스트 개수: `edge-utils.test.ts` 92건(`it(` 카운트, null 방어 1건 포함) + `editor-store.test.ts` 66건 = 158건 — RESOLUTION.md "158 passed" 주장과 정확히 일치(`grep -oE '\bit\(' | wc -l` 로 직접 재확인).
  - CHANGELOG.md 최상단에 §4.1 기능 상세 기록 확인(SoT 상수화 세부는 없으나 §4.1 기능 자체의 이력은 정확).
  - TODO/FIXME/HACK/XXX 주석 없음(`edge-utils.ts`/`editor-store.ts` 전체 재확인).

### 요약
이번 라운드(`20_02_41`)의 diff 파일목록은 이전 라운드가 이미 지적한 harness diff-list 누락 문제를 그대로 재발시켜(WARNING, 마지막 커밋 `d00d39c18` 의 실제 코드 변경 3개 파일이 여전히 빠짐), 직접 `git show`/`git diff`/Read 로 우회 검증했다. 실질 검증 결과 이번 변경분("컨테이너 경계 핸들 SoT 상수화")은 spec R-3 "커플링 주의" 서술과 코드(`edge-utils.ts`/`editor-store.ts`)가 line-level 로 정확히 일치하고, 이전 라운드 RESOLUTION 항목(오탈자, onConnect×2 명시, null 방어 테스트)도 모두 실제 반영을 확인했다. 다만 RESOLUTION.md 가 "별도 backlog task(`task_89a0d3a2`)로 전환"했다고 주장하는 노드 복제 phantom-undo 결함이 실제로는 canonical plan 위치(`plan/complete/spec-sync-edge-gaps.md` 비고)에 등록되지 않아 "의도(추적 완료)"와 "구현(등록 누락)" 간 괴리가 있다(WARNING). TODO/FIXME, 반환값 누락, 미검증 에러 경로는 발견되지 않았다.

### 위험도
LOW
