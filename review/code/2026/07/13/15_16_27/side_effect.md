# 부작용(Side Effect) Review

대상: 이전 ai-review 라운드(`review/code/2026/07/13/15_01_46/`) 산출물 3건
(`security.md`/`side_effect.md`/`testing.md`, 전부 신규 파일) + `spec/3-workflow-editor/2-edge.md`
§3.2 엣지 상태별 스타일 표·설명 갱신(수정).

### 발견사항

- **[INFO]** 이번 diff 는 실행 코드 변경이 전혀 없다 — 8개 점검 관점(상태 변경/전역 변수/파일시스템/시그니처/인터페이스/환경 변수/네트워크/이벤트·콜백) 대부분 해당 없음
  - 위치: `review/code/2026/07/13/15_01_46/security.md`(신규), `review/code/2026/07/13/15_01_46/side_effect.md`(신규), `review/code/2026/07/13/15_01_46/testing.md`(신규), `spec/3-workflow-editor/2-edge.md`(수정)
  - 상세: 4개 파일 모두 markdown(이전 라운드 리뷰 산출물 3건 + spec 문서 1건)이며, 실행되는 애플리케이션 코드(`.ts`/`.tsx`/`.css` 등)는 이번 diff 범위에 없다. §3.2 실제 구현(`use-edge-execution-state.ts`/`edge-utils.ts`/`custom-edge.tsx`/`workflow-canvas.tsx`/`globals.css`)은 이전 커밋에서 이미 반영되어, 이번 diff 는 그 결과를 보고·문서화하는 산출물만 추가한다. 따라서 함수 시그니처·전역 Zustand 스토어·React 렌더 경로·환경 변수·네트워크 요청·이벤트 콜백 어느 것도 변경되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/07/13/15_01_46/*` 리포트 3건 신규 커밋은 저장소 기존 관례에 부합하는 예상된 파일시스템 기록이며, 매 라운드가 이전 라운드 산출물을 diff 로 재흡수하는 메타 구조를 만든다
  - 위치: `review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md`
  - 상세: `review/` 트리는 gitignore 대상이 아니며 SUMMARY/RESOLUTION 과 함께 각 리뷰어 산출물을 커밋하는 것이 기존 관례다(과거 라운드 `14_20_12`/`14_42_20` 산출물도 동일 패턴으로 커밋됐고, 그 사실 자체를 15_01_46 라운드의 security.md/side_effect.md 가 이미 INFO 로 확인해 둔 바 있다). 이 관례로 인해 매 라운드가 직전 라운드의 리뷰 리포트를 changeset 대상 파일로 다시 흡수해 재귀적으로 분석하는 구조가 반복되지만, 이는 실행 코드에 영향을 주는 부작용이 아니라 리뷰 프로세스 자체의 특성이다.
  - 제안: 조치 불요(기존 관례 준수). 라운드가 계속 누적돼 diff 노이즈(과거 리뷰 리포트 재스캔)가 과도해지면, 오케스트레이터 측에서 `review/` 트리를 changeset 스캔 대상에서 제외하는 방안을 검토할 수 있다(이번 요청 범위 밖 — 코드 변경 제안 아님).

- **[INFO]** spec 문서(`2-edge.md`) §3.2 상태 플립("미구현(Planned)" → "구현됨")은 서술 텍스트 변경뿐이라 side-effect 관점에서는 해당 없음 — 회귀 테스트 공백과의 정합성은 별도 관점(consistency/testing) 소관
  - 위치: `spec/3-workflow-editor/2-edge.md` §3.2 표 3행("데이터 흐름"/"실행 완료"/"비활성 노드 연결") + 신설 인용 단락(우선순위·판정 로직 서술)
  - 상세: 표 플립과 신설 설명 단락 모두 실행 로직을 담고 있지 않은 순수 서술이라 부작용 점검 8개 항목 어디에도 해당하지 않는다. 다만 같은 diff 묶음에 포함된 `testing.md`(파일 3)가 "핵심 최적화 주장 미재현"·"재활성화 회귀 테스트 부재" WARNING 2건을 이미 별도로 제기했으므로, "구현됨" 단정과 테스트 공백 사이의 간극은 side-effect 리뷰가 아닌 testing/consistency 리뷰 관점에서 다뤄야 할 사안이라 여기서는 중복 지적하지 않는다.
  - 제안: 조치 불요(side-effect 범위 밖). 필요 시 testing.md 항목 참조.

### 요약

이번 diff 는 실행 코드를 전혀 포함하지 않는 문서성 변경이다 — 이전 ai-review 라운드(`15_01_46`)의 산출물 markdown 3건(security/side_effect/testing) 신규 추가와 `spec/3-workflow-editor/2-edge.md` §3.2 상태 표·설명 갱신뿐이며, §3.2 의 실제 구현 코드(`use-edge-execution-state.ts` 등)는 이전 커밋에서 이미 반영되어 이번 diff 범위 밖이다. 상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백 등 부작용 점검 8개 관점 모두 실질적 해당 사항이 없다. `review/` 트리 신규 커밋은 저장소 기존 관례(리뷰 산출물 커밋 대상)에 부합하는 예상된 파일시스템 기록이며, 매 라운드가 직전 라운드 산출물을 diff 로 재흡수하는 메타 구조 자체는 부작용이 아닌 프로세스 특성으로 남겨둔다. 차단 사유 없음.

### 위험도

NONE

STATUS=success ISSUES=3
