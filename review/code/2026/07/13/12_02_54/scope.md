# 변경 범위(Scope) 리뷰 결과

## 대상 (origin/main 대비 4개 커밋 누적 diff, 48개 파일)
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
- `codebase/frontend/src/lib/stores/editor-store.ts` (+`__tests__/editor-store.test.ts`)
- `codebase/frontend/src/lib/utils/edge-utils.ts` (+`__tests__/edge-utils.test.ts`)
- `codebase/frontend/src/content/docs/03-workflow-editor/{canvas-basics,connecting-nodes}.{mdx,en.mdx}`
- `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`
- `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*` (직전 3회 ai-review 세션 산출물, 36개 파일)

## 의도된 작업
`plan/in-progress/spec-sync-edge-gaps.md` §1.2 — "출력 포트 드래그 → 빈 영역 드롭 시 노드 추가
검색 팝업 + 자동 엣지 연결" 구현(spec §1.2 "미구현 · Planned" → 구현), 및 그 뒤를 잇는 3회의
ai-review 라운드(11_04_21→11_28_30→11_46_01)에 대한 순차 해소 커밋. 이번 diff 는 신규 기능
착수분이 아니라 4개 커밋(feat → resolution×3)의 누적이며, 각 커밋은 직전 라운드가 낸
CRITICAL/WARNING 만 표적으로 반영한다.

## 발견사항

- **[INFO]** `buildAndAddNode` 반환 타입 변경(`void` → `string | undefined`)
  - 위치: `workflow-canvas.tsx` `buildAndAddNode`
  - 상세: §1.2 자동 연결이 신규 노드 id 를 target 으로 필요로 하므로 직접 파생된 필수 변경. 기존
    호출부(`handleAddNodeAtCenter`, `onDrop`)는 반환값을 무시할 뿐 동작 변화 없음.
  - 제안: 없음(정상 범위).

- **[INFO]** `edge-utils.ts` 신규 순수 헬퍼 5종(`isConnectionDroppedOnPane`, `firstInputHandleId`,
  `connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`)
  - 상세: 기존 `isSelfConnection`/`isDuplicateConnection` 과 동일한 "순수 함수 분리 + 단위
    테스트" 패턴을 그대로 따르며 §1.2 판정·조립 로직에만 관여한다. 대응 vitest(21케이스)도
    신규 함수에 정확히 국한(기존 describe 블록·픽스처 무변경).
  - 제안: 없음(정상 범위).

- **[INFO]** `editor-store.ts` `onConnect` 에 `opts?: { skipUndo?: boolean }` 추가
  - 상세: §1.2 "노드 생성+연결"을 단일 undo 체크포인트로 묶기 위한 기능 요구사항 직결 변경.
    기본값 `false`로 하위 호환 유지, 대응 테스트 2건(`editor-store.test.ts`)도 신규 옵션 범위
    안에 국한됨.
  - 제안: 없음(정상 범위).

