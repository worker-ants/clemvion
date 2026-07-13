### 발견사항

- **[INFO]** 이번 라운드에 side_effect 리뷰어로 배정된 10개 파일은 전부 문서(리뷰 산출물 9종 + spec 1종) — 실행 경로에 개입하는 코드가 아님
  - 위치: `review/code/2026/07/13/16_49_37/{maintainability,performance,requirement,scope,security,side_effect,testing,user_guide_sync}.md`, `review/code/2026/07/13/16_49_37/meta.json`, `spec/3-workflow-editor/2-edge.md`
  - 상세: 앞 9개는 이전(2회차 fix 이후) ai-review 라운드가 생성한 정적 markdown/json 리포트이고, `spec/3-workflow-editor/2-edge.md` 변경분은 `code:` frontmatter 배열에 신규 파일 3종 추가 + §4/§5 상태 서술을 "미구현(Planned)"→"구현됨"으로 갱신하는 문서 편집이다. 둘 다 런타임에 로드·실행되는 코드가 아니므로 상태 변경·전역 변수·파일시스템 부작용·시그니처/인터페이스 변경·환경 변수·네트워크 호출·이벤트/콜백 어느 관점에서도 해당 사항이 없다. `review/**` 신규 파일 생성은 프로젝트 컨벤션(CLAUDE.md "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")이 요구하는 정상 산출물이며 예상치 못한 파일시스템 부작용이 아니다(직전 scope.md 리뷰도 동일 결론).

- **[INFO]** 이번 라운드 배정 diff 에 실제 프로덕션 코드 변경분이 빠져 있어, 직접 git 으로 확인해 보강함 — 실코드 기준으로도 부작용 없음
  - 위치: 배정된 10개 파일에는 없지만, 같은 커밋(`9036bb565` "ai-review 3회차 반영")에 포함된 `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`, `codebase/frontend/src/lib/utils/edge-data-preview.ts` (및 테스트 2종)
  - 상세: `git diff 5f8b14151 9036bb565 -- <해당 파일들>` 로 직접 확인한 결과 — (1) `workflow-canvas.tsx`: 인라인 `onOpenModal={(id) => {...}}` / `onClose={() => setDataModalEdgeId(null)}` 를 `openDataModal`/`closeDataModal` `useCallback` 으로 추출(maintainability INFO 반영). `openDataModal` 의 dep `[edgeHoverPreview]` 는 `use-edge-hover-preview.ts` 가 반환 객체를 `useMemo` 로 안정화하고 있어(74번째 줄 `return useMemo(...)`) 매 렌더 재생성 없이 안전하다. 둘 다 `EdgeDataPreviewTooltip`/`EdgeDataModal` 에 넘기는 **내부** prop 이라 외부 공개 시그니처·다른 소비처에 영향 없음. (2) `edge-data-preview.ts`: `EdgeDataSummary` 인터페이스에 `bytesApprox: boolean` 필드가 추가되고 `summarizeDataForPreview` 가 100,000자 초과 시 `TextEncoder` 인코딩을 생략하는 분기가 추가됨 — grep 결과(`EdgeDataSummary`/`summarizeDataForPreview` 참조) 소비처가 `edge-data-preview.tsx` 단 하나뿐이라 순수 additive 필드로 다른 소비처에 영향 없다. `set()` 호출·전역 상태 변경 없는 순수 함수 성격도 그대로 유지. (3) `edge-data-preview.tsx`: `summary.bytesApprox` 를 표시 문자열(`"~"` 접두)에만 반영 — 읽기 전용 렌더 변경. 신규 전역 변수, 환경 변수 접근, 네트워크 호출, 파일시스템 접근, 이벤트 리스너 직접 등록은 이번 라운드 diff 에도 없음을 확인.
  - 제안: 조치 불필요(참고 기록). 다만 라우팅 관점에서, 이번 커밋의 실질 코드 diff(byte-cap 로직·콜백 안정화 등, WARNING/INFO fix 대상)가 side_effect 리뷰어의 배정 파일 목록에서 누락된 점은 오케스트레이터의 diff 산정 방식(라운드 간 diff base) 재점검 여지가 있다 — 이번엔 직접 검증으로 갭을 메웠으나, 다음 라운드부터는 `--route=all` 또는 코드 파일 명시 타겟팅으로 실제 프로덕션 diff 가 매 라운드 각 리뷰어에게 도달하는지 확인 권장.

- **[INFO]** 이전 라운드(16_49_37) side_effect.md 자체 내용 재확인 — 결론(NONE) 유지, 새 모순 없음
  - 위치: `review/code/2026/07/13/16_49_37/side_effect.md`
  - 상세: 해당 리포트가 주장하는 "unmount cleanup 해소", "`findLatestResultByNodeId` 순수 읽기전용 additive", "테스트의 Zustand 전역 store `setState` 시딩은 beforeEach 로 격리됨" 은 이번에 직접 확인한 round-3 fix 코드와 모순되지 않는다(오히려 round-3 는 그 위에 byte-cap·콜백 안정화만 추가). security.md 가 별도로 짚은 "hover 로 실행 결과 노출 마찰이 낮아짐"(INFO, 신규 인가 경계 아님)도 side-effect 관점에서 상태 변경이 아닌 노출 범위 문제라 이 리뷰의 카테고리 밖으로 적절히 분리되어 있다.

### 요약

이번 라운드에 배정된 diff(리뷰 산출물 9건 + spec 문서 1건)는 전부 실행되지 않는 정적 문서로, 부작용(Side Effect) 관점의 8개 점검 항목(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백) 어디에도 해당하지 않는다. 배정 목록에는 없었지만 같은 커밋에 포함된 실제 프로덕션 fix(`workflow-canvas.tsx` 콜백 `useCallback` 추출, `edge-data-preview.ts` 바이트 계산 상한 분기 + `EdgeDataSummary.bytesApprox` 필드 추가)를 git diff 로 직접 확인해, 모두 내부 prop/순수 additive 필드 수준의 국소적 변경이며 전역 상태·공개 API·외부 I/O 에 영향이 없음을 재검증했다. 유일한 참고 사항은 이번 라운드 side_effect 배정 파일 목록이 실질 코드 diff 를 포함하지 않았다는 라우팅 관측이며, 직접 검증으로 갭을 메워 결론에 영향은 없다.

### 위험도
NONE
