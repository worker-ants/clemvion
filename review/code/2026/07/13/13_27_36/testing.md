# 테스트(Testing) Review — §1.3 역방향 연결 확인 + 기존 엣지 재연결/분리 (3회차)

## 컨텍스트

이번 diff 는 2회에 걸친 직전 ai-review(`12_40_48` CRITICAL 1건, `13_06_50` WARNING 5건)의 지적이 모두 코드에 반영된 상태다. 직접 확인한 결과:

- CRITICAL(자기연결/무효 핸들 드롭 시 기존 엣지 오삭제)은 `use-edge-reconnect.ts` 의 detach 판정을 success 플래그가 아니라 `connectionState.toNode` 기반으로 재설계해 해소, 회귀 가드 테스트(`use-edge-reconnect.test.ts` "무효 핸들 드롭이면 삭제하지 않는다") 존재.
- `13_06_50` WARNING #2(sourceHandle 재계산 미검증)·#3(컨테이너 충돌 거부 미검증)은 `editor-store.test.ts` `onReconnect (§1.3)` describe 에 각각 "sourceHandle 이 바뀌는 재연결이면 포트색 data 를 재계산한다"·"컨테이너 소속 충돌이면 거부한다(엣지 미변경)" 테스트로 실제 추가됨을 확인.
- `13_06_50` WARNING #4(`evaluateConnectionRejection` sentinel 규약)는 `{ ok: true } | { ok: false; message? }` 판별 유니온(`evaluateConnection`)으로 리팩터됨.
- `removeEdge` 의 `containerId` 재도출도 신규 테스트로 커버됨.

즉 이전 두 라운드가 지적한 테스트 갭은 모두 실제로 메워졌다. 아래는 그 위에서 새로 발견한, 아직 어느 라운드도 지적하지 않은 잔여 사항이다.

## 발견사항

- **[WARNING]** 신규 `onReconnect` 거부(reject) 테스트 2건이 사용자 피드백(toast) 계약을 검증하지 않음
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onReconnect (§1.3)")` 중 "이미 존재하는 동일 연결로의 재연결은 중복으로 거부한다", "컨테이너 소속 충돌이면 거부한다(엣지 미변경) — evaluateConnection 공용 경로" 두 케이스
  - 상세: `evaluateConnection` 은 중복/컨테이너 충돌 거부 시 `{ ok: false, message: "..." }` 를 반환하고 `onConnect`/`onReconnect` 는 이 `message` 를 `toast.error(...)` 로 표시한다는 것이 JSDoc·spec 상 명시된 계약이다. 그런데 이 두 신규 테스트는 `e1?.target` 이 원래 값으로 유지되는지와 `undoStack` 길이만 단언하고, `toastErrorMock` 이 호출됐는지/어떤 메시지로 호출됐는지는 전혀 확인하지 않는다. 반면 같은 파일의 기존 `onConnect — 금지 연결 하드 차단 (§2.2)` 의 "동일 연결 중복은 토스트 + 엣지 미추가" 테스트는 `expect(toastErrorMock).toHaveBeenCalledWith("These nodes are already connected.")` 를 명시적으로 단언한다. 즉 `onReconnect` 경로에서 `evaluateConnection` 이 `message` 를 유실하거나(`{ ok: false }` 로만 반환) `onReconnect` 내부의 `if (result.message) toast.error(result.message)` 호출이 실수로 제거돼도, 이 두 테스트는 "엣지가 안 바뀜" 만으로 여전히 통과한다 — 사용자가 왜 재연결이 거부됐는지 인지하지 못하는 회귀를 잡지 못한다.
  - 제안: 두 테스트에 `expect(toastErrorMock).toHaveBeenCalledWith(...)` 단언을 추가해 `onConnect` 쪽 동일 케이스와 동등한 수준으로 맞출 것.

- **[WARNING]** plan 체크박스의 테스트 개수 서술이 재차 stale — 동일 drift 패턴의 3번째 재발
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 ("테스트: reconnect 훅 renderHook 4 + store onReconnect 4/removeEdge 1 + firstInputHandleId emit 2")
  - 상세: 실제 `editor-store.test.ts` 의 `onReconnect (§1.3)` describe 는 6건(유효 재연결/자기연결 거부/중복 거부/sourceHandle 재계산/컨테이너 충돌 거부/제자리 재연결), `removeEdge (§1.3 detach)` describe 는 2건(제거+undo/containerId 재도출)이다 — 같은 diff 에 포함된 `review/code/2026/07/13/13_06_50/RESOLUTION.md` 자신도 "vitest 125 passed(... store 63[onReconnect 6·removeEdge 2 포함] ...)" 로 6/2 를 명시하고 있어 코드·직전 RESOLUTION 서술과 plan 서술이 서로 어긋난다. 직전 라운드(`13_06_50`)의 testing 리뷰가 "3→4" 로 정정하도록 지적했는데, 바로 그 정정을 반영한 동일 커밋에서 sourceHandle 재계산·컨테이너 충돌 테스트 2건 + removeEdge 1건을 추가로 넣으면서 개수 서술을 다시 갱신하지 않아, 정정 직후 곧바로 재-stale 상태가 됐다 — `12_40_48`→`13_06_50` 에서 이미 한 번 지적·수정된 것과 완전히 같은 종류의 drift(테스트 개수 claim vs 실제 코드)가 세 번째로 재발한 셈이다.
  - 제안: "store onReconnect 6/removeEdge 2" 로 정정. 코드에 새 테스트를 추가하는 커밋에서는 인접 plan 개수 서술을 같은 커밋에서 갱신하는 체크리스트 습관을 권장.

