# Resolution — edge §1.2 ai-review (2026-07-13 11:04)

원 리뷰 위험도 **HIGH** (CRITICAL 1 + WARNING 6). 아래와 같이 반영했다.

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | SoT spec `spec/3-workflow-editor/2-edge.md` §1.2 가 "미구현 · Planned" 로 stale | **반영** — §1.2 헤더의 "(미구현 · Planned)" 제거, "현재 구현" 각주를 실제 구현(React Flow v12 `connectionState`, `onConnectEnd`, `dragSource`, `buildAndAddNode` 반환값, `skipUndo` undo 단일화, 순수 헬퍼)으로 갱신. `status: partial` 은 §1.3/§3.2/§4/§5 잔여로 유지. 교차 spec grep 결과 edge §1.2 를 planned 로 참조하는 다른 문서 없음(self-contained) → 사실 동기화라 full consistency-check 생략(비례성). |

## Warning

| # | 발견 | 조치 |
|---|------|------|
| 2 | undo 스냅샷 중복 push (Ctrl+Z 시 고아 노드) | **반영** — store `onConnect` 에 `opts?.skipUndo` 추가. 자동 연결 경로는 `buildAndAddNode` 의 단일 pushUndo(노드 생성 전 스냅샷)만 체크포인트가 되도록 `onConnect(conn, {skipUndo:true})` 호출 → Ctrl+Z 1회로 노드+엣지 함께 취소. |
| 3 | §1.2 배선(`onConnectEnd`/`handleAddNodeFromSearch`) 미검증 | **반영** — 배선 판정/조립 로직을 순수 헬퍼(`connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`)로 추출하고 vitest 12케이스 추가(총 57 통과). 소스-핸들 타입 필터·touch/mouse 좌표 추출·targetHandle 부재 시 생략 모두 커버. |
| 4 | CHANGELOG 미갱신 | **반영** — `CHANGELOG.md` 최상단에 §1.2 Unreleased 항목 추가(SoT 명시). |
| 5 | `workflow-canvas.tsx` God Component 팽창 | **이월** — "드래그 종료→팝업 오픈→자동 연결" 오케스트레이션의 전용 훅 추출은 §1.3 착수 시 함께 검토(plan §1.3 이월 항목 (a) 기록). 유사 코드 누적 시점 리팩터가 적절. |
| 6 | "노드 검색 팝업 열기" 로직 3중 중복 | **반영** — `openNodeSearchPopupAt(clientX, clientY, flowPosition, dragSource?)` 공용 헬퍼로 통합, `onPaneClick`·`handleCanvasMenuAction`·`onConnectEnd` 세 경로가 공유. |
| 7 | `firstInputHandleId` 가 컨테이너 첫 입력 포트 순서에 암묵 의존 | **부분 반영** — `buildAutoConnectConnection` JSDoc 에 "컨테이너 충돌은 현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않음" 명시. 현행 노드 정의상 첫 입력이 예약 포트(`emit` 등)인 케이스 없음(미발생). 예약 포트 방어 로직 강화는 실제 그런 노드 추가 시로 이월. |

## Info (선택 반영)

