# 문서화(Documentation) Review

대상: spec §1.3(엣지 역방향 연결 확인 + 기존 엣지 재연결/분리) 구현 + 직전 ai-review 2회차(`12_40_48`, `13_06_50`) 반영분. 33개 변경 파일(코드 6 + mdx 4 + CHANGELOG/spec/plan 3 + 이전 리뷰 산출물 20).

## 발견사항

- **[WARNING]** `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스의 테스트 개수 서술이 실제 테스트 파일과 다시 어긋나 있다(2차 drift — 직전 라운드가 고친 "3→4" 수정 이후 테스트가 더 늘어난 것을 반영하지 못함).
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 항목 — "테스트: reconnect 훅 renderHook 4 + store onReconnect **4**/removeEdge **1** + firstInputHandleId emit 2"
  - 상세: 실제 `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` 를 직접 세어보면 `describe("onReconnect (§1.3)")` 블록은 6개 `it()`(유효 재연결/자기연결 거부/중복 거부/`sourceHandle` 변경 시 포트색 재계산/컨테이너 충돌 거부/제자리 재연결)이고, `describe("removeEdge (§1.3 detach)")` 블록은 2개 `it()`(제거+undo/컨테이너 `containerId` 재도출)이다. `vitest run` 으로 직접 실행해 총 125 passed(3 파일)를 확인했고, 이는 `review/code/2026/07/13/13_06_50/RESOLUTION.md` 검증 섹션이 이미 정확히 기록한 "store 63[onReconnect 6·removeEdge 2 포함]" 과 정확히 일치한다. 즉 두 번째 ai-review 라운드가 WARNING #2(`sourceHandle` 재계산 미검증)·#3(컨테이너 충돌 거부 미검증)·removeEdge INFO(컨테이너 재도출 미검증)를 반영하며 테스트를 4→6, 1→2 로 늘렸는데, 그 RESOLUTION.md 자체는 올바른 개수를 기록한 반면 plan 체크박스 서술은 그 갱신 **이전**(1차 SPEC-DRIFT 수정 직후, "3→4"까지만) 값에 머물러 있다. 같은 커밋 안에 있는 두 문서(plan vs RESOLUTION.md)가 동일 기능의 테스트 개수를 서로 다르게 기재하는 내부 불일치이며, 향후 커버리지 감사·"완료 항목 재검토" 시 혼란을 유발할 수 있다.
  - 제안: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 텍스트의 "store onReconnect 4/removeEdge 1" 을 "store onReconnect 6/removeEdge 2" 로 정정.

- **[INFO]** 이전 2회 ai-review 라운드가 지적한 문서 drift(3건)는 이번 diff 최종 상태에서 모두 실제로 해소됨을 확인
  - 위치: `CHANGELOG.md`(§1.3 항목 1), `spec/3-workflow-editor/2-edge.md` §1.3, `plan/in-progress/spec-sync-edge-gaps.md` §1.3
  - 상세: (a) `onReconnectStart` 배선 서술 — 세 문서 모두 현재 "`onReconnect`/`onReconnectEnd` 두 콜백"으로 정확히 서술하며, 실제 `workflow-canvas.tsx`/`use-edge-reconnect.ts` 코드에도 `onReconnectStart` 는 존재하지 않는다(grep 0건, 직접 확인). (b) `deleteEdge`→`removeEdge` 리네임 — plan 을 포함한 전 파일에서 `removeEdge` 로 일관되고, `deleteEdge` 잔존은 원래부터 있던 무관한 `workflowsApi.deleteEdge`(REST 헬퍼) 한 곳뿐이다(grep 확인). (c) `evaluateConnectionRejection`→`evaluateConnection` 판별 유니온 리팩터 — spec/CHANGELOG/plan 모두 `evaluateConnection` 으로 정확히 갱신되어 있고 실제 함수명과 일치한다. 위 WARNING(테스트 개수) 항목을 제외하면 CHANGELOG·spec·plan·mdx·코드 간 SoT 정합이 잘 유지되고 있다.
  - 제안: 없음(확인 목적).

- **[INFO, 긍정]** 유저가이드(mdx) 동시 갱신 — README 대체 역할
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`/`.en.mdx`, `containers-and-tools.mdx`/`.en.mdx`
  - 상세: 이 저장소는 최상위 기능 README 대신 `content/docs` 아래 ko/en 이중 유저가이드가 SoT 문서 역할을 한다. 신규 재연결/detach/역방향 연결 동작이 ko/en 양쪽에 대칭으로 추가됐고(문구 표현만 다르고 내용 동일), 기존 "컨테이너 소속 변경" 안내 문구도 새 끝점-드래그 재연결 동작에 맞게 함께 정정됐다. frontmatter `code:` 목록도 `connecting-nodes.mdx`/spec 파일 양쪽에서 `use-edge-reconnect.ts`/`edge-utils.ts` 를 동일하게 포함해 정합한다(직접 확인). API 문서·환경변수 문서는 이번 변경(순수 프런트엔드 상태 관리)과 무관해 해당 없음.
  - 제안: 없음.

- **[INFO, 긍정]** 신규 코드의 JSDoc·인라인 주석 품질
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `codebase/frontend/src/lib/stores/editor-store.ts`(`evaluateConnection`/`buildEdgeDataForConnection`/`onReconnect`/`removeEdge`), `codebase/frontend/src/lib/utils/edge-utils.ts`(`RESERVED_INPUT_HANDLE_IDS`/`firstInputHandleId`)
  - 상세: 모든 신규 공개 함수·메서드에 "왜 이렇게 판정하는지"(success 플래그 대신 드롭 위치로 판정하는 이유, `evaluateConnection` 이 판별 유니온을 쓰는 이유, `removeEdge` 로 명명해 `workflowsApi.deleteEdge` 와 구분하는 이유)를 근거와 함께 설명하는 JSDoc/주석이 달려 있고, 모두 실제 구현과 line-level 로 일치함을 코드 대조로 확인했다. `workflow-canvas.tsx` 의 `reconnectEdgeInStore` 셀렉터명도 인접 컨벤션과 다른 이유를 한 줄 주석으로 명시(이전 라운드 maintainability INFO 반영 확인).
  - 제안: 없음.

## 요약

이번 diff 는 두 차례의 ai-review 사이클(12_40_48 CRITICAL 1건 + WARNING 3건, 13_06_50 SPEC-DRIFT 1건 + WARNING 4건)을 거치며 CHANGELOG·spec·plan·mdx 유저가이드 전반의 문서-코드 정합성을 대부분 회복했다 — `onReconnectStart` 잔존 서술, `deleteEdge`→`removeEdge` 개명 전파, `evaluateConnection` 함수명 등은 모두 최종 상태에서 코드와 정확히 일치함을 직접 확인했다. 다만 `plan/in-progress/spec-sync-edge-gaps.md` §1.3 의 테스트 개수 서술("onReconnect 4/removeEdge 1")이 2차 라운드에서 실제로 테스트가 6/2 로 늘어난 뒤 갱신되지 않아 재차 stale 해졌고, 이는 같은 커밋에 포함된 `review/code/2026/07/13/13_06_50/RESOLUTION.md` 의 올바른 기록(6/2)과도 어긋나는 내부 불일치다. 신규 공개 함수의 JSDoc/인라인 주석 품질과 ko/en 유저가이드 동시 갱신은 전반적으로 모범적이다.

## 위험도
LOW
