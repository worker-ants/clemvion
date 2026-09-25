# RESOLUTION — review/code/2026/09/25/23_58_59 (3라운드, 전수 `--route=all`)

SUMMARY: Critical 1 · Warning 6 · INFO 19. 14명 전원 결과 확보(forced 7명 누락 없음). Critical 이 있어 조치 후 4라운드로 간다.
W5 하나는 developer SKILL §ISSUE FIX 정책 «수렴 예외» 로 트래커에 등재했다(아래 판정).

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| C1 | rotate 의 락 안 재판정이 통합 행(scope)은 다시 읽지만 요청자 역할은 요청 시작 시점 값 — 연결 테스트(수 초) 동안 강등돼도 Organization 자격 증명 교체가 커밋된다. OAuth 콜백 재판정은 역할도 다시 읽어 비대칭 | **고침 — 맞는 지적.** `plan/complete/rotate-lost-update.md` §D 가 받아들인 것은 **scope** 재판정뿐이고 역할 재조회를 기각한 기록은 없다. Organization 이면 락을 쥔 같은 트랜잭션 커넥션으로 역할을 다시 읽는다(personal 은 역할과 무관해 읽지 않는다). 테스트: 강등 → 403 · 커밋 없음, 본인 personal → 역할 조회 없음 | `a8b5c8b13` |
| W1 | 실행 엔진(`getForExecution`)이 personal 가시성을 안 본다 — UUID 를 아는 Editor 가 노드에 넣어 실행하면 남의 자격 증명으로 외부 호출 | **후속 plan 항목 보강(이 PR 범위 밖 — 사용자 결정 1).** `plan/in-progress/integration-personal-owner-followup.md` 첫 항목에 이 악용 경로와 «저장 시점 검증만으로 대부분 닫힌다» · 경계 캐너리(INFO 11)를 더했다. spec §8 «아직 강제되지 않는 것» 이 이미 명시한다 | (plan 커밋) |
| W2 | OAuth 콜백 재판정의 역할 조회가 행 락을 쥔 채 풀에서 두 번째 커넥션을 빌린다 | **고침** — `WorkspacesService.getMemberRole(workspaceId, userId, manager?)` — 트랜잭션 매니저로 같은 커넥션에서. C1 의 rotate 도 같은 방식 | `a8b5c8b13` |
| W3 | update · remove 의 역할 이중 조회 | **기존 트래커 항목 갱신** — 1라운드 W6 과 같은 지적(«워크스페이스 역할을 가드와 핸들러가 두 번 조회한다»). 전역 `RolesGuard` 변경이라 범위 밖 | (plan 커밋) |
| W4 | `updateScope` 가 공유 판정을 우회하는 이유가 호출부에 없다 — «일관성» 으로 되돌리면 권한 상승 재도입 | **고침** — 호출부 주석(범위 전환은 personal → organization 승격이라 늘 Admin, `assertCanModify` 는 Organization 이 아니면 통과시킨다) | `a8b5c8b13` |
| W5 | `handleCallback` ~310줄에 재판정까지 | **«수렴 예외» 로 트래커 등재** — 아래 판정 | (plan 커밋) |
| W6 | e2e 헤더 invariant 문장 미완성 | **고침** | `a8b5c8b13` |
| INFO 1~19 | 가시성 이중 표현 · 판정 오케스트레이션 · 모듈 경계 · 빈 래퍼 · `judgedRow` 이름 · 조건부 쓰기 뒤 재조회 · 인덱스 · API 계약 변화 · 가이드 동기화 등 | 기록만. INFO 11(실행 경로 경계 캐너리)은 W1 과 함께 후속 plan 에 적었다 | — |

**뮤턴트**(3라운드 조치분, 예측/실측): R13(rotate 가 락 안에서 역할을 다시 읽지 않음) · R14(콜백 역할 조회가 매니저를 안 씀) — 예측 KILLED /
실측 KILLED.

## 수렴 판정 — developer SKILL §ISSUE FIX 정책 «수렴 예외» 적용 (W5)

- **(a) 동작 결함이 아니다** — `handleCallback` 의 크기는 이 PR 이전부터의 구조이고, 재판정은 락 안 한 줄 호출이며 전용 테스트
  (`handleCallback — 사용자가 시작한 재인증 · scope 추가는 커밋 직전에 인가를 다시 본다`, 뮤턴트 R3~R6 · R9 · R10 · R14)가 지킨다.
- **(b) 고치면 새 라운드를 강제한다** — 자격 증명 교체 분기를 private 메서드로 뽑는 것은 민감한 OAuth 콜백의 `codebase/**` 리팩터라
  리뷰 게이트가 다시 무장되고, 이 PR 은 이미 세 라운드째 매 라운드 직전 수정의 인접 표면에서 새 지적을 냈다.
- **(c) 이 조항을 여기 인용한다** — 등재 사유는 비용이 아니라 수렴이다.
- **(d) 등재는 이 턴에 했다** — 트래커 «`IntegrationOAuthService.handleCallback` 이 ~310줄 한 함수다 — 인가 재판정까지 그 안에 산다».

## TEST 결과

마지막 codebase 편집(`a8b5c8b13`) 뒤 전 단계를 다시 돌렸다.

- lint: 통과 (`_test_logs/lint-20260926-001803.log`)
- unit: 통과 — backend 10238 · frontend 6781 (`_test_logs/unit-20260926-001856.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260926-002013.log`)
- e2e: 통과 — 72 스위트 · 405 passed (`_test_logs/e2e-20260926-002255.log`)

## 보류·후속 항목

- W1 · INFO 11 — `plan/in-progress/integration-personal-owner-followup.md` 첫 항목(노드 실행 · 저장 시점).
- W3 — 트래커 «워크스페이스 역할을 가드와 핸들러가 두 번 조회한다»(갱신).
- W5 — 트래커 «`handleCallback` 이 ~310줄 한 함수다»(수렴 예외).
