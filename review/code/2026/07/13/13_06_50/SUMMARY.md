# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나(직전 라운드 CRITICAL·WARNING 3건은 모두 반영·해소 확인), 이번 PR 이 새로 도입한 핵심 로직(재연결 시 포트색 재계산) 미검증 + 기존 사각지대(컨테이너 충돌 거부 경로 미검증, RESOLUTION.md 서술 오류)가 testing 관점에서 MEDIUM 으로 지적됐고, **architecture/documentation/user_guide_sync 3개 리뷰어는 `success` 로 보고됐으나 출력 파일이 디스크에 존재하지 않아(disk-write gap) 해당 3개 관점의 실제 발견사항을 확인할 수 없는 상태**이므로 전체 위험도를 낮추지 않고 MEDIUM 으로 유지한다.

## Critical 발견사항

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `onReconnectStart` 배선 서술이 실제 코드와 불일치(CHANGELOG/spec/plan 3개 문서 동시 stale). 직전 라운드 CRITICAL 수정 과정에서 "success-flag(ref+`onReconnectStart`)" 판정 설계를 "드롭 위치(`connectionState.toNode`)" 판정으로 교체하며 `onReconnectStart`/ref 를 의도적으로 제거했으나(코드가 더 단순하고 회귀도 없음), 세 문서 프로즈만 리팩터 이전 설계("`onReconnectStart`/`onReconnect`/`onReconnectEnd` 3종 배선")를 그대로 서술 | `CHANGELOG.md`(§1.3 항목1) / `spec/3-workflow-editor/2-edge.md` §1.3 / `plan/in-progress/spec-sync-edge-gaps.md` §1.3 | 코드 변경 불요. 세 문서에서 `onReconnectStart` 언급을 제거하고 "`onReconnect`/`onReconnectEnd` 두 콜백만 배선"으로 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 | plan 체크박스가 개명 전 store 메서드명(`deleteEdge`)을 그대로 서술 — 이미 해소된 네이밍 충돌(`workflowsApi.deleteEdge` REST 헬퍼와의 동명 충돌)이 plan 근거로 재도입될 위험. 테스트 개수 서술도 실제(4건)와 다르게 "3건"으로 기재 | `plan/in-progress/spec-sync-edge-gaps.md` §1.3 | `deleteEdge` 2곳을 `removeEdge` 로, 테스트 개수(3→4)를 실제 코드에 맞춰 정정 |
| 2 | 테스트 | 이번 PR 이 새로 도입한 핵심 로직 — 재연결 시 포트색(`edgeData`) 재계산(`buildEdgeDataForConnection`) — 을 어떤 테스트도 검증하지 않음. 4개 `onReconnect` 테스트 모두 `sourceHandle` 은 그대로 두고 `target` 만 바꿔, `sourceHandle` 이 실제로 바뀌는 시나리오(포트색 stale 방지 목적 로직)가 커버되지 않음 | `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` / `editor-store.test.ts` `describe("onReconnect (§1.3)")` | `sourceHandle` 이 실제로 변경되는 재연결 케이스 1개 추가, `edges[0].data` 가 새 `sourceHandle` 기준으로 재계산됐는지 단언 |
| 3 | 테스트 | `detectContainerConflict` 거부(컨테이너 충돌 toast) 경로가 `onConnect`/`onReconnect` 어느 쪽으로도 실제 테스트되지 않음. 직전 라운드 `RESOLUTION.md` 는 "onConnect 경로와 동일 코드라 이미 검증됨"을 스킵 근거로 적었으나, 저장소 전체 grep 결과 `detectContainerConflict` 거부 분기를 실행하는 테스트는 0건 — 스킵 근거 서술 자체가 사실과 다름 | `codebase/frontend/src/lib/stores/editor-store.ts` `evaluateConnectionRejection` / `review/code/2026/07/13/12_40_48/RESOLUTION.md`(testing 행) | 최소 1개(`onConnect` 또는 `onReconnect`) 통합 테스트로 컨테이너 충돌 거부(toast + 엣지 미변경)를 실증. `RESOLUTION.md` 의 "이미 검증됨" 서술도 정정 |
| 4 | 유지보수성 | `evaluateConnectionRejection` 의 `null`(유효)/`""`(조용히 거부)/문자열(거부+toast) 3중 반환이 타입 시스템이 강제하지 않는 암묵적 sentinel 규약 — 현재 두 호출부는 `!== null` && truthy 를 정확히 조합해 올바르게 처리 중이나, 향후 편집 시 `if (rejection)` 단축 실수로 자기연결 케이스가 "유효"로 오판될 위험 | `codebase/frontend/src/lib/stores/editor-store.ts` `evaluateConnectionRejection` 및 호출부(`onConnect`/`onReconnect`) | `null \| { silent: true } \| { message: string }` 또는 `{ ok: boolean; message?: string }` 같은 판별 유니온으로 리팩터해 truthy 단축 실수를 컴파일 타임에 차단 |
| 5 | 리뷰 인프라(disk-write gap) | `architecture`/`documentation`/`user_guide_sync` 3개 리뷰어가 워크플로 매니페스트에는 `status=success` 로 보고됐으나, 해당 `output_file` 이 세션 디렉터리에 실제로 존재하지 않음(`ls` 로 부재 확인, journal.jsonl 등 복구 경로도 없음). 아키텍처(스토어/훅 분리 구조)·문서 전반(CHANGELOG/spec)·유저가이드(mdx) 관점의 실제 발견사항이 이번 통합 보고서에 반영되지 못했다 | `review/code/2026/07/13/13_06_50/{architecture,documentation,user_guide_sync}.md`(파일 부재) | 3개 리뷰어를 타겟 재실행(`--route` 명시 또는 개별 재호출)해 실제 출력을 확보한 뒤 SUMMARY 갱신. 그 전까지 이 3개 관점은 "미확인" 으로 간주하고 병합·머지 판단에 반영하지 말 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/부작용 | `<ReactFlow>` 전역 `onReconnect`/`onReconnectEnd` 배선에 개별 엣지 `reconnectable:false` opt-out 이 없어, 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결·detach 대상이 됨. `Delete` 키 삭제는 기존에도 가능했고, 최종 저장·실행 시 서버측 구조 검증(`CONTAINER_MISSING_EMIT` 등)이 이중 방어로 남아 즉각적 위험은 아님. 직전 라운드에서 이미 수용된 INFO 의 재확인 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 의도된 동작이면 조치 불요. 구조적 필수 배선 보호가 필요하면 향후 `reconnectable:false` 부여 검토 |
| 2 | 회귀 검증 | 직전 라운드 CRITICAL(재연결 드래그가 자기연결/무효 핸들에 드롭 시 기존 엣지 오삭제)은 판정 기준을 success 플래그에서 드롭 위치(`connectionState.toNode`)로 교체해 해소됨을 코드·테스트(vitest 122 passed 직접 실행 확인)로 재확인 | `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts` | 없음(확인 목적) |
| 3 | 테스트 | `removeEdge` 신규 테스트가 "엣지 제거 시 `containerId` 재도출" 부수효과를 검증하지 않음(엣지/undoStack 길이만 확인) | `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("removeEdge (§1.3 detach)")` | 컨테이너 자식 → 유일 진입엣지 `removeEdge` → `containerId` 가 `null` 로 재도출되는지 단언하는 케이스 1개 추가(비용 낮음) |
| 4 | 테스트 인프라 | `vitest run` 은 타입 strip, `tsconfig.json` 은 `*.test.ts` exclude — 신규 테스트 파일의 타입 오류를 어떤 CI 게이트도 잡지 못하는 구조적 사각지대(직전 라운드 `Connection` 미-import 사례의 원인). 이번엔 import 정상이나 사각지대 자체는 미해소 | `codebase/frontend/tsconfig.json`, `package.json` `"test"` 스크립트 | 이번 PR 범위 밖. `tsc --noEmit` 을 test glob 포함하는 별도 스크립트 또는 vitest typecheck 옵션 도입을 별도 트랙으로 이월 |
| 5 | 테스트 | 재연결 경로의 컨테이너 충돌 거부 전용 테스트·reconnect/detach e2e(Playwright) 부재는 이미 직전 라운드에서 트리아지되어 낮은 우선순위로 보류된 잔여 항목(신규 결함 아님) | `codebase/frontend/e2e/`(관련 spec 없음) | 회귀 보고 시 또는 canvas e2e 하네스 도입 시 함께 편입 검토 |
| 6 | 스코프 | `onConnect` 헬퍼 추출(`evaluateConnectionRejection`/`buildEdgeDataForConnection`), `deleteEdge`→`removeEdge` 리네임, `firstInputHandleId` 예약 포트 스킵 강화 등 §1.3 기능 자체 범위 밖으로 보일 수 있는 변경은 모두 직전 라운드(`12_40_48`) 리뷰 피드백 반영 또는 plan/CHANGELOG 에 사전 고지된 항목으로, 임의 확장이 아님 | `editor-store.ts`, `edge-utils.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 보안 취약점 없음. 구조적 엣지 재연결 대상 포함은 INFO(무결성 관찰) |
| requirement | LOW | SPEC-DRIFT 1건(`onReconnectStart`) + WARNING 1건(plan `deleteEdge`) + 검증 통과 다수 |
| scope | NONE | §1.3 구현 + 직전 라운드 반영 범위 내 변경만 확인, 임의 확장 없음 |
| side_effect | LOW | 동일 SPEC-DRIFT/WARNING 재확인 + INFO 2건(구조적 엣지 포함, 무변화 pushUndo) |
| maintainability | LOW | 문서 drift WARNING + `evaluateConnectionRejection` sentinel 규약 WARNING + 다수 긍정 개선 확인 |
| testing | MEDIUM | 신규 핵심 로직(포트색 재계산) 미검증 + 컨테이너 충돌 거부 경로 미검증(RESOLUTION.md 서술 오류) |
| architecture | 재시도 필요 | 출력 파일 디스크 부재(disk-write gap) — 발견사항 확인 불가 |
| documentation | 재시도 필요 | 출력 파일 디스크 부재(disk-write gap) — 발견사항 확인 불가 |
| user_guide_sync | 재시도 필요 | 출력 파일 디스크 부재(disk-write gap) — 발견사항 확인 불가 |

## 발견 없는 에이전트

scope, security — CRITICAL/WARNING/SPEC-DRIFT 없이 INFO 수준 관찰만 존재.

## 권장 조치사항

1. `architecture`/`documentation`/`user_guide_sync` 리뷰어를 타겟 재실행해 disk-write gap 을 복구하고, 실제 발견사항으로 본 SUMMARY 를 갱신할 것 — 그 전까지 이 3개 관점은 미확인 상태이며 클린으로 간주해 병합하지 말 것.
2. `CHANGELOG.md` / `spec/3-workflow-editor/2-edge.md` §1.3 / `plan/in-progress/spec-sync-edge-gaps.md` §1.3 에서 `onReconnectStart` 서술을 제거(SPEC-DRIFT, 코드 변경 불요).
3. `plan/in-progress/spec-sync-edge-gaps.md` 의 `deleteEdge`→`removeEdge` 정정 및 테스트 개수(3→4) 정정.
4. `onReconnect` 의 포트색(`edgeData`) 재계산 로직을 실제로 검증하는 테스트 1건 추가(`sourceHandle` 변경 케이스).
5. `detectContainerConflict` 거부 경로에 대한 최소 1개 통합 테스트 추가 + `review/code/2026/07/13/12_40_48/RESOLUTION.md` 의 스킵 근거 서술 정정.
6. (선택) `evaluateConnectionRejection` 반환 규약을 판별 유니온으로 리팩터해 향후 truthy 단축 실수를 컴파일 타임에 차단.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **제외**: 표 (reviewer · 이유, 5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 프런트엔드 클라이언트 상태(zustand)/콜백 배선 변경으로 성능 관점 해당 사항 낮음(구체적 사유 텍스트는 매니페스트에 미포함) |
  | dependency | router 판단 — 의존성(패키지) 변경 없음 |
  | database | router 판단 — DB/마이그레이션 변경 없음 |
  | concurrency | router 판단 — 서버측 동시성 로직 변경 없음(프런트엔드 단일 스레드 상태관리) |
  | api_contract | router 판단 — API/wire 계약 변경 없음(백엔드 미변경) |