- #9 `getNodeDefinition` 이중 조회 — `handleAddNodeFromSearch` 는 자동 연결 시 1회만 재조회(경미, Map 조회). 미변경.
- #12 touch/mouse 분기 주석 — `pointerClientPosition` 헬퍼로 추출되며 JSDoc 로 설명 대체.
- #13 `source` 필드명 혼동 — `NodeSearchPopupState.source` → `dragSource` 로 개명(Connection.source 와 구분).
- #10 `dragSource` 방향성 비대칭 → §1.3 이월 (plan (b)).
- #15 `onReconnect` 미배선 상호작용 우려 → §1.3 이월 (plan (c)).
- 기타 INFO(보안 레이어 분리 정상 #8, 성능 O(1) #11 등)는 조치 불요.

## 검증

- tsc `--noEmit`: clean
- vitest `edge-utils.test.ts`: **57 passed** (신규 헬퍼 5종 커버)
- eslint(변경 4파일): 0 errors (기존 `aria-selected` 경고 1건은 본 변경과 무관한 팝업 결과 리스트 JSX)
- e2e(`make e2e-test-full`): backend e2e + Playwright 46 passed (재실행)
- fresh `/ai-review --branch origin/main`: resolution 커밋 후 재검토 완료 → 아래 2회차 참조

---

# Resolution 2회차 — fresh ai-review (2026-07-13 11:28, `review/code/2026/07/13/11_28_30`)

1회차 resolution 커밋(`2b775357b`) 후 fresh 검토 결과 **MEDIUM (CRITICAL 0, WARNING 4)**. CRITICAL(spec stale) 해소 확인. 신규 WARNING 4건 처리:

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | testing | `onConnect` 의 `skipUndo` 옵션 미검증 | **반영** — `editor-store.test.ts` 에 `onConnect — skipUndo (§1.2)` describe 2케이스 추가(opts 미지정 → undoStack +1, `{skipUndo:true}` → undoStack 불변). |
| 2 | testing | `workflow-canvas.tsx` 실배선(onConnectEnd→handleAddNodeFromSearch→onConnect) 컴포넌트/e2e 미검증 | **이월** — 순수 헬퍼는 vitest 59건 전수 커버. 조합 검증(RTL + `@xyflow/react` mock)은 저장소에 canvas 컴포넌트 테스트 패턴이 없어, §1.3 오케스트레이션 훅 추출과 함께 도입(리뷰어도 "§1.3 착수 전 권고"). plan §1.3 이월 (d) 기록. |
| 3 | user_guide_sync | `connecting-nodes.mdx`/`.en.mdx` "빈 영역 드롭 = 아무 일 없음" stale | **반영** — 빈 캔버스 드롭 케이스를 분리해 "노드 추가 팝업 + 자동 연결(입력 포트 없으면 노드만)"로 갱신, 다른 무효 target 의 "아무 일 없음"은 유지(ko/en). |
| 4 | user_guide_sync | `canvas-basics.mdx`/`.en.mdx` "노드 추가 세 가지 방법" 에 §1.2 네 번째 방법 누락 | **반영** — 제목 "세 가지"→"네 가지"(Three→Four), `<Steps>` 에 "출력 포트를 빈 곳으로 드래그" 항목 추가, connecting-nodes 로 교차링크(ko/en). |

INFO(합성 액션 승격·God Component 훅·이중 pushUndo hygiene·헬퍼 배치·좌표변환 중복)는 모두 §1.3 이월 또는 별건 백로그로 추적 — 이번 스코프 밖.

## 2회차 검증
- store test: **54 passed**(신규 skipUndo 2), edge-utils: **57 passed**, tsc clean, eslint 0 errors
- e2e(`make e2e-test-full`): 1회차 resolution 코드에 대해 Playwright 46 passed(재실행). 2회차는 프로덕션 코드 무변경(테스트+문서+plan만).
- fresh `/ai-review`: 2회차 커밋 후 3회차 재검토로 수렴 확인 → 아래 3회차 참조

---

# Resolution 3회차 — fresh ai-review (2026-07-13 11:46, `review/code/2026/07/13/11_46_01`)

2회차 커밋(`7980c2868`) 후 fresh 검토 결과 **MEDIUM (CRITICAL 0, WARNING 3)** — 모두 trivial 또는 sanctioned:

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | testing | 컴포넌트 실배선 통합 테스트 부재 (3회 연속 재부상) | **의도적 최종 이월 확정** — 리뷰어가 "테스트 추가 또는 이월을 최종 확정 문서화" 를 명시 허용. plan §1.3 (d) 를 "[의도적 최종 이월 — 결정 확정] … §1.2 PR 은 이 항목으로 blocking 하지 않는다" 로 못박아 재지적 종결. 순수 로직 vitest 23 전수 커버, glue 만 미검증, canvas 테스트 하네스 부재로 §1.3 훅 추출과 동반 작성이 옳음. |
| 2 | documentation | `workflow-canvas.tsx:336` stale 주석 `popup.source`(개명 전 필드명) | **반영** — `NodeSearchPopupState.dragSource` 로 정정. 겸사 `handleAddNodeFromSearch` undo 주석의 "유일한 체크포인트" 과장을 정확한 서술(엣지가 노드-only 중간 상태를 스냅샷하지 않게 함)로 교정. |
| 3 | requirement | plan §1.2 "vitest 27케이스" 오기(실측 23) | **반영** — "vitest 23케이스(edge-utils 21 + store 2)" 로 정정(git diff `it(` 카운트 실측). |

INFO(pre-existing 이중 pushUndo, 좌표변환 폴백 중복, `getNodeDefinition` 이중 조회, God Component, 섹션 주석)는 §1.3 이월 또는 별건 hygiene 백로그로 추적. 겸사 spec §1.2·CHANGELOG 의 undo 서술도 "단일 pushUndo" 근사 표현 → 정확한 behavior 서술로 교정.

## 3회차 검증
- 변경: workflow-canvas.tsx 주석 2건(inert), spec/CHANGELOG/plan 문서. 프로덕션 로직 무변경.
- tsc/eslint/vitest 영향 없음(주석·문서만). 4회차 fresh `/ai-review` 로 수렴 최종 확인 후 push.

---

# Resolution 4회차 — fresh ai-review (2026-07-13 12:02, `review/code/2026/07/13/12_02_54`) → 수렴

3회차 커밋(`1173bc10f`) 후 fresh 검토 결과 **LOW (CRITICAL 0, WARNING 2)** — 리뷰어 총평 "이번 diff 자체를 차단할 조치는 없다". 두 WARNING 모두 latent/의도적 이월:

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | testing | 컴포넌트 통합 테스트 부재 (4회 연속) | **이월 확정 유지** — 리뷰어가 "이 항목만으로 차단 불요" 로 최종 승인. §1.3(d) 확정 문구 유지. |
| 2 | requirement | 컨테이너 첫 입력 포트 불변식이 JSDoc 에만 의존 + plan 이월 목록에서 누락 | **반영(plan-only)** — plan §1.3 이월 목록에 (e)로 명시 추가(예약 포트 코드 제외 강화 또는 신규 컨테이너 PR 체크리스트). latent·현재 미발생이라 코드 무변경. |

INFO 11건(God Component·skipUndo SRP·dragSource 방향성·이중조회·좌표 폴백 중복·섹션 주석·단순 클릭 팝업·frontmatter code 목록·Rationale 등)은 전부 §1.3 이월 또는 선택적 후속으로 분류, 이번 diff 차단 사유 없음.

## 최종 수렴
- 4라운드: **HIGH(C1+W6) → MEDIUM(C0+W4) → MEDIUM(C0+W3) → LOW(C0+W2)**. CRITICAL 1회차 해소, 이후 실질 코드 결함 0.
- 잔여 2 WARNING 은 latent(미발생)·의도적 이월(§1.3 동반)로, 리뷰어가 명시적으로 non-blocking 판정.
- 4회차 조치는 plan §1.3 (e) 추가뿐(codebase 무변경) → push 가드 기준(마지막 codebase 커밋 `1173bc10f`)의 fresh 리뷰 = 12_02_54 유효. **수렴 완료, push 진행.**