- **[INFO]** `openNodeSearchPopupAt` 추출로 `onPaneClick`/`handleCanvasMenuAction`(기존 경로)도
  함께 리팩터
  - 상세: §1.2 신규 진입점(`onConnectEnd`)이 팝업 오픈 시퀀스(컨텍스트 메뉴 닫기 → 팝업
    세팅)를 그대로 반복하려던 것을 공용 헬퍼로 추출하며 기존 두 경로도 그 헬퍼를 쓰도록
    바뀌었다. behavior-preserving 리팩터(로직 재배치일 뿐 순서·조건 변경 없음)로 §1.2 구현이
    직접 만든 신규 중복을 그 자리에서 해소한 것이라 범위 이탈로 보기 어렵다. 동일 판단이
    직전 3회 리뷰(11_04_21 scope/maintainability, 11_28_30 architecture, 11_46_01 scope INFO
    #12)에서도 반복 확인됨.
  - 제안: 없음(정상 범위).

- **[INFO]** 유저가이드 mdx 4파일(`canvas-basics`/`connecting-nodes` ko/en) 갱신
  - 상세: "노드를 추가하는 세 가지 방법" → "네 가지 방법"(§1.2 신규 진입 경로 추가), 연결하기
    가이드에 "빈 캔버스 드롭 시 자동 연결" 절 추가. 두 문서 모두 frontmatter `code:` 에
    `workflow-canvas.tsx`가 이미 등재돼 있어 이 diff의 1차 문서화 대상이며, 서술 내용(드래그
    시작·트리거 예외·연결 자동화)이 코드 diff와 정확히 대응한다. 무관한 절 수정 없음.
  - 제안: 없음(정상 범위).

- **[INFO]** `CHANGELOG.md`/`spec/3-workflow-editor/2-edge.md`/`plan/in-progress/spec-sync-edge-gaps.md`
  갱신은 §1.2 항목 1건에 국한
  - 상세: CHANGELOG 신규 섹션 1개, spec §1.2 절(헤더 라벨 제거 + "현재 구현" 각주) 1개, plan
    체크박스 1줄(`[ ]`→`[x]`) + §1.3 이월 메모 1줄만 수정. §1.3/§2.2/§2.3/§3.2 등 인접 항목은
    무변경.
  - 제안: 없음(정상 범위).

- **[INFO]** 마지막 커밋(1173bc10f)은 프로덕션 로직 무변경 — 주석/plan 텍스트 정정 + 통합테스트
  이월 확정만
  - 위치: `workflow-canvas.tsx`(stale 주석 `popup.source`→`NodeSearchPopupState.dragSource`,
    undo 서술 미세 교정), `plan/in-progress/spec-sync-edge-gaps.md`(vitest 케이스 수
    27→23 정정, §1.3(d) "의도적 최종 이월" 문구 확정), `CHANGELOG.md`/`spec/2-edge.md`(동일
    undo 서술 교정)
  - 상세: 직전 라운드(11_46_01) documentation/requirement WARNING 을 정확히 표적 반영한
    것으로, 커밋 메시지도 "주석·문서만(프로덕션 로직 무변경)"이라 명시하고 실제 diff(코드
    라인은 주석 텍스트만 변경, 실행 로직 무변화)와 일치한다. 요청 외 추가 수정 없음.
  - 제안: 없음(정상 범위).

- **[INFO]** `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*` 리뷰 산출물 36개 파일이
  diff 에 포함
  - 상세: 신규 코드/기능이 아니라 각 ai-review 세션의 `SUMMARY.md`/`RESOLUTION.md`/개별
    reviewer 리포트/`meta.json`/`_retry_state.json` 이다. 이 저장소는 `review/` 디렉터리를
    gitignore 하지 않고 감사 추적용으로 커밋하는 확립된 관례를 갖고 있어(선례 다수), §1.2
    구현과 별개 목적의 무관한 파일 추가가 아니라 동일 작업 사이클의 산출물이다.
  - 제안: 없음(정상 범위, 반복 확인).

- **[INFO]** 이번 diff(누적 4커밋) 전체에서 요청 범위 밖 리팩토링·기능 확장·무관한 파일 수정은
  발견되지 않음
  - 상세: 각 커밋이 정확히 직전 라운드의 지적 항목만 반영하고, God Component 정리·`role`
    유니온 재설계·`getNodeDefinition` 중복 조회 정리·screenToFlowPosition 폴백 통합 등 여러
    reviewer 가 제안한 "더 큰 리팩터" 는 전부 §1.3 이월로 명시적으로 defer 됐을 뿐 이번 diff
    에 슬쩍 끼워 넣지 않았다. over-engineering(요청하지 않은 기능 추가) 사례 없음.

불필요한 리팩토링, 무관한 파일 수정, 포맷팅만의 변경, 사용하지 않는 임포트, 설정 파일 변경은
발견되지 않았다. 추가된 주석은 모두 §1.2 구현 의도(연결원 기록·자동 연결 생략 조건·undo
단일화 근거)를 설명하는 데 국한되며, 무관한 코드에 대한 주석 추가/삭제도 없다.

## 요약
누적 4개 커밋(feat + 3회 ai-review 해소)의 변경분은 모두 plan §1.2("출력 포트 드래그 → 빈
영역 드롭 → 노드 추가 팝업 + 자동 엣지 연결") 구현과 그 리뷰 사이클 반영이라는 단일 의도에
정확히 대응한다. 각 후속 커밋은 직전 라운드가 지적한 CRITICAL/WARNING 만 표적으로 반영했고,
더 넓은 범위의 리팩터 제안(God Component 분리, 필드 재설계 등)은 스코프를 넓히는 대신
`plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월로 명시적으로 defer 처리해 이번 diff 에
끼워 넣지 않았다. 유저가이드 mdx 갱신·CHANGELOG/spec/plan 동기화·리뷰 산출물 커밋 모두
이 저장소의 확립된 관례와 이 기능 하나의 스코프 안에 있다. 요청 범위를 벗어나는 리팩토링,
기능 확장, 무관한 파일·설정 수정, 포맷팅/주석/임포트 잡음은 발견되지 않았다.

## 위험도
NONE
