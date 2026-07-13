# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. §1.3(역방향 연결 확인 + 엣지 재연결/분리) 3회차 diff 로, 직전 두 라운드(12_40_48 CRITICAL 1건, 13_06_50 WARNING 다수)의 지적사항은 9개 리뷰어가 코드·테스트로 독립 재검증해 모두 해소를 확인했다. 신규 발견은 WARNING 2건뿐이며 둘 다 기능 결함이 아니라 (1) 테스트 커버리지 보완 여지, (2) plan 문서의 테스트 개수 서술 stale — 이며, 두 번째는 3개 리뷰어(requirement/testing/documentation)가 동일 문제를 중복 지적했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(plan) | `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스의 테스트 개수 서술이 실제 코드와 어긋남 — "store onReconnect 4/removeEdge 1" 로 적혀 있으나 실제 `editor-store.test.ts` 는 `onReconnect (§1.3)` describe 6건(유효 재연결/자기연결 거부/중복 거부/sourceHandle 재계산/컨테이너 충돌 거부/제자리 재연결), `removeEdge (§1.3 detach)` describe 2건(제거+undo/containerId 재도출). 같은 changeset 내 `review/code/2026/07/13/13_06_50/RESOLUTION.md` 자신은 이미 "6/2"로 정확히 기록하고 있어 두 문서 간 내부 불일치. 직전 라운드가 "3→4"로 한 번 정정한 바로 그 문구가, 같은 정정 커밋에서 신규 테스트 2건이 더 추가되며 재차 stale 해진 것 — 동일 drift 패턴 3번째 재발(requirement·testing·documentation 3개 리뷰어 중복 지적) | `plan/in-progress/spec-sync-edge-gaps.md` §1.3 | "store onReconnect 6/removeEdge 2"로 정정(코드 변경 불요). 향후 테스트 추가 커밋에서 인접 plan 개수 서술을 같은 커밋에서 함께 갱신하는 체크리스트 습관 권장 |
| 2 | 테스트 | 신규 `onReconnect` 거부(reject) 테스트 2건("중복으로 거부", "컨테이너 소속 충돌이면 거부")이 엣지 상태·undoStack 길이만 단언하고 사용자 피드백(`toast.error` 호출/메시지) 계약은 검증하지 않음 — `evaluateConnection`이 `message`를 유실하거나 `onReconnect` 내부의 `toast.error(result.message)` 호출이 실수로 제거돼도 이 테스트들은 여전히 통과해 회귀를 못 잡음. 같은 파일의 `onConnect — 금지 연결 하드 차단` 스위트는 동등 케이스에서 `toast.error` 호출을 명시적으로 단언해 비대칭 | `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onReconnect (§1.3)")` | 두 테스트에 `expect(toastErrorMock).toHaveBeenCalledWith(...)` 단언 추가, `onConnect` 쪽과 동등 수준으로 정렬 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/보안/부작용 | 구조적 엣지(컨테이너 `body`/`emit`)에 `reconnectable:false` opt-out 이 없어 일반 데이터 엣지와 동일하게 드래그 재연결/detach 대상 — 서버측 `CONTAINER_MISSING_EMIT` 등 이중 검증이 최종 방어선으로 남아 즉각 위험 아님(3라운드 연속 관찰·수용) | `workflow-canvas.tsx` `<ReactFlow onReconnect.../>` | 필요 시 엣지 데이터에 `structural: true` 필드 추가해 reconnectable/detach 대상에서 명시적 제외 검토 |
| 2 | 아키텍처 | FE `RESERVED_INPUT_HANDLE_IDS`(`edge-utils.ts`)와 BE `CONTAINER_LOOPBACK_PORTS`(`shadow-workflow.ts`)가 값은 일치하나 컴파일타임 공유 계약 없이 독립 리터럴로 존재 — 원소 1개뿐이라 즉각 위험 낮음 | `codebase/frontend/src/lib/utils/edge-utils.ts` | 예약 포트가 2개 이상으로 늘거나 다른 위치에서도 참조되면 공유 상수/패키지 승격 검토 |
| 3 | 유지보수성/부작용 | `onReconnect`/`removeEdge` 는 실제 변경 여부와 무관하게 항상 `pushUndo()` 호출 — 기능 영향 미미(무변화 시 Ctrl+Z 1회 스킵), 기존 `onConnect`/`removeNode` 패턴과 일관 | `editor-store.ts` `onReconnect`/`removeEdge` | 우선순위 낮음. 필요 시 "실제 변경 시에만 pushUndo" 최적화 고려 |
| 4 | 유지보수성 | `onReconnect`/`removeEdge` 종결부("nextEdges 계산 → deriveContainerAssignments → return")가 3줄 동일 패턴으로 반복 | `editor-store.ts` | 선택 사항 — `commitEdges(state, nextEdges)` 헬퍼 추출 고려, 현재 규모론 시급하지 않음 |
| 5 | 테스트 | `onConnect` 자체 스위트에는 컨테이너 충돌 거부 케이스가 없음(자기연결/중복/정상 3케이스만) — 공용 `evaluateConnection` 경로라 실질 위험 낮으나, 향후 `onConnect` 만 개별 리팩터 시 회귀 미포착 가능 | `editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")` | 선택 사항 — `onConnect` 쪽에도 컨테이너 충돌 거부 케이스 1건 대칭 추가 고려 |
| 6 | 테스트 | store 레벨 "자기연결 재연결 거부" 테스트가 실제 React Flow 제스처로는 도달 불가능한 방어 코드를 검증(`isValidConnection` 게이트가 실제 자기연결 드롭을 `onReconnect` 호출 전에 차단) — 실제 시나리오는 `use-edge-reconnect.test.ts` 가 정확히 커버, 기능 결함 아님 | `editor-store.ts`/`editor-store.test.ts` | 조치 불요. 혼동 방지용 주석("실사용 경로는 use-edge-reconnect.test.ts 참조") 추가 고려 |
| 7 | 아키텍처 | `workflow-canvas.tsx`(993줄) God Component — 기존 부채, 이번 diff 는 오히려 재연결 로직을 순수 훅으로 추출해 완화 방향(§1.2 팝업 오케스트레이션 잔여는 plan 에 이미 이월 추적 중) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 별도 조치 불요. §1.2 정리 시 동일 패턴(순수 훅+콜백 주입) 적용 권장 |
| 8 | 아키텍처 | 구조적 엣지(body/emit)와 일반 데이터 엣지가 도메인 모델상 1급 필드로 구분되지 않고 핸들 id 명명 규칙에만 암묵적으로 존재 | `workflow-canvas.tsx`, 엣지 데이터 스키마 전반 | 조치 불요. 구조적 배선 보호 필요해지면 `edge.data.role`/`structural` 필드로 승격 검토(항목 1과 연계) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/우회 없음. 이전 CRITICAL(자기연결 오삭제) 해소 재확인, DB 레벨 방어선 유지 |
| architecture | LOW | DIP/OCP 준수 확장, 순환의존·레이어 위반 없음. FE/BE 예약포트 공유계약 부재·God Component·구조적 엣지 미구분은 기존/latent 낮은 위험 |
| requirement | LOW | spec §1.3 line-level 정합, 이전 CRITICAL+SPEC-DRIFT+WARNING 다수 해소 확인. plan 테스트 개수 stale 재발 WARNING 1건 |
| scope | NONE | 스코프 이탈·무관 파일 수정 없음. 리팩터·문서 수정 모두 §1.3 요구에 직접 종속 |
| side_effect | NONE | 전역 상태/네트워크 부작용 없음. 이전 CRITICAL·네이밍 충돌 해소 확인 |
| maintainability | NONE | 이전 라운드 유지보수성 WARNING 전건 해소. 경미한 boilerplate 반복만 잔존 |
| testing | LOW | 이전 갭 모두 메워짐. 신규 WARNING 2건(toast 계약 미검증, plan 개수 재-stale) |
| documentation | LOW | CHANGELOG/spec/plan/mdx 정합 대부분 회복. plan 테스트 개수 stale WARNING(공동 지적) |
| user_guide_sync | NONE | 매칭 trigger(`spec-major-change`) 필수 동반갱신 완료, mdx ko/en parity 유지, 누락 0건 |

