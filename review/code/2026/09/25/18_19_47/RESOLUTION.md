# RESOLUTION — review/code/2026/09/25/18_19_47 (5라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 3 · INFO 13. 14명 중 6명(security · requirement · scope · dependency · concurrency · user_guide_sync)이
Critical · Warning 0. 라운드 전 선언한 판정 규칙: «동작 결함이 하나라도 있으면 고친다, 남은 것이 전부 구조 · 문서 · 테스트 형태면
수렴 예외». 이 라운드의 Warning 셋은 동작 결함이 아니다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W3 | CHANGELOG 의 `@Roles` 라우트 수가 머지 시점과 다름 | **고침 — 리뷰어 수치도 다시 쟀다.** AST 실측: 머지 시점 88곳(editor 63 · admin 17 · owner 4 · viewer 4), `origin/main` 79곳(63 · 9 · 3 · 4). 차이 9 = 이 PR 이 붙인 admin 8 · owner 1. **spec 의 같은 수치(66 · 9 · 7 · 5)는 결정 당시 main 기준으로도 틀렸다** — planner 턴(`--spec` `review/consistency/2026/09/25/18_35_55`)으로 정정. CHANGELOG · spec 모두 codebase 밖이라 리뷰 라운드를 새로 만들지 않는다 | (마무리 커밋) |
| W1 | `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 의 메타데이터 조회 골격 중복 | **수렴 예외로 등재** — 아래 판정 | — |
| W2 | 403 설명 상수가 공유 거부 표의 `.code` 를 보간하지 않음 | **수렴 예외로 등재** — 아래 판정 | — |
| INFO 4 · 6 | `throwOwnerTransferRequired` 가 공유 상수를 펼치지 않음 · 서비스 고유 문구 unit 미고정 | W1 · W2 와 같은 등재 항목에 함께 적는다 | — |
| 그 외 INFO | 1~3 · 5 · 7~13 | 기록만. INFO 8(`transferOwnership` docstring «단일 IN 쿼리» 서술 vs 순차 락)은 이 PR 이전부터의 서술 부채라 같은 등재 항목에 적는다 | — |

## 수렴 판정 — developer SKILL §ISSUE FIX 정책 «수렴 예외» 적용

W1 · W2 는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **이 턴에** 등재하고 이 PR 에서는 고치지 않는다. 네 조건:

- **(a) 동작 결함이 아니다** — W1 은 5줄 조회 골격의 중복이고 두 함수는 각자 테스트 · 뮤턴트(M8 · M9 · MB · MB2)와 부트 캐너리의 분리
  카운트가 지킨다. W2 는 OpenAPI 설명 문자열의 수작업 동기화다. 재현되는 오동작이 없다. 발견의 성격도 라운드를 따라 동작(3 · 4라운드:
  두 번째 선의 코드 · `transferOwnership` 오라클) → 구조 · 문서(5라운드)로 옮겼다.
- **(b) 고치면 새 라운드를 강제한다** — 둘 다 `codebase/**` 편집이라 리뷰 게이트의 freshness 가 다시 무장된다. 이 PR 은 이미 다섯 라운드를
  돌았고, 매 라운드가 직전 수정의 인접 표면에서 같은 크기의 구조 지적을 새로 냈다.
- **(c) 이 조항을 여기 인용한다** — 등재 사유는 비용이 아니라 수렴이다.
- **(d) 등재는 이 턴에 한다** — 트래커 항목 «경로 워크스페이스 가드 후속 — reflection 골격 · 403 설명 코드 보간 · 서비스 문구»(신설).

## TEST 결과

마지막 codebase 편집(`61ca58343`) 뒤 전 단계를 돌렸고, 그 뒤로는 spec · plan · CHANGELOG · review 산출물만 바뀌었다.

- lint: 통과 (`_test_logs/lint-20260925-180828.log`, frontend 포함)
- unit: 통과 — backend 10058 passed (`_test_logs/unit-20260925-180948.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-181121.log`)
- e2e: 통과 — 71 스위트 · 391 passed (`_test_logs/e2e-20260925-181424.log`)

## 보류·후속 항목

- W1 · W2 · INFO 4 · 6 · 8 — 위 트래커 항목(수렴 예외).
