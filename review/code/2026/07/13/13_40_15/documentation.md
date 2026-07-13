# 문서화(Documentation) Review

대상: spec §1.3(엣지 역방향 연결 확인 + 기존 엣지 재연결/분리) 구현 최종 상태 — 3회 ai-review 사이클(`12_40_48`→`13_06_50`→`13_27_36`, HIGH→MEDIUM→LOW)을 거친 뒤의 4회차 fresh 검토. CHANGELOG/spec/plan/mdx(ko·en)와 실제 코드(`editor-store.ts`/`use-edge-reconnect.ts`/`workflow-canvas.tsx`/`edge-utils.ts`)를 직접 대조했다.

## 발견사항

- **[INFO]** 이전 라운드가 지적한 문서 drift 3건이 최종 상태에서 모두 해소됨을 재확인
  - 위치: `CHANGELOG.md` §1.3 항목 1, `spec/3-workflow-editor/2-edge.md` §1.3, `plan/in-progress/spec-sync-edge-gaps.md` §1.3
  - 상세: (a) 세 문서 모두 "`onReconnect`/`onReconnectEnd` 두 콜백 배선"으로 정확히 서술하며, `grep -rn onReconnectStart`는 코드·문서 전체에서 0건이다(코드에서 제거된 success-flag 방식의 잔재 없음). (b) store 메서드명은 `removeEdge`로 전 파일 일관 — 남은 `deleteEdge`는 `workflowsApi.deleteEdge`(기존 REST 헬퍼)뿐이고, `editor-store.ts` JSDoc이 "혼동 방지를 위해 `removeEdge`로 명명"이라고 그 이유까지 정확히 밝힌다. (c) `evaluateConnectionRejection`→`evaluateConnection` 판별 유니온(`{ok:true}|{ok:false;message?}`) 개명이 spec·CHANGELOG·plan·코드 전체에서 일치한다. (d) `plan/in-progress/spec-sync-edge-gaps.md` §1.3의 테스트 개수 서술도 "reconnect 훅 renderHook 4 + store onReconnect 6/removeEdge 2 + firstInputHandleId emit 2"로, 실제 `editor-store.test.ts`의 `describe("onReconnect (§1.3)")` 6개 `it()` / `describe("removeEdge (§1.3 detach)")` 2개 `it()`와 정확히 일치함을 직접 세어 확인했다(직전 라운드가 지적한 "4/1" stale 값은 커밋 `77850f5f9`에서 이미 정정됨).
  - 제안: 없음(확인 목적).

- **[INFO, 긍정]** 신규 공개 함수·인터페이스 메서드의 JSDoc 품질
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`(모듈 JSDoc + `⚠️` 회귀 방지 근거), `codebase/frontend/src/lib/stores/editor-store.ts`(`evaluateConnection`/`buildEdgeDataForConnection`/`onReconnect`/`removeEdge` 인터페이스 JSDoc), `codebase/frontend/src/lib/utils/edge-utils.ts`(`RESERVED_INPUT_HANDLE_IDS`/`firstInputHandleId`)
  - 상세: 모든 신규 함수가 "왜"(success 플래그 대신 드롭 위치로 판정하는 이유, 판별 유니온을 쓰는 이유, 이름 충돌 회피 이유)를 근거와 함께 설명하며 실제 구현과 line-level로 일치한다. `RESERVED_INPUT_HANDLE_IDS`의 SoT 주석("backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`")도 실제 백엔드 상수(`new Set(['emit'])`, `shadow-workflow.ts:220`)와 값·위치가 정확히 일치함을 직접 확인했다.
  - 제안: 없음.

- **[INFO, 긍정]** 유저가이드(mdx, ko/en) 동시 갱신 — 이 저장소는 최상위 README 대신 `content/docs`가 SoT
  - 위치: `connecting-nodes.mdx`/`.en.mdx`(재연결·detach·undo 섹션 신설), `containers-and-tools.mdx`/`.en.mdx`(컨테이너 소속 변경 문구를 "드래그가 아니라 연결선 재연결"로 명확화)
  - 상세: 신규 동작이 ko/en 대칭으로 반영되고, `connecting-nodes.mdx` frontmatter `code:` 목록과 `spec/3-workflow-editor/2-edge.md`의 code 인벤토리가 `use-edge-reconnect.ts`/`edge-utils.ts` 추가분까지 서로 일치한다. API 문서·환경변수 문서는 이번 변경(순수 프런트엔드 상태 관리, 백엔드·wire 무변경)과 무관해 해당 없음.
  - 제안: 없음.

- **[INFO]** 테스트 파일 `Connection` 타입 미-import(TS2304) 결함도 최종 상태에서 해소 확인
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts:2`
  - 상세: 1회차 리뷰가 지적한 `import type { Node, Edge } from "@xyflow/react"` 뒤 `Connection` 누락은 현재 `import type { Node, Edge, Connection } from "@xyflow/react";`로 수정돼 있다. (참고: 이 파일은 `tsconfig.json`의 `__tests__` exclude 대상이라 `next build`/`tsc --noEmit`로는 애초에 잡히지 않고 `vitest run`도 타입 strip이라 무관하지만, 코드 자체는 정정됐다.)
  - 제안: 없음(확인 목적). 이 구조적 사각지대(tsc가 `__tests__`를 exclude)는 기존에 별도 트랙으로 이월된 항목이라 이번 변경 범위는 아니다.

## 요약

3회의 ai-review 수정 사이클(HIGH→MEDIUM→LOW)을 거쳐 CHANGELOG·spec·plan·mdx 유저가이드·코드 간 문서-코드 정합성이 최종적으로 완전히 회복됐다 — `onReconnectStart` 잔존 서술, `deleteEdge`→`removeEdge` 개명 전파, `evaluateConnection` 함수명, plan 테스트 개수(6/2) 모두 직접 대조로 line-level 일치를 확인했다. 신규 공개 함수의 JSDoc은 판정 근거("왜 성공 플래그가 아니라 드롭 위치인가" 등)를 명확히 설명하며, ko/en 유저가이드도 대칭으로 갱신됐고 frontmatter code 인벤토리도 정합하다. 이번 라운드에서 새로 발견된 문서화 결함은 없다.

## 위험도
NONE
