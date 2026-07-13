# Requirement Review — edge §1.2 출력 포트 드래그→빈 영역 드롭 자동 노드 추가+연결 (4회차 fresh, origin/main 대비 4-commit 누적)

대상 diff 는 `origin/main` 대비 4개 커밋(`19386ef10` feat, `2b775357b` refactor/resolution, `7980c2868` docs/tests, `1173bc10f` docs)의 누적이며, 선행 3회 ai-review(`11_04_21` HIGH→해소, `11_28_30` MEDIUM→해소, `11_46_01` MEDIUM CRITICAL=0→해소)가 지적한 CRITICAL 1건·WARNING 다수를 모두 반영한 최종 상태다. 본 라운드는 그 해소가 실제 코드/spec 실측과 line-level 로 일치하는지, 그리고 새로운 요구사항 결함이 있는지 독립적으로 재검증했다.

## 발견사항

- **[INFO]** spec §1.2 line-level 일치 및 감사 수치(vitest 케이스 수) 재검증 — 완전 정확
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2(헤더+3 불릿+"현재 구현" 각주), `plan/in-progress/spec-sync-edge-gaps.md` §1.2 체크박스, `CHANGELOG.md`
  - 상세: 헤더 "(미구현 · Planned)" 제거, 3개 불릿(팝업 표시/자동 연결 방향/입력 포트 없으면 생략)과 "현재 구현" 각주(`onConnectEnd`, `connectionState.isValid`/`fromNode`/`fromHandle`, `dragSource`, `buildAndAddNode` id 반환, `skipUndo`, 순수 헬퍼 4종)가 실제 코드(`workflow-canvas.tsx`, `edge-utils.ts`, `editor-store.ts`)와 정확히 대응함을 직접 대조 확인. 3회차(`11_46_01`) 가 지적한 "vitest 27케이스"(과다 기재) 는 최종 커밋(`1173bc10f`)에서 "23케이스(edge-utils 헬퍼 21 + `onConnect` skipUndo 2)"로 정정됐고, `edge-utils.test.ts` 의 5개 신규 describe 블록을 직접 카운트(`isConnectionDroppedOnPane` 5 + `firstInputHandleId` 4 + `connectionDragSource` 6 + `pointerClientPosition` 3 + `buildAutoConnectConnection` 3 = 21) + `editor-store.test.ts` `describe("onConnect — skipUndo (§1.2)")` 2건으로 21+2=23 이 실측과 정확히 일치함을 재확인했다. CHANGELOG/spec 의 undo 서술("`buildAndAddNode` 단일 pushUndo" → "엣지 추가가 노드-only 중간 상태를 별도 스냅샷으로 남기지 않는다")도 3회차가 지적한 과장("유일한 체크포인트")을 정확한 behavior 표현으로 교정한 상태다.
  - 제안: 없음(조치 완료 확인).

