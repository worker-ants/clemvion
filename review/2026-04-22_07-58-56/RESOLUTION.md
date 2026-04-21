# 리뷰 이슈 조치 내역 — 2026-04-22 (ShadowWorkflow cycle 예외)

대상 리뷰: `review/2026-04-22_07-58-56/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견 | 조치 | 위치 |
|---|----------|------|------|------|
| W1 | Security/Architecture/Side Effect/Requirement | 포트 미검증 — 예외가 `emit` 외 포트에도 적용 | 모듈 상수 `CONTAINER_LOOPBACK_PORTS = new Set(['emit'])` 선언. `shouldBypassCycleCheck(source, target, targetPort)` 가 포트까지 확인한 뒤 조상 관계를 검사. spec §4.4 에 "target 포트가 `emit` 일 때만 허용, 그 외는 통상 cycle 판정 유지" 명시 | `shadow-workflow.ts`, spec §4.4 |
| W3 | Testing | 기존 loopback edge 상태에서 외부→컨테이너 에지 허용 경로 미검증 | `keeps an existing loopback edge out of the reachability graph` 케이스 추가 (loop.body→child, child→loop.emit 에지가 존재하는 상태에서 ext→loop.in 허용) | shadow-workflow.spec.ts |
| W4 | Testing/Requirement | 중첩 조상 loopback 테스트의 pre-existing edge 부재 | 기존 "nested children to ancestor" 테스트는 유지하되, false-positive 방지 경로는 W3 신규 케이스 + "rejects edge from a child to an unrelated (non-ancestor) container" 케이스가 실제로 `loopA.body → childA` + `loopB → loopA` 사전 에지로 진짜 cycle 을 만들어 검증 | 동일 |
| W5 | Testing | 손상된 containerId 순환 체인 방어 미검증 | `tolerates corrupted containerId chains (A↔B)` 케이스 추가 (A.containerId=B, B.containerId=A 에서 X→A 에지가 무한루프 없이 허용되는지) | 동일 |
| W6 | Testing | "allows" 케이스 snapshot 상태 미검증 | `records the loopback edge in the snapshot with correct ports` 케이스 추가 + W3 케이스에서 `sw.snapshot().edges` 길이 검증 | 동일 |
| W7 | Architecture/Maintainability | 우회 규칙이 addEdge·wouldCreateCycle 두 곳에 분산 | `shouldBypassCycleCheck(sourceId, targetId, targetPort)` 단일 술어 추출. 양쪽이 동일 술어를 호출 | shadow-workflow.ts |
| W8 | Performance | DFS 내부에서 매 에지마다 `isAncestorContainer` (Set 생성) 호출 → O(V×E) | `collectBypassableEdgeIds()` 로 bypass 대상 edge id 를 **한 번 pre-compute** 후 DFS 는 O(1) `has()` 체크만 | 동일 |
| W9 | Maintainability | addEdge 이중 중첩 if | `&&` 로 단일 조건 병합 | 동일 |
| I1/I5/I6 | Documentation/Maintainability | JSDoc 태그 누락, `cur` 재참조 혼동, 파라미터명 방향 모호 | `isAncestorContainer(descendantId, candidateAncestorId)` 로 이름·시그니처 명확화. `@param`/`@returns` 태그 추가 | shadow-workflow.ts |
| I9 | Architecture | containerId 체인 깊이 무제한 | 모듈 상수 `MAX_CONTAINER_DEPTH = 64` 로 안전 상한 추가 (visited Set 방어와 병행) | 동일 |

## 스코프 밖

| # | 이유 |
|---|------|
| W2 | `containerId` 클라이언트 조작 방어 — Shadow 레이어는 영구 저장 전 검증이라 즉각 필수는 아님. 서버 측 cross-validation 은 별도 보안 설계 과제 |
| I2/I3 | 주석 언어 혼용, spec 표 가독성 — 전사 컨벤션 결정 사안 |
| I4 | 테스트 픽스처 보일러플레이트 — 별도 테스트 리팩터 라운드 |
| I7 | spec §4.3 `sourceId` vs `source_id` 네이밍 — 기존 이슈, 별도 과제 |
| I10 | CLAUDE.md 멀티라인 주석 컨벤션 — JSDoc 의 설계 의도 전달 가치가 커서 유지 |
| I11 | 중간 컨테이너 노드의 조상 loopback — 현재 "nested children to ancestor" 테스트가 grandchild 경로를 이미 커버 |
| I12 | 주석의 spec 경로 누락 — spec §4.4 명시는 코드 주석에 이미 적용 |

## 검증

- `npx eslint "src/**/*.ts"` backend → 통과
- `npx jest src/modules/workflow-assistant/tools/shadow-workflow` → **24 통과** (기존 20 + 신규 4: emit 외 포트 차단 / 기존 loopback 존재 시 외부→컨테이너 허용 / 손상 containerId 체인 / snapshot 기록 검증)
- `npx jest` backend 전체 → **1565 통과**
- `npx nest build` → 통과

## E2E 검증 (사용자 확인 필요)

1. Loop 컨테이너 + 내부 자식 노드 구성에서 `add_edge(child → loop, target_port: 'emit')` 성공 여부
2. 중첩 Foreach > Loop > child 구조에서 `add_edge(grandchild → outer.emit)` 성공 여부
3. `target_port: 'in'` 으로 되돌아가는 에지는 기존처럼 `CYCLE_DETECTED` 거부 — iteration 의도가 아닌 오염 에지 차단
