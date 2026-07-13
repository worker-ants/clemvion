### 발견사항

- **[INFO]** 이번 라운드(`17_13_05`)에 architecture 리뷰어로 라우팅된 파일은 소스 코드가 아니라 이전 라운드(`16_49_37`)의 리뷰 산출물(`maintainability.md`/`meta.json`/`performance.md`/`requirement.md`/`scope.md`/`security.md`/`side_effect.md`/`testing.md`/`user_guide_sync.md`)과 spec 문서(`spec/3-workflow-editor/2-edge.md`) 뿐이다.
  - 위치: `review/code/2026/07/13/17_13_05/_prompts/architecture.md` "리뷰 대상 파일" 1~10
  - 상세: 실제 이번 fix 커밋(`9036bb565`, "ai-review 3회차 반영 — 바이트 계산 상한·콜백 안정화·테스트 강화")은 `edge-data-preview.tsx`/`workflow-canvas.tsx`/`lib/utils/edge-data-preview.ts` 코드도 함께 변경했으나(직접 `git show HEAD` 로 확인), 이번 라운드의 architecture 프롬프트에는 라우팅되지 않았다. `spec/3-workflow-editor/2-edge.md`·`meta.json`·타 리뷰어 산출물만 대상이라, 이 파일들 자체에 대해서는 SOLID/결합도/레이어/디자인패턴/순환의존/추상화/모듈경계/확장성 관점에서 평가할 "코드 구조"가 없다(모두 markdown/json 텍스트).
  - 제안: 조치 불필요 — 라우팅은 오케스트레이터의 auto 모드 결정이며, 앞선 두 차례(`15_52_56`, `16_20_51`) architecture 리뷰가 실제 소스(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`, `workflow-canvas.tsx`, `execution-store.ts`)를 이미 상세 분석했으므로 커버리지 공백은 아니다. 참고로 직접 확인한 이번 커밋의 실제 코드 델타(`BYTE_APPROX_THRESHOLD` 상수 추출 + `bytesApprox` 필드 추가, `onOpenModal` 인라인 콜백 → `openDataModal`/`closeDataModal` useCallback 추출)는 기존 계층 구조(순수 유틸 → 타이밍 훅 → 프레젠테이션 컴포넌트 → 오케스트레이터)를 그대로 유지하는 국소적 수정으로, 새로운 결합·레이어 위반·순환 의존을 만들지 않는다.

- **[INFO]** spec 문서(§4/§5) 갱신이 실제 구현 계층 구조를 정확히 반영 — 재확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §4(호버 행 "미구현"→"구현됨"), §5("미구현 · Planned"→구현 서술), `code:` frontmatter 신규 3파일(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`) 추가
  - 상세: 신규 서술("순수 함수 `summarizeDataForPreview`/`formatBytes`" + "타이밍 전용 훅 `useEdgeHoverPreview`" + "프레젠테이션 컴포넌트 `EdgeDataPreviewTooltip`/`EdgeDataModal`" + "오케스트레이터 `workflow-canvas.tsx`")는 이전 두 architecture 리뷰가 확인한 계층 분리(관심사 분리: 순수 로직/타이밍 상태기계/렌더링/배선)와 함수·상수명 단위까지 일치한다. `code:` frontmatter 도 실제 참조하는 3개 신규 파일을 정확히 등재해 spec-impl 추적성이 유지된다.
  - 제안: 조치 불필요.

- **[INFO]** (변동 없음, 재확인) 이전 라운드 architecture WARNING — "nodeId → 최신 실행 결과" 조회 로직 3중 중복 — 은 여전히 부분 해소 상태이며 명시적으로 defer 되어 있다
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts`(`findLatestResultByNodeId`, O(1)) vs `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508` 부근 `InfoTab`(원본 역순 선형 스캔, 직접 grep 재확인 — 미이관), `use-expression-context.ts`(별도 bulk 패턴)
  - 상세: `plan/in-progress/spec-sync-edge-gaps.md` 비고에 "`findLatestResultByNodeId` selector 를 기존 소비처로 확대"가 후속 task(`task_edb57ca2`)로 명시돼 있고, `InfoTab` 은 1:1 이관 후보·`use-expression-context.ts` 는 다른 접근이라 드롭인 불가라는 근거까지 문서화돼 있다(직접 확인). 이번 라운드에서 새로 악화되거나 개선된 부분은 없다 — §4/§5 surface 로 스코프를 한정한 기존 판단이 그대로 유지되는 정상 상태다.
  - 제안: 조치 불필요(이번 PR 스코프 밖). 후속 task 진행 시 `node-settings-panel.tsx`부터 이관.

- **[INFO]** (변동 없음, 재확인) `workflow-canvas.tsx` 오케스트레이션 누적 — 신규 `openDataModal`/`closeDataModal` 두 콜백이 추가로 얹혔으나 개별 로직 자체는 훅/유틸로 잘 위임돼 있어 응집도 저하는 미미
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
  - 상세: 이전 두 라운드가 지적한 God-component 축적 이슈(캔버스 파일이 다수의 엣지 관련 훅 + 컨텍스트 메뉴 + 노드 검색 팝업 등 여러 책임을 겹쳐 가진 상태)는 plan 에 "§4 오케스트레이션 정리 시 이월"로 이미 추적 중이며, 이번 fix 커밋의 두 콜백(모달 열기/닫기 안정화)도 그 이월 대상에 자연스럽게 포함된다. 새로운 결함이 아니다.
  - 제안: 조치 불필요 — 기존 계획대로 후속 오케스트레이션 정리 시 일괄 처리.

### 요약

이번 아키텍처 리뷰 라운드(`17_13_05`)에 실제로 라우팅된 대상은 소스 코드가 아니라 이전 라운드(`16_49_37`)의 리뷰 산출물 9건과 spec 문서 1건이며, 이들 자체는 SOLID/결합도/레이어/디자인패턴/순환의존/모듈경계 관점에서 평가할 코드 구조를 담고 있지 않다. spec 문서 갱신은 실제 구현의 4단 계층(순수 유틸 → 타이밍 훅 → 프레젠테이션 컴포넌트 → 오케스트레이터)을 함수·상수명 단위까지 정확히 반영하고 있음을 재확인했다. 직접 `git show`/`grep` 으로 검증한 이번 fix 커밋의 실제 코드 델타(바이트 계산 상한 상수화, 모달 콜백 useCallback 추출)는 국소적이고 기존 계층·모듈 경계를 보존하며 새로운 아키텍처 위반을 도입하지 않는다. 이전 두 차례 architecture 리뷰(`15_52_56` LOW, `16_20_51` LOW)가 지적한 "nodeId→최신 실행결과 조회 3중 중복"(신규 O(1) selector 는 신규 소비처에만 적용, 기존 `node-settings-panel.tsx`/`use-expression-context.ts` 는 미이관)과 "`workflow-canvas.tsx` 오케스트레이션 누적"은 이번 라운드에도 변동 없이 남아 있으나, 둘 다 plan 문서에 근거·후속 task(`task_edb57ca2`)로 명시적으로 defer 되어 있어 병합을 막을 사안이 아니다.

### 위험도
NONE
