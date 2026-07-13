# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[CRITICAL]** SoT 스펙 문서 `spec/3-workflow-editor/2-edge.md` §1.2 가 구현과 어긋난 채(stale) 방치됨
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2 "빈 영역 드롭 시 (미구현 · Planned)" 절 (frontmatter `code:` 에 `workflow-canvas.tsx`/`edge-utils.ts` 가 이미 등재된 바로 그 spec 파일)
  - 상세: 이번 diff 는 `workflow-canvas.tsx`(`onConnectEnd` 배선)·`edge-utils.ts`(`isConnectionDroppedOnPane`/`firstInputHandleId`)로 §1.2("출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 + 자동 엣지 연결")를 완전히 구현했고, `plan/in-progress/spec-sync-edge-gaps.md` 체크박스도 `[ ]` → `[x]` 로 갱신했다. 그러나 정작 SoT 인 `spec/3-workflow-editor/2-edge.md` §1.2 본문은 그대로 "(미구현 · Planned)" 라벨과 "현재 구현: ... 출력 포트 드래그→빈 영역 드롭에 따른 팝업 표시·자동 엣지 연결(`onConnectEnd` 핸들러)은 아직 없다." 라는, 이제는 사실과 다른(false) 서술을 유지하고 있다. 같은 plan 파일·같은 spec 파일의 자매 항목인 §2.2/§2.3 구현 때는 CHANGELOG(`## Unreleased — 워크플로 에디터가 자기연결·중복 연결은 막고...`)에 "`spec/3-workflow-editor/2-edge.md §2.2/§2.3` 이 '대부분 미구현 (Planned)' 로 두었던 ... 구현·동기화했다" 라고 명시된 대로, 이 저장소는 "Planned→구현" 전환 시 spec 본문 자체를 구현 상태로 동기화하는 것을 확립된 관례로 삼고 있다(canvas §10/§3.3/§11.3, §3.1/§5.4/§6/§7, integration §5 배지 등 다수 선례). 이번 PR 은 그 관례를 지키지 않아, 리뷰어·차기 작업자가 spec 만 보고 "§1.2 미구현" 으로 오판할 위험이 있다.
  - 제안: §1.2 본문을 "구현됨" 으로 갱신 — plan 파일에 이미 정리된 구현 요약(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반 판정, `NodeSearchPopupState.source` 경유 연결원 전달, `buildAndAddNode` 반환값 활용, 대상 노드에 입력 포트가 없으면(트리거 등) 자동 연결 생략)을 스펙 톤으로 옮기고, `isConnectionDroppedOnPane`/`firstInputHandleId` 순수 헬퍼 참조를 덧붙인다. frontmatter `status: partial` 은 §1.3/§3.2/§4/§5 가 남아있어 유지하되, "현재 구현" 서술은 실측과 일치시켜야 한다.

- **[WARNING]** CHANGELOG.md 미갱신 — 동일 성격의 선례와 불일치
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이 저장소는 "spec 이 Planned 로 두었던 편집기 UX 항목을 구현" 유형 변경마다 예외 없이 CHANGELOG `## Unreleased` 항목을 추가해 왔다(동일 `2-edge.md` 파일의 §2.2/§2.3 항목, `0-canvas.md` §10/§3.3/§11.3, §3.1/§5.4/§6/§7, `4-integration/0-common.md §5` 등). 이번 §1.2 구현은 사용자 체감 가능한 편집기 동작 변경(드래그 드롭 시 자동 노드 생성+연결)이며 위 선례들과 성격이 동일함에도 CHANGELOG 항목이 빠져 있다.
  - 제안: 위 §2.2/§2.3 항목과 유사한 톤으로 "출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결 (§1.2)" Unreleased 항목을 추가하고 SoT 를 `spec/3-workflow-editor/2-edge.md §1.2` 로 명시.

- **[INFO]** JSDoc/인라인 주석 자체 품질은 양호 — 정확성 문제 없음
  - 위치: `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId`, `workflow-canvas.tsx` `onConnectEnd`/`buildAndAddNode`/`handleAddNodeFromSearch` 인라인 주석
  - 상세: 신규 순수 함수 두 개 모두 JSDoc 이 있고(§1.2 참조, 판정 근거·null 처리 근거까지 설명), `workflow-canvas.tsx` 의 각 콜백에도 "왜" 를 설명하는 한국어 주석이 충실하다(예: "source→새 노드 조합은 자기연결·중복이 될 수 없어 onConnect 검증을 항상 통과한다" 처럼 비자명한 불변식까지 명시). `NodeSearchPopupState.source` 필드 주석도 "더블클릭/우클릭 메뉴로 열린 경우엔 undefined" 를 정확히 반영. 기존 주석 중 이번 변경으로 부정확해진 것은 없음(스펙 문서 자체를 제외).
  - 제안: 없음(현행 유지).

- **[INFO]** spec Rationale 섹션에 §1.2 구현 근거 미등재
  - 위치: `spec/3-workflow-editor/2-edge.md` `## Rationale` (R-1, R-2 만 존재)
  - 상세: §1.2 자동 연결 시 "대상 노드에 입력 포트가 없으면 연결을 생략한다" 같은 엣지 케이스 결정은 향후 재질문 소지가 있는 설계 판단이라, R-2 와 같은 형식의 Rationale 항목으로 남겨두면 재작업 시 근거 추적에 유리하다.
  - 제안: 선택 사항 — spec 본문 갱신 시 짧은 Rationale 한 단락 추가 고려.

## 요약
코드 자체의 문서화(JSDoc·인라인 주석)는 새 헬퍼·콜백 모두에 충실하고 정확하지만, 이 변경의 핵심 결함은 SoT 문서 동기화 누락이다. `plan/in-progress/spec-sync-edge-gaps.md` 체크박스만 갱신되고 정작 근거 spec 인 `spec/3-workflow-editor/2-edge.md` §1.2 는 "미구현 · Planned" 서술을 그대로 유지해 코드와 spec 이 어긋나 있으며, 이는 같은 plan·같은 spec 파일의 자매 항목(§2.2/§2.3)이 구현될 때 spec 본문 동기화 + CHANGELOG 항목 추가를 병행했던 이 저장소의 확립된 관례와 불일치한다. CHANGELOG 항목 부재도 동일한 갭이다.

## 위험도
HIGH