- **[WARNING]** `firstInputHandleId`/`buildAutoConnectConnection` 의 "컨테이너 충돌 미발생" 불변식이 여전히 코드가 아닌 JSDoc 주석에만 의존 — 3회 연속(11_04_21/11_28_30/11_46_01) 동일 관찰이 이번에도 재확인되며, plan §1.3 이월 항목 (a)-(d) 명시 목록에는 이 항목 자체가 없음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildAutoConnectConnection` JSDoc("컨테이너 충돌은 현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않는다"), `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(Rule 2: `targetHandle==='emit'` 이고 source 가 이미 다른 컨테이너 소속이면 거부)
  - 상세: 자동 연결의 `targetHandle` 은 `firstInputHandleId(newNodeDefinition)` 이 반환하는 신규 노드의 첫 입력 포트다. 현재 `loop`/`foreach`/`map` 3개 컨테이너 스키마 모두 `inputs` 배열 순서가 `['in','emit']`이라 첫 입력은 항상 `'in'`이고, `detectContainerConflict`가 트리거되지 않는다 — 오늘 시점 데이터로는 안전함을 재확인했다. 그러나 이 안전성은 코드가 강제하는 것이 아니라 "미래에도 새 컨테이너 타입의 첫 입력이 예약 포트(`emit` 등)가 아닐 것"이라는 관례에 대한 암묵적 의존이다. 이 가정이 깨지면(신규 컨테이너 노드 정의 추가 시 포트 순서가 다르게 정의될 경우) `onConnect` 이 `detectContainerConflict`에서 조용히 거부되어 토스트만 뜨고, 이미 `buildAndAddNode`로 생성된 신규 노드는 캔버스에 엣지 없는 고아 상태로 남는다(생성 롤백 없음) — 사용자는 원인을 알기 어렵다. 이 latent 리스크 자체는 매 라운드 "차단 아님"으로 판정돼 왔으나, God-Component/방향성 재설계/onReconnect 충돌/통합테스트 이월(plan §1.3 항목 a~d)과 달리 이 항목은 plan 의 명시적 이월 목록에 실제로 포함돼 있지 않아, 향후 §1.3 착수 시점에도 재점검 트리거가 걸리지 않고 누락될 위험이 있다.
  - 제안: 코드 되돌리기 불필요, 두 가지 중 하나를 권고 — (1) `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 목록에 이 항목을 (e)로 명시 추가해 향후 신규 컨테이너 노드 정의 PR 체크리스트에 걸리게 하거나, (2) `firstInputHandleId`(또는 `buildAutoConnectConnection`)가 예약 포트 id(`'emit'` 등)를 명시적으로 제외하는 선택 로직으로 강화해 불변식을 코드 레벨에서 보장. 후자가 더 근본적이나 우선순위는 낮음(현재 데이터로 미발생).

- **[INFO]** (회색지대) `onConnectEnd` 가 "드래그 없는 단순 클릭"에도 반응해 팝업을 열 수 있음 — spec §1.2 가 이 경계를 정의하지 않음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `isConnectionDroppedOnPane`/`connectionDragSource`(`isValid !== true` 만으로 판정), `workflow-canvas.tsx` `onConnectEnd`
  - 상세: React Flow v12 는 출력 포트에서 mousedown 후 이동 없이 바로 mouseup(사실상 클릭)해도 connection 제스처가 종료된 것으로 간주해 `onConnectEnd`를 호출하며, 이때 `connectionState.isValid`는 유효 target 이 없어 `true`가 아니다. 즉 사용자가 드래그할 의도 없이 출력 포트를 클릭만 해도 그 좌표에 노드 검색 팝업이 열린다. spec §1.2 본문은 "드래그 후 빈 영역에 드롭"만 서술하고 "이동 거리 0인 클릭"을 별도로 다루지 않아, 이 동작이 spec 위반인지 의도된 것인지 spec 자체가 침묵한다. React Flow 공식 예제와 동일한 패턴이고 데이터 손상·오류 없이 Escape 로 닫히므로 실사용 위험은 낮다.
  - 제안: 필요 시 spec §1.2에 이 경계 케이스("이동 없는 클릭도 빈 영역 드롭과 동일하게 취급") 를 명시해 함수명(`isConnectionDroppedOnPane`)-실제 판정 기준 간 불일치 소지를 없앨 수 있음(선택 사항, 차단 아님).

- **[INFO]** 컴포넌트/e2e 통합 테스트 부재 — 3회 연속 재부상 후 이번 라운드에 "의도적 최종 이월"로 명시적 확정됨
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (d)
  - 상세: `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선 조합은 여전히 어떤 테스트로도 exercise 되지 않는다(순수 판정/조립 로직은 vitest 23케이스로 전수 커버). 다만 이번 최종 커밋에서 이 갭을 "§1.3 오케스트레이션 훅 추출 시점에 함께 도입"하기로 plan 에 `[의도적 최종 이월 — 결정 확정]` 문구로 명시 확정했고, 3회 연속 동일 지적이었다는 사실과 재지적 대상이 아니라는 점까지 문서화했다. 요구사항 충족(§1.2 스코프) 관점에서는 순수 로직이 전수 커버돼 있어 실질 버그 위험은 낮으며, 이는 testing 리뷰 영역의 결정이지 requirement 결함은 아니다.
  - 제안: 없음(참고용 기록). 재지적하지 않음.

- **[INFO]** 비즈니스 로직·반환값·엣지케이스 재확인 — 결함 없음
  - 상세: (1) 대상 노드에 입력 포트가 없으면(`firstInputHandleId` → `null`) `buildAutoConnectConnection` 이 `null` 을 반환해 연결을 생략하고 노드만 남는다 — spec 3번째 불릿과 line-level 일치. (2) 자동 연결 경로도 `onConnect` 내부의 자기연결/중복/컨테이너 충돌 검증을 그대로 통과해야 하며 `skipUndo` 는 `pushUndo()` 호출만 건너뛸 뿐 다른 검증·상태 변경에 관여하지 않는다(코드 확인). (3) 신규 순수 헬퍼 5종(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`) 모두 모든 분기에서 값을 반환하며 null/undefined 가드가 완비돼 있다(직접 코드 열람 확인). (4) TODO/FIXME/HACK/XXX 류 미완성 표식은 diff 전체에서 발견되지 않음.

## 요약

4회차 fresh 검토 결과, 3차례의 ai-review 사이클(HIGH→MEDIUM→MEDIUM, CRITICAL 0 수렴)이 지적한 사항은 최종 커밋(`1173bc10f`)까지 전건 정확히 해소되어 있음을 독립적으로 재확인했다 — spec §1.2 본문·CHANGELOG·plan·유저가이드 4개 mdx 모두 실제 구현과 line-level 로 일치하고, 감사 수치(vitest 23케이스) 도 실측과 정확히 부합한다. §1.2 가 spec 이 요구하는 3가지 행위(팝업 표시·자동 연결·입력 포트 없으면 생략)를 정확히 구현하며 반환값·엣지케이스·에러 시나리오 처리에 결함이 없다. 유일하게 남은 실질 관찰은 컨테이너 첫 입력 포트가 예약 포트가 아니라는 가정이 여전히 코드가 아닌 주석에만 의존하고 이 항목이 plan §1.3 명시 이월 목록에서 누락돼 있다는 점(WARNING, latent·현재 미발생)과, "드래그 없는 클릭"에 대한 spec 침묵(회색지대 INFO) 두 가지뿐이며 둘 다 차단 사유는 아니다. 통합 테스트 부재는 plan 에 의도적 최종 이월로 명시 확정되어 재지적 대상이 아니다.

## 위험도
LOW
