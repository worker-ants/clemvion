# RESOLUTION — review/code/2026/09/25/17_14_49 (3라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 6 · INFO 14. 조치는 main 이 직접 했다. 정지 규칙상 이 라운드도 수정이 있었으므로 4라운드를 돈다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W1 | 서비스 `assertAdmin` 이 비멤버에게 `ADMIN_REQUIRED` — 이 PR 의 규칙 (나)를 두 번째 선이 어기고, 이 PR 이 더한 테스트가 그 값을 고정 | **고침** — 멤버십과 역할을 나눴다(`removeMember` 와 같은 모양). 영향: `renameWorkspace` · `updateWorkspaceSettings` · `addMemberByEmail` · `updateMemberRole` 의 비멤버 → `NOT_A_MEMBER`. HTTP 로는 가드가 먼저 막아 wire 응답은 이미 `NOT_A_MEMBER` 였다. 테스트 셋을 새 계약으로 바꿔 RED 확인 후 고쳤다. 뮤턴트 S1(종전 결합) KILLED | `dc60b1af8` |
| W2 | 정적 가드가 이름 휴리스틱에만 의존 | **변경 없음 — spec 이 정한 알려진 한계다.** `spec/data-flow/12-workspace.md` §Rationale «경로 파라미터 워크스페이스도 가드가 본다» 가 «이름이 규칙 밖(`id` 등)이면 못 보는 것이 이 가드의 한계다» 로 적었고, 허용목록 방식은 `@Param` 전부(130건)에 대해 «워크스페이스인가» 를 사람이 판정하는 목록이 돼 그 절이 기각한 opt-in 모양으로 돌아간다. 그 한계를 넘는 강화는 spec 결정(planner) 사안이다 | — |
| W3 | 가드+서비스 이중 조회(15 라우트, `leaveWorkspace` 최대 4~5회) | **변경 없음 — 1 · 2라운드와 같은 근거.** 추가 조회는 유니크 인덱스(`@Unique(['workspaceId','userId'])`, e2e `entity-schema-declarations` 가 DB 대조) 조회이고 대상은 저빈도 관리 라우트다. `leaveWorkspace` 의 수: 가드 1 · 서비스 인가 선행 1(이 PR — 오라클 제거) · 워크스페이스 1 · 트랜잭션 락 1 · owner 일 때 owner 목록 1. 서비스 검사는 spec 이 정한 두 번째 선이라 가드의 role 을 넘겨받지 않는다 | — |
| W4 | `@WorkspaceId()` 소비 판별이 모든 경로에서 선계산 | **고침** — 필요한 분기에서만(종전 `&&` 단축과 같은 비용). 뮤턴트 S3 KILLED | `dc60b1af8` |
| W5 | 공용 `decoratorCallName` 직접 테스트 없음 | **고침** — 호출형 · 비-호출형(`null`) · 다른 이름. 뮤턴트 S4 KILLED | `dc60b1af8` |
| W6 | `param-uuid-pipe` 측정 주석이 모집단 이동 미반영 | **고침** — (2026-09-25 보탬) 실측: `@Param` id-형 121 = 맨 식별자 107 : 인스턴스화 14, `@WorkspaceParam` 15 | `dc60b1af8` |
| INFO 2 | `getWorkspaceSettings` 인라인 `FORBIDDEN` | **고침** — `NOT_A_MEMBER`(spec `9-user-profile.md` §6.1 · 가드와 같게). 뮤턴트 S2 KILLED | `dc60b1af8` |
| INFO 6 · 7 | e2e 의 `NIL_WS` 재선언 · admin 승격 setup 의도 | **고침** — 공유 fixture import · 주석 | `dc60b1af8` |
| INFO 1 | `ADMIN_ROLES` 를 `ReadonlySet<WorkspaceRoleName>` 로 | **변경 없음** — `Set<'admin'\|'owner'>.has(string)` 은 타입 오류라 호출부마다 캐스트가 필요해진다. 값은 서열에서 파생되므로 SoT 는 이미 하나다 | — |
| 그 외 INFO | 3~5 · 8~14 | 기록만(도달 불가 조합 · 기존 트래커 등재 · 기존 수용 한계) | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260925-173554.log`)
- unit: 통과 — backend 10046 passed (`_test_logs/unit-20260925-173654.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-173827.log`)
- e2e: 통과 — 71 스위트 · 390 passed (`_test_logs/e2e-20260925-174124.log`)

## 보류·후속 항목

없음.