## 발견 없는 에이전트

security, scope, side_effect, maintainability, user_guide_sync — CRITICAL/WARNING 없음(NONE), 확인성 INFO만 존재.

## 권장 조치사항
1. `plan/in-progress/spec-sync-edge-gaps.md` §1.3 테스트 개수 서술을 "store onReconnect 6/removeEdge 2"로 정정(3개 리뷰어 중복 지적, 코드 변경 불요).
2. `editor-store.test.ts` 의 신규 `onReconnect` 거부 테스트 2건에 `toast.error` 호출 단언 추가해 `onConnect` 쪽과 커버리지 대칭화.
3. (선택, 낮은 우선순위) `onConnect` 자체 스위트에 컨테이너 충돌 거부 케이스 1건 추가, store 자기연결 거부 테스트 옆에 "실제 도달 불가 경로" 주석 추가.
4. (선택, 백로그) 예약 포트(`RESERVED_INPUT_HANDLE_IDS`)가 2개 이상으로 늘거나 구조적 엣지 보호가 필요해지면 FE/BE 공유 상수화·`structural` 필드 승격 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync (8명 — architecture 는 router_safety 강제가 아닌 router 자체 선택)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 프런트엔드 zustand 상태갱신 + React Flow 콜백 배선(렌더/알고리즘 복잡도 변경 없음)으로 router 판단(사유 원문 미제공, changeset 성격상 추론) |
  | dependency | 신규 외부 패키지 의존성 변경 없음 |
  | database | DB 스키마·쿼리 변경 없음(백엔드 미포함 changeset) |
  | concurrency | 비동기/동시성 로직 변경 없음(단일 스레드 클라이언트 상태 갱신) |
  | api_contract | API/DTO/wire 계약 변경 없음(순수 프런트엔드) |