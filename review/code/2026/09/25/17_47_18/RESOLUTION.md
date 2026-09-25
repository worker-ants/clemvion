# RESOLUTION — review/code/2026/09/25/17_47_18 (4라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 8 · INFO 15. 라운드 전 선언한 판정 규칙: «동작 결함이 하나라도 있으면 고친다, 남은 것이 전부 구조 ·
문서 · 테스트 형태면 수렴 예외». W3 이 동작 결함(두 번째 선의 존재 · 유형 오라클)이라 고쳤고, 같은 라운드에 싼 항목을 함께 넣었다.
수정이 있었으므로 5라운드를 돈다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W3 | `transferOwnership` 이 인가 전에 워크스페이스를 조회 — 세 번째 오라클 | **고침(동작 결함)**. 비멤버 · 비-owner 멤버 × 부재 · 개인 · 팀 6케이스를 먼저 써서 RED 6 확인 → 트랜잭션 밖 무락 인가 선행(락 재검사 유지, `leaveWorkspace` 와 같은 모양) → GREEN. 락 테스트는 «첫 조회는 무락 인가 선행, 트랜잭션 안은 전부 락» 으로 정확히 했다. e2e 오라클 표에 `transfer-ownership` 추가. 뮤턴트 T1 · T2 KILLED. spec 의 «두 메서드» 실측은 planner 턴(`--spec` `review/consistency/2026/09/25/18_07_58` BLOCK: NO, 커밋 `4c6f4f033`)으로 정정 | `1f616ef05` |
| W4 | 다중 `@WorkspaceParam` + `@Roles()` 조합 미고정 | **고침** — 각 워크스페이스에서 요구를 충족해야 통과. 처음 쓴 케이스(미달이 한 자리)는 «첫째에만 역할 적용» 뮤턴트 T3 를 **못 잡았다**(SURVIVED — 메타데이터 순서상 첫째가 그 자리였다). 반대 자리 케이스를 더해 T3 · T4 KILLED | `1f616ef05` · `61ca58343` |
| W5 | `addMemberByEmail` 의 비-admin 멤버 × 유형 미검증 | **고침(커버리지)** — 동작은 이미 맞았다(추가 즉시 GREEN) | `1f616ef05` |
| W2 | DTO `WORKSPACE_ROLES` 가 서열에서 파생 안 됨 | **고침** — `satisfies readonly WorkspaceRoleName[]`(서열 밖 이름은 컴파일 오류), 반대 방향은 기존 `workspace-roles.spec.ts`. 순서는 OpenAPI enum 표시 순서라 파생하지 않았다 | `1f616ef05` |
| W6 | frontend `role-gate.tsx` 주석이 지운 `ROLE_HIERARCHY` 를 가리킴 | **고침** — 새 위치(`WORKSPACE_ROLE_LEVEL`)로 | `1f616ef05` |
| W1 | 이중 조회 비용 실측 | **변경 없음 — 1~3라운드와 같은 근거**(유니크 인덱스 조회 · 저빈도 관리 라우트 · 두 번째 선의 독립성) | — |
| W7 | 비멤버 `code` 일괄 변경(외부 소비자) | **변경 없음** — CHANGELOG 가 전역 범위 · 수치 · «`error.code` 로 분기하는 클라이언트는 확인할 것» 을 적었다(2라운드 W8) | — |
| W8 | 유저 가이드 동반 갱신 | **변경 없음** — 검토 후 갱신 불필요, 근거는 plan §구현 중 결정(1라운드 W8) | — |
| INFO | 1~15 | 기록만. INFO 8(공유 상수 freeze)은 소비처가 전부 `.has()`/펼침이라 보류 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260925-180828.log`, frontend 포함)
- unit: 통과 — backend 10058 passed (`_test_logs/unit-20260925-180948.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-181121.log`)
- e2e: 통과 — 71 스위트 · 391 passed (`_test_logs/e2e-20260925-181424.log`)

## 보류·후속 항목

없음.