- **[INFO]** `onConnect` 자체 경로에서 `detectContainerConflict` 거부는 여전히 미검증(비대칭)
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")`(자기연결/중복/정상 3케이스만 존재, 컨테이너 충돌 케이스 없음)
  - 상세: 컨테이너 충돌 거부 테스트는 이번 라운드에서 `onReconnect` 쪽에만 추가됐다(공용 `evaluateConnection` 경로를 실증한다는 의도). 현재는 `onConnect`/`onReconnect` 가 동일 헬퍼를 호출하므로 실질 위험은 낮지만, `onConnect` 자체의 스위트만 놓고 보면 "컨테이너 충돌 시 토스트 + 엣지 미추가" 계약이 여전히 0건으로 남아 있어, 향후 `onConnect` 쪽만 개별적으로 손대는 리팩터가 발생하면 이 스위트는 회귀를 못 잡는다.
  - 제안: 선택 사항(낮은 우선순위) — `onConnect` 쪽에도 컨테이너 충돌 거부 케이스 1건을 대칭적으로 추가하는 것을 고려.

- **[INFO]** store 레벨 "자기연결 재연결 거부" 테스트가 검증하는 코드 경로는 실제 React Flow 제스처로는 도달 불가능한 방어 코드
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` 내 `evaluateConnection` 의 `isSelfConnection` 분기, 대응 테스트 "자기연결로의 재연결은 거부한다(변경 없음)"
  - 상세: 직전 라운드(`12_40_48`) requirement 리뷰가 `@xyflow/system`/`@xyflow/react` 소스까지 추적해 확인한 바에 따르면, 자기연결로의 드롭은 React Flow 의 `isValidConnection` 게이트가 `onReconnect` prop 호출 자체를 막아 store `onReconnect` 는 이런 입력으로 절대 호출되지 않는다(이 사실 자체가 그 라운드 CRITICAL 의 근거였다 — 그래서 detach 판정을 success 플래그가 아니라 `toNode` 기반으로 옮겨야 했다). CRITICAL 은 훅 레벨에서 이미 올바르게 해소됐고, 실제 "자기연결 드롭" 시나리오는 `use-edge-reconnect.test.ts` 의 "무효 핸들(노드 위, 예: 자기연결) 드롭이면 삭제하지 않는다" 테스트가 정확히 그 실제 경로(훅의 `toNode` 판정)를 커버한다. 반면 store 테스트는 여전히 프로덕션에서 도달 불가능한 방어 코드를 직접 함수 호출로 검증하는 것이라, 이 테스트만 보고 "self-connection reconnect 가 store 레벨에서 이렇게 막힌다" 고 오인하면 안 된다 — 기능적 결함은 아니고 이미 실제 경로가 다른 테스트로 커버되므로 조치 불요.
  - 제안: 기능적 조치 불요. 해당 테스트 옆에 "RF isValidConnection 게이트로 실제 드래그에서는 도달하지 않는 방어 코드 — 실사용 자기연결 드롭 시나리오는 use-edge-reconnect.test.ts 참조" 주석을 남기면 향후 커버리지 감사 시 혼동 방지에 도움.

## 요약

이전 두 라운드(`12_40_48`, `13_06_50`)가 지적한 CRITICAL 1건과 WARNING 5건은 모두 코드·테스트 레벨에서 실제로 반영됐음을 diff 로 직접 확인했다 — detach 판정의 `toNode` 기반 재설계, sourceHandle 변경 시 포트색 재계산 테스트, 컨테이너 충돌 거부 테스트, `evaluateConnection` 판별 유니온 리팩터, `removeEdge` 의 `containerId` 재도출 테스트가 모두 존재한다. 이번 라운드에서 새로 발견한 잔여 사항은 두 가지 WARNING(신규 거부 테스트가 엣지 상태만 확인하고 `toast.error` 호출 자체는 검증하지 않음, plan 의 테스트 개수 서술이 같은 수정 커밋에서 추가된 2건을 반영하지 못해 세 번째로 재발한 drift)과 두 가지 INFO(대칭성 관점에서 `onConnect` 자체의 컨테이너 충돌 테스트 부재, store 레벨 자기연결 거부 테스트가 실제로는 도달 불가능한 경로를 검증한다는 점 — 단 실제 시나리오는 이미 훅 테스트가 정확히 커버)이다. 기능적 결함이나 회귀 위험은 발견되지 않았고, 모두 테스트 완결성·문서-테스트 정합성 수준의 보완 사항이다.

## 위험도
LOW
